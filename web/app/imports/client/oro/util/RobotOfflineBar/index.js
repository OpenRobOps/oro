/**
 * RoborOfflineBar Meteor dependant component,
 * Displays a sticky bar when a robot it's offline
 */
import React from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import { CTX_PROPS, readRobotProp } from '../../../../lib/context';
import { useRobotData } from '../hooks';
import RobotOfflineBarComponent from './RobotOfflineBarComponent';

const RobotOfflineBar = (props) => {
  const { context } = props;
  // Convenience function for operating on context robot props
  const getRobotId = (urlContext, scope = {}) => (
    readRobotProp({ ctx: urlContext, scope: scope.read, prop: CTX_PROPS.ROBOT_ID })
  );
  // Get data from robot selected
  const robotId = getRobotId(context);
  const robot = useRobotData(robotId);
  // Get the last update of the robot
  const lastUpdate = moment(robot && robot.updateStamp).fromNow();
  // Check if the robots is online or offline
  const robotOnline = robot && robot.status && robot.status.agentOnline;

  return (
    <RobotOfflineBarComponent lastUpdate={lastUpdate} robotOnline={robotOnline} robot={robot} />
  );
};

RobotOfflineBar.propTypes = {
  context: PropTypes.object.isRequired
};

export default RobotOfflineBar;
