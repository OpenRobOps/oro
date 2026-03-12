/**
 * Actions context HOC.
 * This Higher Order Component handles:
 *   - Action Execution
 *   - Prompting for user-provided arguments
 *   - Action Feedback
 *   - Action Object Props
 *
 * The correct way to use it with React components is to wrap said component and pass props like so:
 *   React Hooks:
 *
 *     const WrappedComponent = WithActionsContext(baseProps, (props) => {
 *       return (
 *        <h1>{...props}</h1>
 *       );
 *     });
 *     export default WrappedComponent;
 *
 *   React Components:
 *
 *     class WrappedComponent extends React.Component {.......}
 *     const WithActionsContextWrappedComponent =
 *        props => WithActionsContext(props, WrappedComponent);
 *     export default WithActionsContextWrappedComponent;
 *
 */
/* eslint-disable no-use-before-define */
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import PropTypes from 'prop-types';
import { Portal } from '@mui/material';
import { Meteor } from 'meteor/meteor';
import { isEmpty, isEqual, isObject, isString } from 'lodash';
// ORO modules
import { keyValueListToList } from '../../../lib/util';
import {
  ACTION_TYPES,
  ARGNAME_GO_PATH,
  ARGNAME_GO_URL
} from '../../../lib/actions';
import { ID_TYPE_ROBOT } from '../../../shared/constants';
import {
  actionHasUserInput, actionHasConfirmation, collectAttributeIdsForUserInput
} from '../../../shared/actions';
import CustomSnackbar, { SnackbarVariants, SNACKBAR_DEFAULT_DURATION } from './CustomSnackbar';
import ActionFeedback, { EXECUTION_STATUS, FEEDBACK_TIMEOUT } from '../common/ActionFeedback';
import { EMBEDDED_ACTION_KEY, GROUP_ID_NONE } from '../../../lib/uiPreferences';
import ActionParametersDialog from './ActionParametersDialog';
import { useFullscreenContext } from '../contexts/FullscreenContext';

// TODO(herchu) There are lots of debug messages below to debug the interaction with
// ActionFeedback and the feedbackTimeout call. Turn this DEBUG_CALLBACKS variable to 1 to
// debug it; and remove all occurrences of it (and the console.log calls) once this works ok.
const DEBUG_CALLBACKS = 0;

