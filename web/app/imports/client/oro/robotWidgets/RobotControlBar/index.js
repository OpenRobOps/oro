/**
 * Robot Control Bar Component
 *
 * Fleet widget to be used in dashboard, contains a robot searchbar and robot buttons that execute actions
 * Meteor dependant component
 */
import React from 'react';
import { Meteor } from 'meteor/meteor';
import { withTracker } from 'meteor/react-meteor-data';
// ORO modules
import { Preferences, Robots } from '../../../../lib/collections';
import { ACTION_TYPES, ActionDefinitions, createInternalActionId } from '../../../../lib/actions';
import RobotControlBarComponent from './RobotControlBarComponent';
import RobotInfoButtons from '../RobotInfoButtons';
import WithSnackbar from '../../util/WithSnackbar';
import WithActionsContext from '../../util/WithActionsContext';
import Lock from '../Lock';
import RobotSearch from '../../util/RobotSearch';

const RESTART_AGENT_ACTION_ID = createInternalActionId(ACTION_TYPES.RESTART_AGENT);
const UPDATE_AGENT_ACTION_ID = createInternalActionId(ACTION_TYPES.UPDATE_AGENT);

const RobotInfoButtonsWithActionsContext = props => WithActionsContext(props, RobotInfoButtons);

const RobotInfoButtonsWithActionsContextAndSnackbar = props => (
  WithSnackbar(props, RobotInfoButtonsWithActionsContext)
);

const RobotControlBar = props => (
  <RobotControlBarComponent
    {...props}
    Lock={Lock}
    RobotInfoButtons={RobotInfoButtonsWithActionsContextAndSnackbar}
    RobotSearch={RobotSearch}
  />
);

/**
 * Get module configuration for customizations
 */
const RobotControlBarContainer = withTracker(({ robotId }) => {
  const robotHandle = robotId && Meteor.subscribe('robot.details', { robotId });
  Meteor.subscribe('actions.config');
  const isLoading = robotId && !robotHandle.ready();

  const actionsConfig = {}// new ConfigManager(ActionDefinitions).getEntityConfig(companyEntity);
  const restartAndUpdateActionsConfig = actionsConfig && {
    [RESTART_AGENT_ACTION_ID]: actionsConfig[RESTART_AGENT_ACTION_ID],
    [UPDATE_AGENT_ACTION_ID]: actionsConfig[UPDATE_AGENT_ACTION_ID]
  };

  // Determine if Lock is enabled for this company
  const prefs = { lock: {} } ; //new ConfigManager(Preferences).getEntityConfig({
    // ...companyEntity,
  //   fields: ['lock']
  // });
  const lockConfig = prefs?.lock;
  const robot = robotId && Robots.findOne({ _id: robotId });

  return {
    isLoading,
    robotId,
    lockConfig,
    restartAndUpdateActionsConfig,
    robot
  };
})(RobotControlBar);

export default RobotControlBarContainer;
