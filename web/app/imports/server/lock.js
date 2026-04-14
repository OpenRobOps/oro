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

/*
 * Module to implement robot's Locks logic: lock and unlock robots, get and update configuration, etc.
 *
 * This module is called from apis in this file (publication*s / methods) and from other modules
 * such as Actions, e.g. when an action is about to execute.
 */
import { Meteor } from 'meteor/meteor';
import { isNumber, isObject, isString } from 'lodash';
// InOrbit modules
import PreferencesManager from './preferences';
import Robot from './model/robot';
import OroRoles from './roles';
import ActionsEngine from './actions';
import { ActionDefinitions } from '../lib/actions';
import { LOCK_TYPES } from '../lib/lock';
// import NotificationsManager from './notifications';
import { getUserId, getUserName, getUserLoggingAttributes } from '../lib/events';
import EventLog, { EVENT_TYPES, EVENT_MODULES, buildEvent } from './eventLogger';
import {
  RESOURCE_SINGLETONS, RESOURCE_TYPES, glueId,
  ACCESS_LEVEL_VIEW, ACCESS_LEVEL_OPERATE, ACCESS_LEVEL_CONFIGURE, isSystemUser
} from '../shared/roles';

// Default lock is 5 minutes
const DEFAULT_EXPIRATION_SECONDS = 600;

// Fields for ActionDefinitions collection
const ACTION_FIELD_RESTRICTED = 'lock';
// Fields for Preferences collection
const PREFERENCES_FIELD_TYPE = 'type';
const PREFERENCES_FIELD_EXPIRATION_SECONDS = 'expirationSeconds';
const PREFERENCES_FIELD_EXPIRATION_RENEWAL_SECONDS = 'expirationRenewalSeconds';

let instance;
class LockManager {
  constructor() {
    // Singleton Pattern
    if (instance === undefined) {
      instance = this;
      this._preferences = new PreferencesManager();

    }
    // eslint-disable-next-line no-constructor-return
    return instance;
  }

  init = async () => {
      // Meteor methods to add, edit or remove attributes and mappings
      Meteor.methods({
        'robot.lock': this._meteorLockRobot,
        'robot.unlock': this._meteorUnlockRobot,
        'robot.checkLock': this._meteorCheckLockExpiration,
        'config.setLockPreferences': this._meteorSetLockPreferences
      });
  }

  /**
   * Tells if a robot is currently locked. If locked, the return value is an object with the lock
   * information. Otherwise, it returns null.
   */
  isRobotLocked = async (robotId, now = Date.now()) => {
    let lock;
    const robot = new Robot(robotId);
    try {
      lock = await robot.getLockAsync();
    } catch (e) {
      console.warn(`Attempted to get lock of an nonexisting robot ${robotId}`);
    }
    const locked = lock && lock.locked;
    const expired = locked && lock.expirationTs < now;
    if (locked && expired) {
      // In the special case we are querying a robot that was locked but whose locked already
      // expired, use the change to update the lock to 'unlocked' (locked: false). Chances are
      // a user is looking at this robot, so updating the flag now without waiting for a
      // 'garbage collector' will quickly update its collections flag
      console.warn('Automatically expiring lock on robot', robotId);
      await robot.setLockAsync({ locked: false, expirationTs: null });
      const robotName = await robot.getNameAsync();
      // Add a notification. NOTE: This matches the notifications in ingest's job-gc.js
      lock.userId && await this.notifyUser({
        msg: `${robotName} - Lock from user ${lock.userName} has expired`,
        robotId,
        userId: lock.userId
      });
      try {
        // NOTE: Send exactly the same information here and in ingest/jobs/job-gc.js!
        new EventLog().sendEvent(buildEvent(EVENT_MODULES.LOCK, EVENT_TYPES.LOCK_EXPIRED, {
          ts: now,
          robotId,
          userId: lock.userId,
          robotName,
          userName: lock.userName,
          lock // the rest of lock metadata (user, expiration ts, etc.)
        }));
      } catch (e) {
        // We don't want to stop the execution if for some reason
        // the logging fails.
      }
    }
    return locked && !expired ? lock : null;
  };

