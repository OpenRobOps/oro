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
 * Implements a small Robot Lock indicator, and button to lock/unlock the robot.
 *
 * Design slides:
 * https://docs.google.com/presentation/d/1x2SdRWEqcuVYEbQoyHOaW_27FBsBWSrHlOu1vecpy74
 */
import { Meteor } from 'meteor/meteor';
import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import LockIcon from '@mui/icons-material/Lock';
import { withStyles } from 'tss-react/mui';
import { Button, Tooltip, Box } from '@mui/material';
import classNames from 'classnames';
// ORO modules
import CustomSnackbar, { SnackbarVariants, SNACKBAR_DEFAULT_DURATION } from '../../util/CustomSnackbar';
import { isLocked, isLockedForUser } from '../../../../lib/lock';
import { formatDuration } from '../../../../lib/util';
import { legacyWithStyles } from '../../util/withStyles';

const styles = theme => ({
  mobileVersion: {
    [theme.breakpoints.down('md')]: {
      minWidth: '40px'
    }
  }
});

const tooltipStyles = {
  tooltip: {
    color: 'white',
    backgroundColor: 'black',
    border: 'solid 1px white',
    borderRadius: 0,
    fontSize: 13
  }
};
const CustomTooltip = withStyles(Tooltip, tooltipStyles);
CustomTooltip.muiName = 'Tooltip';

const TIMEOUT_RE_RENDER_MS = 30000;

// Breakpoint style constant
const LG_BREAKPOINT = { display: { lg: 'block', xs: 'none' } };

class Lock extends React.Component {
  state = {
    unlockConfirmationOpen: false,
    unlockConfirmationRobotId: null,
    statusOpen: false,
    statusMessage: '',
    statusSuccess: false
  };

  componentDidUpdate(prevProps) {
    const { robotId } = this.props;
    if (robotId && prevProps.robotId != robotId) {
      Meteor.call('robot.checkLock', { robotId });
    }
  }

  componentWillUnmount() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  /**
   * Event handler for the button click. The same button is used for locking
   * and unlocking.
   * It will attempt to Lock or Unlock the robot; or in the case the robot is already locked
   * by a different user, show a confirmation message before breaking the lock.
   */
  handleLockClicked = () => {
    const { lock, robotId } = this.props;
    const locked = isLocked(lock);
    const lockedForUser = isLockedForUser(lock, Meteor.userId());
    if (!locked) {
      Meteor.call('robot.lock', { robotId }, (err, result) => {
        if (err) {
          console.error('Error locking robot', err);
        }
        this.setState({
          statusOpen: true,
          statusMessage: result ? 'Robot locked' : 'Error locking robot',
          statusSuccess: Boolean(result)
        });
      });
    } else if (!lockedForUser) {
      this.setState({
        unlockConfirmationRobotId: robotId
      }, this.callUnlockRobot);
    } else {
      // breaking someone else's lock. Confirm first! Simply open the confirm dialog
      this.setState({
        unlockConfirmationOpen: true,
        unlockConfirmationRobotId: robotId
      });
    }
  };

  /**
   * Makes the actual meteor call to unlock a robot. Used both from the "Unlock" button,
   * and after confirming the user wants to break someone else's lock.
   */
  callUnlockRobot = () => {
    const { robotId } = this.props;
    Meteor.call('robot.unlock', { robotId }, (err, result) => {
      if (err) {
        console.error('Error unlocking robot', err);
      }
      this.setState({
        statusOpen: true,
        statusMessage: result ? 'Robot unlocked' : 'Error unlocking robot',
        statusSuccess: Boolean(result)
      });
    });
  };

  /**
   * Closes the confirmation dialog (pressing "X" or by timeout)
   */
  handleCloseConfirmation = () => {
    this.setState({
      unlockConfirmationOpen: false,
      statusOpen: false
    });
  };

  /**
   * Callback for confirming the user wants to break the current lock.
   * Note that there is an extra check to make sure the current robot did not change since
   * the dialog was open.
   */
  handleConfirmUnlock = () => {
    const { unlockConfirmationRobotId } = this.state;
    const { robotId } = this.props;
    if (robotId != unlockConfirmationRobotId) {
      console.warn('Will not unlock robot. Callback called after current robot changed');
      return;
    }
    this.setState({
      unlockConfirmationOpen: false,
      statusOpen: false
    });
    this.callUnlockRobot();
  };

