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
 * Provides feedback for robot custom actions.
 * It currently only supports custom scripts.
 *
 * This component should be created only when a given action has been executed.
 * As parameters, it takes the executionId (uniquely identifies a given script execution) the
 * corresponding robotId and an executionTs. These are provided as a response to the
 * actions.execute API (currently Meteor method) when a custom script is executed on the server.
 *
 * Whenever an update is received from the agent, the provided updateCallback function is called
 * with the received update.
 *
 * In the future, this component can be used to display these updates, script output, etc.
 * visually to the user.
 */
import { Meteor } from 'meteor/meteor';
import { withTracker } from 'meteor/react-meteor-data';
import React from 'react';
import PropTypes from 'prop-types';
// ORO imports
import { RobotCustomScript } from '../../../lib/collections';

// Possible values for executionStatus
// @see agentlets/custom_commands on the agent
const EXECUTION_STATUS = {
  ABORTED: 'aborted',
  TO_BE_STARTED: 'to be started',
  RUNNING: 'running',
  FINISHED: 'finished'
};

// The default Feedback Timeout in ms
const FEEDBACK_TIMEOUT = 5000;

const ActionsFeedback = (props) => {
  const {
    updateCallback = () => {},
    update
  } = props;
  try {
    if (update) {
      updateCallback(update);
    }
  } catch (e) {
    console.error('Exception delivering action feedback update', e);
  }
  return <div />;
};

ActionsFeedback.propTypes = {
  update: PropTypes.object,
  updateCallback: PropTypes.func
};

const ActionsFeedbackContainer = withTracker(({ robotId, executionId, executionTs }) => {
  Meteor.subscribe('actions.feedback', { robotId, executionId, executionTs });
  const update = RobotCustomScript.findOne({
    robotId,
    // TODO rename 'fileName' collection field to 'executionId'
    fileName: executionId,
    // NOTE serverTime is a Date field but executionTs is a number (epoch)
    serverTime: { $gte: new Date(executionTs) }
  });
  return { update };
})(ActionsFeedback);

ActionsFeedbackContainer.propTypes = {
  robotId: PropTypes.string,
  executionId: PropTypes.string,
  executionTs: PropTypes.number,
  updateCallback: PropTypes.func
};

export { EXECUTION_STATUS, FEEDBACK_TIMEOUT };
export default ActionsFeedbackContainer;
