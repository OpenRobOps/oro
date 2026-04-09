/**
 * HighResolutionToggleComponent
 *
 * Meteor agnostic component.
 * Handles the toggle of high resolution snapshot.
 * Receives a cameraNumber as prop and when the toggle is
 * turned on it turns that camera to high resolution.
 * Converted from class component to functional component.
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { Typography, Switch } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import classNames from 'classnames';
// ORO modules
import { CAMERA_TOGGLE_ID, ARGNAME_CAMERA_FOCUS, ARGNAME_CAMERA_ID } from '../../../../shared/actions';

const useStyles = makeStyles()(theme => ({
  highRezContainer: {
    display: 'inline-flex'
  },
  textContainer: {
    display: 'flex',
    alignItems: 'center',
    color: theme.palette.text.title,
    [theme.breakpoints.down('md')]: {
      fontSize: '13px'
    }
  },
  timeLeft: {
    color: theme.palette.text.darkBlue,
    fontWeight: theme.fontWeight.bold,
    [theme.breakpoints.down('md')]: {
      fontSize: '13px'
    }
  },
  highResOff: {
    fontWeight: theme.fontWeight.bold,
    [theme.breakpoints.down('md')]: {
      fontSize: '13px'
    }
  },
  disabledText: {
    color: 'rgba(0, 0, 0, 0.26)'
  }
}));

function HighResolutionToggleComponent(props) {
  const {
    cameraIsInHighRes = false, colorClass, isLoading, disabled,
    toggleHighResMeteorCall, robotId, cameraNumber
  } = props;
  const { classes } = useStyles();

  const [clientLoading, setClientLoading] = useState(false);

  // Track previous props to detect camera changes
  const prevPropsRef = useRef({ cameraNumber, cameraIsInHighRes, robotId });

  /**
   * Handles a click on the 'High Resolution' button.
   * Triggers a temporary increase in the camera image resolution for the selected camera.
   */
  const handleHighResButton = useCallback(() => {
    if (toggleHighResMeteorCall) {
      setClientLoading(true);
      const highResModeOn = cameraIsInHighRes;
      toggleHighResMeteorCall({
        robotId,
        actionId: CAMERA_TOGGLE_ID,
        args: {
          [ARGNAME_CAMERA_ID]: cameraNumber,
          [ARGNAME_CAMERA_FOCUS]: highResModeOn ? 0 : 1 // booleans not implemented as action args
        }
      }, (err) => {
        setClientLoading(false);
        if (err) console.log('Error attempting to toggle hi-res resolution', err);
      });
    }
  }, [cameraIsInHighRes, cameraNumber, robotId, toggleHighResMeteorCall]);

  // If the previous camera was in high res, switch high res on for this camera
  useEffect(() => {
    const prev = prevPropsRef.current;
    if (prev.cameraIsInHighRes && robotId === prev.robotId && cameraNumber !== prev.cameraNumber) handleHighResButton();
    prevPropsRef.current = { cameraNumber, cameraIsInHighRes, robotId };
  }, [cameraNumber, cameraIsInHighRes, robotId, handleHighResButton]);

  return (
    <div className={classes.highRezContainer}>
      {!isLoading && (
        <>
          <div className={classNames(classes.textContainer, colorClass)}>
            <Typography className={classNames(
              classes.textContainer,
              colorClass,
              { [classes.disabledText]: disabled }
            )}>
              Hi-rez
              &nbsp;
            </Typography>
            {cameraIsInHighRes ? (
              // TODO: Replace the 'on' text with the time left
              <Typography
                className={classNames(
                  classes.timeLeft,
                  { [classes.disabledText]: disabled }
                )}
              >
                On
              </Typography>
            ) : (
              <Typography
                className={classNames(
                  classes.highResOff,
                  { [classes.disabledText]: disabled }
                )}
              >
                Off
              </Typography>
            )}
          </div>
          {/* TODO: Replace the switch with a progress bar that decreases with time */}
          <Switch
            color="primary"
            onChange={handleHighResButton}
            checked={cameraIsInHighRes}
            disabled={clientLoading || disabled}
            data-test="navdet-controls-highrez"
          />
        </>
      )}
    </div>
  );
}

HighResolutionToggleComponent.propTypes = {
  // robot settings variables
  robotId: PropTypes.string,
  toggleHighResMeteorCall: PropTypes.func, // Meteor toggle high resolution call
  cameraNumber: PropTypes.string, // Identifies the camera that this component is handling
  cameraIsInHighRes: PropTypes.bool, // if true the camera is in high resolution mode
  colorClass: PropTypes.string, // class name with the text color the text should have
  isLoading: PropTypes.bool, // indicates if the subscriptions are still loading
  disabled: PropTypes.bool // indicates if the component is disabled
};

export default HighResolutionToggleComponent;
