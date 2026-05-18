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
 * Common status declarations and functions to manipulate and represent statuses.
 */
import moment from 'moment';
import { Mongo } from 'meteor/mongo';
import SimpleSchema from 'simpl-schema';
import { isArray, intersection, isNumber } from 'lodash';
// InOrbit imports
import { DEFAULT_RECENTLY_ONLINE_SEC, STATUS } from '../shared/status';
import { HACK_GHOST_UPDATE_STAMP_VALUE, AGG_STATUSES_KEY } from '../shared/constants';
import { COLLECTIONS } from '../shared/constants';

const RobotStatus = new Mongo.Collection(COLLECTIONS.ROBOT_STATUS);
// TODO describe this view, point to design doc
const RobotsWithStatus = new Mongo.Collection(COLLECTIONS.ROBOTS_WITH_STATUS);
/**
 * _id: == robotId
 * <attributeId>: RobotStatus.schema (validation done by hand in status.js)
 * ...
 */
// TODO: Update the schema. This is NOT up to date (and it may have never been)
// * `formattedAttributeValue` is `formattedValue`.
// `formattedAttributeValue` does not exist and is not used.
// * `hasOpenAlert: { type: Boolean, optional: true },` is missing.
RobotStatus.schema = new SimpleSchema({
  name: String, // NOTE: Denormalized. Source of truth in AttributeDefinitions
  value: Number, // Status values coming from /lib/status.js
  attributeValue: Number, // The attribute value that triggered the status when last evaluated
  formattedAttributeValue: // Same as above, formatted using this attribute's rules
    { type: String, optional: true },
  ts: Number,
  message: // Textual description of the current status
    { type: String, optional: true },
  lastChangeTs: // In milliseconds, last time the value changed
    { type: Number, optional: true },
  incidentId: { type: String, optional: true },
  data: { type: Object, optional: true }
});

const StatusConfig = new Mongo.Collection(COLLECTIONS.STATUS_CONFIG);
/**
 *  attributeId: str,
 *  rules: [{
 *       functionName: "higherThan" - Name of the pre-defined function to use
 *       params: Object             - Parameters to the function. This is what will most likely be
 *                                    modified per entity (e.g.: company)
 *       status: STATUS_ERROR       - Value returned in case the result of the function is true
 *     }, {
 *       function: "higherThan"
 *       params: Object
 *       state: STATUS_WARN
 *     }]
 *  }
 */
if (Meteor.isServer) {
  StatusConfig.rawCollection().createIndex({ attributeId: 1 }, { unique: true });
}


/**
 * This field is used in robots_with_status publication as a TEMPORARY field to calculate and
 * stored an aggregated status value within a RobotStatus document (or rather: on synthetic
 * documents created from RobotsWithStatus view).
 * Make sure to use this field everywhere we used the *calculated* aggregated status.
 * Note that in some future, aggregated statuses should be calculated by services so we can
 * include this field (or some other name) in DB queries.
 */
const AGG_STATUS_FIELD = '__aggregatedStatusValue__'; // any field name, not an attribute id
// Offline-ness concepts
//
// 1. What thing are we talking about? It can be:
//  - How long a robot has been offline
//  - How long since a particular status has been updated
//
// 2. With respect to how long a robot has been offline:
//  a. Offline: Value of the "agentOnline" Data Source. Takes effect immediately.
//       Fleet Status will show all Status chip colors as offline / faded.
//
//  b. Recently Online (default = 1hr, configurable via recentlyOnlineTime):
//       Whether a robot, despite being offline, is shown in the same status sort order
//       as before, so that it doesn't 'move' as soon as it goes offline.
//     isLongOffline -> the converse of "recently online". Same threshold / values.
//
//     For filtering and sorting, the value of 'agentOnline' (the property inside the internal
//     'status' object used by the FleetStatusComponent) is based on the result of isLongOffline.
//     @see the FleetStatusComponent.calculateAggStatus function.
//
//     When filtering robots in a Fleet context, only robots Long Offline (not Recently Online)
//     will be filtered out.
//
// TODO: Organize and clarify:
//   - STALE_STATUS_TIME ---> For 'status' color -> show 'stale OK/WARN/ERROR'. 5 minutes.
//   - OFFLINE_STATUS_TIME -> For 'status' color -> show all black / missiong. 1 week.

const OFFLINE_STATUS_TIME = moment.duration(1, 'week').valueOf();
const STALE_STATUS_TIME = moment.duration(5, 'minutes').valueOf();

