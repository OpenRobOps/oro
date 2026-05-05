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
 * AuditLogEventRow
 *
 * Displays action feedback obtained from "actions.getFeedback" Meteor method
 * Handles the state of the expandable row
 */
import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
// ORO modules
import { useMethod } from '../../../../../util/meteorUtils';
import AuditLogEventRowComponent from './AuditLogEventRowComponent';
import { EVENT_MODULES } from '../../../../../../../lib/events';

const AuditLogEventRow = ((props) => {
  const { eventObject } = props;
  const [isExpanded, setIsExpanded] = useState(false);
  const eventRobotId = eventObject.robotId;
  const actionExecutionId = eventObject.module == EVENT_MODULES.ACTION
    ? eventObject?.eventData?.executionId
    : null;

  // This meteor call hook returns { isLoading, data, error, call }
  const actionFeedback = useMethod('actions.getFeedback');
  const { call: fetchActionDetails } = actionFeedback;

  // Function to handle the state of the expandable row
  const handleToggleExpanded = useCallback(() => {
    console.log("xx handleToggle", )
    // If state is going from closed to expanded get
    // custom action script details
    if (!isExpanded) {
      fetchActionDetails({
        executionId: actionExecutionId,
        robotId: eventRobotId
      }); // async call; but no need to await it
    }
    setIsExpanded(!isExpanded);
  }, [isExpanded, eventRobotId, actionExecutionId, fetchActionDetails]);

  return (
    <AuditLogEventRowComponent
      isExpanded={isExpanded}
      onExpandRowClicked={handleToggleExpanded}
      actionFeedback={actionFeedback}
      {...props}
    />
  );
});

AuditLogEventRow.propTypes = {
  eventObject: PropTypes.object
};

export default AuditLogEventRow;
