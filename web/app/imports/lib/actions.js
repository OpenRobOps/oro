/**
 * Collections, constants and client-side functions to support actions.
 */
import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import SimpleSchema from 'simpl-schema';
import { isObject } from 'lodash';
// ORO modules
import { COLLECTIONS } from '../shared/constants';
import { isActionDisabledLocked } from './lock';
import {
  ACTION_UPDATE_USER_FIELDS,
  ACTION_TYPES,
  NAVIGATE_TO_ACTION_ID,
  RELOCALIZE_ACTION_ID,
  TELEOP_ACTION_ID,
  NAVIGATE_PATH_ID,
  CANCEL_NAV_GOAL_ID,
  ARGNAME_SCRIPT_FILENAME,
  ARGNAME_PUBLISH_MESSAGE,
  ARGNAME_GO_URL,
  ARGNAME_GO_PATH,
  createInternalActionId,
  CAMERA_TOGGLE_ID
} from '../shared/actions';

/*
 * Schema for action templates, each of the `template` field in action definitions below.
 */
const ActionTemplateSchema = new SimpleSchema({
  label: { type: String, required: true },
  lock: { type: Boolean, required: false },
  internal: { type: Boolean, required: false, defaultValue: false },
  client: { type: Boolean, required: false, defaultValue: false },
  disableAddingArgs: { type: Boolean, required: false, defaultValue: false },
  featureFlag: { type: String, required: false },
  context: { type: Object, blackbox: true, required: false, defaultValue: {} },
  elementList: { type: Array, blackbox: true, required: false, defaultValue: [] },
  'elementList.$': { type: String, required: true },
  elementValues: { type: Object, required: false, defaultValue: {}, blackbox: true }
});

/**
 * Client-side method.
 * Resolves any conditional rendering of an action, given the actions configuration.
 * It modifies the actions configuration in place, adding or editing `ui` element to them.
 * This object has the following flags:
 *  - `isDisabled`: If the action is disabled because of at least one condition
 *  - `label`: Label to display (for now: a copy of the action's label)
 *  - `disabledTooltip`: Tooltip to display on mouse hover when the action is disabled
 */
const resolveConditionalActionsRendering = ({
  actionsConfig, collectionsConfig, robot, actionIds, userId, lockConfig
}) => {
  if (actionIds && !Array.isArray(actionIds)) {
    throw new Error('actionIds must be an array');
  }
  if (!actionIds) {
    actionIds = Object.keys(actionsConfig);
  }
  actionIds.forEach((actionId) => {
    if (actionsConfig && isObject(actionsConfig[actionId])) {
      const action = actionsConfig[actionId];
      const actionNewConfig = action.ui || {};
      if (robot && robot.status && !robot.status.agentOnline) {
        actionNewConfig.isDisabled = true;
        actionNewConfig.disabledTooltip = 'Robot is offline';
      } else {
        const { lock } = robot || {};
        // Check that the action is not disabled due to a lock condition
        const actionLockDisabled = isActionDisabledLocked({
          action, lockConfig, robotLock: lock, userId
        });
        // If we can't evaluate the conditional action for any reason (e.g. still loading),
        // defer to the server the real validation -- be flexible here. Or if we can safely
        // determine the action can be executed; also enable the button.
        if (actionLockDisabled.disabled) {
          actionNewConfig.isDisabled = actionLockDisabled.disabled;
          actionNewConfig.disabledTooltip = actionLockDisabled.message;
        } else {
          actionNewConfig.isDisabled = false;
        }
      }
      actionNewConfig.label = action.label;
      action.ui = actionNewConfig;
    }
  });
};


const Schemas = {};

