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
 * Lock container: owns the lock business logic, passing presentational data and
 * a single toggle handler down to LockComponent.
 */
import React, {
  useCallback, useEffect, useRef, useState
} from 'react';
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
import PropTypes from 'prop-types';
import { useMethod } from '../../util/meteorUtils';
import useConfirmationSnackbar, { SnackbarVariants } from '../../util/useConfirmationSnackbar';
import { isLocked, isLockedForUser } from '../../../../lib/lock';
import { formatDuration } from '../../../../lib/util';
import LockComponent from './LockComponent';

const TIMEOUT_RE_RENDER_MS = 30000;

const Lock = (props) => {
  const { robotId, lock, disabled = false } = props;

  const { call: lockRobot } = useMethod('robot.lock');
  const { call: unlockRobot } = useMethod('robot.unlock');
  const { call: checkLock } = useMethod('robot.checkLock');
  const { openDialog, ConfirmationDialog } = useConfirmationSnackbar();

  const userId = useTracker(() => Meteor.userId(), []);
  // Bumped to force a re-render so the remaining lock duration label stays current.
  const [, setTick] = useState(0);
  const timeoutRef = useRef(null);

  const locked = isLocked(lock);
  // True when the robot is locked by a different user (locked against the current user).
  const lockedByOther = isLockedForUser(lock, userId);

  // Re-check the lock whenever the selected robot changes.
  useEffect(() => {
    if (robotId) {
      checkLock({ robotId });
    }
  }, [robotId, checkLock]);

  // While someone else holds the lock, schedule a re-render so the remaining duration stays
  // current; clean up the timer on unmount or when the lock changes.
  useEffect(() => {
    if (locked && lockedByOther && lock?.userName) {
      const durationMs = lock.expirationTs - Date.now();
      if (durationMs > TIMEOUT_RE_RENDER_MS) {
        timeoutRef.current = setTimeout(() => setTick(t => t + 1), TIMEOUT_RE_RENDER_MS);
        return () => clearTimeout(timeoutRef.current);
      }
    }
    return undefined;
  }, [lock, locked, lockedByOther]);

  const doUnlock = useCallback(async () => {
    try {
      const result = await unlockRobot({ robotId });
      openDialog({
        message: result ? 'Robot unlocked' : 'Error unlocking robot',
        variant: result ? SnackbarVariants.SUCCESS : SnackbarVariants.ERROR,
      });
    } catch (err) {
      openDialog({
        message: `Error unlocking robot: ${err?.reason || err?.message || err}`,
        variant: SnackbarVariants.ERROR,
      });
    }
  }, [unlockRobot, openDialog, robotId]);

  // The same button locks and unlocks. When the robot is already locked by a
  // different user, confirm before breaking their lock.
  const handleToggleLock = useCallback(async () => {
    if (!locked) {
      try {
        const result = await lockRobot({ robotId });
        openDialog({
          message: result ? 'Robot locked' : 'Error locking robot',
          variant: result ? SnackbarVariants.SUCCESS : SnackbarVariants.ERROR,
        });
      } catch (err) {
        openDialog({
          message: `Error locking robot: ${err?.reason || err?.message || err}`,
          variant: SnackbarVariants.ERROR,
        });
      }
    } else if (!lockedByOther) {
      // The current user holds the lock; release it directly.
      doUnlock();
    } else {
      // Breaking someone else's lock. Confirm first.
      openDialog({
        message: `You'll be breaking the lock held by ${lock.userName}`,
        variant: SnackbarVariants.WARNING,
        actionMessage: 'Confirm',
      }, (confirmed) => {
        if (!confirmed) {
          return;
        }
        doUnlock();
      });
    }
  }, [locked, lockedByOther, lock, robotId, lockRobot, doUnlock, openDialog]);

  const lockedLabel = lockedByOther ? 'Locked' : 'Unlock';
  const label = locked ? lockedLabel : 'Lock';

  let lockedBy;
  if (locked && lockedByOther && lock.userName) {
    const { str: durationStr } = formatDuration(lock.expirationTs - Date.now(), 'ms');
    const email = lock.userEmail ? `(${lock.userEmail})` : '';
    lockedBy = `by ${lock.userName} ${email} for ${durationStr}`;
  }

  return (
    <>
      <LockComponent
        locked={locked}
        label={label}
        lockedBy={lockedBy}
        disabled={disabled}
        onToggleLock={handleToggleLock}
      />
      {ConfirmationDialog}
    </>
  );
};

Lock.propTypes = {
  robotId: PropTypes.string,
  lock: PropTypes.object, // the robot Lock object (when locked)
  disabled: PropTypes.bool,
};

export default Lock;
