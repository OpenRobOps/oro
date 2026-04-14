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
 * Utility functions and constants associated with fleet context filtering
 * There is no Rendering component here, instead these are all functions
 * which facilitate and unify the handling of Fleet context across widgets.
 *
 * NOTE: REACT & METEOR FREE FILE
 */
import { isEmpty, isObject, isString, isNumber, isArray } from 'lodash';
import {
  STATUS,
  FLAG_ERROR,
  FLAG_WARNING,
  FLAG_OK,
  FLAG_OFFLINE,
  ALL_FLAGS_ARRAY,
  DEFAULT_FLAGS_STRING
} from '../../../shared/status';
import { AGG_STATUSES_KEY } from '../../../shared/constants';

// Key to add aggregated status to each robot object in robots collection
const UI_AGG_STATUS = 'uiAggregatedStatus';

/**
 * Maps a string (normally a letter) to a status value: 'e' to 20 (error), etc.
 * See FLAG_* constants
 */
const statusLetterToValue = (statusLetter) => {
  switch (isString(statusLetter) && statusLetter.toLowerCase()[0]) {
    case FLAG_ERROR:
      return STATUS.ERROR.value;
    case FLAG_WARNING:
      return STATUS.WARN.value;
    case FLAG_OK:
      return STATUS.OK.value;
    default:
      return undefined;
  }
};

/**
 * Maps a status value to a string (letter): 20 to 'e
 * See FLAG_* constants
 */
const statusValueToLetter = (statusValue) => {
  switch (statusValue) {
    case STATUS.ERROR.value:
      return FLAG_ERROR;
    case STATUS.WARN.value:
      return FLAG_WARNING;
    case STATUS.OK.value:
      return FLAG_OK;
    default:
      return undefined;
  }
};

/**
 * Check whether the given status letter is in the robot Status string
 * Returns false if the string is falsy
 *
 * NOTE: Copied also to server/status.js
 */
const isInRobotStatusString = (statusLetter, robotStatus) => {
  const status = robotStatus || DEFAULT_FLAGS_STRING;
  return status.includes(statusLetter);
};

// Formats a given a status Id and statusValue into an object param
const makeAttributeStatusUrlParam = (statusId, statusValue) => ({ [statusId]: statusValueToLetter(statusValue) });

// Validates whether the given status value is a valid value
// Valid values are [0, 10, 20] (source of truth is STATUS constant!)
const validateStatusValue = (statusValue) => !!STATUS.FROM_VALUE[statusValue];

// Validates whether the given status leetter is a valid
// Valid values are [e, w, o, f] (source of truth is FLAG constants)
const isValidStatusLetter = (statusLetter) => ALL_FLAGS_ARRAY.includes(statusLetter);

/**
 * Parser to get the statusValue and Id from a the context attributeStatus
 * (which is a url param).
 * If the attributeStatus param is not valid, return null for both statusId and value
 * Ex, valid: {cpuLoadPercentage: e } => { statusId: cpuLoadPercentage, statusValue: 20 }
 */
const getAttributeStatusFromParam = (attributeStatus) => {
  // If attributeStatus is of invalid format or empty, return nulls
  if (!isObject(attributeStatus) || isEmpty(attributeStatus)) {
    return { statusId: null, statusValue: null };
  }
  // Extract the statusId and Letter from the object
  const statusId = Object.keys(attributeStatus)[0];
  const statusLetter = attributeStatus[statusId];
  // Validate whether the status letter is valid (e, w, o, f)
  if (!isValidStatusLetter(statusLetter)) {
    return { statusId: null, statusValue: null };
  }
  const statusValue = statusLetterToValue(statusLetter);

  return { statusId, statusValue };
};

/**
 * Specialized function to apply a filter on robots
 * e.g. when filtering by cpuLoadPercentage[error|warning|ok]
 * the error/warning/ok values are represented by their numerical equivalents
 * [20/10/0]
 * EX, for input: ('cpuLoadPercentage[20]', { robotId: { cpuLoadPercentage: { value: 10 }}..., { _id: robotId, name: robotName, ...}) = false
 * gave false because the status value for the robot (10) differed from the given attributeStatus of 20
 */
const filterFunctionForStatusItem = (attributeStatus, robot) => {
  const robotStatus = robot.statuses;
  const { statusId, statusValue } = getAttributeStatusFromParam(attributeStatus);
  let ok = true;
  if (statusId) {
    ok = false;
    if (robotStatus && robotStatus[statusId]) {
      ok = statusValue === robotStatus[statusId].value;
    }
  }
  return ok;
};

