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

import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
// ORO modules
import { Robots } from '../../../lib/collections';
import { ActionDefinitions } from '../../../lib/actions';
import { fetchRobotAttributeValues } from '../../../lib/attributes';
import { VITAL_SPEED_LINEAR, VITAL_SPEED_ANGULAR } from '../../../shared/attributes';

/**
 * Receives a robotId and returns the robot.
 * It uses useTracker to load the data.
 * @param {string} robotId
 */
const useRobotData = (robotId) => useTracker(() => {
    const handle = Meteor.subscribe('robot.details', { robotId });
    const robotData = Robots.findOne({ _id: robotId });
    return { data: robotData, isLoading: !handle.ready() };
  }, [robotId]);

/**
 * Returns true if the robot is currently moving (has non-zero linear or angular velocity).
 * @param {string} robotId
 */
const useIsRobotMoving = robotId => useTracker(() => {
  const attributes = [VITAL_SPEED_LINEAR, VITAL_SPEED_ANGULAR];
  Meteor.subscribe('attributes.teleopGauges', { robotId, attributes });
  const vitals = fetchRobotAttributeValues({ robotId, attributes }) || {};
  return ((vitals[VITAL_SPEED_LINEAR] && vitals[VITAL_SPEED_LINEAR].value !== 0)
    || (vitals[VITAL_SPEED_ANGULAR] && vitals[VITAL_SPEED_ANGULAR].value !== 0));
}, [robotId]);

/**
 * Returns all actions config — a map from actionId to action definition.
 * Actions in oro are global (not per-entity), so no entityId/entityType needed.
 * @returns {{ data: Object, isLoading: boolean }}
 */
const useActionsConfig = () => useTracker(() => {
  const handle = Meteor.subscribe('actions.config');
  const docs = ActionDefinitions.find({}).fetch();
  // Build a map from actionId to action definition
  const data = docs.reduce((acc, doc) => {
    const key = doc.actionId || doc._id;
    if (key) acc[key] = doc;
    return acc;
  }, {});
  return { data, isLoading: !handle.ready() };
}, []);

export {
  useRobotData,
  useIsRobotMoving,
  useActionsConfig,
};