  render() {
    const { classes, theme, lock, colorClassNames, fullscreen } = this.props;
    let { disabled = false } = this.props;
    const {
      unlockConfirmationOpen,
      statusMessage, statusSuccess, statusOpen
    } = this.state;
    const locked = isLocked(lock);
    const lockedForMe = isLockedForUser(lock, Meteor.userId());
    const lockedLabel = !lockedForMe ? 'Unlock' : 'Locked';
    const label = locked ? lockedLabel : 'Lock';
    let lockedBy;
    let lockedByAboutToBreak;
    if (locked && lockedForMe && lock.userName) {
      const durationMs = lock.expirationTs - new Date();
      const { str: durationStr } = formatDuration(durationMs, 'ms');
      const { userEmail } = lock;
      const email = userEmail ? `(${userEmail})` : '';
      lockedByAboutToBreak = `by ${lock.userName}`;
      lockedBy = `by ${lock.userName} ${email} for ${durationStr}`;

      if (durationMs > TIMEOUT_RE_RENDER_MS) {
        this.timeoutId = setTimeout(() => {
          this.setState({});
        }, TIMEOUT_RE_RENDER_MS);
      }

      // If it is locked by someone else, then clicking means "break the lock". This can only
      // be done by engineers, managers, etc. -- anyone with proper permissions on ~locks resource
      // TODO : check permissions to break locks here
      // disabled = disabled || !clientGrantsSpecificAccess(
      //   this.context && this.context.userGrants,
      //   null,
      //   [RESOURCE_SINGLETONS.LOCKS],
      //   ACCESS_LEVEL_CONFIGURE
      // );
    }
    const lockedBtn = (
      <Button
        data-test="robot-lock-button"
        size="small"
        variant={locked ? 'contained' : 'text'}
        style={{ backgroundColor: lockedForMe ? theme.palette.text.statusError : (locked ? theme.palette.text.lightGray : '') }}
        onClick={this.handleLockClicked}
        disabled={disabled}
        title={lockedBy}
      >
        <LockIcon
          // style={{ color: locked ? 'blue' : theme.palette.text.lightGray }}
          style={{ color: locked ? theme.palette.background.default : theme.palette.text.lightGray }}
        />
        <Box sx={LG_BREAKPOINT}>
          {label}
        </Box>
      </Button>
    );
    const lockedBtnContainer = disabled ? (
      <CustomTooltip
        title={lockedBy}
        placement="bottom"
        disableInteractive
      >
        <div>
          {lockedBtn}
        </div>
      </CustomTooltip>
    ) : (lockedBtn);
    return (
      <Fragment>
        {lockedBtnContainer}
        {unlockConfirmationOpen && (
          <CustomSnackbar
            open={unlockConfirmationOpen}
            variant={SnackbarVariants.WARNING}
            message={'You\'ll be breaking the lock held ' + lockedByAboutToBreak}
            autoHideDuration={SNACKBAR_DEFAULT_DURATION}
            actionMessage="Confirm"
            onClose={this.handleCloseConfirmation}
            onAction={this.handleConfirmUnlock}
          />
        )}
        {!unlockConfirmationOpen && statusOpen && (
          <CustomSnackbar
            open={statusOpen}
            variant={statusSuccess ? SnackbarVariants.SUCCESS : SnackbarVariants.ERROR}
            message={statusMessage}
            autoHideDuration={SNACKBAR_DEFAULT_DURATION}
            onClose={this.handleCloseConfirmation}
          />
        )}
      </Fragment>
    );
  }
}

// Receive global user grants as context
// Lock.contextType = UserGrantsContext;

Lock.propTypes = {
  classes: PropTypes.object,
  robotId: PropTypes.string,
  lock: PropTypes.object, // the robot Lock object (when locked)
  disabled: PropTypes.bool,
  fullscreen: PropTypes.bool,
  colorClassNames: PropTypes.object
};

export default legacyWithStyles(Lock, styles, { withTheme: true });