// DO NOT EXPORT THIS MAPPING, FOR INTERNAL USE OF STATUS.JS ONLY
// This index map is for internal use of the status utility functions of:
// - aggregateFleetStatus
// - getCombinedStatusValue
// indexes of the combined status values for easier code read
const COMBINED_STATUS_IX_MAPPING = {
  errorCount: 0,
  errorIx: 1,
  warnCount: 2,
  warnIx: 3,
  okCount: 4,
  okIx: 5
};

/**
 * Whether this robot has been offline for enough time to consider it
 * less interesting for prioritization purposes.
 *
 * NOTE that the time used to do this check can be managed by
 * setting the recentlyOnlineTime configuration parameter as a ui preference.
 * If not, a default value (DEFAULT_RECENTLY_ONLINE_SEC) will be used.
 */
const isLongOffline = (robot, recentlyOnlineTime, now = Date.now()) => {
  if (!recentlyOnlineTime) {
    recentlyOnlineTime = DEFAULT_RECENTLY_ONLINE_SEC;
  }
  // HACK(adamantivm) For ghost fleet
  if (robot.updateStamp == HACK_GHOST_UPDATE_STAMP_VALUE) {
    return false;
  }
  return (!robot.status || !robot.status.agentOnline)
    && (now - robot.updateStamp) > recentlyOnlineTime * 1000;
};

/**
 * Combine status values with priority.
 *
 * status should be an object with one key per attribute
 * and a status per element.
 *
 * If the optional attributeIdList is provided, then only
 * the provided attributeIds are used for the calculation.
 *
 * @arg status object of schema: { attributeId: { value, ts, ..otherkeys } }
 * @arg attributeIdList array of attributeIds to be considered in sorting
 * @arg robotName the robot name
 *
 * @return {
 *  combinedStatusValue: [
 *    (minus) number of ERROR statuses,
 *    < index of first ERROR, if attributeIdList is given, or -1 >,
 *    (minus) number of WARNING statuses,
 *    < index of first WARNING, if attributeIdList is given, or -1 >,
 *    (minus) number of OK statuses,
 *    < index of first OK, if attributeIdList is given, or -1 >
 *   ],
 *  statusTimestamps: [
 *     error value most recent timestamp,
 *     warning value most recent timestamp,
 *     ok value most recent timestamp,
 *   ]
 * }
 *
 * This allows doing lexicographical comparison giving priority to number
 * of errors, then priority of topmost error, then follow with warnings.
 */
const getCombinedStatusValue = (
  status = {},
  attributeIdList,
  robotName // TODO(herchu) Use this to break ties
) => {
  // simple function for comparing timestamps
  const compareTimestamp = (statusTs, statusTimestamps, ix) => (
    statusTimestamps[ix] > statusTs ? statusTimestamps[ix] : statusTs);
  // TODO (Pisti) use robotName for the sorting of the robots by alphabetical order
  // indexes of the combined status values for easier code read
  const {
    okCount, okIx, warnCount, warnIx, errorCount, errorIx
  } = COMBINED_STATUS_IX_MAPPING;
  const statusTimestamps = [0, 0, 0];
  attributeIdList = attributeIdList || Object.keys(status);
  const value = [0, -1, 0, -1, 0, -1];
  attributeIdList.forEach((attrId, ix) => {
    // TODO Account for stale status values
    if (attrId in status) {
      switch (status[attrId].value) {
        case STATUS.OK.value:
          value[okCount] -= 1;
          if (attributeIdList && value[okIx] === -1) {
            value[okIx] = ix;
          }
          // Save the most recent timestamp
          statusTimestamps[2] = compareTimestamp(status[attrId].ts, statusTimestamps, 2);
          break;
        case STATUS.WARN.value:
          value[warnCount] -= 1;
          if (attributeIdList && value[warnIx] === -1) {
            value[warnIx] = ix;
          }
          // Save the most recent timestamp
          statusTimestamps[1] = compareTimestamp(status[attrId].ts, statusTimestamps, 1);
          break;
        case STATUS.ERROR.value:
          value[errorCount] -= 1;
          if (attributeIdList && value[errorIx] === -1) {
            value[errorIx] = ix;
          }
          // Save the most recent timestamp
          statusTimestamps[0] = compareTimestamp(status[attrId].ts, statusTimestamps, 0);
          break;
        default:
          break;
      }
    } else {
      // TODO Better ideas on how to account for missing values?
      // Currently counting as zero
    }
  });
  return { combinedStatusValue: value, statusTimestamps };
};

/**
 * check whether the age of the status is past the stale-ness threshold
 * @arg statusAge is Date.now() - status.ts
 */
const isStatusStale = statusAge => statusAge > STALE_STATUS_TIME;
/**
 * check whether the age of the status is past the offline-ness threshold
 * @arg statusAge is Date.now() - status.ts
 */
