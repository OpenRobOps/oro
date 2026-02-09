/**
 * RobotOfflineBar displays a sticky bar under the menu tabs.
 * It includes an icon and some text to let the user quickly understand that a robot is offline
 */
import React from 'react';
import PropTypes from 'prop-types';
import { Typography } from '@mui/material';
import { withStyles } from 'tss-react/mui';
import RobotOfflineIcon from '../../graphics/op/RobotOfflineIcon';

const styles = theme => ({
  container: {
    position: 'sticky',
    top: '0px',
    /* This component needs to have the same zIndex as the tabs in dashboardSelector,
     to avoid being hidden by the shadow of the tab container and
     to not be on top of the menu selector. */
    zIndex: '1000',
    backgroundColor: theme.palette.incidents.warning,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    // Match widget card shadow style
    boxShadow: `5px 5px 10px ${theme.palette.boxShadow.light}, -3px -3px 5px 1px ${theme.palette.boxShadow.white}`,
    padding: '4px 16px',
    margin: '6px 45px 6px 30px',
    borderRadius: '10px',
  },
  message: {
    fontWeight: 500,
    fontSize: '12px',
    paddingLeft: '8px'
  },
  icon: {
    fontSize: '18px'
  }
});

const ROBOT_OFFLINE_TEXT = 'has been offline since';

const RobotOfflineBar = (props) => {
  const { robot, robotOnline, classes, lastUpdate } = props;
  const robotName = robot && robot.name;
  return (
    <>
      {robot && !robotOnline && (
        <div className={classes.container} data-test="robot-offline-bar">
          <RobotOfflineIcon
            robotOfflineBar
            classes={{ root: classes.icon }}
          />
          <Typography className={classes.message}>
            {robotName} {ROBOT_OFFLINE_TEXT} {lastUpdate}
          </Typography>
        </div>
      )}
    </>
  );
};

RobotOfflineBar.propTypes = {
  classes: PropTypes.object.isRequired,
  robot: PropTypes.object,
  robotOnline: PropTypes.bool,
  lastUpdate: PropTypes.string
};

export default withStyles(RobotOfflineBar, styles, { withTheme: true });
