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

import { useMemo } from 'react';
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
// ORO modules
import { Robots } from '../../../lib/collections';
import { ActionDefinitions } from '../../../lib/actions';
import { fetchRobotAttributeValues } from '../../../lib/attributes';
import { VITAL_SPEED_LINEAR, VITAL_SPEED_ANGULAR } from '../../../shared/attributes';
import { ID_TYPE_ROBOT } from '../../../shared/constants';

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
 * Returns the locationId for the given robot object.
 * In oro, locationId is stored directly on the robot document.
 * @param {{ robot: object }} params
 * @returns {{ locationId: string|undefined, isLoading: boolean }}
 */
const useRobotLocation = ({ robot } = {}) => {
  const locationId = robot?.locationId;
  return { locationId, isLoading: false };
};

/**
 * Returns the actions config for a robot — a map from actionId to action definition.
 * @param {string} robotId
 * @returns {{ data: Object, isLoading: boolean }}
 */
const useActionsConfig = (robotId) => {
  const queryArgs = useMemo(
    () => ({ entityId: robotId, entityType: ID_TYPE_ROBOT }),
    [robotId]
  );
  return useTracker(() => {
    if (!robotId) return { data: {}, isLoading: false };
    const handle = Meteor.subscribe('actions.config', queryArgs);
    const docs = ActionDefinitions.find(queryArgs).fetch();
    // Build a map from actionId to action definition
    const data = docs.reduce((acc, doc) => {
      if (doc.actionId) acc[doc.actionId] = doc;
      return acc;
    }, {});
    return { data, isLoading: !handle.ready() };
  }, [robotId, queryArgs]);
};

/**
 * Stub: fetches global UI preferences for a widget.
 * TODO: Implement with a real UIPreferences Meteor collection.
 * @returns {{ data: null, isLoading: false }}
 */
const useUIPreferences = (_widget) => {
  return { data: null, isLoading: false };
};

export {
  useRobotData,
  useIsRobotMoving,
  useRobotLocation,
  useActionsConfig,
  useUIPreferences,
};