  /**
   * Tells if a robot is locked for execution actions for a specific user. This happens if the
   * robot has a lock, and the lock does not belong to the given user.
   * Returns a boolean value.
   */
  isRobotLockedFor = async (robotId, userId, now = Date.now()) => {
    const lock = await this.isRobotLocked(robotId, now);
    return lock && lock.locked ? lock.userId != userId : false;
  };

  /**
   * Establishes the lock preferences 
   * 
   * @param {object} lock With { lock, expirationSeconds }
   */
  setLockPreferences = async (lock) => {
    const { type, expirationSeconds } = lock;
    if (type !== undefined) {
      if (!(Object.values(LOCK_TYPES).includes(type))) {
        throw new Error('lock value is not a valid lock type: ' + type);
      }
    }
    if (expirationSeconds !== undefined) {
      if (!isNumber(expirationSeconds)) {
        throw new Error('expirationSeconds must be a number');
      }
    }
    await this._preferences.setPreferences('lock', lock);
    return true;
  };

  /**
   * Helper method to send notifications to users.
   *
   * NOTE: Currently notifications are sent to everyone, fix this when we support
   * addressing individual notifications!
   */
  notifyUser = async ({ robotId, msg, userId }) => {
    if (!userId) {
      throw new Error('userId must be a string');
    }
    const config = await this._getLockPreferences();
    if (config && (!('notifications' in config) || config.notifications)) {
      // TODO(herchu) address this notification specifically to userId
      console.log('TODO create notification for msg', msg, { robotId })
      // await new NotificationsManager().makeGenericNotification(
      //   msg,
      //   { robotId }
      // );
    }
  };

  /**
   * Puts a lock on a robot determined by `robotId`.
   *
   * @param {String} robotId Identifies the robot to lock
   * @param {Object} user A User document (used for logging)
   * @param {Number} now The operation timestamp, if different from Date.now()
   * @param {Boolean} soft If true, the robot will be locked only if not locked by another user
   *
   * The `userId` and `userName` are not strictly required but should always be given so we can
   * display _who_ has locked this robot.
   */
  lockRobot = async ({
    robotId, user, now = Date.now(), soft = false
  }) => {
    const robot = new Robot(robotId);
    try {
      await robot.existsAsync();
    } catch (e) {
      console.warn(`Attempted to lock an unexisting robot ${robotId}`);
      return false;
    }
    const userInfo = getUserLoggingAttributes(user);
    // In "soft" mode, the lock is obtained only if not breaking another previous lock
    if (soft) {
      const existingLock = await robot.getLockAsync();
      // Check permissions. This depends on the user AND the lock object, so it is not part
      // of the meteor method's checking
      if (existingLock && existingLock.userId != userInfo.userId) {
        return false;
      }
    }
    const ts = now || Date.now();
    const robotName = await robot.getNameAsync();
    const config = await this._getLockPreferences();
    // Determine how long the lock will be valid (0 means forever)
    const lockDurationSecs = isNumber(config[PREFERENCES_FIELD_EXPIRATION_SECONDS])
      ? config[PREFERENCES_FIELD_EXPIRATION_SECONDS] : DEFAULT_EXPIRATION_SECONDS;
    // Calculate the expiration, which is null for zero 'expirationSeconds' values,
    // or N seconds in the future
    const expirationTs = config.expirationSeconds <= 0
      ? null : ts + 1000 * lockDurationSecs;
    // Update the robot
    const lock = {
      ...userInfo,
      locked: true,
      ts,
      expirationTs
    };
    await robot.setLockAsync(lock);

    if (!isSystemUser(user)) { // NOTE(herchu) Not logging internal calls to lock robots (spammy)
      try {
        new EventLog().sendEvent(buildEvent(EVENT_MODULES.LOCK, EVENT_TYPES.LOCK_LOCKED, {
          ...userInfo,
          ts: now,
          robotId,
          robotName,
          lock // the rest of lock metadata (user, expiration ts, etc.)
        }));
      } catch (e) {
        // We don't want to stop the execution if for some reason
        // the logging fails.
      }
    }
    return true;
  };

