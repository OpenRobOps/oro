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
 * RobotInfoButtons.js
 *
 * This component encapsulates the functionality to show basic Robot information and corresponding
 * action buttons, to be placed at the header of the Ground Control view.
 */
import { Meteor } from 'meteor/meteor';
import React, { Fragment, useState } from 'react';
import PropTypes from 'prop-types';
import { Button, Typography, Tooltip, Grid, Box }
  from '@mui/material';
import {
  Cancel, Refresh, Update
} from '@mui/icons-material';
import { Navigation2, Settings } from 'lucide-react';
import { useTracker } from 'meteor/react-meteor-data';
import moment from 'moment';
// ORO modules
import { ID_TYPE_ROBOT } from '../../../../shared/constants';
import {
  ACTION_TYPES,
  createInternalActionId
} from '../../../../lib/actions';
import ConfirmationDialog from '../../util/ConfirmationDialog';
import WrapWithTooltip from '../../util/WrapWithTooltip';
import { getActionTooltip } from '../../../../shared/actions';
import { formatTime } from '../../../../lib/util';
import { Robots } from '../../../../lib/collections';
// import {
//   RESOURCE_SINGLETONS, ACCESS_LEVEL_CONFIGURE, clientGrantsSpecificAccess
// } from '../../../../shared/roles';
// import UserGrantsContext from '../../contexts/UserGrantsContext';
import Lock from '../Lock';
import { legacyWithStyles } from '../../util/withStyles';
import { legacyWithNavigate } from '../../util/withNavigate';

const RobotDeleteIcon = Cancel;
const RobotUpdateIcon = Refresh;
const RESTART_AGENT_ACTION_ID = createInternalActionId(ACTION_TYPES.RESTART_AGENT);
const UPDATE_AGENT_ACTION_ID = createInternalActionId(ACTION_TYPES.UPDATE_AGENT);
const RESTART_AGENT_LABEL = 'Restart Agent';