const isStatusOffline = statusAge => statusAge > OFFLINE_STATUS_TIME;

/**
 * Calculates the display color based on a given status and agent online status
 */
const getStatusColor = (status, agentOnline, theme) => {
  if (!status) {
    return agentOnline
      ? theme.palette.incidents.inactive
      : theme.palette.incidents.staleInactive;
  }
  let statusAge = Date.now() - status.ts;
  // HACK(adamantivm) Ghost fleet
  if (status.ts == 12) {
    statusAge = 0;
  }
  // If older than a week --> show offline
  if (!agentOnline && isStatusOffline(statusAge)) {
    return theme.palette.incidents.staleInactive;
    // If offline or older than five minutes, then it's stale
  } else if (!agentOnline || isStatusStale(statusAge)) {
    switch (status.value) {
      case STATUS.OK.value:
        return theme.palette.incidents.staleOk;
      case STATUS.WARN.value:
        return theme.palette.incidents.staleWarning;
      case STATUS.ERROR.value:
        return theme.palette.incidents.staleError;
      default:
        return theme.palette.incidents.staleInactive;
    }
  } else {
    // Online and current status value
    switch (status.value) {
      case STATUS.OK.value:
        return theme.palette.incidents.ok;
      case STATUS.WARN.value:
        return theme.palette.incidents.warning;
      case STATUS.ERROR.value:
        return theme.palette.incidents.error;
      default:
        return theme.palette.incidents.inactive;
    }
  }
};

/**
 * Compares two objects of the form { value, ts, agentOnline }
 * This function is used for sorting algorithms.
 * It returns -1 if status1 should be first (ie. higher priority),
 * or 0 if they are identical,
 * or 1 if status2 should be first (higher priority).
 *
 * Note that the ordering given this compare function yields something like:
 * [
 *   (online, error),
 *   (online, warn),
 *   (online, ok),
 *   (online, invalid),
 *   (offline, error),
 *   (offline, warn),
 *   (offline, ok),
 *   (offline, invalid/stale)
 * ]
 */
const compareStatusValue = (
  { value: value1, agentOnline: agentOnline1 },
  { value: value2, agentOnline: agentOnline2 }
) => {
  if (agentOnline1 != agentOnline2) {
    // Online should always go first
    return agentOnline1 ? -1 : 1;
  } else if (value1 != value2) {
    // Same offline status
    return value1 > value2 ? -1 : 1;
  } else {
    return 0;
  }
};

/**
 * Given a set of robot status values: if it is online and the status values from
 * the DB, and given a list of statuses we care about, it returns an aggregated
 * "robot status" with three elements { agentOnline, value, ts } with the
 * highest status value (and its timestamp).
 *
 * This same object format is shared with compareStatusValue() (for sorting) and
 * getAggregatedFleetStatus().
 */
const getAggregatedRobotStatus = (robot, statusList, addEmptyLabel = false) => {
  const agentOnline = !isLongOffline(robot);
  const ret = {
    value: -1,
    ts: 0,
    agentOnline
  };
  statusList && statusList.forEach((statusId) => {
    const status = robot.statuses[statusId];
    if (status && isNumber(status.value)) {
      if (status.value == ret.value) {
        ret.ts = Math.max(ret.ts, status.ts);
      } else if (status.value > ret.value) {
        ret.value = status.value;
        ret.ts = status.ts;
      }
    } else if (statusId == AGG_STATUSES_KEY) {
      ret.value = robot[AGG_STATUS_FIELD];
      ret.ts = robot[AGG_STATUS_FIELD].ts
    }
  });
  if (addEmptyLabel) {
    ret.label = '\u00A0';
  }
  return ret;
};

/**
 * Function to calculate some aggregated status value across several robots.
 *
 * @arg robots an array of Robot objects, each one must contain a statuses object
 * @arg recentlyOnlineTime time in seconds before a robot is considered long offline
 *
 * @return an object `{ agentOnline, value, ts, visibleStatusValue }` taken as an aggregation of all
 *      the robots statuses given. These values can be then sent to getStatusColor().
 */
