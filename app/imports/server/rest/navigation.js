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
 * Navigation REST API.
 */
import Validator from 'fastest-validator';
import pick from 'lodash/pick';
// ORO modules
import LockManager from '../lock';
import { ACCESS_LEVEL_OPERATE } from '../../shared/roles';
import { NAVIGATE_TO_ACTION_ID } from '../../shared/actions';

// Schema validators
const WaypointsRequestSchema = {
  $$strict: true, // no fields allowed other than those here
  waypoints: {
    type: 'array',
    empty: false,
    items: {
      type: 'object',
      props: {
        frameId: { type: 'string', optional: true },
        x: { type: 'number' },
        y: { type: 'number' },
        theta: { type: 'number' }
      }
    }
  }
};

const waypointsRequestSchemaValidator = new Validator().compile(WaypointsRequestSchema);

/**
* API handler for POST /robots/{robotId}/navigation/waypoints
*
* Sends a list of waypoints to a robot to be navigated
*
* @param {Object} robot Robot object
* @param {Object} user Caller user object
* @param {Object} navigateWaypointsRequest Request parsed from request body JSON
*/
const apiNavigateWaypointsExecute = async ({ robot, user, body: navigateWaypointsRequest }) => {
  // Validate schema
  const validation = waypointsRequestSchemaValidator(navigateWaypointsRequest);
  if (validation !== true) {
    return [(validation.length && validation[0].message) || 'Bad request', 400];
  }

  const { waypoints } = navigateWaypointsRequest;

  if (waypoints.length > 1) {
    // TODO extend API to support more than one waypoint
    return ['This API supports only lists of exactly one waypoint', 400];
  }

  try {
    // Run the action as the invoking user
    const pose = pick(waypoints[0], ['x', 'y', 'theta', 'frameId']);
    const result = await new LockManager().runRobotAction({
      actionId: NAVIGATE_TO_ACTION_ID,
      robotId: robot.getId(),
      user,
      args: { pose }
    });

    // Format the result and return it
    if (!result.ok) {
      // Try to return a message with useful info if we have it
      const message = result.message || result.error || `Error while executing navigation on robot ${robot.getId()}`;
      throw new Error(`Error executing ${NAVIGATE_TO_ACTION_ID} on robot ${robot.getId()}: ${message}`);
    }

    return [{ message: result.message || 'Action executed' }, 200];
  } catch (e) {
    console.warn('Error executing navigation waypoints', e);
    return [{ error: e.message }, 500];
  }
};

// Actions URLs to functions
const routes = [{
  path: 'robots/{robotId:id}/navigation/waypoints',
  method: 'POST',
  handler: apiNavigateWaypointsExecute,
  trackingId: 'executeNavigationWaypointsAction',
  checkUserCanRobot: ACCESS_LEVEL_OPERATE,
  loadRobot: true
}];

export default routes;
