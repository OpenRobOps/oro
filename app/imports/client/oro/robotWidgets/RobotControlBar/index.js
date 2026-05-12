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
 * Robot Control Bar Component
 *
 * Fleet widget to be used in dashboard, contains a robot searchbar and robot buttons that execute actions
 * Meteor dependant component
 */
import React from 'react';
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
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
const RobotControlBarContainer = (props) => {
  const { robotId } = props;
  const trackerData = useTracker(() => {
    const robotHandle = robotId && Meteor.subscribe('robot.details', { robotId });
    Meteor.subscribe('actions.config');
    const isLoading = robotId && !robotHandle.ready();

    const actionsConfig = {}; // new ConfigManager(ActionDefinitions).getEntityConfig(companyEntity);
    const restartAndUpdateActionsConfig = actionsConfig && {
      [RESTART_AGENT_ACTION_ID]: actionsConfig[RESTART_AGENT_ACTION_ID],
      [UPDATE_AGENT_ACTION_ID]: actionsConfig[UPDATE_AGENT_ACTION_ID]
    };

    // Determine if Lock is enabled for this company
    const prefs = { lock: {} }; // new ConfigManager(Preferences).getEntityConfig({...});
    const lockConfig = prefs?.lock;
    const robot = robotId && Robots.findOne({ _id: robotId });

    return {
      isLoading,
      robotId,
      lockConfig,
      restartAndUpdateActionsConfig,
      robot
    };
  }, [robotId]);
  return <RobotControlBar {...props} {...trackerData} />;
};

export default RobotControlBarContainer;