  /**
   * Extends a robot lock's expiration. This is done when doing any action on the robot,
   * that automatically keeps the robot locked a bit longer.
   * It could be done later explicitly by a "renew lock" UI option when the user is notified
   * the lock is expiring.
   *
   * The lock object is a robot lock that we use to know current lock expiration (if needed), and
   * most importantly the initial lock timestamp, so in the DB the lock is renewed only if it
   * matches this ts.
   */
  renewLock = async (robotId, lock, config = null) => {
    if (!isString(robotId)) {
      throw new Error('robotId must be a string');
    }
    if (!isObject(lock)) {
      throw new Error('lock must be an object');
    }
    if (!config) {
      config = await this._getLockPreferences();
    }
    const renewalSeconds = config[PREFERENCES_FIELD_EXPIRATION_RENEWAL_SECONDS];
    if (renewalSeconds <= 0 || renewalSeconds === false) {
      // Renewal of locks is disabled. Do not extend the lock
      return false;
    }
    const durationSecs = config[PREFERENCES_FIELD_EXPIRATION_RENEWAL_SECONDS]
      || config[PREFERENCES_FIELD_EXPIRATION_SECONDS]
      || DEFAULT_EXPIRATION_SECONDS;
    const expirationTs = Date.now() + 1000 * durationSecs;
    if (expirationTs > lock.expirationTs) {
      // if EXPIRATION_RENEWAL_SECONDS from now actually extends (not shortens) the lock,
      // then update it
      return await new Robot(robotId).updateLockAsync(lock.ts, { expirationTs });
    } else {
      return false; // lock not updated
    }
  };

  /**
   * Unlocks a robot. This can be used both to unlock a robot that a user has locked, or
   * for a robot some one else's locked ("breaking" the lock).
   */
  unlockRobot = async ({ robotId, user, now = Date.now(), soft = false }) => {
    const robot = new Robot(robotId);
    let lock;
    const userId = getUserId(user);
    try {
      lock = await robot.getLockAsync();
    } catch (e) {
      console.warn(`Attempted to unlock an unexisting robot ${robotId}`);
      return false;
    }
    const robotName = await robot.getNameAsync();
    // Check permissions. This depends on the user AND the lock object, so it is not part
    // of the meteor method's checking
    if (lock && lock.userId != userId) {
      if (soft) {
        // The robot is locked by another user but this was an attempt to *release* the user's lock
        return false;
      }
      // This is an attempt to break someone else's robot.
      // Note: *Breaking* locks is represented by CONFIG verb on LOCK resource type
      if (!await new OroRoles().canAccessSystemElement(
        userId, RESOURCE_SINGLETONS.LOCKS, ACCESS_LEVEL_CONFIGURE
      )) {
        console.warn(`User ${userId} attempted to break {${lock.userId}}'s lock on robot ${robotId}; access denied`);
        return false;
      }
    }
    // If there is a lock, break it (and create a notification)
    if (lock && lock.userId != userId) {
      lock.userId && await this.notifyUser({
        robotId,
        msg: `${robotName} - Lock has been broken by user ${getUserName(user)}`,
        userId: lock.userId
      });
    }
    // TODO(herchu) in future versions, check if the user has permissions to break locks
    // (This is a proposal, it is not yet implemented -- anyone can break other locks)
    // For this, we first need to load the robot's lock and determine if user userId owns it.
    await robot.setLockAsync(null); // unlock it

    if (!isSystemUser(user)) { // NOTE(herchu) Not logging internal calls to lock robots (spammy)
      try {
        new EventLog().sendEvent(buildEvent(EVENT_MODULES.LOCK, EVENT_TYPES.LOCK_UNLOCKED, {
          ...getUserLoggingAttributes(user),
          ts: now,
          robotId,
          robotName,
          lock: {
            locked: false,
            userId
          }
        }));
      } catch (e) {
        // We don't want to stop the execution if for some reason
        // the logging fails.
      }
    }
    return true;
  };

