/**
 * TeleopControls
 *
 * Component used to contain and provide props for TeleopCommand and NavigationJoystick.
 * Converted from class component to functional component.
 * stepByStep defaults to true (safe mode).
 */
import React, { useState, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from 'tss-react/mui';
// ORO modules
import TeleopCommand from './TeleopCommand';
import WrapWithTooltip from '../../util/WrapWithTooltip';

// These are the control modes constants
const CONTROL_MODES = {
  STEPBYSTEP: 'stepbystep',
  JOYSTICK: 'joystick',
  GAMEPAD: 'gamepad'
};

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

  const [badNetwork, setBadNetwork] = useState(false);
  const [networkStatus] = useState(0);
  const [controlMode] = useState(CONTROL_MODES.STEPBYSTEP);
  const [gamepadConnected, setGamepadConnected] = useState(false);

  // stepByStep defaults to true (safe mode — no withTracker subscription needed in oro)
  const stepByStep = true;

  // networkState: 3 and 2 represent low and average latency
  // 1 and 0 represent high latency or offline
  useEffect(() => {
    setBadNetwork(offline || networkStatus < 2 ? false : false);
    // TODO: handle network status properly
    setBadNetwork(false);
  }, [offline, networkStatus]);

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
          controlMode={controlMode}
          onGamepadConnect={onGamepadConnect}
          controlModes={CONTROL_MODES}
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
