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
 * Audit Logs Fleet component
 *
 * Creates an audit log widget to be used at the fleet scope
 */

import React from 'react';
import PropTypes from 'prop-types';
import AuditLogs from '../AuditLogs';
import { prepareTimeVarsForQuery, LIVE_TIME, StartTsPropType } from '../../../util/timeUtils';

const AuditLogsFleet = (props) => {
  const {
    robotId,
    eventType,
    eventModule,
    userId,
    actionId,
    startTs,
    nowTs,
    timeRangeMs
  } = props;

  // Checks types, cleans wrong values, adds defaults if necessary
  const timeVars = prepareTimeVarsForQuery(startTs, timeRangeMs, nowTs);

  const query = {
    startTs: timeVars.startTs,
    endTs: timeVars.endTs,
    limit: 100
  };
  /**
  * Handles selection of a collection to act as a filter
  * When no robot is selected it is possible to filter by event type
  * @param {string} -  The collection Id to perform filter on
  */
  if (eventType) {
    query[eventType.type] = eventType.value;
  } else if (eventModule) {
    query[eventModule.type] = eventModule.value;
  } else if (userId) {
    query[userId.type] = userId.value;
  } else if (robotId) {
    query[robotId.type] = robotId.value;
  } else if (actionId) {
    query[actionId.type] = actionId.value;
  }
  /**
  * When a robot is selected we want the widget to act as audit logs in robots dashboards,
  * for this we pass a robotId and it will only show the logs of that robot.
  * In case there is no robot selected, no robotId is passed and the widget
  * shows the logs of the entire fleet.
  * @param {string} - The robot Id to perform filter on
  */
  if (robotId) {
    query.robotId = robotId;
  }

  return <AuditLogs {...props} variant="widget" queries={[query]} />;
};

AuditLogsFleet.propTypes = {
  startTs: StartTsPropType,
  nowTs: PropTypes.number,
  timeRangeMs: PropTypes.number,
  robotId: PropTypes.string,
  eventType: PropTypes.object,
  eventModule: PropTypes.object,
  userId: PropTypes.object,
  actionId: PropTypes.object
};

export default AuditLogsFleet;
