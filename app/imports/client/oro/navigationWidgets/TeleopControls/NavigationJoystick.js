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
 * Navigation joystick
 * Simple, controlled component that displays 4 directions control arrows and a nipple control.
 *
 * Utilizes callbacks to handle user clicks and joystick movement.
 */
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { IconButton, useTheme } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { ArrowUp, ArrowRight, ArrowDown, ArrowLeft } from 'lucide-react';
// ORO Modules
import NippleJoystick from '../../../lib/NippleJoystick';

const ROW_HEIGHT = '55px';

const useStyles = makeStyles()(theme => ({
  outerRing: {
    borderRadius: '50%',
    height: '100%',
    border: `${theme.palette.text.mutedDark} solid 2px`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerRingStepwiseMode: {
    border: `${theme.palette.teleopArrows.stepwise} solid 2px`,
  },
  outerRingTeleopMode: {
    border: `${theme.palette.teleopArrows.teleop} solid 2px`,
  },
  disabled: {
    opacity: '0.5'
  },
  backgroundCircle: {
    background: theme.palette.background.navDark,
    borderRadius: '50%',
    height: 'calc(100% - 4px)',
    width: 'calc(100% - 4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column'
  },
  rowContainer: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    height: ROW_HEIGHT,
    width: '100%',
  },
  nippleContainer: {
    width: '100%',
    maxWidth: ROW_HEIGHT,
    height: '100%'
  },
  iconButtonRoot: {
    fontSize: '3rem',
    color: theme.palette.text.muted
  },
  arrowTeleopMode: {
    color: theme.palette.teleopArrows.teleop
  },
  arrowStepwiseMode: {
    color: theme.palette.teleopArrows.stepwise
  },
  iconButton: {
    height: ROW_HEIGHT,
    width: ROW_HEIGHT
  }
}));

/**
 * Counts the amount of seconds the button is pressed calculating the difference between the
 * current time with the time the button was first pressed (timeStart).
 * Adds one unit every second that has passed.
 */
const simulateAcceleration = timeStart => Math.floor((Date.now() - timeStart) / 1000) + 1;

/**
 * Receives a callback to be executed when the user interacts with the button.
 * Returns event handlers to be passed to the button.
 */
function useLongPress(callback, onStop) {
  const [startLongPress, setStartLongPress] = useState(false);
  const [timeoutId, setTimeoutId] = useState();
  const [timeStart, setTimeStart] = useState();

  useEffect(() => {
    if (startLongPress) {
      if (!timeoutId) {
        const timerId = setInterval(() => callback(simulateAcceleration(timeStart)), 500);
        setTimeoutId(timerId);
      }
    } else {
      clearInterval(timeoutId);
      setTimeoutId();
    }
    return () => clearInterval(timeoutId);
  }, [callback, startLongPress, timeStart]);

  // When the user presses the button
  const start = useCallback(() => {
    setStartLongPress(true);
    setTimeStart(Date.now());
  }, []);

  // When the user stops pressing the button
  const stop = useCallback(() => {
    setStartLongPress(false);
    setTimeStart();
    onStop?.();
  }, [onStop]);

  return {
    onMouseDown: start,
    onMouseUp: stop,
    onMouseLeave: stop,
    onTouchStart: start,
    onTouchEnd: stop,
    onClick: callback,
  };
}

/**
 * Helper function to tie a callback to various related mouse events
 */
const makeEventsToCallbacksObject = (callback) => ({
  onMouseDown: callback,
  onTouchStart: callback,
  onClick: callback,
});

/**
 * Auxiliary function that adds styles to an element
 *
 * @param {object} element element you want to add styles
 * @param {object} elementStyles styles that you want to add to the element
 */
const setStylesOnElement = (element, elementStyles) => Object.assign(element.style, elementStyles);

// Module-level counter for unique joystick DOM ids; avoids the collision risk
// of Math.random() * 100 when multiple joystick instances are rendered simultaneously
let _joystickIdCounter = 0;

// Size of the nipple joystick background
const JOYSTICK_BACKGROUND_SIZE = '45px';

// Size of the joystick front (the stick that points out of the joystick)
const JOYSTICK_FRONT_SIZE = '55px';

/**
 * Adapts the joystick from nipplejs library to match our design.
 * @param {object} joystickUi element with the nipplejs joystick elements back and front
 * @param {object} props Active props the joystick has { stepwise, teleop, darkmode, theme }
 */
