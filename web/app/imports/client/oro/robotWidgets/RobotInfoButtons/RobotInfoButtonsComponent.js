/**
 * RobotInfoButtons.js
 *
 * This component encapsulates the functionality to show basic Robot information and corresponding
 * action buttons, to be placed at the header of the Ground Control view.
 */
import { Meteor } from 'meteor/meteor';
import React, { Fragment } from 'react';
import PropTypes from 'prop-types';
import { Button, Typography, Tooltip, Grid, Box }
  from '@mui/material';
import {
  Cancel, Settings, Refresh, Update, Navigation
} from '@mui/icons-material';
import { withTracker } from 'meteor/react-meteor-data';
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
import { Url } from '../../../../lib/urls';
import { SECTION_SCOPES } from '../../../../lib/uiPreferences';
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
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  actionButtonText: {
    color: theme.palette.text.title,
    fontWeight: theme.fontWeight.medium
  },
  systemActions: {
    display: 'flex',
    alignItems: 'center'
  },
  iconStyle: {
    paddingRight: '4px'
  },
  lowerCaseButton: {
    textTransform: 'initial',
    fontWeight: theme.fontWeight.lightPlus,
    color: theme.palette.text.content
  },
  lastSeen: {
    padding: '0.2em 12px',
  },
  rowButton: {
    color: theme.palette.text.content
  }
});
// Remove robot button timer: It allows deleting a robot after 5min of inactivity
// this prevents a button appearing and dissapearing on times of intermittent connectivity
const ALLOW_REMOVE_ROBOT_UNIT = Meteor.isDevelopment ? 'seconds' : 'minutes';

// Breakpoint style constant
const LG_BREAKPOINT = { display: { lg: 'block', xs: 'none' } };

class RobotInfoButtons extends React.Component {
  state = {
    confirmDialogOpen: false,
    currentVariant: '',
    latestVariantVersion: '',
  }

  /**
   * Returns an object containing the icon color,
   * tooltip and active / inactive state based on
   * the robot and agent status.
   */
  agentStatus = () => {
    const { version, variant } = this.props;
    const { currentVariant, latestVariantVersion } = this.state;
    // If the variant didn't change, don't fetch the new variant
    // Variant version updates are much less common than switching between robots
    // so we will fetch the latest version only on variant changes.
    if (variant !== currentVariant) {
      this.setAgentVariantState();
      return false;
    } else if (version !== latestVariantVersion) {
      const s = {};
      s.fill = theme => theme.palette.text.title;
      s.text = 'Update Agent';
      s.tooltip = 'Update to ' + latestVariantVersion;
      s.click = this.confirmUpdate;
      s.disabled = false;
      s.version = version;
      s.latestVersion = latestVariantVersion;
      return s;
    } else {
      return false;
    }
  }

  componentDidMount() {
    this.agentStatus();
  }

  componentDidUpdate(prevProps, prevState) {
    const { variant, robotId } = this.props;
    const { currentVariant, latestVariantVersion } = this.state;
    if (variant != currentVariant) {
      this.setAgentVariantState();
    }
    if (currentVariant !== prevState.currentVariant
      || latestVariantVersion !== prevState.latestVariantVersion
      || robotId != prevProps.robotId
      || variant != prevProps.variant) {
      this.agentStatus();
    }
  }

  /**
   * Method to call upon the server to get the latest version for a variant
   * if the variant passed is undefined, the server will assume we desire the
   * main variant and will return the latest agent version for main.
   * The method saves in the state the latest variant version and the variant
   * it is tracking.
   */
  setAgentVariantState = () => {
    const { variant, agentVariantConfig, isPreferenceLoading } = this.props;
    let latestVariantVersion;
    let currentVariant;
    if (!isPreferenceLoading) {
      Meteor.call('agent.latest_variant', {
        variant: agentVariantConfig
      }, (error, result) => {
        if (result) {
          latestVariantVersion = result;
          currentVariant = variant;
          this.setState({ latestVariantVersion, currentVariant });
        }
        if (error) {
          console.error(error);
        }
      });
    }
  }

  /**
   * Returns a string indicating the elapsed time since the robot's
   * last connection.
   */
  getLastSeenInterval = () => {
    const { updateStamp } = this.props;
    return 'Last seen ' + moment(updateStamp).fromNow();
  }

