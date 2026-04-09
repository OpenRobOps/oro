/**
 * Pose Data Component
 *
 * Renders the pose of the robot selected at the bottom of the Map widgets,
 * Navigation widget, and Time Capsule map. It supports two types of poses:
 *  - Actual pose of the robot (indoor: [x, y, theta], outdoor: [lat, lng])
 *  - The pose chosen when waypoint interaction is active.
 *
 * Pure React Component - Meteor agnostic.
 */
import React, { useRef, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Grid, Typography, Button, IconButton, useMediaQuery, Tooltip } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { get } from 'lodash';
// ORO modules
import { Copy, ExternalLink, Navigation } from 'lucide-react';
import { useActiveInteraction } from '../../contexts/ActiveInteractionContext';
import theme from '../../../Styles';
import { NAVIGATE_MODE } from '../interactions';
import { LOCALIZATION_MAP_TYPES } from '../../../../shared/constants';

// Simple template replacement: replaces {key} placeholders with values from the map
const replaceTemplate = (template, values) =>
  template.replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
import { LOCALIZATION_VARIANTS } from '../../robotWidgets/LocalizationWidget/Localization';

const TITLE_WAYPOINT = 'Waypoint';
const TITLE_ROBOT_POSE = 'Robot pose';

const useStyles = makeStyles()(() => ({
  container: {
    backgroundColor: theme.palette.background.white,
    display: 'flex',
    alignItems: 'center',
    zIndex: 1,
    position: 'absolute',
    width: '100%',
    bottom: '0px',
    paddingTop: '10px'
  },
  typography: {
    color: theme.palette.text.content,
    display: 'flex',
    fontSize: '0.8125rem',
    alignItems: 'center',
    fontWeight: theme.fontWeight.lightPlus,
    lineHeight: '20px',
    letterSpacing: '0.03333em'
  },
  poseDataContainer: {
    display: 'flex',
    borderRadius: '4px',
    border: '1px solid #B2D3FF',
    padding: '3px',
    alignItems: 'center'
  },
  typographyData: {
    color: theme.palette.text.title,
    fontSize: '12px',
    paddingRight: '3px'
  },
  typographyTitle: {
    fontWeight: 500,
    color: '#666',
    height: '23px',
    fontSize: '13px',
    padding: '0 12px 0 4px'
  },
  // We want to get a reference of different content than the one displayed in
  // the other placeholders, then we create this invisible placeholder that contains the JSON.
  // We can't use "display: none" property as it has to be displayed because we want to
  // be able to access DOM elements directly when the component mounts.
  invisibleP: {
    height: 0,
    width: 0,
    opacity: 0,
    position: 'absolute',
  },
  openLinkTypography: {
    color: '#666',
    fontSize: '13px',
    textTransform: 'none'
  },
  iconContainer: {
    padding: '0 0 0 5px'
  },
  icon: {
    width: '19px',
    height: '17px',
  },
  mobileTypography: {
    fontSize: '11px'
  }
}));

const DEFAULT_BUTTON_LABEL = 'Open in Google Maps';

/**
 * Helper function to retrieve and format pose values to 3 decimal places.
 * @param {Object} poseToShow - Object containing pose data.
 * @param {string} key - The key of the pose data to retrieve (e.g., 'x', 'y', 'theta').
 * @returns {string} - Formatted pose value or '--'.
 */
const getFormattedPoseValue = (poseToShow, key) => {
  const value = get(poseToShow, key, '--');
  if (value === '--') return value;
  // Handle latitude/longitude human-readable formatting
  if (key === 'latitude') {
    return `${Math.abs(value).toFixed(3)} ${value >= 0 ? 'N' : 'S'}`;
  } else if (key === 'longitude') {
    return `${Math.abs(value).toFixed(3)} ${value >= 0 ? 'E' : 'W'}`;
  }
  // Default formatting for other keys like 'x', 'y', 'theta'
  return value.toFixed(3);
};