const createJoystickStyle = (joystickUi, props = {}) => {
  /**
   * Joystick front and back nodes.
   * front is the node that the user moves, it is a circle that the user can interact with.
   * back is the node that represents the background of the joystick, in this style it tries to
   * imitate a hole where the stick of the joystick is placed.
   */
  const { front, back } = joystickUi;
  const { teleopMode, stepwiseMode, theme, stepByStep } = props;

  setStylesOnElement(back, {
    boxShadow: 'inset 2px 2px 2px rgba(0, 0, 0, 0.5)',
    width: JOYSTICK_BACKGROUND_SIZE,
    height: JOYSTICK_BACKGROUND_SIZE,
    marginLeft: `calc(-${JOYSTICK_BACKGROUND_SIZE} / 2)`,
    marginTop: `calc(-${JOYSTICK_BACKGROUND_SIZE} / 2)`,
    background: teleopMode ? theme.palette.background.navDark : theme.palette.teleopArrows.baseArrow
  });

  let frontBorder = 'initial';
  if (stepwiseMode && !stepByStep) frontBorder = `2px solid ${theme.palette.teleopArrows.stepwise}`;
  if (teleopMode) frontBorder = `2px solid ${theme.palette.teleopArrows.teleop}`;
  const lightGradient = 'radial-gradient(113.54% 113.54% at 40.33% 15.25%, #FFFFFF 0%, #FAFAFA 26.38%, #ECECEC 57.1%, #D5D5D5 89.86%, #CCCCCC 100%)';
  setStylesOnElement(front, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 1,
    width: JOYSTICK_FRONT_SIZE,
    height: JOYSTICK_FRONT_SIZE,
    marginLeft: `calc(-${JOYSTICK_FRONT_SIZE} / 2)`,
    marginTop: `calc(-${JOYSTICK_FRONT_SIZE} / 2)`,
    background: teleopMode ? theme.palette.background.navDark : lightGradient,
    border: frontBorder
  });

  // Teleop mode inner gradient, light and dark mode
  const frontDecoratorChild = front.childNodes[0] ? front.childNodes[0] : document.createElement('div');
  const darkInnerGradient = 'radial-gradient(113.31% 113.31% at 59.66% 84.68%, #1A1230 0%, #150E26 21.38%, #110B1F 40.82%, #0E0918 59.53%, #0E0918 100%)';
  const lightInnerGradient = 'radial-gradient(113.31% 113.31% at 59.66% 84.68%, #FFFFFF 0%, #FBFBFB 21.38%, #F0F0F0 40.82%, #DEDEDE 59.53%, #C4C4C4 77.77%, #A3A3A3 95.52%, #999999 100%)';
  setStylesOnElement(frontDecoratorChild, {
    height: 'calc(100% - 10px)',
    width: 'calc(100% - 10px)',
    borderRadius: '50%',
    opacity: 1,
    background: teleopMode ? darkInnerGradient : lightInnerGradient,
    border: teleopMode ? `1px solid ${theme.palette.teleopArrows.teleop}` : 'initial'
  });

  // Only append if not already in the DOM; appendChild on an existing child
  // would move it, which is harmless now but fragile if nipplejs adds sibling nodes
  if (!front.childNodes[0]) front.appendChild(frontDecoratorChild);
};