/**
 * Filters a robot according to the provided
 * fleet context and aggregated statuses
 *
 * fleetContext: Object, supports { robotStatus, attributeStatus }
 * aggStatuses: Object, keys are robotIds { robotId: aggStatus: {...} }
 *
 */
const fleetFilterFunction = fleetContext => (robot) => {
  const { robotStatus, attributeStatus } = fleetContext;

  let ok = true;

  // filter out robots by their aggregated status
  // These are: Error, Warning, ok, offline/inactive.
  const aggStatus = robot && robot[UI_AGG_STATUS] && robot[UI_AGG_STATUS][AGG_STATUSES_KEY];
  const aggStatusValue = aggStatus && aggStatus.value;
  switch (aggStatusValue) {
    case STATUS.ERROR.value:
      ok = ok && isInRobotStatusString(FLAG_ERROR, robotStatus);
      break;
    case STATUS.WARN.value:
      ok = ok && isInRobotStatusString(FLAG_WARNING, robotStatus);
      break;
    case STATUS.OK.value:
      ok = ok && isInRobotStatusString(FLAG_OK, robotStatus);
      break;
    // default: the default case includes inactive / not reported
    // (there are no more filters in the UI)
    default:
      ok = ok && isInRobotStatusString(FLAG_OFFLINE, robotStatus);
  }

  // When filtering out offline robots, check agentOnline status
  if (!isInRobotStatusString(FLAG_OFFLINE, robotStatus) && aggStatus && !aggStatus.agentOnline) {
    return false;
  }

  // filter out robots by attribute status
  if (attributeStatus) {
    ok = ok && filterFunctionForStatusItem(attributeStatus, robot);
  }
  return ok;
};

/**
 * Specialized function to apply a filter on robots by robotId
 * returns: true, if the robotId exists and the robotId is not equal to the robot._id
 *          false, if the robotId does not exist or the robotId is equal to robot._id
*/
const filterFunctionForRobotId = robotId => (robot) => {
  if (robotId && robot._id !== robotId) {
    return false;
  }
  return true;
};

/**
 * Function to group up the robots with the groupBy criteria
 * @param {array} groups, Array of groups criterias in which robots can be grouped
 * @param {string} groupBy, String that represents the ID criteria of the groups array
 * @param {array} sortedRobots, List of ungrouped robots to be grouped
 * @return {object} Return object with: filteredRobotsObj, and filteredGroups
 */
const groupingRobots = (groups, groupBy, sortedRobots) => {
  const filteredGroups = groups.filter(c => c.matchesCriteria(groupBy));
  // Sort groups in case they have a defined `order` field
  filteredGroups.sort((a, b) => {
    const orderA = a && isNumber(a.order) ? a.order : filteredGroups.length + 1;
    const orderB = b && isNumber(b.order) ? b.order : filteredGroups.length + 1;
    return orderA - orderB;
  });
  filteredGroups.push(unassignedColl);
  // Filter the robots by the groups of the selected grouping criteria
  const filteredRobotsObj = {};
  // prepare an array to track robots already assigned
  const alreadyClassified = {};
  // for each filtered group, filter the array of robots keeping only the ones
  // that have that group assigned. If the robot is not in the group
  // check if it has not been classified and so add it to the unasigned group.
  filteredGroups.forEach((group) => {
    const filteredRobots = sortedRobots.filter(
      r => group.classifyRobot(r, alreadyClassified, r.statuses)
    );
    if (filteredRobots.length > 0) {
      filteredRobotsObj[group._id] = filteredRobots;
    }
  });

  return { filteredRobotsObj, filteredGroups };
};

const STATUSES_LABELS = {
  [FLAG_ERROR]: 'error',
  [FLAG_WARNING]: 'warn',
  [FLAG_OK]: 'ok',
  [FLAG_OFFLINE]: 'offline',
};

export {
  fleetFilterFunction,
  filterFunctionForStatusItem,
  makeAttributeStatusUrlParam,
  getAttributeStatusFromParam,
  isInRobotStatusString,
  filterFunctionForRobotId,
  groupingRobots,
  FLAG_ERROR,
  FLAG_WARNING,
  FLAG_OK,
  FLAG_OFFLINE,
  DEFAULT_FLAGS_STRING,
  UI_AGG_STATUS,
  STATUSES_LABELS
};