  /**
   * Checks if a robot's lock is expired, and clears it immediately.
   * Implemented as its own method, although the implementation is simply a side effect of
   * isRobotLocked(), so it simply calls that other method.
   */
  checkLockExpiration = async ({ robotId }) => {
    await this.isRobotLocked(robotId);
  };

  /**
   * Helper method to log action failures to event log
   *
   * @param {string} robotId - The robot ID
   * @param {string} robotName - The robot name
   * @param {string} actionId - The action ID
   * @param {Object} user - The user who triggered the action
   * @param {string} failureReason - The reason for failure
   * @param {Object} actionDef - Optional action definition for additional context
   */
  _logActionFailure = (robotId, robotName, actionId, user, failureReason, actionDef = null) => {
    try {
      new EventLog().sendEvent(buildEvent(EVENT_MODULES.ACTION, EVENT_TYPES.ACTION_FAILED, {
        ...getUserLoggingAttributes(user),
        ts: Date.now(),
        robotId,
        robotName,
        actionId,
        actionType: actionDef?.type || 'unknown',
        type: actionDef?.type || 'unknown', // kept for backward compatibility
        label: actionDef?.label || actionId,
        failureReason
      }));
    } catch (e) {
      // Do not throw if logging fails
      console.error('Error logging action failure', e);
    }
  };

  /**
   * Attempts to run a robot action. The execution first goes through this method to check
   * any condition related to locks: if locks are enabled if the robot is
   * locked, etc.
   * The userId of the user executing the action is received, as well as the fields from
   * its profile. They are normally fetched from the Meteor method execution; though this
   * method is not dependent on Meteor.
   *
   * @param {user} Either a Meteor user with { _id, profile } or a { userId } object. It is used
   *   to check permissions and for logging purposes.
   */
  runRobotAction = async ({
    robotId, actionId, user, args
  }) => {
    if (!user) {
      return { error: 'No user provided' };
    }
    const userId = getUserId(user);
    if (!isSystemUser(user)
      && !await new OroRoles().canAccessRobot(userId, robotId, ACCESS_LEVEL_OPERATE)) {
      return { error: 'User not authorized to run actions on ' + robotId };
    }
    let robotName;
    try {
      robotName = await (new Robot(robotId)).getNameAsync();
    } catch (e) {
      console.warn(`Attempted to run action on an unexisting robot ${robotId}`);
      return { error: 'Unknown robot' };
    }

    // Helper function for logging action failures (declared after robotName is computed)
    const logFailure = (reason, actionDef = null) => {
      this._logActionFailure(robotId, robotName, actionId, user, reason, actionDef);
    };

    if (!isSystemUser(user) && !await new OroRoles().canAccess(
      userId,
      glueId(RESOURCE_TYPES.ACTION, actionId),
      ACCESS_LEVEL_OPERATE
    )) {
      logFailure('User not authorized to run action');
      return { error: 'User not authorized to run action' };
    }
    // Load the action first to determine if it _needs_ the robot to be locked
    const actionDef = await ActionDefinitions.findOneAsync({ _id: actionId })
    if (!actionDef) {
      logFailure('Action not found');
      console.error(`Cannot execute unknown action ${actionId}`);
      return { error: 'Action not found' };
    }
    // flag to lock if 2 things happened: running the action AND locking the robot
    let autoLocked = false;
    if (actionDef[ACTION_FIELD_RESTRICTED]) {
      // Additional checks...
      const config = await this._getLockPreferences();
      if (config[PREFERENCES_FIELD_TYPE] == LOCK_TYPES.AUTOMATIC
        || config[PREFERENCES_FIELD_TYPE] == LOCK_TYPES.EXPLICIT) {
        const robotLock = await this.isRobotLocked(robotId);
        if (robotLock) {
          if (robotLock.userId != userId) {
            // Robot is locked by another user. Fail and log
            const errorMsg = 'Robot is locked' + (robotLock.userName ? ' by ' + robotLock.userName : '');
            logFailure(errorMsg, actionDef);
            return { error: errorMsg };
          } else {
            await this.renewLock(robotId, robotLock, config);
          }
        } else if (config[PREFERENCES_FIELD_TYPE] == LOCK_TYPES.EXPLICIT) {
          const errorMsg = 'Robot must be locked to execute action';
          logFailure(errorMsg, actionDef);
          return { error: errorMsg };
        } else if (config[PREFERENCES_FIELD_TYPE] == LOCK_TYPES.AUTOMATIC) {
          autoLocked = true;
          await this.lockRobot({ robotId, user });
        }
      }
    }
    const res = await new ActionsEngine().runAction({
      robotId,
      actionId,
      context: { robotId },
      user,
      args
    });
    // If result is not ok, the failure was already logged by ActionsEngine
    if (res.ok && autoLocked) {
      res.message = 'Action executed. Robot automatically locked';
    }
    return res;
  };