const getAggregatedFleetStatus = (
  robots, statusList, recentlyOnlineTime, now = Date.now()
) => {
  // indexes of the combined status values for easier code read
  const {
    okCount, okIx, warnCount, warnIx, errorCount, errorIx
  } = COMBINED_STATUS_IX_MAPPING;
  const fleetStatus = {
    value: -1,
    ts: 0,
    agentOnline: false,
    visibleStatusValue: [0, -1, 0, -1, 0, -1]
  };
  robots.reduce((acc, robot) => {
    const agentOnline = !isLongOffline(robot, recentlyOnlineTime, now);
    const {
      combinedStatusValue: robotStatus, statusTimestamps
    } = getCombinedStatusValue(robot.statuses, statusList, robot.name);
    // now save the most recent time stamp
    acc.ts = Math.max(...statusTimestamps, acc.ts);
    // We only care about robots that are online or recentlyOnline
    if (agentOnline) {
      // if any robot is online, overall status will show as online
      acc.agentOnline = agentOnline;
      // sum the number of ERRORs (this number is a negative)
      acc.visibleStatusValue[errorCount] += robotStatus[errorCount];
      // take the smallest error index different to -1
      if (acc.visibleStatusValue[errorIx] == -1 || (
        robotStatus[errorIx] !== -1 && acc.visibleStatusValue[errorIx] > robotStatus[errorIx])) {
        acc.visibleStatusValue[errorIx] = robotStatus[errorIx];
      }

      // sum the WARNings
      acc.visibleStatusValue[warnCount] += robotStatus[warnCount];
      // take the smallest Warning index different to -1
      if (acc.visibleStatusValue[warnIx] == -1 || (
        robotStatus[warnIx] !== -1 && acc.visibleStatusValue[warnIx] > robotStatus[warnIx])) {
        acc.visibleStatusValue[warnIx] = robotStatus[warnIx];
      }
      // sum the OKs
      acc.visibleStatusValue[okCount] += robotStatus[okCount];
      // take the smallest Ok index different to -1
      if (acc.visibleStatusValue[okIx] == -1 || (
        robotStatus[okIx] !== -1 && acc.visibleStatusValue[okIx] > robotStatus[okIx])) {
        acc.visibleStatusValue[okIx] = robotStatus[okIx];
      }
    }
    return acc;
  }, fleetStatus);

  // Aggregate the final status of the location as a statusValue
  if (fleetStatus.visibleStatusValue[errorCount] < 0) {
    fleetStatus.value = STATUS.ERROR.value;
  } else if (fleetStatus.visibleStatusValue[warnCount] < 0) {
    fleetStatus.value = STATUS.WARN.value;
  } else if (fleetStatus.visibleStatusValue[okCount] < 0) {
    fleetStatus.value = STATUS.OK.value;
  }

  return fleetStatus;
};

/**
 * Handle undefined status values
 */
const getStatusValue = (value) => {
  if (value === undefined) {
    return -1;
  } else {
    return value;
  }
};

/**
 * Returns the status object corresponding to a numeric value; or
 * null if not found.
 * E.g. for value=10, it returns { value:10, label:"warning"}.
 */
const getStatusFromValue = (value) => {
  for (const key in STATUS) {
    if (STATUS[key].value == value) {
      return STATUS[key];
    }
  }
  return null;
};

/**
 * Lexicographically compare two arrays. Note they are assumed to contain
 * the same number of elements.
 */
const lexCompare = (arr1, arr2) => {
  for (let n = arr1.length, i = 0; i < n; i++) {
    if (arr1[i] != arr2[i]) {
      return arr1[i] < arr2[i] ? -1 : 1;
    }
  }
  return 0;
};

/**
 * Helper function for sortRobotsByStatus, that compares an already calculated
 * `visibleStatusValue` from two objects (normally Robots)
 */
const compareByVisibleStatus = (a, b) => (
  lexCompare(a.visibleStatusValue, b.visibleStatusValue)
);

/**
 * Sort robots by the configured visible status values.
 */
const sortRobotsByStatus = (robots, statusList, recentlyOnlineTime) => (
  robots?.map((r) => {
    // Build a `visibleStatusValue` array determining sort criteria
    let sortArray = [0];
    if (!isLongOffline(r, recentlyOnlineTime)) {
      sortArray = sortArray.concat(
        getCombinedStatusValue(r.statuses, statusList).combinedStatusValue, r.name
      );
    } else {
      sortArray[0] = 1; // push robot to back, seen long ago
      sortArray.push(-r.updateStamp); // simply sort by recency (negative, most recent values first)
    }
    return Object.assign({ visibleStatusValue: sortArray }, r);
  }).sort(compareByVisibleStatus)
);

export {
  RobotStatus,
  RobotsWithStatus,
  StatusConfig,
  STATUS,
  getStatusColor,
  getStatusValue,
  getStatusFromValue,
  getAggregatedRobotStatus,
  getAggregatedFleetStatus,
  compareStatusValue,
  lexCompare,
  sortRobotsByStatus,
  compareByVisibleStatus,
  isLongOffline,
  OFFLINE_STATUS_TIME,
  STALE_STATUS_TIME,
  AGG_STATUS_FIELD
};
