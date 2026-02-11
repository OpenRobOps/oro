/**
 * Shared constants and functions for robot locks handling.
 * See server/lock.js and design document for more details:
 * https://docs.google.com/document/d/1y0-htiDFGgDr1csOQwqk3CmRYEQZ6_hko9IGpNDYUm8
 */

// Types of locks per company
const LOCK_TYPES = {
  // disabled (default behavior): does not use locks.
  DISABLED: 'disabled',
  // explicit: robots need to be explicitly locked to execute restricted actions
  EXPLICIT: 'explicit',
  // automatic: robots will automatically lock if explicit actions are attempted to run
  AUTOMATIC: 'automatic'
};

// Types of locks per company
const LOCK_TYPES_LABELS = [
  { label: 'Disabled', _id: LOCK_TYPES.DISABLED },
  { label: 'Selectable', _id: LOCK_TYPES.EXPLICIT },
  { label: 'Automatic', _id: LOCK_TYPES.AUTOMATIC }
];

// For backwards compatibility and because this is an enterprise feature, the default
// behavior is to use no locks.
const LOCK_TYPE_DEFAULT = LOCK_TYPES.DISABLED;

/**
 * Tells is a lock object is already expired
 */
const isExpired = (lockObject, now = Date.now()) => (
  Boolean(lockObject) && lockObject.expirationTs < now
);

/**
 * Tells is a lock object indicates a current and non-expired lock
 */
const isLocked = lockObject => (
  Boolean(lockObject) && lockObject.locked && !isExpired(lockObject)
);

/**
 * Tells if a lock (from a robot) is active, and locked by a _different_ user from userId.
 */
const isLockedForUser = (lockObject, userId) => (
  isLocked(lockObject) && lockObject.userId != userId
);

/**
 * Determines if the given action is disabled because of a lock condition imposed on it.
 * Checks two different ways the action is disabled because of a robot lock rule:
 *  First it checks that the action needs the robot to be locked to be executed
 *  Then it checks these conditions:
 *  1- If the robot is locked by another user the action is disabled
 *  2- If the lock config is set in selectable (EXPLICIT 'old name') and the robot is not locked
 *      then the action is disabled
 *  @return {Object} - {
 *                       disabled, (boolean) if true the action is disabled
 *                       message (string, optional) reason why the action is disabled
 *                     }
 */
const isActionDisabledLocked = ({
  action,
  lockConfig,
  robotLock,
  userId
}) => {
  const lockExists = isLocked(robotLock);
  const lockedForUser = isLockedForUser(robotLock, userId);
  const isExplicit = lockConfig.type === LOCK_TYPES.EXPLICIT;

  // If action requires robot to be locked
  if (action.lock) {
    // If the robot is locked for the user then the action is disabled
    if (lockedForUser) {
      return {
        disabled: true,
        message: 'Robot is locked'
      };
    }

    // If the action needs to be locked but it is not locked
    if (isExplicit && !lockExists) {
      return {
        disabled: true,
        message: 'Robot should be locked first'
      };
    }
  }

  return { disabled: false };
};

export {
  LOCK_TYPES,
  LOCK_TYPES_LABELS,
  LOCK_TYPE_DEFAULT,
  isExpired,
  isLocked,
  isLockedForUser,
  isActionDisabledLocked
};