  /**
   * Meteor call to lock a robot
   */
  async _meteorLockRobot({ robotId }) {
    if (!robotId) {
      throw new Meteor.Error('robotId must be a string');
    }
    if (!await new OroRoles().canAccessDual(
      this.userId,
      RESOURCE_SINGLETONS.LOCKS,
      ACCESS_LEVEL_OPERATE,
      robotId,
      ACCESS_LEVEL_OPERATE
    )) {
      throw new Meteor.Error('Unauthorized');
    }
    return new LockManager().lockRobot({
      robotId,
      user: await Meteor.userAsync()
    });
  }

  /*
   * Meteor call to unlock a robot
   */
  async _meteorUnlockRobot({ robotId }) {
    if (!robotId) {
      throw new Meteor.Error('robotId must be a string');
    }
    if (!await new OroRoles().canAccessDual(
      this.userId,
      RESOURCE_SINGLETONS.LOCKS,
      ACCESS_LEVEL_OPERATE,
      robotId,
      ACCESS_LEVEL_OPERATE
    )) {
      throw new Meteor.Error('Unauthorized');
    }
    // TODO(herchu) check if user has permissions to break someone else's lock
    return new LockManager().unlockRobot({
      robotId,
      user: await Meteor.userAsync()
    });
  }

  /**
   * Returns the lock preferences.
   * Note that the result is never null (it can be an empty object).
   */
  _getLockPreferences = async () => (
    (await this._preferences.getPreferences('lock')) || {}
  );

  async _meteorSetLockPreferences(lock) {
    if (!await new OroRoles().canAccessSystemElement(
      this.userId,
      RESOURCE_SINGLETONS.LOCKS,
      ACCESS_LEVEL_CONFIGURE
    )) {
      return { error: 'User not authorized to modify lock preferences' };
    }
    return new LockManager().setLockPreferences(lock);
  };

  /*
   * Meteor call done to the server as a hint to check if a lock is expired. This is called
   * immediately after opening a robot if the UI detects the lock is already expired, so
   * the lock can be immediately garbage-collected without waiting for a background job to
   * do it.
   */
  async _meteorCheckLockExpiration({ robotId }) {
    // Any user with permission to view a robot can see the locks (and check for
    // expiration)
    if (!await new OroRoles().canAccessRobot(this.userId, robotId, ACCESS_LEVEL_VIEW)) {
      throw new Meteor.Error('User not authorized to view robot ' + robotId);
    }
    if (!robotId) {
      throw new Meteor.Error('robotId must be a string');
    }
    // TODO(herchu) check if user has permissions to break a lock
    return new LockManager().checkLockExpiration({ robotId });
  }
}

export default LockManager;
