/**
 * Common status declarations and functions to manipulate and represent statuses.
 *
 * Shared, module, no Meteor stuff allowed!
 */

import { isIncluded } from "../lib/util";

/**
 * Status constants
 */
const STATUS = {
  OK: { value: 0, text: 'OK' },
  WARN: { value: 10, text: 'warning' },
  ERROR: { value: 20, text: 'error' },
  // For convenience, this structure also contains in runtime,
  // generated below. e.g.:
  //
  // TEXT: {
  //   '0': 'OK',
  //   '10': 'warning', ...
  // },
  // FROM_VALUE: {
  //  '0': { value: 0, text: 'OK' },
  //  '10': { value: 10, text: 'warning' }, ...
  // }
  // FROM_TEXT": {
  //   'warning': { value: 10, text: 'warning' }, ...
  // }
};

// Convenience high-speed accessor for textual values and for the entire objects
const texts = {};
const fromValue = {};
const fromText = {};
for (const label in STATUS) {
  const st = STATUS[label];
  texts[st.value] = st.text;
  fromValue[st.value] = st;
  fromText[st.text] = st;
}
STATUS.TEXT = texts;
STATUS.FROM_VALUE = fromValue;
STATUS.FROM_TEXT = fromText;

const STATUS_FUNCTIONS = {
  HIGHER_THAN: 'higherThan',
  LESS_THAN: 'lessThan',
  EQUALS: 'equals',
  NOT_EQUALS: 'notEquals',
  CONTAINS: 'contains'
};

// Status filter flags in URLs (for 'statuses=...' and for 'status[statusId]=...')
const FLAG_ERROR = 'e';
const FLAG_WARNING = 'w';
const FLAG_OK = 'o';
const FLAG_OFFLINE = 'f';
const ALL_FLAGS_ARRAY = [FLAG_ERROR, FLAG_WARNING, FLAG_OK, FLAG_OFFLINE];
const DEFAULT_FLAGS_STRING = FLAG_ERROR + FLAG_WARNING + FLAG_OK;
const ALL_FLAGS_STRING = DEFAULT_FLAGS_STRING + FLAG_OFFLINE;

// Default time a robot needs to stay offline before considering offline for
// Fleet scope filtering and status sorting purposes.
// Can be tailored with the UI preference 'recentlyOnlineTime'
const DEFAULT_RECENTLY_ONLINE_SEC = 60 * 60; // seconds

/**
 * Checks if `robotStatus` includes default flags
 * @param {string} robotStatus
 * @returns {boolean}
 */
const includesAllStatuses = robotStatus => (
  isIncluded(robotStatus, DEFAULT_FLAGS_STRING)
  || isIncluded(robotStatus, ALL_FLAGS_STRING)
);

/**
 * Check whether the given status letter is in the robot status filter string.
 * If no filter string is provided, defaults to showing error+warning+ok.
 */
const isInRobotStatusString = (statusLetter, robotStatus) => {
  const status = robotStatus || DEFAULT_FLAGS_STRING;
  return status.includes(statusLetter);
};

/**
 * Given a status filter string and an aggregated status value,
 * returns whether the robot should be shown.
 */
const matchesStatusFilter = (statusFilter, aggStatusValue) => {
  switch (aggStatusValue) {
    case STATUS.ERROR.value:
      return isInRobotStatusString(FLAG_ERROR, statusFilter);
    case STATUS.WARN.value:
      return isInRobotStatusString(FLAG_WARNING, statusFilter);
    case STATUS.OK.value:
      return isInRobotStatusString(FLAG_OK, statusFilter);
    default:
      return isInRobotStatusString(FLAG_OFFLINE, statusFilter);
  }
};

export {
  STATUS,
  STATUS_FUNCTIONS,
  FLAG_ERROR,
  FLAG_WARNING,
  FLAG_OK,
  FLAG_OFFLINE,
  ALL_FLAGS_ARRAY,
  DEFAULT_FLAGS_STRING,
  ALL_FLAGS_STRING,
  DEFAULT_RECENTLY_ONLINE_SEC,
  includesAllStatuses,
  isInRobotStatusString,
  matchesStatusFilter
};
