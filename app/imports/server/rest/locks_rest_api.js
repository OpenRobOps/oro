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
 * Locks REST API
 *
 * NOTE: This is part of Robots API
 */

import LockManager from '../lock';
import { ACCESS_LEVEL_OPERATE, ACCESS_LEVEL_VIEW } from '../roles';

/**
 * Handle REST API to lock a robot. Returns information about the current
 * lock and also a flag to show if the robot is locked for the user.
 *
 * @param {Object} res Web response
 * @param {Object} user The user querying the lock status
 * @param {String} robotId
 */
async function apiIsRobotLocked({ user, robotId }) {
  const locked = await new LockManager().isRobotLocked(robotId);
  const lockedForUser = await new LockManager().isRobotLockedFor(robotId, user._id);

  return [{
    lock: locked || null,
    lockedForUser: lockedForUser || false
  }];
}

/**
 * Handle REST API to lock a robot
 *
 * @param {Object} res Web response
 * @param {Object} user The user trying to lock the robot
 * @param {String} robotId
 */
async function apiLockRobot({ user, robotId, body }) {
  const lockManager = new LockManager();
  if (await lockManager.isRobotLockedFor(robotId, user._id)) {
    return [{ error: `The robot ${robotId} is locked by another user` }, 403];
  }
  const result = await lockManager.lockRobot({
    robotId,
    user,
    soft: Boolean(body?.soft)
  });
  if (result) {
    return [{ lock: await new LockManager().isRobotLocked(robotId) }, 201];
  } else {
    return [{ error: `Attempted to lock a not existing robot ${robotId}` }, 404];
  }
}

/**
 * Handle REST API to unlock a robot
 *
 * @param {Object} res Web response
 * @param {Object} user The user trying to lock the robot
 * @param {String} robotId
 */
async function apiUnlockRobot({ user, robotId, body }) {
  const result = await new LockManager().unlockRobot({
    robotId,
    user,
    soft: Boolean(body?.soft)
  });
  if (result) {
    return ['', 204];
  } else {
    return [{ error: `You can't unlock robot ${robotId} it's locked by other user or it doesn't exist` }, 403];
  }
}

const robotLockPath = '/robots/{robotId:id}/lock';
const routes = [
  {
    path: robotLockPath,
    method: 'GET',
    handler: apiIsRobotLocked,
    trackingId: 'locks',
    checkUserCanRobot: ACCESS_LEVEL_VIEW,
    loadRobot: true
  },
  {
    path: robotLockPath,
    method: 'PUT',
    handler: apiLockRobot,
    trackingId: 'locks',
    checkUserCanRobot: ACCESS_LEVEL_OPERATE,
    loadRobot: true
  },
  {
    path: robotLockPath,
    method: 'DELETE',
    handler: apiUnlockRobot,
    trackingId: 'locks',
    checkUserCanRobot: ACCESS_LEVEL_OPERATE,
    loadRobot: true
  },
];

export default routes;