function NavigationJoystick(props) {
  const {
    disabled, forwardCallback, backwardCallback, onJoystickMove, onContinuousStop,
    leftCallback, rightCallback, stepByStep, teleopMode, stepwiseMode
  } = props;
  const { classes } = useStyles();
  const theme = useTheme();
  const mutationObserver = useRef(null);
  const joystickRef = useRef(null);

  // We utilize a unique node id because the mutation observer has issues handling react refs.
  // Using a module counter instead of Math.random() * 100 to avoid id collisions when
  // multiple joystick instances render at the same time (e.g. robot grid view)
  const uniqueNodeId = useMemo(() => `joystick-${++_joystickIdCounter}`, []);

  useEffect(() => {
    // Mutation Observers detect any changes in the DOM
    mutationObserver.current = new MutationObserver(((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation?.target?.id === uniqueNodeId) window.dispatchEvent(new Event('resize'));
      });
    }));
    if (mutationObserver.current && joystickRef.current) {
      mutationObserver.current.observe(document.getElementById(uniqueNodeId), {
        attributes: true,
        characterData: true,
        childList: true,
        subtree: true,
        attributeOldValue: true,
        characterDataOldValue: true
      });
    }
    return () => {
      mutationObserver.current?.disconnect();
    };
  // joystickRef.current intentionally excluded; React does not track ref mutations,
  // so including it in deps does not guarantee re-runs. The getElementById call inside
  // already handles the case where the element may not yet exist.
  }, [uniqueNodeId]);

  // nipplejs v1 uses a Collection (Map-based), not an array — use getJoystickByUid()
  const applyJoystickStyle = useCallback(() => {
    const joystick = joystickRef.current?.joystick?.getJoystickByUid();
    if (joystick?.ui) {
      createJoystickStyle(joystick.ui, {
        stepwiseMode, teleopMode, theme, stepByStep
      });
    }
  }, [stepwiseMode, teleopMode, theme, stepByStep]);

  useEffect(() => {
    applyJoystickStyle();
  }, [applyJoystickStyle]);

  // All four useLongPress hooks are called unconditionally at the component level
  // to comply with the Rules of Hooks.
  // When stepByStep is true, makeEventsToCallbacksObject is used instead.
  const forwardLongPress = useLongPress(forwardCallback, onContinuousStop);
  const leftLongPress = useLongPress(leftCallback, onContinuousStop);
  const rightLongPress = useLongPress(rightCallback, onContinuousStop);
  const backLongPress = useLongPress(backwardCallback, onContinuousStop);

  const forward = stepByStep ? makeEventsToCallbacksObject(forwardCallback) : forwardLongPress;
  const left = stepByStep ? makeEventsToCallbacksObject(leftCallback) : leftLongPress;
  const right = stepByStep ? makeEventsToCallbacksObject(rightCallback) : rightLongPress;
  const back = stepByStep ? makeEventsToCallbacksObject(backwardCallback) : backLongPress;

  return (
    <div
      className={classNames(classes.outerRing, {
        [classes.disabled]: disabled,
        [classes.outerRingTeleopMode]: teleopMode,
        [classes.outerRingStepwiseMode]: stepwiseMode,
      })}
    >
      <div className={classes.backgroundCircle}>
        <div className={classes.rowContainer}>
          <IconButton
            {...forward}
            classes={{ root: classes.iconButton }}
            disabled={disabled}
            size="large">
            <ArrowUp
              className={classNames(classes.iconButtonRoot, {
                [classes.arrowTeleopMode]: teleopMode,
                [classes.arrowStepwiseMode]: stepwiseMode
              })}
              size={28}
            />
          </IconButton>
        </div>
        <div className={classes.rowContainer}>
          <IconButton
            {...left}
            classes={{ root: classes.iconButton }}
            disabled={disabled}
            size="large">
            <ArrowLeft
              className={classNames(classes.iconButtonRoot, {
                [classes.arrowTeleopMode]: teleopMode,
                [classes.arrowStepwiseMode]: stepwiseMode
              })}
              size={28}
            />
          </IconButton>
          <div className={classes.nippleContainer}>
            {!stepwiseMode && !stepByStep && (
              <NippleJoystick
                id={uniqueNodeId}
                ref={joystickRef}
                options={{
                  mode: 'static',
                  dynamicPage: true,
                  position: { top: '50%', left: '50%' },
                  restOpacity: 1
                }}
                style={{
                  width: '100%',
                  height: '100%',
                  position: 'relative',
                  pointerEvents: (disabled || stepByStep) ? 'none' : 'auto'
                }}
                onCreated={applyJoystickStyle}
                onMove={onJoystickMove}
                onEnd={onJoystickMove}
              />
            )}
          </div>
          <IconButton
            {...right}
            classes={{ root: classes.iconButton }}
            disabled={disabled}
            size="large">
            <ArrowRight
              className={classNames(classes.iconButtonRoot, {
                [classes.arrowTeleopMode]: teleopMode,
                [classes.arrowStepwiseMode]: stepwiseMode
              })}
              size={28}
            />
          </IconButton>
        </div>
        <div className={classes.rowContainer}>
          <IconButton
            {...back}
            classes={{ root: classes.iconButton }}
            disabled={disabled}
            size="large">
            <ArrowDown
              className={classNames(classes.iconButtonRoot, {
                [classes.arrowTeleopMode]: teleopMode,
                [classes.arrowStepwiseMode]: stepwiseMode
              })}
              size={28}
            />
          </IconButton>
        </div>
      </div>
    </div>
  );
}

NavigationJoystick.propTypes = {
  disabled: PropTypes.bool,
  teleopMode: PropTypes.bool,
  stepwiseMode: PropTypes.bool,
  stepByStep: PropTypes.bool,
  onContinuousStop: PropTypes.func,
  forwardCallback: PropTypes.func,
  leftCallback: PropTypes.func,
  rightCallback: PropTypes.func,
  backwardCallback: PropTypes.func,
  onJoystickMove: PropTypes.func,
};

export default NavigationJoystick;
