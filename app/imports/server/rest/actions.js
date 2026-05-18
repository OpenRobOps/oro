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
 * Actions REST API.
 *
 */
import Validator from 'fastest-validator';
// ORO modules
import LockManager from '../lock';
import { ACCESS_LEVEL_VIEW, ACCESS_LEVEL_OPERATE } from '../roles';
import ConfigManager, { ID_TYPE_ROBOT } from '../../lib/configManagerAsync';
import { ActionDefinitions, ACTION_TYPES } from '../../lib/actions';
import { notFoundApiError } from '../rest_api_common';
import { RobotCustomScript } from '../../lib/collections';
import ActionsEngine from '../actions';
import EventLog, { EVENT_MODULES, EVENT_TYPES, buildEvent } from '../eventLog/eventLogger';
import { getUserLoggingAttributes } from '../../lib/events';

/**
 * List of action types that we want to make available via API.
 */
const API_ACTION_TYPES = [
  ACTION_TYPES.RUN_SCRIPT,
  ACTION_TYPES.PUBLISH_TO_TOPIC,
  ACTION_TYPES.DISPATCH_MISSION
];

// Schema validators
const ActionExecutionRequestSchema = {
  $$strict: true, // no fields allowed other than those here
  actionId: { type: 'string', empty: false },
  parameters: { type: 'object', optional: true, },
};

const actionExecutionRequestSchemaValidator = new Validator().compile(ActionExecutionRequestSchema);

/**
 * Return action definitions for a robot
 */
const getActionDefinitionsByRobot = async robot => (
  new ConfigManager(ActionDefinitions).getEntityConfig({
    entityId: robot.getId(),
    entityType: ID_TYPE_ROBOT
  }) || {}
);

/**
 * Aux function to verify if an action is defined for a robot
 */
const actionExists = async (actionId) => (
  Boolean(await new ActionsEngine().getActionDefinition(actionId))
);

/**
 * API handler for POST /robots/{robotId}/actions
 *
 * Executes an action on a given robot.
 *
 * @param {Object} robot Robot object
 * @param {Object} user Caller user object
 * @param {Object} actionExecRequest Request parsed from request body JSON
 */
const apiActionExecute = async ({ robot, user, body: actionExecRequest }) => {
  // Validate schema
  const validation = actionExecutionRequestSchemaValidator(actionExecRequest);
  if (validation !== true) {
    return [(validation.length && validation[0].message) || 'Bad request', 400];
  }

  const { actionId, parameters } = actionExecRequest;

  // Get the action and return 404 if it doesn't exist
  if (!await actionExists(actionId)) {
    // Emit audit log for missing action
    try {
      new EventLog().sendEvent(buildEvent(EVENT_MODULES.ACTION, EVENT_TYPES.ACTION_FAILED, {
        ...getUserLoggingAttributes(user),
        ts: Date.now(),
        robotId: robot.getId(),
        robotName: await robot.getNameAsync(),
        actionId,
        type: 'unknown',
        label: actionId,
        failureReason: 'Action not found'
      }));
    } catch (e) {
      console.error('Error logging action failure', e);
    }
    return notFoundApiError(`Action not found for actionId = "${actionId}"`);
  }

  // Run the action as the invoking user
  const result = await new LockManager().runRobotAction({
    actionId,
    robotId: robot.getId(),
    user,
    args: parameters
  });

  // Format the result and return it
  if (!result.ok) {
    // Try to return a message with useful info if we have it
    const message = result.message || result.error
      || `Error while executing action ${actionId} on robot ${robot.getId()}`;
    const errorObject = { error: message };
    if (result.errors) {
      errorObject.validations = result.errors;
    }
    return [errorObject, 400];
  }

  const startTs = result.ts || Date.now();
  const lastUpdateTs = startTs;
  const { executionId } = result;
  const status = 'started';

  return [{
    executionId,
    status,
    startTs,
    lastUpdateTs
  }];
};

/**
 * API handler for /robots/{robotId}/actions/{executionId}
 *
 * Returns the status of an action execution as reported from the robot
 *
 * @param {Object} robot Robot object, retrieved by the API wrapper (robotId param)
 */
const apiGetActionExecutionStatus = async ({ robot, executionId }) => {
  const executionStatus = await RobotCustomScript.findOneAsync({
    robotId: robot.getId(), fileName: executionId
  });

  if (!executionStatus) {
    return notFoundApiError('Action execution status not found. Note that only status for actions of type RunScript is implemented');
  }

  return [{
    executionId,
    status: executionStatus.executionStatus,
    statusDetails: executionStatus.executionStatusDetails,
    startTs: executionStatus.ts,
    lastUpdateTs: executionStatus.updatedTs,
    returnCode: executionStatus.returnCode,
    stderr: executionStatus.stderr,
    stdout: executionStatus.stdout
  }];
};

/**
 * API handler for POST /robots/{robotId}/actions/compile
 *
 * Compiles an action to an object that includes all data required for its execution
 * without requiring further communication with the Platform
 *
 * @param {Object} robot Robot object
 * @param {Object} user Caller user object
 * @param {Object} actionExecRequest Request parsed from request body JSON
 */
const apiActionCompile = async ({ robot, body: actionExecRequest }) => {
  // Validate schema
  const validation = actionExecutionRequestSchemaValidator(actionExecRequest);
  if (validation !== true) {
    return [(validation.length && validation[0].message) || 'Bad request', 400];
  }

  const { actionId, parameters } = actionExecRequest;

  const { ok, error, compiled } = await new ActionsEngine().compileAction({
    actionId,
    robotId: robot.getId(),
    args: parameters
  });

  if (!ok) {
    return [{ error }, 500];
  }

  return [compiled];
};

// Actions URLs to functions
const routes = [{
  path: 'robots/{robotId:id}/actions',
  method: 'POST',
  handler: apiActionExecute,
  trackingId: 'executeRobotAction',
  checkUserCanRobot: ACCESS_LEVEL_OPERATE,
  loadRobot: true
}, {
  path: 'robots/{robotId:id}/actions/{executionId:id}',
  method: 'GET',
  handler: apiGetActionExecutionStatus,
  trackingId: 'getActionExecutionStatus',
  checkUserCanRobot: ACCESS_LEVEL_OPERATE,
  loadRobot: true
}, {
  path: 'robots/{robotId:id}/actions/compile',
  method: 'POST',
  handler: apiActionCompile,
  trackingId: 'compileAction',
  internalOnly: true,
  loadRobot: true
}];

export default routes;
