/**
 * This component is used to display the robot name as part of the
 * robot avatar (RobotPoseLayer).
 */
import React, { useMemo, useEffect, useContext } from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from 'tss-react/mui';
import {
  Paper,
  Grid,
  Typography
} from '@mui/material';
import Overlay from 'ol/Overlay';
// Modules
import { MapContext } from '../Map/Map';
import AnchoredOverlayLayer from '../Map/AnchoredOverlay';

// Styles for the name and properties legend
const useStyles = makeStyles()(theme => ({
  container: {
    backgroundColor: theme.palette.background.navMedium,
    color: theme.palette.text.contrastText,
    boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.5)',
    padding: '4px 8px',
    borderRadius: '5px',
    border: 'none',
    opacity: 0.8
  },
  robotName: {
    fontWeight: '500',
    display: 'flex',
    fontSize: '12px',
    justifyContent: 'center',
    whiteSpace: 'nowrap',
    opacity: '1'
  },
  selectedRobotNameContainer: {
    backgroundColor: theme.palette.primary.main,
    opacity: 0.9,
  },
  selectedRobotName: {
    color: theme.palette.background.white
  }
}));

const RobotName = ({ robotPose = {}, robotDetails = {}, selected }) => {
  // CSS styling
  const { classes, cx } = useStyles();

  // Get a reference to the OpenLayers map
  const { map } = useContext(MapContext);

  const { x, y } = robotPose;

  // Create feature only the first time, when we mount
  const overlay = useMemo(() => new Overlay({
    offset: [25, -30],
    opacity: 0.8,
    zIndex: selected ? 15 : 12
  }), []);

  // Mount when map and overlay are ready
  useEffect(() => {
    if (!map || !overlay) return undefined;

    map.addOverlay(overlay);

    return () => {
      if (map) {
        map.removeOverlay(overlay);
      }
    };
  }, [map, overlay]);

  // Update the features on the source each time the robotPose changes
  useEffect(() => {
    // Position overlay one meter above the robot avatar,
    // and 0.5 meters to the right to align it to the center of the avatar
    overlay.setPosition([x, y]);
  }, [x, y]);

  return (
    <AnchoredOverlayLayer x={x} y={y} sizeY={0.7}>
      <Paper
        className={cx(classes.container, { [classes.selectedRobotNameContainer]: selected })}
      >
        <Grid>
          <Typography
            className={cx(classes.robotName, { [classes.selectedRobotName]: selected })}
          >
            {robotDetails && robotDetails.name}
          </Typography>
        </Grid>
      </Paper>
    </AnchoredOverlayLayer>
  );
};

RobotName.propTypes = {
  // {x,y,theta} of the robot
  robotPose: PropTypes.object,
  robotDetails: PropTypes.object,
  selected: PropTypes.bool
};

export default RobotName;
