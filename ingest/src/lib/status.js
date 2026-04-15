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
 * Shared module to facilitate robot status management and display
 */
const STATUS = {
  OK: { value: 0, text: "OK" },
  WARN: { value: 10, text: "warning" },
  ERROR: { value: 20, text: "error" },
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
}
// Convenience high-speed accessor for textual values and for the entire objects
const texts = {}, fromValue = {}, fromText = {};
for(let label in STATUS) {
  const st = STATUS[label];
  texts[st.value] = st.text;
  fromValue[st.value] = st;
  fromText[st.text] = st;
}
STATUS.TEXT = texts;
STATUS.FROM_VALUE = fromValue;
STATUS.FROM_TEXT = fromText;

/**
 * Calculates the display color based on a given status and agent online status
 */
const getStatusColor = (status, agentOnline, theme) => {
  // Status is stale/unknown
  if (!status) {
    return agentOnline ? theme.statusColor.inactive :
      theme.statusColor.staleInactive;
  }

  let statusAge = Date.now() - status.ts;
  // HACK(adamantivm) Ghost fleet
  if (status.ts == 12) {
    statusAge = 0;
  }

  // If older than a week --> show offline
  if (!agentOnline && statusAge > 1000 * 60 * 60 * 24 * 7) {
    return theme.statusColor.staleInactive;
    // If offline or older than five minutes, then it's stale
  } else if (!agentOnline || statusAge > 1000 * 60 * 5) {
    switch(status.value) {
      case STATUS.OK.value:
        return theme.statusColor.staleOk;
      case STATUS.WARN.value:
        return theme.statusColor.staleWarning;
      case STATUS.ERROR.value:
        return theme.statusColor.staleError;
      default:
        return theme.statusColor.staleInactive;
    }
  } else {
    // Online and current status value
    switch(status.value) {
      case STATUS.OK.value:
        return theme.statusColor.ok;
      case STATUS.WARN.value:
        return theme.statusColor.warning;
      case STATUS.ERROR.value:
        return theme.statusColor.error;
      default:
        return theme.statusColor.inactive;
    }
  }
}

/**
 * Handle undefined status values
 */
const getStatusValue = (value) => {
  if (value === undefined) {
    return -1;
  } else {
    return value;
  }
}

/**
 * Returns the status object corresponding to a numeric value; or
 * null if not found.
 * E.g. for value=10, it returns { value:10, label:"warning"}.
 */
const getStatusFromValue = (value) => {
  for (let key in STATUS) {
    if (STATUS[key].value == value) {
      return STATUS[key];
    }
  }
  return null;
}

export { STATUS, getStatusColor, getStatusValue, getStatusFromValue };