  /**
   * Returns a string indicating the last seen time for a robot in
   * '<day> at hh:mm:ss' format, where day can be either 'today',
   * 'yesterday' or 'YYYY/MM/DD'.
   */
  getLastSeenTime = () => {
    const { updateStamp } = this.props;
    return 'Last seen ' + formatTime(updateStamp).toLowerCase();
  }

  confirmDelete = () => {
    const { robot } = this.props;
    const { name, _id } = robot;
    const robotName = name || _id;
    this.setState({
      confirmDialogOpen: true,
      operation: 'delete',
      confirmContentText: `Are you sure you want to delete ${robotName} from your fleet?`,
      confirmButtonText: 'YES, DELETE',
      confirmSuccessMessage: 'Robot deleted'
    });
  }

  confirmUpdate = () => {
    const { robot } = this.props;
    const { name, _id } = robot;
    const robotName = name || _id;
    this.setState({
      confirmDialogOpen: true,
      operation: 'updateAgent',
      confirmContentText: `Update the agent installed on ${robotName} to the latest version?`,
      confirmButtonText: 'YES, UPDATE',
      confirmSuccessMessage: 'Update command sent'
    });
  }

  confirmResponse = (confirmed) => {
    const { onFeedback, selectRobotCallback, robotId } = this.props;
    const { operation } = this.state;
    this.setState({ confirmDialogOpen: false });

    if (confirmed) {
      // TODO(adamantivm) Move updateAgent to use confirmation logic from the Actions engine
      if (operation == 'updateAgent') {
        this.handleUpdateAgent();
      } else {
        // NOTE(adamantivm) This is now only used for the Delete Robot button
        // TODO(adamantivm) Migrate the Delete Robot action to be a proper action
        Meteor.call('robot.' + operation, { robotId }, (err) => {
          if (err) {
            onFeedback && onFeedback((err && err.error) || 'Error');
          } else {
            // After successfully deleting the robot, remove it from the context
            selectRobotCallback();

            // TODO (franguerini): Uncomment this line (or move it somewhere else) to have
            //                     snackbar messages after the robot is deleted
            //                     by having the remove of the deleted robot it is re-rendering
            //                     with an empty robotId (because it changed to undefined)
            //                     I believe the proper solution to this would be to move this logic
            //                     outside of this component (refactor it) so that the onFeedback
            //                     does not depend on the state of this component
            // onFeedback && onFeedback(confirmSuccessMessage, SnackbarVariants.SUCCESS);
          }
        });
      }
    }
  }

  handleUpdateAgent = () => {
    const {
      actionsConfig,
      executeAction
    } = this.props;
    const action = actionsConfig && actionsConfig[UPDATE_AGENT_ACTION_ID];
    executeAction({ action: { _id: UPDATE_AGENT_ACTION_ID, ...action } });
  }

  handleRestartAgent = () => {
    const {
      actionsConfig,
      executeAction
    } = this.props;
    const action = actionsConfig && actionsConfig[RESTART_AGENT_ACTION_ID];
    executeAction({ action: { _id: RESTART_AGENT_ACTION_ID, ...action } });
  }

  // This logic should remain synchronized with the one in NavigationControlBarComponent
  redirectToRobotSettings = () => {
    const { robotId, navigate } = this.props;
    const settingsNavPath = new Url().relative().settings().tail('navigation');
    const settingsView = robotId
      ? settingsNavPath.query({ id: robotId, scope: SECTION_SCOPES.ROBOT }).toString()
      : settingsNavPath.toString();
    navigate(settingsView);
  }

