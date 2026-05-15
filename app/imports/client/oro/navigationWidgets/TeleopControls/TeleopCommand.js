/**
 * Copyright 2026 InOrbit, Inc.
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

/**
 * Teleoperation components (arrows and joystick).
 * Converted from class component to functional component.
 * Direct teleop via MQTT is always used (doMqttGo path only).
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Meteor } from 'meteor/meteor';
import { throttle, isNumber } from 'lodash';
import PropTypes from 'prop-types';
// ORO Modules
import NavigationJoystick from './NavigationJoystick';

// minimal distance joystick must move to trigger robot movement
// this directly translates to the minimum velocity as a percentage of the max velocity
const JOYSTICK_MIN_THRESHOLD = 0.2;
// This value sets a maximum displacement from the joystick center
// Values greater than 1 and up to max are turned to 1, anything greater is discarded
// This is a safety measure to prevent accidental teleop due to misclicking
const JOYSTICK_MAX_THRESHOLD = 2;
// Minimal value in one particular direction for the joystick to send movement
// signals to the agent, effectively acts as a "noise" filter, reducing sensitivity
const JOYSTICK_NOISE_THRESHOLD = 0.1;
// movement started event
const JOYSTICK_MOVEMENT_START = 'move';
// movement ended event
const JOYSTICK_MOVEMENT_ENDED = 'end';
// time between continuous signals sent to the agent
const CONTINUOUS_CALL_FREQ = 200; // ms

function TeleopCommand(props) {
  const {
    stepByStep, disableControls,
    badNetwork, controlsDimensions, teleopMode, stepwiseMode,
    precisionCallbacks, isZeroData, robotId, onFeedback, getTsHint: getTsHintProp
  } = props;

  const [temporaryDisabled, setTemporaryDisabled] = useState(false);

  // Variables to track changes on the joystick separate from the react lifecycle
  const linearVelocityRef = useRef(0);
  const angularVelocityRef = useRef(0);
  const teleopActiveRef = useRef(false);
  const continuityTimerRef = useRef(null);
  const timeoutRef = useRef(null);

  /** Helper function to clear the timer */
  const stopTimer = useCallback(() => {
    if (continuityTimerRef.current) {
      clearTimeout(continuityTimerRef.current);
      continuityTimerRef.current = null;
    }
  }, []);

  // Clear both timers on unmount; prevents MQTT commands or state updates
  // from firing after the component is gone (e.g. user navigates away mid-movement)
  useEffect(() => {
    return () => {
      stopTimer();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [stopTimer]);

  // Teleop GO via server-side method. Browser MQTT credentials are subscribe-only,
  // so publishing must go through the server which holds superuser broker creds.
  const doMqttGo = useCallback(({ tsHint, linearVelocity, angularVelocity }) => {
    Meteor.call('robot.continuousGoTeleop', {
      robotId, tsHint, linearVelocity, angularVelocity
    }, (error) => {
      if (error) {
        onFeedback?.(error.error || 'Error sending teleop go');
        console.error(error);
      }
    });
  }, [robotId, onFeedback]);

  /**
   * Wrapper method to fetch tsHint.
   */
  const getTsHint = useCallback(() => {
    if (getTsHintProp) return getTsHintProp();
    return 0;
  }, [getTsHintProp]);

  // Drive the continuous teleop loop. The loop terminates when teleopActiveRef
  // is set false on the joystick `end` event or on arrow release (stopMove).
  const teleopGoCall = useCallback((calledByTimer = false) => {
    if (!calledByTimer) stopTimer();
    const tsHint = getTsHint();

    doMqttGo({
      tsHint,
      linearVelocity: linearVelocityRef.current,
      angularVelocity: angularVelocityRef.current
    });
    if (!continuityTimerRef.current) {
      continuityTimerRef.current = setTimeout(() => {
        continuityTimerRef.current = null;
        if (teleopActiveRef.current) {
          throttledTeleopCallRef.current(true);
        }
      }, CONTINUOUS_CALL_FREQ);
    }
  }, [doMqttGo, getTsHint, stopTimer]);

  // Throttled teleop call, recreated via effect when teleopGoCall changes so it
  // never captures a stale closure (e.g. if robotId changes mid-session)
  const throttledTeleopCallRef = useRef(null);
  useEffect(() => {
    throttledTeleopCallRef.current = throttle(teleopGoCall, CONTINUOUS_CALL_FREQ);
    return () => throttledTeleopCallRef.current?.cancel();
  }, [teleopGoCall]);

  const temporaryDisableControlsStart = useCallback(() => {
    setTemporaryDisabled(true);
  }, []);

  const temporaryDisableControlsEnd = useCallback(() => {
    setTemporaryDisabled(false);
  }, []);

  /**
   * Provided one of the 4 supported directions (-1, 0, 1, 2)
   * sends a teleop command to the agent to move one step in said
   * direction:
   * 0: Move forward
   * 2: Move backward
   * -1: Rotate CounterClockwise
   * 1: Rotate Clockwise
   * If stepbystep is enabled, this method will block the arrow buttons and
   * prevent the method being called more than once per 2.5s.
   */
  const teleopStepCall = useCallback((direction) => {
    const tsHint = getTsHint();
    // Disable controls when in step by step mode
    if (stepByStep) temporaryDisableControlsStart();
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    // Re-enable controls after the step
    timeoutRef.current = setTimeout(() => {
      temporaryDisableControlsEnd();
    }, 2500);
    Meteor.call('robot.teleopStep', {
      robotId,
      tsHint,
      direction,
    }, (error) => {
      if (error) {
        onFeedback?.(error.error || 'Error sending teleop step');
        console.error(error.error);
      }
    });
  }, [getTsHint, stepByStep, temporaryDisableControlsStart, temporaryDisableControlsEnd, robotId, onFeedback]);

  // Continuous arrow handlers: set velocity vector and kick off the MQTT throttle loop.
  // Used when stepByStep is false so holding an arrow drives ros/teleop/go like the joystick.
  const startMove = useCallback((linear, angular) => {
    teleopActiveRef.current = true;
    linearVelocityRef.current = linear;
    angularVelocityRef.current = angular;
    throttledTeleopCallRef.current?.();
  }, []);

  const stopMove = useCallback(() => {
    teleopActiveRef.current = false;
    linearVelocityRef.current = 0;
    angularVelocityRef.current = 0;
  }, []);

  const teleopCallbacks = stepByStep ? {
    forwardCallback: () => teleopStepCall(0),
    backwardCallback: () => teleopStepCall(2),
    leftCallback: () => teleopStepCall(1),
    rightCallback: () => teleopStepCall(-1)
  } : {
    forwardCallback: () => startMove(1, 0),
    backwardCallback: () => startMove(-1, 0),
    leftCallback: () => startMove(0, 1),
    rightCallback: () => startMove(0, -1)
  };

  /**
   * Event handler for the joystick movement events.
   * Depending on the event and data available, will send to the agent movement commands.
   */
  const handleJoystickMove = useCallback((evt, data) => {
    if (evt.type == JOYSTICK_MOVEMENT_START) {
      if (!data || !isNumber(data.force)) return;
      // SAFETY MEASURE: Make sure movements are intended by having a min/max displacement check
      if (data.force >= JOYSTICK_MIN_THRESHOLD && data.force < JOYSTICK_MAX_THRESHOLD) {
        teleopActiveRef.current = true;
        const force = data.force > 1 ? 1 : data.force;
        const angle = data.angle.radian;

        // Calculate Velocities as percentages of the maximum configured velocity
        linearVelocityRef.current = Math.round(force * Math.sin(angle) * 1000) / 1000;
        linearVelocityRef.current = Math.abs(linearVelocityRef.current) > 1
          ? Math.sign(linearVelocityRef.current) : linearVelocityRef.current;
        // SAFETY MEASURE: Sensitivity rounding
        linearVelocityRef.current = Math.abs(linearVelocityRef.current) > JOYSTICK_NOISE_THRESHOLD
          ? linearVelocityRef.current : 0;

        angularVelocityRef.current = Math.round(-1 * force * Math.cos(angle) * 1000) / 1000;
        angularVelocityRef.current = Math.abs(angularVelocityRef.current) > 1
          ? Math.sign(angularVelocityRef.current) : angularVelocityRef.current;
        // SAFETY MEASURE: Sensitivity rounding
        angularVelocityRef.current = Math.abs(angularVelocityRef.current) > JOYSTICK_NOISE_THRESHOLD
          ? angularVelocityRef.current : 0;

        throttledTeleopCallRef.current();
      } else {
        teleopActiveRef.current = false;
        angularVelocityRef.current = 0;
        linearVelocityRef.current = 0;
      }
    } else if (evt.type == JOYSTICK_MOVEMENT_ENDED) {
      teleopActiveRef.current = false;
      angularVelocityRef.current = 0;
      linearVelocityRef.current = 0;
    }
  }, []);

  const {
    forwardCallback, backwardCallback, leftCallback, rightCallback
  } = stepwiseMode ? precisionCallbacks : teleopCallbacks;

  const disableControlsProp = temporaryDisabled || disableControls || badNetwork;

  return (
    <div
      style={{
        height: controlsDimensions.height,
        width: controlsDimensions.width
      }}
    >
      <NavigationJoystick
        disabled={disableControlsProp}
        forwardCallback={forwardCallback}
        backwardCallback={backwardCallback}
        leftCallback={leftCallback}
        rightCallback={rightCallback}
        onJoystickMove={handleJoystickMove}
        onContinuousStop={stepByStep ? undefined : stopMove}
        teleopMode={teleopMode}
        stepwiseMode={stepwiseMode}
        stepByStep={stepByStep}
        isZeroData={isZeroData}
      />
    </div>
  );
}

TeleopCommand.propTypes = {
  getTsHint: PropTypes.func,
  robotId: PropTypes.string,
  onFeedback: PropTypes.func,
  stepByStep: PropTypes.bool,
  disableControls: PropTypes.bool,
  badNetwork: PropTypes.bool,
  controlsDimensions: PropTypes.object,
  teleopMode: PropTypes.bool,
  stepwiseMode: PropTypes.bool,
  isZeroData: PropTypes.bool,
  precisionCallbacks: PropTypes.object
};

export default TeleopCommand;
