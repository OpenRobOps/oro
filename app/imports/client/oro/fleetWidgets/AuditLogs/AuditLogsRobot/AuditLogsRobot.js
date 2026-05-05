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
 * Audit Logs Robot component
 *
 * Creates an audit log widget to be used at the robot scope
 */
import React from 'react';
import PropTypes from 'prop-types';
import AuditLogs from '../AuditLogs';
import { prepareTimeVarsForQuery, StartTsPropType } from '../../../util/timeUtils';

const AuditLogsRobot = (props) => {
  const {
    robotId,
    startTs,
    timeRangeMs,
    nowTs
  } = props;

  // Checks types, cleans wrong values, adds defaults if necessary
  const timeVars = prepareTimeVarsForQuery(startTs, timeRangeMs, nowTs);

  const query = {
    startTs: timeVars.startTs,
    endTs: timeVars.endTs,
    limit: 100
  };
  if (robotId) {
    query.robotId = robotId;
  }
  return <AuditLogs {...props} variant="widget" queries={[query]} />;
};

AuditLogsRobot.propTypes = {
  startTs: StartTsPropType,
  nowTs: PropTypes.number,
  timeRangeMs: PropTypes.number,
  robotId: PropTypes.string,
};

export default AuditLogsRobot;