  render() {
    const {
      offline, isZeroData, classes,
      onNavigationDetail, updateStamp,
      actionsConfig, lock, enableLock, robotId, isRobotLoading
    } = this.props;
    const { userGrants } = this.context;
    const { confirmDialogOpen, confirmTitle, confirmContentText, confirmButtonText } = this.state;
    // Flags to decide if some buttons should or should not be shown
    const showDeleteRobot = clientGrantsSpecificAccess(this.context && userGrants,
      null, [RESOURCE_SINGLETONS.FLEET], ACCESS_LEVEL_CONFIGURE);
    const showUpdateAgent = showDeleteRobot;
    const showSettings = clientGrantsSpecificAccess(this.context && userGrants,
      null, [RESOURCE_SINGLETONS.DATASOURCES], ACCESS_LEVEL_CONFIGURE);
    const restartAction = actionsConfig && actionsConfig[RESTART_AGENT_ACTION_ID];
    const updateAction = actionsConfig && actionsConfig[UPDATE_AGENT_ACTION_ID];

    const restartActionUi = (restartAction && restartAction.ui) || {};
    const updateActionUi = (updateAction && updateAction.ui) || {};
    // TODO Clara: Replace isZeroData to noRobotSelected (related to withZeroDataCheck)
    const agentStatus = this.agentStatus();

    return !isZeroData && !isRobotLoading ? (
      <Grid container justifyContent="space-between" align="center">
        <div className={classes.robotActions}>
          {restartAction && WrapWithTooltip(getActionTooltip(restartAction), (
            <Button
              variant="text"
              size="small"
              aria-label="Restart"
              className={classes.rowButton}
              onClick={this.handleRestartAgent}
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
          >
            <Navigation
              className={classes.iconStyle}
              sx={{ fill: theme => theme.palette.text.title }}
            />
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
                onClick={this.confirmDelete}
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
        <Box sx={LG_BREAKPOINT}>
            {offline && (
              <Tooltip title={this.getLastSeenTime()} placement="top" disableInteractive>
                <Typography variant="caption" className={classes.lastSeen}>
                  {this.getLastSeenInterval()}
                </Typography>
              </Tooltip>
            )}
          </Box>
          { /* NOTE(Gus) Since settings are now only offered to Admins, show the
                settings button only to admins. See IO-633 for more info */ }
          {showSettings && (
            <Button
              variant="text"
              size="small"
              aria-label="Settings"
              onClick={this.redirectToRobotSettings}
              title="Settings"
            >
              <Settings
                className={classes.iconStyle}
                sx={{ fill: theme => theme.palette.text.title }}
              />
            </Button>
          )}
        </div>
        <ConfirmationDialog
          onDone={this.confirmResponse}
          open={confirmDialogOpen}
          title={confirmTitle}
          content={confirmContentText}
          confirmButtonText={confirmButtonText}
        />
      </Grid>
    ) : (
      <Fragment />
    );
  }
}

// RobotInfoButtons.contextType = UserGrantsContext;

RobotInfoButtons.propTypes = {
  classes: PropTypes.object,
  robot: PropTypes.object,
  robotId: PropTypes.string,
  offline: PropTypes.bool,
  updateStamp: PropTypes.number,
  isZeroData: PropTypes.bool,
  theme: PropTypes.object,
  version: PropTypes.string,
  variant: PropTypes.string,
  agentVariantConfig: PropTypes.string,
  isPreferenceLoading: PropTypes.bool,
  onFeedback: PropTypes.func, // callback for errors executing agent actions (restart, update)
  onNavigationDetail: PropTypes.func, // callback for the Navigation Detail button
  actionsConfig: PropTypes.object,
  executeAction: PropTypes.func,
  lock: PropTypes.object,
  enableLock: PropTypes.bool,
  selectRobotCallback: PropTypes.func, // callback used to change the context of robotId
  isRobotLoading: PropTypes.bool
};

const RobotInfoButtonsContainer = withTracker(({ robotId }) => {
  if (robotId) {
    const preferencesHandle = Meteor.subscribe('preferences', {
      entityId: robotId, entityType: ID_TYPE_ROBOT, fields: ['agentVariant']
    });
    const robotHandle = Meteor.subscribe('robot.details', { robotId });
    const isPreferenceLoading = !preferencesHandle.ready();
    const robot = Robots.findOne({ _id: robotId });
    const offline = robot && robot.status && !robot.status.agentOnline;
    return {
      isPreferenceLoading,
      isRobotLoading: !robotHandle.ready(),
      offline,
      updateStamp: robot && robot.updateStamp
    };
  }
  // TODO Clara: Replace isZeroData to noRobotSelected (related to withZeroDataCheck)
  return { isZeroData: true };
})(RobotInfoButtons);

export default legacyWithNavigate(legacyWithStyles(RobotInfoButtonsContainer, styles, { withTheme: true }));