const ActionDefinitions = new Mongo.Collection(COLLECTIONS.ACTION_DEFINITIONS);
/*
 * This schema contains lots of fields and details... Refer to design doc:
 * https://docs.google.com/document/d/14nbbXkgxc4-ICCvko5SWFmyAf8Usuji8w0E97xeBnis/edit
 *
 * entityId: string
 * entityType: string
 * <actionId> : { // each action template object, indexed by actionId
 *   type: string, // type from ACTION_TYPES
 *   label: string, // human readable, user set name
 *   description: string (optional), // human readable, action description
 *   icon: string,    // Icon for this action. Could be anything that goes into the 'src' field
 *                    // of an img, such as a base64 data or an image URL.
 *   tooltip: string, // Tooltip text for the action
 *   order: number,    // HACK(adamantivm) If present, used to sort actions by numerical order
 *     // NOTE icon, tooltip and order are
 *     // still experimental, under action-icons feature flag
 *     // NOTE order in particular should be
 *     // removed from here and moved to ui_preferences instead
 *   target: { type: String, optional: true },
 *   client: bool (optional), // (default: false) if this is a client-side action
 *   isTemplate: bool (optional) // if this action is a system template, not to be used directly
 *   context: { // context on which or for which this action will execute -- normally a robot
 *     robotId: null, // optional; if action applies to a robot, placeholder for robotId
 *     fleetId ?
 *   },
 *   confirmation { // if confirmation is needed. See design doc
 *     required: bool,
 *     message: string,
 *     buttonLabel: string
 *   }
 *   elementList: [array of argument names]
 *   elementValues: { // values (constants) or placeholders
 *     // for each argument required by this action
 *     arg1: { value: _, type: _, label: _ }
 *     ...
 *   }
 *   disableAddingArgs: bool, optional // if user can add more args to this template
 *   createdTs: Number // creation timestamp
 *   updatedTs: Number // last updte timestamp
 *   featureFlag: String // optional; if the action is controlled by a feature flag, place it here
 * },
 */
if (Meteor.isServer) {
  ActionDefinitions.rawCollection().createIndex({ entityId: 1, entityType: 1 }, { unique: true });
}


const ActionTokens = new Mongo.Collection(COLLECTIONS.ACTION_TOKENS);
Schemas.ActionTokens = new SimpleSchema({
  actionId: String,
  // TODO(herchu) define exact meaning; or completely remove
  sourceId: { type: String, optional: true },
  type: String,
  label: String,
  target: { type: String, optional: true },
  context: { type: Object, blackbox: true },
  elementList: Array,
  // eslint-disable-next-line indent
    'elementList.$': String,
  elementValues: { type: Object, blackbox: true },
  nonce: { type: String, optional: true },
  createdTs: Number,
  lock: { type: Boolean, optional: true },
  confirmation: { type: Object, optional: true },
  description: { type: String, optional: true },
  // eslint-disable-next-line indent
    'confirmation.required': Boolean
}, { requiredByDefault: true });
if (Meteor.isDevelopment) {
  ActionTokens.attachSchema(Schemas.ActionTokens);
}
if (Meteor.isServer) {
  ActionTokens.rawCollection().createIndex({ sourceId: 1 });
  ActionTokens.rawCollection().createIndex({ createdTs: 1 });
  ActionTokens.rawCollection().createIndex({ nonce: 1, actionId: 1 }, { unique: true });
}

export {
  // Action types, schemas and system IDs
  ActionTemplateSchema,
  ACTION_UPDATE_USER_FIELDS,
  ACTION_TYPES,
  NAVIGATE_TO_ACTION_ID,
  RELOCALIZE_ACTION_ID,
  TELEOP_ACTION_ID,
  NAVIGATE_PATH_ID,
  CANCEL_NAV_GOAL_ID,
  CAMERA_TOGGLE_ID,
  // Collections
  ActionDefinitions,
  ActionTokens,
  // Special arguments
  ARGNAME_SCRIPT_FILENAME,
  ARGNAME_PUBLISH_MESSAGE,
  ARGNAME_GO_URL,
  ARGNAME_GO_PATH,
  // Utility functions
  createInternalActionId,
  resolveConditionalActionsRendering
};