// TODO (franguerini) Refactor this component so that robot it does not need robot as prop
// and having this component only work with robotId
const WithActionsContext = (props, WrappedComponent) => {
  const {
    actionsConfig = {},
    companyId,
    robot = {},
    widget,
    uiConfig = {},
    actionsList,
    robotId
  } = props; /** @see WithActionsContext.propTypes */

  const { containerRef } = useFullscreenContext() || {};

  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);

  // variable use to indicate if an action is executing
  const [actionExecuting, setActionExecuting] = useState(false);
  // User Id state.
  const [userId, setUserId] = useState(null);

  // This widget's actions state: a 'hardcoded' list of actions to display (embedded actions,
  // or prepared actions e.g. in a banner)
  const [widgetActions, setWidgetActions] = useState([]);
  // Single Actions (1-click) state. An array of single click actions.
  const [actionsSingle, setActionsSingle] = useState([]);
  // Actions Groups state. An array of objects with defined actions groups.
  const [actionsGroups, setActionsGroups] = useState([]);
  const [defaultGroupFlag, setDefaultGroupFlag] = useState(true);
  // Actions already in groups state. A Set of actions ids already in groups.
  const [actionIdsInGroups, setActionIdsInGroups] = useState(new Set());

  // ActionId of the action in flight state. Null for no action in flight.
  const [actionInFlightId, setActionInFlightId] = useState(null);

  // Enabled Features state. An array of enabled features ids
  const [features, setFeatures] = useState([]);

  // Time id state. Null when timer has been cleared.
  const [timer, setTimer] = useState(null);

  // State to track asynchronous agent-side action feedback - used with ActionsFeedback
  // - Details of the action being tracked. Also used as a flag to enable/disable
  //   the ActionsFeedback component
  const [actionFeedback, setActionFeedback] = useState({
    executionTs: null,
    executionId: null,
    robotId: null,
    action: null
  });
  // - Updates received from the agent. Using a ref instead of a state since it needs
  //   to be accessible from callbacks
  const actionFeedbackUpdateRef = useRef();

  // Handles Close Snackbar Alert event
  const handleCloseSnackbarAlert = () => {
    setSnackbarAlert(prevSnackbarAlert => ({
      ...prevSnackbarAlert,
      open: false
    }));
  };

  // Snackbar Alert state.
  const [snackbarAlert, setSnackbarAlert] = useState({
    open: false,
    variant: SnackbarVariants.SUCCESS,
    message: '',
    onClose: handleCloseSnackbarAlert,
    autoHideDuration: SNACKBAR_DEFAULT_DURATION,
    actionMessage: '',
    onAction: null,
  });

  // Arguments input dialog properties: null when closed, or an `action` and
  // callbacks { onAction, onCancel } when open.
  const [argsInputPrompt, setArgsInputPrompt] = useState(null);

  /**
   * Navigate MC to the provided URL, retrieved
   * from the notification.
   */
  const urlAction = ({ url, external = false }) => {
    if (!external) {
      if (!navigate) {
        console.error('Cannot execute client actions - navigate function not provided');
      } else {
        // If we are about to jump to a URL about a robot, first check if a child window is
        // registered to 'display a robot'. In that case, post a message to that child window;
        // otherwise open it here
        const handled = false; // (see comment below)
        // NOTE(herchu) Since introduction of dashboards, there is no easy way to identify just from
        // the URL if it points "to the robot dashboard". The following logic is broken, as is
        // the MULTIPLE_WINDOWS support.
        // TODO(herchu) Re-enable MULTIPLE_WINDOWS experimental feature, by looking at a URL and
        // the dashboards configuration and decide from there if the URL should be handled in the
        // child window.
        // if (features.includes(FEATURES.MULTIPLE_WINDOWS)) {
        //   const robotIdFromUrl = isRobotUrl(url);
        //   if (robotIdFromUrl) {
        //     // Attempt to have this URL action be handled in a child window (if there is any)
        //     handled = theWindowsManager.sendRobotId({ robotId: robotIdFromUrl, url });
        //   }
        // }
        if (!handled) {
          navigate(url);
        } else {
          // Executed. Since the action has no effect on the current window, show a snackbar
          // message like we for agent actions.
          // Just in case the other window got lost; it's on background and the user
          // has lost it, whatever reason, allow to open the given url here as usual -- as an
          // action attached to the snackbar message.
          setActionInFlightId(null);
          setSnackbarAlert(prevSnackbarAlert => ({
            ...prevSnackbarAlert,
            open: true,
            message: 'Page opened in child window',
            variant: SnackbarVariants.SUCCESS,
            actionMessage: 'Open here',
            onAction: () => navigate(url)
          }));
        }
      }
    } else {
      window.open(url);
    }
  };

  /**
   * Runs an action clicked on the widget
   */
  const executeAction = ({ action }) => {
    if (action) {
      const {
        callback, url, type, args
      } = action;
      const id = action._id || action.actionId;
      if (callback) {
        // This is not a regular Action object; it may be a pseudo-action just created from the
        // client code. E.g. Dismiss or Add a robot. Just invoke the callback
        callback();
      } else if (url) {
        // NOTE(herchu) This is not a regular action object either. It comes from older billing
        // (and other?) notifications that could take the user setting pages.
        // TODO(migrate them to a ACTION_TYPES.GO_APP type of action

        // For now, url can only be customized with company id
        const newUrl = url.replace('{{companyId}}', companyId);
        urlAction({ url: newUrl });
      } else if (type === ACTION_TYPES.GO_GO_APP) { // client-side action
        if (args && args[ARGNAME_GO_PATH]) {
          urlAction({ url: action.args[ARGNAME_GO_PATH] });
        } else {
          console.warn(`Malformed ${ACTION_TYPES.GO_GO_APP} action: missing arg ${ARGNAME_GO_PATH}`);
        }
      } else if (type === ACTION_TYPES.GO_URL) { // client-side action
        if (args && args[ARGNAME_GO_URL]) {
          urlAction({ url: args[ARGNAME_GO_URL], external: true });
        } else {
          console.warn(`Malformed ${ACTION_TYPES.GO_URL} action: missing arg ${ARGNAME_GO_URL}`);
        }
        // It's an action that involves communicating through the app server. Start the process.
      } else if (actionHasUserInput(action)) {
        displayActionArgumentsPrompt({ action });
      } else if (actionHasConfirmation(action)) {
        displayActionConfirmPrompt({ action, args });
      } else if (id) {
        setActionExecuting(true);
        startActionExecution({ action, args });
      }
    }
  };

  /**
   * Called when an action requires user confirmation before running.
   * Pops up a confirmation dialog that can be cancelled. If confirmed to proceed, it invokes
   * agentActionStart (passing the same `action` and the original robotId as argument)
   */
  const displayActionConfirmPrompt = ({ action, args }) => {
    const { confirmation, label } = action;
    let message = `You are about to ${label || 'run this action'}`;
    let actionMessage = 'Confirm';
    if (isObject(confirmation)) {
      if (confirmation.message && isString(confirmation.message)) {
        ({ message } = confirmation.message);
      }
      if (confirmation.buttonLabel && isString(confirmation.buttonLabel)) {
        actionMessage = confirmation.buttonLabel;
      }
    }
    setSnackbarAlert(prevSnackbarAlert => ({
      ...prevSnackbarAlert,
      open: true,
      variant: SnackbarVariants.WARNING,
      message,
      actionMessage,
      onAction: () => {
        // We dismiss the popup to prevent
        // the user from clicking it more than once
        setSnackbarAlert(prevSnackbarAlert2 => ({
          ...prevSnackbarAlert2,
          open: false,
          actionMessage: null,
          onAction: null,
        }));

        // We start the action...
        setActionExecuting(true);
        startActionExecution({ action, args });
      }
    }));
  };

  /*
   * Called to open a dialog to prompt for user arguments before executing the
   * action. Once arguments submitted, there could still be the additional step
   * of action confirmation.
   */
  const displayActionArgumentsPrompt = ({ action }) => {
    const attributes = collectAttributeIdsForUserInput(action);
    // this function gets called after retrieving attribute values (or right now, if
    // no attributes are needed)
    const displayDialogFn = (err, attrValues) => {
      if (err) {
        // Could not get attribute values. Show dialog anyway, as it will find other defaults
        console.error('Error retrieving attribute values for actions dialog', err);
      }
      setArgsInputPrompt({
        open: true,
        action,
        robot,
        attrValues,
        onCancel: () => {
          setArgsInputPrompt(null);
        },
        onAction: (args) => {
          // Close the dialog
          setArgsInputPrompt(null);
          // And execute the action (or: confirm it first)
          if (actionHasConfirmation(action)) {
            displayActionConfirmPrompt({ action, args });
          } else {
            setActionExecuting(true);
            startActionExecution({ action, args });
          }
        }
      });
    };
    if (attributes && attributes.length) {
      // Some attributes are required to display options in the user input dialog: load them first
      Meteor.call('attributes.getValues', {
        entityId: robot._id,
        entityType: ID_TYPE_ROBOT,
        attributes
      }, displayDialogFn);
    } else {
      displayDialogFn();
    }
  };

  /**
   * Start the process of executing a non-client-side action (currently agent custom commands)
   *
   * Note that this callback may be called a while after the action was clicked; and the current
   * robotId could have changed since then. If for any reason this component is not showing the
   * same robot anymore, it does not proceed executing the action.
   *
   * TODO Standardize parameters used between method calls (server/action.js), feedback
   * response (ingest/customCommands.js / client/ActionFeedback.js) and parameters passed ultimately
   * to agentActionEnd so that messages and statuses (e.g.: errors) are always passed through
   * properly.
   */
  const startActionExecution = ({ action, args }) => {
    const actionId = action._id || action.actionId;
    setActionInFlightId(actionId);
    // Trigger the action execution
    Meteor.call('actions.execute', {
      actionId,
      robotId: !isEmpty(robot) ? robot._id : (robotId || null),
      args
    }, (err, data) => {
      setActionExecuting(false);
      if (data && data.ok) {
        if (data.executionId) {
          // The action was submitted to the robot and we can now listen for action feedback
          actionFeedbackStart({ data, action });
        } else {
          // Action was submitted from the server but there is no action feedback ID
          actionEnd({ data, action });
        }
      } else {
        // Meteor provides the value provided in the Meteor.Error inside the
        // error property of the err variable
        let errorMessage = err;
        if (err && err.error) {
          errorMessage = err.error;
        } else if (data.errors) {
          errorMessage = data.errors;
        }
        actionEnd({ error: errorMessage, action });
      }
    });
  };

  /**
   * Finish the UI feedback cycle for a non-client-side executed action.
   *
   * It will clear any pending action feedback state and display the corresponding
   * UI feedback: an error message if an error is provided and a success message
   * if the message succeded.
   */
  const actionEnd = ({ error, data, action }) => {
    DEBUG_CALLBACKS && console.log('actionEnd', error, data);
    if (timer) {
      clearTimeout(timer);
      setTimer(null);
    }

    setActionFeedback({
      executionId: null,
      executionTs: null,
      robotId: null,
      action: null
    });
    actionFeedbackUpdateRef.current = null;

    let message;
    let variant;
    if (error) {
      console.error('Error executing action', error, data);
      // error is a meteor error object, with an `error` string
      message = `${action.label}: ${error && isString(error) ? error : 'Error executing action'}`;
      variant = SnackbarVariants.ERROR;
    } else {
      message = `${action.label}: ${data && data.message ? data.message : 'Action executed'}`;
      variant = SnackbarVariants.SUCCESS;
    }
    setActionInFlightId(null);
    setSnackbarAlert(prevSnackbarAlert => ({
      ...prevSnackbarAlert,
      open: true,
      message,
      variant,
      actionMessage: null,
      onAction: null,
    }));
  };

  /**
   * Start listening to agent script feedback.
   */
  const actionFeedbackStart = ({ data, action }) => {
    setTimer(setTimeout(() => feedbackTimeout(action), FEEDBACK_TIMEOUT));
    // We receive robotId as input here in case the action was prepared
    // and we didn't have the robotId as a prop.
    const { executionId, ts, robotId: robotIdFromData } = data;
    DEBUG_CALLBACKS && console.log('actionFeedbackStart', executionId, robotId);
    setActionFeedback({
      executionTs: ts,
      executionId,
      robotId: robotIdFromData,
      action
    });
  };

  /**
   * Receive updates from the agent for the currently executed action.
   */
  const feedbackCallback = (update) => {
    DEBUG_CALLBACKS && console.log('actionFeedbackCallback', update, actionFeedback);
    if (!update) {
      DEBUG_CALLBACKS && console.log('ignoring NULL update');
      return;
    }
    actionFeedbackUpdateRef.current = update;
    const { executionStatus, executionStatusDetails } = update;
    // NOTE(Flor_Grosso): this is displaying execution details as given
    // by the agent. Consider sending a sub status from the agent and
    // making the details string here based on that.
    if (executionStatus === EXECUTION_STATUS.ABORTED) {
      if (update.executionStatusDetails) {
        actionEnd({ error: `Action failed to execute: ${executionStatusDetails}`, action: actionFeedback.action });
      } else {
        actionEnd({ error: 'Action failed to execute', action: actionFeedback.action });
      }
    } else if (executionStatus === EXECUTION_STATUS.FINISHED) {
      actionEnd({ error: null, data: null, action: actionFeedback.action });
    }
  };

  /**
   * Stop waiting for feedback updates from the agent and act based on what
   * happened until now.
   */
  const feedbackTimeout = (action) => {
    const { executionStatus } = actionFeedbackUpdateRef.current || {};
    DEBUG_CALLBACKS && console.log('actionFeedbackTimeout TIMEOUT!!!', executionStatus);
    if (!executionStatus) {
      actionEnd({
        error: 'Timeout waiting for result',
        data: null,
        action
      });
    } else {
      const data = {};
      if (executionStatus === EXECUTION_STATUS.TO_BE_STARTED
        || executionStatus === EXECUTION_STATUS.RUNNING) {
        data.message = 'Action submitted';
      }
      actionEnd({ error: null, data, action });
    }
  };

  // Local actions are excluded
  const filterClientOrInternalActions = action => action && !action.client && !action.internal;

  // ComponentDidMount equivalent hook
  useEffect(() => {
    if (!userId) {
      // On mount, set the userId to the Meteor.userId()
      setUserId(Meteor.userId());
    }
  }, []);

  // ComponentDidUpdate equivalent hook. Will update when actions or uiConfig props change.
  // It updates the list of actions found and in which groups they appear.
  // Input: actionsConfig, uiConfig, actionsList, widget
  // Output state: widgetActions, actionIdsInGroups, defaultGroupFlag
  useEffect(() => {
    const {
      actions = {},
      [widget]: widgetConfig = { [EMBEDDED_ACTION_KEY]: [] }
    } = uiConfig;
    const { groups = null } = actions;
    if (actionsList) {
      // There is a fixed list of actions to display; use it and ignore groups
      setWidgetActions(actionsList);
      setDefaultGroupFlag(true);
      return;
    }
    // if this HOC is rendering embedded actions, list only those
    const widgetActionIds = widget
      ? widgetConfig && widgetConfig[EMBEDDED_ACTION_KEY]
      : Object.keys(actionsConfig);
    const actionIdsInGroupsFound = new Set();
    let definedActionsGroups = [];
    let justDefGroupExists = true;
    if (widgetActionIds && widgetActionIds.length && !isEmpty(actionsConfig)) {
      // Check for empty groups object
      if (groups && !isEmpty(groups)) {
        definedActionsGroups = keyValueListToList(groups).map((group) => {
          const { actionIds = [], _id } = group;
          let foundActions = [];
          if (actionIds && actionIds.length) {
            foundActions = actionIds.map((actionId) => {
              // Spread actionsConfig[actionId] to avoid modifying the prop actionsConfig
              const foundAction = { ...actionsConfig[actionId] };
              if (foundAction && !isEmpty(foundAction)) {
                foundAction._id = actionId;
                actionIdsInGroupsFound.add(actionId);
                if (justDefGroupExists && _id !== GROUP_ID_NONE) {
                  justDefGroupExists = false;
                }
                return foundAction;
              }
              return undefined;
            });
          }
          const remoteActions = foundActions.filter(filterClientOrInternalActions);
          return { ...group, actions: remoteActions };
        });
      }
    }
    // Find the actions in the widget's embedded actions list and keep the objects
    const actionObjects = Array.isArray(widgetActionIds) && widgetActionIds.map(actionId => (
      actionsConfig && { ...actionsConfig[actionId], _id: actionId }
    )).filter(action => action);
    // The previous loop collected `actions in groups` and determined the flag `justDefGroupExists`
    // telling that there are logically no grouped actions (even if some are in the "Other" group).
    // If this is true, clear the collection with all grouped actions.
    if (justDefGroupExists) {
      actionIdsInGroupsFound.clear();
    }
    // HACK(herchu/pisti) See IO-2206: This entire HOC has a weird props/state/effects logic that
    // causes infinite re-rendering calls. Unable to solve the root problem we are simply
    // avoiding setting the "same" state (with a different object) multiple times, to stop the
    // chain or state, effect, and render calls.
    !isEqual(actionsGroups, definedActionsGroups) && setActionsGroups(definedActionsGroups);
    !isEqual(defaultGroupFlag, justDefGroupExists) && setDefaultGroupFlag(justDefGroupExists);
    !isEqual(actionIdsInGroups, actionIdsInGroupsFound)
      && setActionIdsInGroups(actionIdsInGroupsFound);
    !isEqual(widgetActions, actionObjects) && setWidgetActions(actionObjects);
  }, [actionsConfig, uiConfig, actionsList, widget]);

  // ComponentDidUpdate equivalent Hook. When actionIdsInGroups and widgetActions state change,
  // filter those in groups and adds them to `actionsSingle` array
  // Input: actionIdsInGroups, widgetActions
  // Output state: actionsSingle, loading,
  useEffect(() => {
    if (Array.isArray(actionsList)) {
      // if the list of actions is fixed, copy it to 'actionsSingle' (with some processing
      // for user arguments)
      setActionsSingle(actionsList.map((action) => {
        if (action.actionId) {
          // this is an stored action. Since are executing it in the UI,
          // grab the arguments' definitions from the config, as the user is able
          // to provide argument values
          const actionInConfig = (actionsConfig && actionsConfig[action.actionId]) || {};
          return {
            ...action,
            elementList: actionInConfig.elementList,
            elementValues: actionInConfig.elementValues
          };
        } else {
          return { ...action };
        }
      }));
      setLoading(false);
    } else if (actionsConfig && actionIdsInGroups && actionIdsInGroups.size) {
      const filteredActions = Object.keys(actionsConfig)
        .filter(actionId => !actionIdsInGroups.has(actionId)
          && widgetActions.find(action => action._id == actionId))
        .map(filteredActionId => ({
          _id: filteredActionId,
          ...actionsConfig[filteredActionId]
        }));
      const remoteActions = filteredActions.filter(filterClientOrInternalActions);
      setActionsSingle(remoteActions);
      setLoading(false);
    } else if (actionsConfig) {
      // If no groups were found, add the single click actions (actions props) to the
      // actionsSingle array.
      const actionsArray = Object.keys(actionsConfig)
        .filter(actionId => widgetActions.find(action => action._id == actionId))
        .map(actionId => ({
          _id: actionId,
          ...actionsConfig[actionId]
        }));
      const remoteActions = actionsArray.filter(filterClientOrInternalActions);
      setActionsSingle(remoteActions);
      setLoading(false);
    }
  }, [actionIdsInGroups, widgetActions]);

  // Skip rendering if still loading
  if (!loading) {
    return (
      <>
        <WrappedComponent
          {...props}
          actionsConfig={actionsConfig}
          executeAction={executeAction}
          actionsSingle={actionsSingle}
          actionsGroups={actionsGroups}
          defaultGroupFlag={defaultGroupFlag}
          actionInFlightId={actionInFlightId}
          actionExecuting={actionExecuting}
        />
        <Portal container={containerRef && containerRef.current}>
          <CustomSnackbar
            {...snackbarAlert}
          />
          {argsInputPrompt && (
            <ActionParametersDialog
              actionArguments={argsInputPrompt.action}
              attributeValues={argsInputPrompt.attrValues}
              open
              handleClose={argsInputPrompt.onCancel}
              saveChanges={argsInputPrompt.onAction}
            />
          )}
          {actionFeedback && actionFeedback.executionId && (
            <ActionFeedback
              robotId={robot._id}
              updateCallback={feedbackCallback}
              executionId={actionFeedback.executionId}
              executionTs={actionFeedback.executionTs}
            />
          )}
        </Portal>
      </>
    );
  } else {
    return null;
  }
};

WithActionsContext.propTypes = {
  // The action definitions object
  actionsConfig: PropTypes.object,
  // The company id for this actions list.
  companyId: PropTypes.string,
  // The robotid id for this actions list.
  robotId: PropTypes.string,
  // The robot object
  robot: PropTypes.shape({
    // The _id of the robot to execute these actions for.
    _id: PropTypes.string,
    // The lock status object for this robot.
    lock: PropTypes.object
  }),
  // If embedded into a widget, the widget's id string
  widget: PropTypes.string,
  // The uiPreferences object for this companyId
  uiConfig: PropTypes.object,
  // The lock Preferences object for this companyId
  lockConfig: PropTypes.object,
  // A fixed list of actions to display. Normally this is not provided, and the
  // actions list comes from actionsConfig. But when provided, the config is
  // only used to determine actions' attributes such as confirmation or conditions;
  // but the displayed list is this one. This is used for Banners and other places
  // where there is a list of 'prepared' actions (including Dismiss, which is not
  // even a proper Action object)
  actionsList: PropTypes.array,
  collectionsConfig: PropTypes.object
};

export default WithActionsContext;
