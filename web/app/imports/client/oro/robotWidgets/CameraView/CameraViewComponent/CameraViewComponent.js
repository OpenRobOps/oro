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
 * Camera View widget
 * Displays images from the selected robot's camera on the client
 */
import moment from 'moment';
import React, { Fragment, useState, useRef, useEffect, useCallback, useContext } from 'react';
import { Typography, Grid, Tooltip } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import PropTypes from 'prop-types';
import toBase64 from 'arraybuffer-base64';
import { isObject } from 'lodash';
import classnames from 'classnames';
import { EyeOff } from 'lucide-react';
import LoadingBar from '../../../util/LoadingBar';
import { FullscreenContext } from '../../../contexts/FullscreenContext';
import { REAL_TIME_STALE_DATA_SECONDS } from '../../../../../shared/uiPreferences';
import { CONTAINER_LARGE, CONTAINER_MEDIUM, CONTAINER_SMALL } from '../../../../lib/constants';

const PREFS_DEFAULT = { recentTs: 5000, cropped: false };

// Tooltip messages constants
const TURN_ON_TOOLTIP = 'Turn on';
const ZOOM_CAMERA_TOOLTIP = 'Zoom';
const TURN_OFF_TOOLTIP = 'Turn off';
const ENLARGE_TOOLTIP = 'Enlarge';

const NO_IMAGE_CAMERA_SECONDARY_TEXT = 'The image will display when the robot starts publishing it.';
const NO_IMAGE_CAMERA_PRIMARY_TEXT = 'No camera image available.';

// Simple helper to determine container size based on element dimensions
function getContainerSize(element) {
  if (!element) return CONTAINER_LARGE;
  const { clientWidth } = element;
  if (clientWidth > 300) return CONTAINER_LARGE;
  if (clientWidth > 150) return CONTAINER_MEDIUM;
  return CONTAINER_SMALL;
}

const useStyles = makeStyles()(theme => ({
  bigIcon: {
    color: theme.palette.icons?.lightGray,
    fontSize: theme.palette.icons?.bigIcon,
  },
  cameraContainer: {
    alignItems: 'center',
    background: theme.palette.background?.white,
    display: 'flex',
    height: '100%',
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
    border: `1px solid ${theme.palette.background?.lightGray}`
  },
  container: {
    alignItems: 'center',
    display: 'flex',
    height: '100%',
    justifyContent: 'center',
    position: 'relative',
    width: '100%'
  },
  fullscreenCameraContainer: {
    background: theme.palette.background?.black,
    border: 'none'
  },
  errorMessageContainer: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    justifyContent: 'center',
    width: '100%'
  },
  mediumIcon: {
    color: theme.palette.icons?.lightGray,
    fontSize: theme.palette.icons?.mediumIcon,
  },
  smallIcon: {
    color: theme.palette.icons?.lightGray,
    fontSize: theme.palette.icons?.smallIcon
  },
  text: {
    fontSize: '1.25rem',
    fontWeight: 'bold',
    textAlign: 'center'
  },
  widgetLabel: {
    background: theme.palette.background?.darkGray,
    border: `1px solid ${theme.palette.background?.gray}`,
    borderRadius: '2px',
    boxSizing: 'border-box',
    color: theme.palette.text?.contrastText,
    display: 'inline',
    fontSize: '0.75rem',
    fontWeight: theme.fontWeight?.medium,
    padding: '0px 5px',
    position: 'relative'
  },
  labelCrossed: {
    '&:before': {
      position: 'absolute',
      content: '""',
      left: '5%',
      top: '40%',
      borderTop: `2px solid ${theme.palette.text?.contrastText}`,
      borderColor: 'inherit',
      transform: 'rotate(45deg)',
      width: '90%'
    }
  },
  widgetToolbar: {
    display: 'flex',
    justifyContent: 'flex-end',
    left: 0,
    padding: '10px',
    position: 'absolute',
    top: 0,
    width: '100%',
    zIndex: 1
  },
  tooltipPopperBottom: {
    transform: 'initial !important',
    bottom: '0 !important',
    top: 'initial !important',
    left: 'initial !important'
  },
  tooltipPopperLeft: {
    transform: 'initial !important',
    top: 'initial !important',
    left: 'initial !important',
  },
  tooltipLeft: {
    margin: '0 35px !important'
  }
}));