const styles = theme => ({
  robotActions: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  actionButtonText: {
    color: theme.palette.text.title,
    fontWeight: theme.fontWeight.medium
  },
  systemActions: {
    display: 'flex',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  iconStyle: {
    paddingRight: '4px'
  },
  lowerCaseButton: {
    textTransform: 'initial',
    fontWeight: theme.fontWeight.lightPlus,
    color: theme.palette.text.lightGray,
    marginLeft: '12px'
  },
  lastSeen: {
    padding: '0.2em 12px',
  },
  rowButton: {
    color: theme.palette.text.lightGray
  },
  accentOnHover: {
    '&:hover': {
      color: theme.palette.secondary.main,
      backgroundColor: theme.palette.background.onHoverGray,
      // The lucide icon sets its stroke as an SVG attribute; a CSS rule
      // is needed to win over it on hover
      '& svg': {
        stroke: theme.palette.secondary.main
      }
    }
  }
});
// Remove robot button timer: It allows deleting a robot after 5min of inactivity
// this prevents a button appearing and dissapearing on times of intermittent connectivity
const ALLOW_REMOVE_ROBOT_UNIT = Meteor.isDevelopment ? 'seconds' : 'minutes';

// Breakpoint style constant
const LG_BREAKPOINT = { display: { lg: 'block', xs: 'none' } };

const RobotInfoButtons = (props) => {
  const {
    offline, isZeroData, classes, theme,
    onNavigationDetail, updateStamp, robot,
    onFeedback, selectRobotCallback, executeAction,
    actionsConfig, lock, enableLock, robotId, isRobotLoading
  } = props;
  // Confirmation dialog state; the confirm* fields are always set together
  const [confirmState, setConfirmState] = useState({ confirmDialogOpen: false });
  const {
    confirmDialogOpen, confirmTitle, confirmContentText, confirmButtonText, operation
  } = confirmState;

  /**
   * Returns a string indicating the elapsed time since the robot's
   * last connection.
   */
  const getLastSeenInterval = () => 'Last seen ' + moment(updateStamp).fromNow();

  /**
   * Returns a string indicating the last seen time for a robot in
   * '<day> at hh:mm:ss' format, where day can be either 'today',
   * 'yesterday' or 'YYYY/MM/DD'.
   */
  const getLastSeenTime = () => 'Last seen ' + formatTime(updateStamp).toLowerCase();

  const confirmDelete = () => {
    const { name, _id } = robot;
    const robotName = name || _id;
    setConfirmState({
      confirmDialogOpen: true,
      operation: 'delete',
      confirmContentText: `Are you sure you want to delete ${robotName} from your fleet?`,
      confirmButtonText: 'YES, DELETE',
      confirmSuccessMessage: 'Robot deleted'
    });
  };

  const confirmUpdate = () => {
    const { name, _id } = robot;
    const robotName = name || _id;
    setConfirmState({
      confirmDialogOpen: true,
      operation: 'updateAgent',
      confirmContentText: `Update the agent installed on ${robotName} to the latest version?`,
      confirmButtonText: 'YES, UPDATE',
      confirmSuccessMessage: 'Update command sent'
    });
  };

  const handleUpdateAgent = () => {
    const action = actionsConfig && actionsConfig[UPDATE_AGENT_ACTION_ID];
    executeAction({ action: { _id: UPDATE_AGENT_ACTION_ID, ...action } });
  };

  const handleRestartAgent = () => {
    const action = actionsConfig && actionsConfig[RESTART_AGENT_ACTION_ID];
    executeAction({ action: { _id: RESTART_AGENT_ACTION_ID, ...action } });
  };

  const confirmResponse = (confirmed) => {
    setConfirmState(prev => ({ ...prev, confirmDialogOpen: false }));

    if (confirmed) {
      // TODO Move updateAgent to use confirmation logic from the Actions engine
      if (operation == 'updateAgent') {
        handleUpdateAgent();
      } else {
        Meteor.call('robot.' + operation, { robotId }, (err) => {
          if (err) {
            onFeedback && onFeedback((err && err.error) || 'Error');
          } else {
            // After successfully deleting the robot, remove it from the context
            selectRobotCallback();
          }
        });
      }
    }
  };

  /**
   * Returns an object describing the Update Agent button.
   * ORO does not track published agent releases, so no version comparison is
   * made: the button is offered whenever an update action is configured.
   */
  const agentStatus = {
    fill: t => t.palette.text.title,
    text: 'Update Agent',
    tooltip: 'Update the agent to the latest version',
    click: confirmUpdate,
    disabled: false,
  };

  // Flags to decide if some buttons should or should not be shown
  const showDeleteRobot = true; // TODO check access: clientGrantsSpecificAccess(userGrants,
    //null, [RESOURCE_SINGLETONS.FLEET], ACCESS_LEVEL_CONFIGURE);
  const showUpdateAgent = showDeleteRobot;
    //null, [RESOURCE_SINGLETONS.DATASOURCES], ACCESS_LEVEL_CONFIGURE);
  const restartAction = actionsConfig && actionsConfig[RESTART_AGENT_ACTION_ID];
  const updateAction = actionsConfig && actionsConfig[UPDATE_AGENT_ACTION_ID];

  const restartActionUi = (restartAction && restartAction.ui) || {};
  const updateActionUi = (updateAction && updateAction.ui) || {};
  // TODO Clara: Replace isZeroData to noRobotSelected (related to withZeroDataCheck)

  return !isZeroData && !isRobotLoading ? (
      <Grid container justifyContent="space-between" align="center" width="100%">
        <div className={classes.robotActions}>
          {restartAction && WrapWithTooltip(getActionTooltip(restartAction), (
            <Button
              variant="text"
              size="small"
              aria-label="Restart"
              className={classes.rowButton}
              onClick={handleRestartAgent}
              data-test="robot-buttons-restart-agent"
              disabled={restartActionUi && restartActionUi.isDisabled}
            >
              <RobotUpdateIcon
                className={classes.iconStyle}
                sx={{
                  fill: !(offline || (restartActionUi && restartActionUi.isDisabled))
                    ? theme => theme.palette.text.title : theme => theme.palette.text.notesLight
                }}
              />
              <Box sx={LG_BREAKPOINT}>
                {restartAction.label || RESTART_AGENT_LABEL}
              </Box>
            </Button>
          ))}
          {enableLock && (
            <Lock robotId={robotId} lock={lock} />
          )}
          {!offline && agentStatus && showUpdateAgent && updateAction && (
            WrapWithTooltip(agentStatus.tooltip,
              (
                <Button
                  data-test="robot-buttons-update-agent"
                  variant="text"
                  size="small"
                  aria-label="Update"
                  className={classes.rowButton}
                  onClick={agentStatus.click}
                  disabled={updateActionUi && updateActionUi.isDisabled}
                >
                  <Update
                    className={classes.iconStyle}
                    sx={{
                      fill: updateActionUi && updateActionUi.isDisabled
                        ? (theme => theme.palette.text.notesLight) : (agentStatus.fill)
                    }}
                  />
                  <Box sx={LG_BREAKPOINT}>
                    {agentStatus.text}
                  </Box>
                </Button>
              ))
          )}
          <Button
            variant="text"
            size="small"
            aria-label="Teleop"
            data-test="navigation-button"
            onClick={onNavigationDetail}
            classes={{ text: classes.lowerCaseButton }}
            className={classes.accentOnHover}
          >
            <Navigation2 size={20} color={theme.palette.text.lightGray} style={{ marginRight: '4px' }} />
            <Box sx={LG_BREAKPOINT}>
              Navigation
            </Box>
          </Button>
          {showDeleteRobot
            && offline
            && moment(updateStamp).add(5, ALLOW_REMOVE_ROBOT_UNIT).isBefore(moment())
            && (
              <Button
                data-test="robot-buttons-delete-robot"
                variant="text"
                size="small"
                aria-label="Delete"
                className={classes.rowButton}
                onClick={confirmDelete}
                title="Remove"
                classes={{ text: classes.lowerCaseButton }}
              >
                <RobotDeleteIcon
                  className={classes.iconStyle}
                  style={{ sx: theme => theme.palette.text.title }}
                />
                <Box sx={LG_BREAKPOINT}>
                  Remove
                </Box>
              </Button>
            )}
        </div>
        <div className={classes.systemActions}>
          <Box sx={{ display: { lg: 'flex', xs: 'none' }, alignItems: 'center' }}>
            {offline && (
              <Tooltip title={getLastSeenTime()} disableInteractive>
                <Typography variant="caption" className={classes.lastSeen}>
                  {getLastSeenInterval()}
                </Typography>
              </Tooltip>
            )}
          </Box>
        </div>
        <ConfirmationDialog
          onDone={confirmResponse}
          open={confirmDialogOpen}
          title={confirmTitle}
          content={confirmContentText}
          confirmButtonText={confirmButtonText}
        />
      </Grid>
    ) : (
      <Fragment />
    );
};

// RobotInfoButtons.contextType = UserGrantsContext;

RobotInfoButtons.propTypes = {
  classes: PropTypes.object,
  robot: PropTypes.object,
  robotId: PropTypes.string,
  offline: PropTypes.bool,
  updateStamp: PropTypes.number,
  isZeroData: PropTypes.bool,
  theme: PropTypes.object,
  onFeedback: PropTypes.func, // callback for errors executing agent actions (restart, update)
  onNavigationDetail: PropTypes.func, // callback for the Navigation Detail button
  actionsConfig: PropTypes.object,
  executeAction: PropTypes.func,
  lock: PropTypes.object,
  enableLock: PropTypes.bool,
  selectRobotCallback: PropTypes.func, // callback used to change the context of robotId
  isRobotLoading: PropTypes.bool
};

const RobotInfoButtonsContainer = (props) => {
  const { robotId } = props;
  const trackerData = useTracker(() => {
    if (robotId) {
      const robotHandle = Meteor.subscribe('robot.details', { robotId });
      const robot = Robots.findOne({ _id: robotId });
      const offline = robot && robot.status && !robot.status.agentOnline;
      return {
        isRobotLoading: !robotHandle.ready(),
        offline,
        updateStamp: robot && robot.updateStamp
      };
    }
    // TODO Clara: Replace isZeroData to noRobotSelected (related to withZeroDataCheck)
    return { isZeroData: true };
  }, [robotId]);
  return <RobotInfoButtons {...props} {...trackerData} />;
};

export default legacyWithNavigate(legacyWithStyles(RobotInfoButtonsContainer, styles, { withTheme: true }));