const PoseDataComponent = (props) => {
  const {
    selectedRobotPose,
    mapType,
    gpsFix,
    uiPreferences,
    variant
  } = props;
  const { classes, cx } = useStyles();
  const textToCopyRef = useRef();
  // Check if screen width is greater than 900px and less than 1400px
  const isInRange = useMediaQuery('(min-width:900px) and (max-width:1430px)');
  // Gets if there's any active interaction or if some pose is selected
  const { activeInteraction, data } = useActiveInteraction();
  const isWaypointActive = activeInteraction == NAVIGATE_MODE;
  // Determine which pose data to display (waypoint or robot)
  const poseToShow = isWaypointActive
    ? data?.pose
    : selectedRobotPose;
  // Determine title based on active pose type
  const dataTitleToShow = isWaypointActive ? TITLE_WAYPOINT : TITLE_ROBOT_POSE;
  // If UI preferences exist and contains a valid URL template, replace the placeholders
  // for lat and lng
  const generatedUrl = useMemo(() => {
    if (!gpsFix?.latitude || !gpsFix?.longitude) return null;
    return uiPreferences?.externalMapLink?.url
      ? replaceTemplate(
        uiPreferences.externalMapLink.url,
        { lat: gpsFix.latitude, lng: gpsFix.longitude }
      )
      : `https://maps.google.com/?q=${gpsFix.latitude},${gpsFix.longitude}`;
  }, [gpsFix, uiPreferences?.externalMapLink?.url]);
  // Opens the URL to show robot coordinates in a new tab
  const handleOpenUrl = useCallback(() => {
    if (generatedUrl) window.open(generatedUrl, '_blank');
  }, [generatedUrl]);
  // Creates the button label and title based on the UI preferences. If the label is
  // too long, it will be shortened to 6 characters and a tooltip will be shown.
  const { buttonLabel, title } = useMemo(() => {
    const fullLabel = uiPreferences?.externalMapLink?.label || DEFAULT_BUTTON_LABEL;
    const shortened = isInRange && fullLabel.length > 16
      ? `${fullLabel.slice(0, 10)}...`
      : fullLabel;
    return {
      buttonLabel: shortened,
      title: fullLabel
    };
  }, [isInRange, uiPreferences?.externalMapLink?.label]);
  // Button component that opens the URL to show robot coordinates in a new tab
  const OpenMapButton = useMemo(() => (
    <Button
      startIcon={<ExternalLink size={17} />}
      onClick={handleOpenUrl}
    >
      <Typography
        className={cx(
          classes.openLinkTypography,
          { [classes.mobileTypography]: isInRange }
        )}
      >
        {buttonLabel}
      </Typography>
    </Button>
  ), [buttonLabel, classes, cx, handleOpenUrl, isInRange]);

  return (
    <Grid className={classes.container}>
      {mapType == LOCALIZATION_MAP_TYPES.NAV_SAT ? (
        <>
          <div className={classes.poseDataContainer}>
            <Navigation size={17} />
            {variant !== LOCALIZATION_VARIANTS.MAP_WIDGET && (
              <Typography className={cx(classes.typography, classes.typographyTitle)}>
                {TITLE_ROBOT_POSE}
              </Typography>
            )}
            <Typography
              className={cx(
                classes.typography,
                classes.typographyData,
                { [classes.mobileTypography]: isInRange }
              )}
            >
              Lat:&nbsp;
              <Typography
                className={cx(
                  classes.typography,
                  { [classes.mobileTypography]: isInRange }
                )}
              >
                {getFormattedPoseValue(gpsFix, 'latitude')}
              </Typography>
            </Typography>
            <Typography
              className={cx(
                classes.typography,
                classes.typographyData,
                { [classes.mobileTypography]: isInRange }
              )}
            >
              Long:&nbsp;
              <Typography
                className={cx(
                  classes.typography,
                  { [classes.mobileTypography]: isInRange }
                )}
              >
                {getFormattedPoseValue(gpsFix, 'longitude')}
              </Typography>
            </Typography>
          </div>
          <div className={classes.iconContainer}>
            {/* Invisible placeholder necessary to enable clipboard component's copy feature. */}
            <p
              ref={textToCopyRef}
              className={classes.invisibleP}
              data-test="pose-in-lat-lng"
            >
              {JSON.stringify({
                latitude: gpsFix?.latitude,
                longitude: gpsFix?.longitude,
              })}
            </p>
            <Tooltip title="Copy to clipboard">
              <IconButton
                size="small"
                onClick={() => {
                  if (textToCopyRef.current) {
                    navigator.clipboard.writeText(textToCopyRef.current.textContent);
                  }
                }}
              >
                <Copy size={15} />
              </IconButton>
            </Tooltip>
          </div>
          <div className={classes.iconContainer}>
            {/* Conditionally wrap the button in a Tooltip when screen width is in
              the specified range. This shows the full label text when hovering
              over the shortened button text.
            */}
            {isInRange ? (
              <Tooltip title={title}>
                {OpenMapButton}
              </Tooltip>
            ) : (
              OpenMapButton
            )}
          </div>
        </>
      ) : (
        <>
          <Navigation size={17} />
          <Typography className={cx(classes.typography, classes.typographyTitle)}>
            {dataTitleToShow}
          </Typography>
          <div className={classes.poseDataContainer}>
            {/* Display X, Y, and theta values formatted to 3 decimals */}
            <Typography className={cx(classes.typography, classes.typographyData)}>
              X:&nbsp;
              <Typography className={classes.typography}>
                {getFormattedPoseValue(poseToShow, 'x')}
              </Typography>
            </Typography>
            <Typography className={cx(classes.typography, classes.typographyData)}>
              Y:&nbsp;
              <Typography className={classes.typography}>
                {getFormattedPoseValue(poseToShow, 'y')}
              </Typography>
            </Typography>
            <Typography className={cx(classes.typography, classes.typographyData)}>
              theta:&nbsp;
              <Typography className={classes.typography}>
                {getFormattedPoseValue(poseToShow, 'theta')}
              </Typography>
            </Typography>
          </div>
          {/* Invisible placeholder necessary to enable clipboard component's copy feature. */}
          <p
            ref={textToCopyRef}
            className={classes.invisibleP}
            data-test="pose-in-meters"
          >
            {JSON.stringify({
              x: poseToShow?.x,
              y: poseToShow?.y,
              theta: poseToShow?.theta
            })}
          </p>
          <Tooltip title="Copy to clipboard">
            <IconButton
              size="small"
              onClick={() => {
                if (textToCopyRef.current) {
                  navigator.clipboard.writeText(textToCopyRef.current.textContent);
                }
              }}
            >
              <Copy size={15} />
            </IconButton>
          </Tooltip>
        </>
      )}
    </Grid>
  );
};

PoseDataComponent.propTypes = {
  selectedRobotPose: PropTypes.object,
  mapType: PropTypes.string,
  gpsFix: PropTypes.shape({
    latitude: PropTypes.string, // The latitude of the position of the robot
    longitude: PropTypes.string, // The longitude of the position of the robot
  }),
  // a config object containing externalMapLink, another object with the
  // url and the label of the button
  uiPreferences: PropTypes.object,
  // Related to the variant of the widget, it can be 'map-widget',
  // 'navigation-widget' or 'time-capsule-map'
  variant: PropTypes.string
};

export default PoseDataComponent;
