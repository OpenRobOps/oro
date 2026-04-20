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
 * TeleopControls
 *
 * Component used to contain and provide props for TeleopCommand and NavigationJoystick.
 * Converted from class component to functional component.
 * stepByStep defaults to true (safe mode).
 */
import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from 'tss-react/mui';
// ORO modules
import TeleopCommand from './TeleopCommand';
import WrapWithTooltip from '../../util/WrapWithTooltip';

// These are the dimensions used for the teleop controls and the joystick
const CONTROLS_DIMENSIONS = {
  height: 165,
  width: 165
};

const useStyles = makeStyles()(() => ({
  panelContainer: {
    height: '100%',
    width: '100%',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column'
  }
}));

function TeleopControls(props) {
  const {
    offline, disableControls,
    robotId, onFeedback, showTeleop,
    teleopMode, stepwiseMode, getTsHint, precisionCallbacks, isZeroData
  } = props;
  const { classes } = useStyles();

  // TODO: derive badNetwork from offline/networkStatus once server-side connection quality is implemented
  const [badNetwork] = useState(false);
  const [gamepadConnected, setGamepadConnected] = useState(false);

  // stepByStep defaults to true (safe mode; no withTracker subscription needed in ORO)
  const stepByStep = true;

  const onGamepadConnect = useCallback((connected) => {
    setGamepadConnected(connected);
  }, []);

  return (
    <div className={classes.panelContainer}>
      {WrapWithTooltip(offline && 'Robot offline', (
        <TeleopCommand
          robotId={robotId}
          offline={offline}
          onFeedback={onFeedback}
          stepByStep={stepByStep}
          disableControls={disableControls}
          gamepadConnected={gamepadConnected}
          badNetwork={badNetwork}
          onGamepadConnect={onGamepadConnect}
          controlsDimensions={CONTROLS_DIMENSIONS}
          teleopMode={teleopMode}
          stepwiseMode={stepwiseMode}
          precisionCallbacks={precisionCallbacks}
          showTeleop={showTeleop}
          getTsHint={getTsHint}
          isZeroData={isZeroData}
        />
      ))}
    </div>
  );
}

TeleopControls.propTypes = {
  // Robot data
  robotId: PropTypes.string,
  offline: PropTypes.bool,
  // UI settings/data
  disableControls: PropTypes.bool, // when disabledControls, user can't interact.
  onFeedback: PropTypes.func,
  showTeleop: PropTypes.bool,
  teleopMode: PropTypes.bool,
  stepwiseMode: PropTypes.bool,
  getTsHint: PropTypes.func,
  isZeroData: PropTypes.bool,
  precisionCallbacks: PropTypes.object
};

export default TeleopControls;