const CameraView = (props) => {
  const {
    cameraModuleOn,
    cameraNumber,
    camerasConfig,
    image = {},
    isLoading,
    offline,
    onCameraClicked,
    isMainCamera,
    isZeroData,
    cameraPrefs = PREFS_DEFAULT,
    cameraEnabled,
    cameraId,
    label,
    shortLabel,
    standalone,
    config,
    updateCameraTsCallback,
    onSetCameraIsOn,
    onSetCameraCropped,
    robotId
  } = props;

  const { classes } = useStyles();
  const { isFullscreen } = useContext(FullscreenContext);

  const [disableTimeCheck, setDisableTimeCheck] = useState(false);
  const [imageTooltipOpen, setImageTooltipOpen] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageWaitTimeout, setImageWaitTimeout] = useState(false);

  const cameraDivRef = useRef(null);

  // Wait for image timeout
  useEffect(() => {
    const timer = setTimeout(
      () => setImageWaitTimeout(true), REAL_TIME_STALE_DATA_SECONDS * 1000
    );
    return () => clearTimeout(timer);
  }, []);

  const updateCameraTs = useCallback((cameraTs) => {
    if (updateCameraTsCallback) {
      updateCameraTsCallback(cameraId, cameraTs);
    }
  }, [updateCameraTsCallback, cameraId]);

  const handleCameraClicked = useCallback(() => {
    onCameraClicked && onCameraClicked(cameraNumber);
  }, [onCameraClicked, cameraNumber]);

  const toggleCameraIsOn = useCallback((event) => {
    event.stopPropagation();
    let activeCamerasConfig = camerasConfig;
    if (!isObject(activeCamerasConfig)) {
      activeCamerasConfig = {};
    }
    if (!isObject(activeCamerasConfig[cameraNumber])) {
      activeCamerasConfig[cameraNumber] = {};
    }
    const { is_on: isOn } = activeCamerasConfig[cameraNumber];
    const { cropped } = cameraPrefs;
    let newCropped;
    let newIsOn = isOn;
    if (isOn && !cropped) {
      newCropped = true;
    } else if (isOn && cropped) {
      newCropped = false;
      newIsOn = false;
    } else {
      newCropped = false;
      newIsOn = true;
    }
    if (onSetCameraIsOn && isOn != newIsOn) {
      onSetCameraIsOn({
        robotId,
        cameraId: cameraNumber,
        isOn: newIsOn
      }, (err) => {
        if (err) {
          console.log('Error saving camera visibility.', err);
        }
      });
    }
    if (onSetCameraCropped && newCropped !== cropped) {
      onSetCameraCropped({
        robotId,
        cameraId: cameraNumber,
        cropped: newCropped
      }, (err) => {
        if (err) {
          console.log('Error saving camera toggle status.', err);
        }
      });
    }
  }, [camerasConfig, cameraNumber, cameraPrefs, onSetCameraIsOn, onSetCameraCropped, robotId]);

  const isImageCurrent = useCallback((imageTs) => {
    const { recentTs = PREFS_DEFAULT.recentTs } = cameraPrefs;
    if (disableTimeCheck || cameraPrefs.recentTs == 0) {
      return true;
    }
    return Date.now() - imageTs < recentTs;
  }, [disableTimeCheck, cameraPrefs]);

  const handleDisableTimeCheck = useCallback(() => {
    setDisableTimeCheck(true);
  }, []);

  const onImageLoad = useCallback(() => {
    setImageLoaded(true);
  }, []);

  const handleImageTooltipClose = useCallback(() => {
    setImageTooltipOpen(false);
  }, []);

  const handleImageTooltipOpen = useCallback(() => {
    setImageTooltipOpen(true);
    setTimeout(() => setImageTooltipOpen(false), 5000);
  }, []);

  const cameraContainerSize = getContainerSize(cameraDivRef?.current);
  const cameraIsVisible = (camerasConfig && camerasConfig[cameraNumber]
    && camerasConfig[cameraNumber].is_on) || !cameraModuleOn;

  // Build camera label
  let cameraLabel = '';
  if (shortLabel) {
    cameraLabel = shortLabel;
  } else if (label && !label.match(/^camera/)) {
    cameraLabel = label.charAt(0).toUpperCase();
  } else if (isZeroData && !cameraNumber) {
    cameraLabel = config && (Number(config.cameraId) + 1);
  } else {
    cameraLabel = (Number(cameraNumber) + 1);
  }

  const { is_on: isOn } = (camerasConfig && camerasConfig[cameraNumber]) || {};
  const { cropped } = cameraPrefs;
  let labelTooltip = TURN_ON_TOOLTIP;
  if (isOn && !cropped) {
    labelTooltip = ZOOM_CAMERA_TOOLTIP;
  } else if (isOn && cropped) {
    labelTooltip = TURN_OFF_TOOLTIP;
  }

  // Decode image data
  const imageData = image.data || (image.image && toBase64(image.image));
  if (image.ts) {
    updateCameraTs(image.ts);
  }

  const renderCameraImage = () => {
    const { mirror, rotation, cropped: isCropped = false } = cameraPrefs;
    if (cameraDivRef && cameraDivRef.current) {
      const { clientHeight, clientWidth } = cameraDivRef.current;
      const cameraStyle = {
        margin: '0 auto',
        flexGrow: '1',
        width: '100%',
        height: '100%',
        maxHeight: isCropped ? '' : '100%',
        maxWidth: isCropped ? '' : '100%',
        objectFit: isCropped ? 'cover' : 'contain',
        display: !imageLoaded ? 'none' : 'initial'
      };
      if (cameraPrefs && (mirror || rotation)) {
        let transform = '';
        if (cameraPrefs.mirror) transform += ' scaleX(-1)';
        if (cameraPrefs.rotation) transform += ` rotate(${rotation}deg)`;
        cameraStyle.transform = transform;
        if (rotation == 90 || rotation == 270) {
          cameraStyle.maxHeight = '';
          cameraStyle.maxWidth = '';
          cameraStyle.width = clientHeight;
          cameraStyle.height = clientWidth;
        }
      }
      return (
        <Fragment>
          {!imageLoaded && <LoadingBar />}
          <img
            data-test="cameraview-camera-image"
            src={(cameraEnabled && `data:image/jpeg;base64,${imageData}`) || ''}
            alt=""
            style={cameraStyle}
            onLoad={onImageLoad}
          />
        </Fragment>
      );
    }
    return null;
  };

  const renderRobotOffline = () => (
    <Fragment>
      <Typography variant="body2" color="textSecondary">
        Robot is offline
      </Typography>
    </Fragment>
  );

  const renderNoImage = () => (
    <div className={classes.errorMessageContainer}>
      <Typography variant="body2" color="textSecondary" align="center">
        {NO_IMAGE_CAMERA_PRIMARY_TEXT}
      </Typography>
      <Typography variant="caption" color="textSecondary" align="center">
        {NO_IMAGE_CAMERA_SECONDARY_TEXT}
      </Typography>
    </div>
  );

  const imageContainerContent = imageData ? (
    renderCameraImage()
  ) : (
    <div className={classes.errorMessageContainer}>
      {((isLoading || !imageWaitTimeout) && !isZeroData && <LoadingBar />)
        || (offline && renderRobotOffline())
        || renderNoImage()
      }
    </div>
  );

  return (
    <Grid
      className={classes.container}
      data-test="cameraview-container"
      onClick={!isZeroData ? handleCameraClicked : null}
      style={!isZeroData && onCameraClicked ? { cursor: 'pointer' } : null}
    >
      <Tooltip
        title={(!isMainCamera && onCameraClicked && cameraIsVisible && imageLoaded)
          ? ENLARGE_TOOLTIP : ''
        }
        classes={{ popper: classes.tooltipPopperBottom }}
        PopperProps={{ disablePortal: true }}
        open={imageTooltipOpen}
        onClose={handleImageTooltipClose}
        onOpen={handleImageTooltipOpen}
        enterDelay={500}
        disableInteractive
      >
        <div
          className={classnames(classes.cameraContainer, {
            [classes.fullscreenCameraContainer]: isFullscreen
          })}
          onDoubleClick={handleDisableTimeCheck}
          ref={cameraDivRef}
        >
          {/* Camera label toolbar */}
          <Grid
            data-test="cameraview-camera-label-container"
            container
            className={classes.widgetToolbar}
          >
            <Tooltip
              title={!standalone ? labelTooltip : ''}
              placement="left"
              classes={{
                tooltipPlacementLeft: classes.tooltipLeft,
                popper: classes.tooltipPopperLeft
              }}
              PopperProps={{ disablePortal: true }}
              disableInteractive
            >
              <Typography
                className={classnames(classes.widgetLabel, {
                  [classes.labelCrossed]: !isOn && !isZeroData
                })}
                onClick={toggleCameraIsOn}
              >
                {cameraLabel}
              </Typography>
            </Tooltip>
          </Grid>

          {cameraIsVisible ? (
            imageContainerContent
          ) : (
            <div className={classes.errorMessageContainer}>
              <EyeOff size={24} color="gray" />
            </div>
          )}
        </div>
      </Tooltip>
    </Grid>
  );
};

CameraView.defaultProps = {
  cameraPrefs: PREFS_DEFAULT
};

CameraView.propTypes = {
  robotId: PropTypes.string,
  cameraNumber: PropTypes.string,
  cameraModuleOn: PropTypes.bool,
  cameraId: PropTypes.string,
  cameraEnabled: PropTypes.bool,
  cameraPrefs: PropTypes.object,
  camerasConfig: PropTypes.object,
  isMainCamera: PropTypes.bool,
  isLoading: PropTypes.bool,
  label: PropTypes.string,
  shortLabel: PropTypes.string,
  offline: PropTypes.bool,
  isZeroData: PropTypes.bool,
  updateCameraTsCallback: PropTypes.func,
  standalone: PropTypes.bool,
  onCameraClicked: PropTypes.func,
  onSetCameraIsOn: PropTypes.func,
  onSetCameraCropped: PropTypes.func,
  image: PropTypes.object,
  config: PropTypes.object
};

export default CameraView;
