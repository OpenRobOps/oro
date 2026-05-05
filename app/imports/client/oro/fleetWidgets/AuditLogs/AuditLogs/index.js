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
 * AuditLogs widget. Meteor wrapper for loading data through Meteor methods.
 * 
 * It parses the query from the  component props, triggers the request and passes
 * down an auditLogs prop to the wrapped component.
 *
 * Meteor-specific code!
 */
import React from 'react';
import PropTypes from 'prop-types';
import AuditLogsComponent from './AuditLogsComponent';
import useAuditLogs from '../../../hooks/useAuditLogs';

const AuditLogsMeteorWrapper = (props) => {
  const { queries, ...otherProps } = props;
  const query = queries && queries[0];
  const { startTs, endTs, limit, robotId, eventType } = query;
  const { data, isLoading, error } = useAuditLogs({
    robotId,
    startTs,
    endTs,
    eventType,
    limit
  });
  return (
    <AuditLogsComponent auditLogs={data} isLoading={isLoading} error={error} {...otherProps} />
  );
};

AuditLogsMeteorWrapper.propTypes = {
  queries: PropTypes.array
};

export default AuditLogsMeteorWrapper;
