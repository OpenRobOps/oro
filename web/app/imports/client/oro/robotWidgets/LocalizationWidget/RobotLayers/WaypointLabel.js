/**
 * Helper component to render labels around map annotations (for now: waypoints)
 * It is used by NamedWaypointLayer and by its Edit mode, WaypointEdit layer.
 */
import React from 'react';
import { Grid, Typography, TextField } from '@mui/material';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { makeStyles } from 'tss-react/mui';

const useStyles = makeStyles()(theme => ({
  containerActive: {
    backgroundColor: theme.palette.primary.main,
    boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.5)',
    display: 'flex',
    flexDirection: 'column',
    padding: '8px 8px',
    gap: '10px',
    border: `3px solid ${theme.palette.primary.main}`,
    borderRadius: '8px',
    minWidth: '80px',
    alignItems: 'center',
    opacity: 0.8,
  },
  containerInactive: {
    backgroundColor: theme.palette.background.navMedium,
    boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.5)',
    borderRadius: '4px',
    padding: '4px 4px',
    minWidth: '70px',
    opacity: 0.8,
  },
  waypointActiveLabel: {
    fontSize: '0.875rem',
    fontWeight: theme.fontWeight.bold,
    color: theme.palette.background.white
  },
  waypointInactiveLabel: {
    fontSize: '12px',
    fontWeight: theme.fontWeight.medium,
    color: theme.palette.background.white,
    lineHeight: '16px',
    textAlign: 'center'
  },
  waypointLabelContainer: {
    padding: '2px 0px',
  },
  waypointCoordinates: {
    fontSize: '0.875rem',
    color: theme.palette.background.white,
    display: 'flex',
    justifyContent: 'space-between'
  },
  labelEdit: {
    background: '#b3d4ff',
    minWidth: '150px',
    borderRadius: '4px',
    '& .MuiFilledInput-root': {
      background: '#b3d4ff',
      color: '#000',
      borderRadius: '4px'
    },
    '& .MuiFilledInput-root:hover': {
      background: '#b3d4ff',
    },
    '& .MuiFilledInput-root:focus': {
      background: '#b3d4ff',
    }
  }
}));

const WaypointLabel = ({ waypoint, isSelected, isEditing, isGhost, onLabelEdit, isMissionStep }) => {
  const { classes } = useStyles();
  const { x, y, theta, label = 'Waypoint' } = waypoint || {};

  return (
    <div
      className={classnames({
        [classes.containerActive]: isSelected || isEditing || isMissionStep,
        [classes.containerInactive]: !isEditing && !isSelected && !isGhost && !isMissionStep
      })}
    >
      {isSelected || isEditing ? (
        <>
          <Grid
            className={classes.waypointLabelContainer}
          >
            { isEditing ? (
              <TextField
                className={classes.labelEdit}
                value={label}
                onClick={onLabelEdit}
                readOnly
                hiddenLabel
                variant="filled"
                size="small"
              />
            ) : (
              <Typography className={classes.waypointActiveLabel}>
                {label}
              </Typography>
            )}
          </Grid>
          <Grid>
            <Typography className={classes.waypointCoordinates}>
              X:
              &nbsp;
              <div>{Number.isFinite(x) && x.toFixed(3)}</div>
            </Typography>
            <Typography className={classes.waypointCoordinates}>
              Y:
              &nbsp;
              <div>{Number.isFinite(y) && y.toFixed(3)}</div>
            </Typography>
            <Typography className={classes.waypointCoordinates}>
              θ:
              &nbsp;
              <div>{Number.isFinite(theta) && theta.toFixed(3)}</div>
            </Typography>
          </Grid>
        </>
      ) : !isGhost && (
        <Typography className={classes.waypointInactiveLabel}>
          {label}
        </Typography>
      )}
    </div>
  );
};

WaypointLabel.propTypes = {
  waypoint: PropTypes.object,
  isEditing: PropTypes.bool,
  isGhost: PropTypes.bool,
  isSelected: PropTypes.bool,
  onLabelEdit: PropTypes.func, // callback to start editing label
  isMissionStep: PropTypes.bool
};

export default WaypointLabel;
