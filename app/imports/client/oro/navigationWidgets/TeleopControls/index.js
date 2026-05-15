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
 * Teleop Controls Container
 * Contains the main teleop control object within a declarative component
 * in order to allow hooks (in this case from context).
 */

import React, { useEffect, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { isNumber } from 'lodash';
import { Meteor } from 'meteor/meteor';
// ORO Modules
import { useActiveInteraction } from '../../contexts/ActiveInteractionContext';
import TeleopControls from './TeleopControls';
import { useFullscreenContext } from '../../contexts/FullscreenContext';

// Velocity limits and defaults (inlined from TeleopSettings)
// TODO: Read from settings (low priority)
const velLimitsDefaults = {
  linear: {
    min: 0.005,
    max: 0.5,
    default: 0.15
  },
  angular: {
    min: 0.00872665,
    max: 0.785398,
    default: 0.3925
  }
};

// Use imported defaults for precision teleop movements
const linearDelta = velLimitsDefaults.linear.min * 4;
const angularDelta = velLimitsDefaults.angular.min * 4;

function TeleopControlsContainer({
  robotId,
  getTsHint,
  isZeroData,
  offline,
  onFeedback
}) {
  const { isFullscreen } = useFullscreenContext();
  const {
    activeInteraction,
    data,
    setActiveInteraction,
    setInteractionData
  } = useActiveInteraction();
  const distanceAngle = useRef();
  distanceAngle.current = data || { distance: 0, angle: 0 };
  const isActivePrecision = activeInteraction == 'precision';
  const isActiveTeleop = activeInteraction == 'teleop';

  const precisionCallbacks = useMemo(() => ({
    forwardCallback: (acceleration = 1) => {
      if (!isNumber(acceleration)) { acceleration = 1; }
      const { distance, angle } = distanceAngle.current;
      setInteractionData(
        { angle, distance: distance + linearDelta * acceleration }
      );
    },
    backwardCallback: (acceleration = 1) => {
      if (!isNumber(acceleration)) { acceleration = 1; }
      const { distance, angle } = distanceAngle.current;
      setInteractionData({ angle, distance: distance - linearDelta * acceleration });
    },
    leftCallback: (acceleration = 1) => {
      if (!isNumber(acceleration)) { acceleration = 1; }
      const { distance, angle } = distanceAngle.current;
      setInteractionData({ angle: angle + angularDelta * acceleration, distance });
    },
    rightCallback: (acceleration = 1) => {
      if (!isNumber(acceleration)) { acceleration = 1; }
      const { distance, angle } = distanceAngle.current;
      setInteractionData({ angle: angle - angularDelta * acceleration, distance });
    }
  }), [setInteractionData]);

  // If we entered fullscreen, disable active interactions.
  // This is because the joystick breaks on screen resizes and layout changes.
  useEffect(() => { setActiveInteraction(null); }, [isFullscreen, setActiveInteraction]);

  // Refcounted load of RosTeleopAgentlet via the `teleop` publication;
  // unsubscribe on unmount triggers requestLess on the server.
  useEffect(() => {
    if (!robotId) return undefined;
    const handle = Meteor.subscribe('teleop', { robotId });
    return () => handle.stop();
  }, [robotId]);

  return (
    <TeleopControls
      robotId={robotId}
      disableControls={!isActiveTeleop && !isActivePrecision}
      teleopMode={isActiveTeleop}
      getTsHint={getTsHint}
      stepwiseMode={isActivePrecision}
      precisionCallbacks={precisionCallbacks}
      isZeroData={isZeroData}
      offline={offline}
      onFeedback={onFeedback}
    />
  );
}

TeleopControlsContainer.propTypes = {
  robotId: PropTypes.string, // selected robot id
  getTsHint: PropTypes.func, // callback to get TsHint
  isZeroData: PropTypes.bool,
  offline: PropTypes.bool,
  onFeedback: PropTypes.func
};

export default TeleopControlsContainer;
