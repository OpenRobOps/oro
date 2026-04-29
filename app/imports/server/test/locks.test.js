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
 * Server unit tests for Roles implementation (mainly OroRoles.js packages)
 */
import { Meteor } from 'meteor/meteor';
import { assert } from 'chai';
// ORO modules
import { resetDatabase } from './setup';
import OroRoles from '../roles';
import LockManager from '../lock';
import { createUser, createRobot, WALL_E_ROBOT, BOB_USER } from './common';

// Just make sure this is not getting loaded in dev/prod
if (!Meteor.isTest) {
  throw new Error('This is TEST code only');
}

describe('Locks', () => {
  beforeEach(async () => await resetDatabase());

  it('locks robots and releases the locks', async () => {
    // Create user with 'viewer' role and default roles 
    const userId = await createUser();
    const robotId = await createRobot();
    const user = await Meteor.users.findOneAsync({ _id: userId });
    await new OroRoles().createDefaultRoles();
    const mgr = new LockManager();
    const now = Date.now();
    // Lock robot
    assert.isTrue(await mgr.lockRobot({ robotId: WALL_E_ROBOT, user, now }));
    // Fetch the lock and assert its data matches the expected robot and user
    let lock = await mgr.isRobotLocked(robotId);
    assert.isTrue(lock.locked);
    assert.equal(lock.userId, userId);
    assert.equal(lock.ts, now);
    assert.equal(lock.userId, BOB_USER);
    assert.equal(lock.userName, 'Bob the operator');
    assert.equal(lock.userEmail, 'bob@scalable.com');
    assert.equal(lock.expirationTs, now + 10 * 60 * 1000); // 10 minutes default expiration
    // Unlock robot
    assert.isTrue(await mgr.unlockRobot({ robotId, user }));
    lock = await mgr.isRobotLocked(robotId);
    assert.isNull(lock);
  });

  it('breaks other users locks', async () => {
    // Create user with 'viewer' role and default roles 
    const userId1 = await createUser();
    const userId2 = await createUser({ id: 'anotherUser' });
    const robotId = await createRobot();
    const user1 = await Meteor.users.findOneAsync({ _id: userId1 });
    const user2 = await Meteor.users.findOneAsync({ _id: userId2 });
    await new OroRoles().createDefaultRoles();
    const mgr = new LockManager();
    // User 1 locks robot
    assert.isTrue(await mgr.lockRobot({ robotId: WALL_E_ROBOT, user: user1 }));
    let lock = await mgr.isRobotLocked(robotId);
    assert.isTrue(lock.locked);
    assert.equal(lock.userId, userId1);
    // User 2 locks robots, breaking user 1's lock
    assert.isTrue(await mgr.lockRobot({ robotId: WALL_E_ROBOT, user: user2 }));
    lock = await mgr.isRobotLocked(robotId);
    assert.isTrue(lock.locked);
    assert.equal(lock.userId, userId2);
    // TODO(herchu) assert an event log entry was created (a lock was broken)
  });

  it('locks and releases own locks (without breaking others, "soft" mode)', async () => {
    // Create user with 'viewer' role and default roles 
    const userId1 = await createUser();
    const userId2 = await createUser({ id: 'anotherUser' });
    const robotId = await createRobot();
    const user1 = await Meteor.users.findOneAsync({ _id: userId1 });
    const user2 = await Meteor.users.findOneAsync({ _id: userId2 });
    await new OroRoles().createDefaultRoles();
    const mgr = new LockManager();
    // User 1 locks robot
    assert.isTrue(await mgr.lockRobot({ robotId: WALL_E_ROBOT, user: user1 }));
    let lock = await mgr.isRobotLocked(robotId);
    assert.isTrue(lock.locked);
    assert.equal(lock.userId, userId1);
    // User 2 attempts to release lock (with 'soft'), it does not succeed; lock still exists
    assert.isFalse(await await mgr.unlockRobot({ robotId: WALL_E_ROBOT, user: user2, soft: true }));
    lock = await mgr.isRobotLocked(robotId);
    assert.isTrue(lock.locked);
    assert.equal(lock.userId, userId1); // still locked by user1
    // User 2 attempts to lock (with 'soft'), it does not succeed; original lock still exists
    assert.isFalse(await mgr.lockRobot({ robotId: WALL_E_ROBOT, user: user2, soft: true }));
    lock = await mgr.isRobotLocked(robotId);
    assert.isTrue(lock.locked);
    assert.equal(lock.userId, userId1); // still locked by user1
    // User 2 attempts again without 'soft', so it breaks user1's lock and locks the robot
    assert.isTrue(await mgr.lockRobot({ robotId: WALL_E_ROBOT, user: user2 }));
    lock = await mgr.isRobotLocked(robotId);
    assert.isTrue(lock.locked);
    assert.equal(lock.userId, userId2);
  });

  it('locks robots with custom expiration times', async () => {
    // Create user with 'viewer' role and default roles 
    const userId = await createUser();
    const robotId = await createRobot();
    const user = await Meteor.users.findOneAsync({ _id: userId });
    await new OroRoles().createDefaultRoles();
    const mgr = new LockManager();
    const now = Date.now();
    // Set preferences changing the expiration time
    const seconds = 7;
    await mgr.setLockPreferences({ expirationSeconds: seconds });
    // Lock robot
    assert.isTrue(await mgr.lockRobot({ robotId: WALL_E_ROBOT, user, now }));
    // Fetch the lock; assert it is locked with a non-default expiration time
    const lock = await mgr.isRobotLocked(robotId);
    console.log("lock", lock)
    assert.isTrue(lock.locked);
    assert.equal(lock.userId, userId);
    assert.equal(lock.ts, now);
    assert.equal(lock.userId, BOB_USER);
    assert.equal(lock.expirationTs, now + seconds * 1000);
  });
});
