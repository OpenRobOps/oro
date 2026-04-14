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
 * Serverside Actions module.
 * It handles Actions definitions and execution
 */
import { Meteor } from 'meteor/meteor';
import { WebApp } from 'meteor/webapp';
import { Random } from 'meteor/random';
import { CronJob } from 'cron';
import moment from 'moment';
import handlebars from 'handlebars';
import { isObject, isString, isEmpty, get, pick, keyBy } from 'lodash';
import FastestValidator from 'fastest-validator';
// ORO modules
import { ACCESS_LEVEL_VIEW } from '../shared/roles';
import {
  ACTION_TYPES,
  ACTION_TYPES_LIST,
  ARGNAME_SCRIPT_FILENAME,
  ARGNAME_GO_PATH,
  ARGNAME_GO_URL,
  ARGNAME_PUBLISH_MESSAGE,
  ARGNAME_CAMERA_ID,
  ARGNAME_CAMERA_FOCUS,
  ARGNAME_CAMERA_ENABLED,
  ARGNAME_MAP_LABEL,
  ARG_FIELDS,
  createInternalActionId,
  actionArgSpecToSchema,
  isDummyArgName,
  validateActionDefinition,
  findActionTemplateFromType,
  ARGNAME_MISSION_DEFINITION_ID
} from '../shared/actions';
import {
  ActionTemplateSchema,
  ACTION_UPDATE_USER_FIELDS,
  ActionDefinitions,
  ActionTokens,
} from '../lib/actions';
import { keyValueListToObject } from '../lib/util';
import { EXTERNAL_USER_ID, EVENT_SETTINGS_SECTION_NAMES, getUserLoggingAttributes } from '../lib/events';
// import AlertsManager from './alertsManager';
import LockManager from './lock';
import Robot from './model/robot';
import { RobotCustomScript, RobotLocalization } from '../lib/collections';
// import { GROUP_LABEL_NONE, GROUP_ID_NONE } from '../lib/uiPreferences';
// import UIPreferencesManager from './uiPreferences';
import EventLog, { EVENT_TYPES, EVENT_MODULES, buildEvent } from './eventLogger';
import OroRoles from './roles';
// import RttManager from './rttManager';
import Mqtt from './mqtt';
import AttributesManager from './attributes';
// import SpatialTransformationsManager from './spatialTransformationsManager';
// import AnnotationsManager from './annotations';
// import { SPATIAL_ANNOTATION_TYPES } from '../shared/annotations';

// Max life time of an action token in db
const ACTION_TOKEN_EXPIRATION_MS = moment.duration(1, 'day').valueOf();

/**
 * Builds a result object representing an error message
 */
const buildErrorResult = message => ({ error: message });


let instance;
class ActionsEngine {
  constructor() {
    if (instance === undefined) {
      instance = this;
      // Meteor methods to add, edit or remove attributes and mappings
      Meteor.methods({
        'actions.execute': this._meteorExecuteAction,
        'actions.getFeedback': this._meteorGetFeedback
      });
    }
    // eslint-disable-next-line no-constructor-return
    return instance;
  }

  /**
   * Initializes DB defaults, and schedules background processes (tokens cleanup).
   *
   * @param {Object} modules provides the mqtt module in an field `{ mqtt }`. This
   *    should be a pointer to a `Mqtt` instance; or a mock replacement for
   *    unit tests.
   */
  init = async (modules) => {
    // Validate the necessary modules (mqtt for now), which must point to the
    // appropriate managers or test stubs
    if (!modules.mqtt) {
      throw new Error('missing mqtt client module!');
    }
    if (!modules.nav2d) {
      // Previous code did not _break_ without the Nav2d module: just print a warning
      console.warn('Created ActionsEngine without nav2d module. Some functionality will not work');
    }
    this.modules = { ...modules };
    // Initializes action templates
    await this._addDefaults();

    // Timer from keys cleanup cron job
    const CRON_TIMER = '0 0 0 * * *'; // every midnight
    // eslint-disable-next-line no-new
    new CronJob(CRON_TIMER, Meteor.bindEnvironment(() => {
      this._runBatchProcesses();
    }), null, true /* start now */);
    // Force reporting usage at server startup too
    this._runBatchProcesses();
  };

  /**
   * (Re)creates default system actions
   */
  _addDefaults = async () => {
    console.info('Creating default actions');
    // Recreate them usin the templates in ACTION_TYPES_LIST
    for (const actionType of ACTION_TYPES_LIST) {
      if (!actionType.isTemplate) {
        // Check the action template is valid (done only once, anyway)
        try {
          ActionTemplateSchema.validate(actionType.template);
        } catch (e) {
          throw new Error(`Bad config: Action template ${actionType._id} is not valid`, e);
        }
        // Create the action
        // NOTE(herchu) The template is COPIED so we cannot modify the original templates:
        // in test case scenarios, the in-memory DB appears to keep pointers to the original
        // objects and we mess up with them!
        // eslint-disable-next-line no-await-in-loop
        const result = await this.createDefaultActionDefinition(
          actionType._id,
          createInternalActionId(actionType._id),
          { ...actionType.template }
        );
        if (result.errors) {
          console.error('Error creating action definitions', actionType._id, result.errors);
        }
      }
    }
  };

  setActionDefinition = async (actionId, definition) => {
    const update = { $set: definition };
    const unsetFields = {};
    for (const field of Object.keys(definition)) {
      if (definition[field] === undefined) {
        unsetFields[field] = true;
      }
    }
    if (!isEmpty(unsetFields)) {
      update.$unset = unsetFields;
    }
    await ActionDefinitions.upsertAsync({ _id: actionId }, update)
  }

  unsetActionDefinition = async (actionId) => (
    ActionDefinitions.removeAsync({ _id: actionId })
  )

  getActionDefinition = async (actionId) => (
    ActionDefinitions.findOneAsync({ _id: actionId })
  )

  getActionDefinitions = async (actionIds) => (
    keyBy(
      actionIds
      ? await ActionDefinitions.find({ _id: { $in: actionIds } }).fetchAsync()
      : await ActionDefinitions.find({}).fetchAsync()
    , '_id')
  )

  _getMqttModule = () => {
    if (!this.modules.mqtt) {
      throw new Error('missing mqtt module');
    }
    return this.modules.mqtt;
  };

  _getNav2DModule = () => (
    this.modules.nav2d || null
  );

  _getImagesModule = () => (
    this.modules.images || null
  );

  _getMissionsModule = () => (
    this.modules.missions || null
  );

  /**
   * Gets custom script actions output
   * @param {string} executionId
   * @param {string} robotId
  */
  // eslint-disable-next-line class-methods-use-this
  getActionFeedback = async (executionId, robotId) => (
    RobotCustomScript.findOneAsync({
      executionId, robotId
    }, {
      fields: {
        executionStatus: 1,
        stderr: 1,
        stdout: 1,
        updatedTs: 1,
        returnCode: 1
      }
    })
  );

  /**
   * Creates a new action. 
   * It behaves like createActionDefinition; except it does not create or update an action if it already 
   * exists. This is used to create default actions during DB initialization.
   */
  createDefaultActionDefinition = async (type, actionId, definition) => {
    const existingDef = await this.getActionDefinition(actionId);
    if (existingDef !== undefined && !Meteor.isDevelopment) { // even with null, return
      return; // some action already exists; don't recreate it (except in development mode)
    }
    return this.createActionDefinition({
      actionId,
      definition: { type, ...definition }, 
      skipValidation: true
    });
  }

  /**
   * Creates an action definition (template) and stores in configuration db.
   *
   * actionId can be null (and will normally be); in this case the actionId is
   * randomized.
   *
   * If there is a user object received, the call gets logged
   *
   * @param {object} user A User object with { _id, profile } (or userId) that authors this change.

   * @return {object} An object with a `success` flag. If the operation succeeds, it will also
   *   contain `{ id, label }` flags of the newly created action.
   *   If the operation fails, an `errors` object contains a dictionary of which fields
   *   had errors (for the UI to highlight them), and optionally a human-readable error message
   *   (also suited as return value for APIs).
   */
  createActionDefinition = async ({
    actionId,
    definition,
    skipValidation = false,
    user = null
  }) => {
    if (!definition?.type) {
      throw new Error('type and definition are required');
    }
    let validation;
    if (!skipValidation) {
      validation = await this._validateActionDefinition(definition);
    } else { // skipValidation is only used to create the default, built-in actions
      validation = { success: true };
    }
    if (!validation.success) {
      return validation;
    }
    const { type } = definition;
    const actionTemplate = findActionTemplateFromType(type);
    if (!actionTemplate) { // invalid type
      return { errors: { type: true } };
    }
    // Check mandatory arguments
    if (!definition?.type || !definition.label) {
      // can't save it
      return {
        errors: {
          type: !definition?.type,
          label: !definition || !definition.label
        }
      };
    }
    // Action' actionTemplate key `final` is included in action definition artificially
    if (actionTemplate && actionTemplate.final) {
      definition.final = true;
    }
    // If no arguments (and no definition given) defaults to empty
    const action = {
      ...actionTemplate.template,
      ...definition,
      ...pick(definition, ACTION_UPDATE_USER_FIELDS),
      type: definition.type,
      createdTs: Date.now()
    };
    // If id is not given by the system, create one randomly
    if (!actionId) {
      actionId = type + '-' + Random.secret(6);
    }
    // Create the action in DB
    await this.setActionDefinition(actionId, action);
    user && new EventLog().logSetting({
      settingGroupName: EVENT_SETTINGS_SECTION_NAMES.ACTIONS,
      settingName: definition?.label,
      eventType: EVENT_TYPES.SETTING_ADDED,
      user
    });
    return { id: actionId, success: true, label: definition && definition.label };
  };

  /**
   * Removes an action definition from configuration
   *
   * If there is a user object received, the call gets logged
   *
   * @param {object} user A User object with { _id, profile } (or userId) that authors this change.
   */
  removeActionDefinition = async (actionId, user) => {
    await this.unsetActionDefinition(actionId);
    // Propagate removal to any incident calling this action
    console.warn('removeActionDefinition: TODO propagate to alerts');
    // await new AlertsManager().removeActionFromAllIncidents({ entity, actionId });
    // user && new EventLog().logSetting({
    //   settingGroupName: EVENT_SETTINGS_SECTION_NAMES.ACTIONS,
    //   settingName: oldDefinition && oldDefinition.label,
    //   eventType: EVENT_TYPES.SETTING_REMOVED,
    //   user
    // });
    return true;
  };

  /**
   * Updates an action definition (template) and stores in configuration db.
   *
   * If there is a user object received, the call gets logged
   *
   * @param {object} user A User object with { _id, profile } (or userId) that authors this change.
   *
   * @return {object} An object with a `success` flag. If the operation fails, an `errors` object
   *   contains a dictionary of which fields contain errors (for the UI to highlight them),
   *   and optionally a human-readable error message (also suited as return value for APIs).
   */
  updateActionDefinition = async (actionId, definition, user) => {
    if (!actionId) {
      throw new Error('Missing actionId');
    }
    const oldDefinition = await this.getActionDefinition(actionId);
    if (!oldDefinition) {
      throw new Error('Action not found');
    }
    // If no arguments (and no definition given) defaults to empty
    if (!definition.type || !definition.label) {
      // can't save it
      return {
        errors: {
          type: !definition.type,
          label: !definition.label
        }
      };
    }
    const validation = await this._validateActionDefinition(definition);
    if (!validation.success) {
      return validation;
    }
    // actionTemplate is guaranteed to exist, if _validateAction() passes
    const actionTemplate = ACTION_TYPES_LIST.find(obj => obj._id == definition.type);
    // Action's actionTemplate key `final` is included in action definition artificially
    definition.final = actionTemplate && actionTemplate.final;
    // Now create the new action definition. Having the action type changing or not,
    // we need to validate the definition passed as argument, allowing only user-defined
    // fields to pass through. Also, the default fields from the template are applied
    const newDefinition = {
      updatedTs: Date.now(),
      // Do a 'clean' version of the template, auto-completing missing fields. For example
      // if the action template does not have 'client: true', the .clean() call using
      // ActionTemplateSchema will default it to `false`
      ...ActionTemplateSchema.clean(actionTemplate.template),
      // The arguments that take precedence are those passed in the action definition
      // TODO(herchu) Better validation of fields values within ACTION_UPDATE_USER_FIELDS
      ...pick(definition, ACTION_UPDATE_USER_FIELDS)
    };
    if (definition.type != oldDefinition.type) {
      // If the action type changes, then the arguments list gets reset to those
      // of the template.
      Object.assign(
        newDefinition,
        pick(actionTemplate.template, ['elementList', 'elementValues'])
      );
    }
    // Create the action in DB
    await this.setActionDefinition(actionId, newDefinition);
    user && new EventLog().logSetting({
      settingGroupName: EVENT_SETTINGS_SECTION_NAMES.ACTIONS,
      settingName: definition && definition.label,
      eventType: EVENT_TYPES.SETTING_UPDATED,
      user
    });
    return { id: actionId, success: true, label: definition && definition.label };
  };

  /**
   * Creates or updates an action definition
   *
   * If there is a user object received, the call gets logged
   *
   * @param {object} user A User object with { _id, profile } (or userId) that authors this change.
   * @return {object} An object with a `success` flag. If the operation fails, an `errors` object
   *   contains a dictionary of which fields contain errors (for the UI to highlight them),
   *   and optionally a human-readable error message (also suited as return value for APIs).
   */
  createOrUpdateActionDefinition = async (
    actionId,
    definition,
    user
  ) => {
    const oldDefinition = await this.getActionDefinition(actionId);
    if (oldDefinition) {
      return this.updateActionDefinition(actionId, definition, user);
    } else {
      return this.createActionDefinition({ actionId, definition, user });
    }
  };

  /**
   * Suppresses an action
   *
   * @param {object} user A User object with { _id, profile } (or userId) that authors this change.
   */
  suppressActionDefinition = async (actionId, user) => {
    const definition = await this.getActionDefinition(actionId);
    const label = definition?.label;
    await this.unsetActionDefinition(actionId);
    const settingName = label || actionId;
    user && new EventLog().logSetting({
      user,
      settingGroupName: EVENT_SETTINGS_SECTION_NAMES.ACTIONS,
      settingName,
      eventType: EVENT_TYPES.SETTING_REMOVED
    });
    return { success: true, label };
  };

  /**
   * Validates an action definition before allowing to save it to configurations.
   * It performs different checks:
   *  - Some "static" checks about the definition itself (valid type, correct arguments etc),
   *    implemented by validateActionDefinition() from shared/actions.
   *  - Account-specific checks: Gating (access to feature flags, if the action type is only
   *    available under a FF) and limiting (number of actions, if the account edition limits that)
   *
   * NOTE: This method CANNOT be used to validate actions created during addDefaults() because
   * some of them are "final" and "internal", which are some of the checks done in
   * this method to prevent from overwriting them.
   *
   * TODO(herchu) if arguments can change (there is a flag disableAddingArgs -- loosely defined)
   *
   * As most validation methods in this module, it returns an object { success, errors, message }.
   */
  // eslint-disable-next-line class-methods-use-this
  _validateActionDefinition = async (definition) => {
    // First do a 'syntax' check on the action: If the type exists, all arguments are defined, etc.
    const validation = validateActionDefinition(definition);
    if (!validation.success) {
      return validation;
    }
    const actionTemplate = findActionTemplateFromType(definition.type); // not null, already checked
    const { template } = actionTemplate;
    // finally, internal flags
    if (actionTemplate.final) {
      console.warn('Attempted to redefine "final" action');
      return { success: false, message: 'Cannot re-define this action' };
    }
    if (template.internal) {
      console.warn('Attempted to redefine "internal" action ');
      return { success: false, message: 'Cannot re-define this action' };
    }
    return { success: true };
  };

  /**
   * It runs an action using certain `context`.
   * The context will normally contain a robotId. The `args` object contains runtime
   * argument values.
   *
   * If there are any validation errors, it returns a dictionary whose keys are the
   * invalid or missing arguments.
   *
   * @param {user} Optional, for logging purposes: An object with { _id, profile } or
   *      a { userId } object.
   */
  runAction = async ({
    actionId,
    context,
    args,
    user
  }) => {
    if (!actionId) {
      await this._logActionFailure({
        actionId: 'unknown',
        context: { robotId: context?.robotId },
        type: 'unknown',
        label: 'unknown'
      }, user, 'Action ID is required');
      return { errors: { actionId: true } };
    }
    const prepared = await this.prepareActions({ actionIds: [actionId], context, args });
    if (prepared.errors) { // There are errors, stop
      console.warn(`Error preparing action "${actionId}" for execution: ${JSON.stringify(prepared.errors)}`);
      const robotId = context?.robotId;
      const [, errorReason] = Object.entries(prepared.errors)[0];
      if (robotId) {
        // A bit of a fake action object to pass to the logger.
        const fakeAction = {
          actionId,
          context: { robotId },
          type: 'unknown',
          label: actionId
        };
        // eslint-disable-next-line no-await-in-loop
        await this._logActionFailure(fakeAction, user, errorReason);
      }
      return prepared; // which contains { errors } field
    }
    // Execute them
    for (const action of prepared.actions) {
      return this._executeAction(action, user);
    }
    return undefined;
  };

  /**
   * Loads and prepares a list of actions to be ready for execution, and saves
   * them to the ActionTokens collection.
   * To execute any of those actions later, call runStoredAction(actionId, nonce)
   *
   * It returns an array of action references { actionId, type, nonce, label } to be
   * sent along any notification type.
   *
   */
  prepareAndStoreActions = async ({ entityId, entityType, actionIds, context, args, sourceId }) => {
    /*
    NOTE(herchu) sourceId should be required but there is no reliable id from the alerts
    manager to send during _dispatchAlert. Removing the assertion
    if (!sourceId) {
      throw new Error('sourceId must be provided');
    }
    */
    const prepared = await this.prepareActions({ entityId, entityType, actionIds, context, args });
    if (!prepared.actions) { // There are errors (and not a single action compiled), stop
      return prepared; // which contains { errors } field
    }
    const createdTs = Date.now();
    const nonce = Random.secret();
    // Store the actions adding nonces for validation
    const ret = [];
    let ix = 0;
    for (const action of prepared.actions) {
      // Complete the action doc, ensuring elementList has a default value
      Object.assign(action, {
        actionId: actionIds[ix], // it is in the same order as actionIds
        sourceId,
        nonce,
        createdTs,
        elementList: action.elementList || [] // Ensure elementList is always defined
      });
      if (action.client) {
        // For client-side actions, arguments go embedded with the instantiated action object
        // Also, we don't actually need to store and create a nonce for them
        ret.push({
          label: action.label,
          actionId: actionIds[ix],
          type: action.type,
          context: action.context,
          args: action.elementValues // instead of nonce, send away args
        });
      } else {
        // Server action
        // eslint-disable-next-line no-await-in-loop
        await ActionTokens.insertAsync(action);
        // fields type, label, target, context, args are already in `action`
        ret.push({
          label: action.label,
          actionId: actionIds[ix],
          type: action.type,
          lock: action.lock, // if action requires Lock, needed in UI to tell if it is disabled
          confirmation: action.confirmation, // some as `lock` above
          elementList: action.elementList,
          elementValues: action.elementValues,
          nonce
        });
      }
      ix += 1;
    }
    return { actions: ret, errors: prepared.errors };
  };

  /**
   * Runs an action stored in ActionTokens. It receives the `actionId` and the
   * unique and disposable `nonce` identifying this set of action instances.
   * The actions get deleted immediately and cannot be re-run.
   *
   * @param {string} actionId the action to run
   * @param {nonce} nonce A unique, disposable identifier for the stored action to run
   * @param {user} Optional, for logging purposes: A object with { _id, profile } or
   *      a { userId } object.
   */
  runStoredAction = async (actionId, nonce, user) => {
    try {
      const action = await ActionTokens.findOneAsync({ actionId, nonce });
      // validate the action. If it is too old, it is not executed (batch GC should delete it soon)
      if (!action || !action.createdTs
        || (action.createdTs + ACTION_TOKEN_EXPIRATION_MS < Date.now())) {
        const errorMsg = 'Action not found or expired';
        return {
          // It _is_ expired; but we reuse the same error message below
          error: errorMsg
        };
      }
      // ready to execute.
      const ret = await this._executeAction(action, user);
      // NOTE(herchu) We decided not to delete action tokens for now, then can be executed
      // multiple times.
      return ret;
    } catch (err) {
      console.warn('Error executing action', err);
      const errorMsg = 'Action not found or expired';
      return {
        error: errorMsg
      };
    }
  };

  /**
   * Loads, validates and complete arguments on a list of actions given
   * by their ids. It returns an array with the same number of elements as
   * actionIds, with each action ready to be sent for example to dispatchAction.
   * (Or saved to disk after completing additional persistence fields).
   *
   * args: action arguments provided at execution time
   */
  prepareActions = async ({ actionIds, context, args }) => {
    if (!Array.isArray(actionIds)) {
      throw new Error('actionIds must be an array');
    }
    const actionsCfg = await this.getActionDefinitions(actionIds);
    let attributeValues = null;
    const actions = [];
    let errors = {};
    if (context.robotId) {
      // If executing on a robot, fetch any necessary attribute from vitals, and add
      // to the argument values available to prepare the actions
      attributeValues = await this._loadAttributes(actionsCfg, context.robotId);
    }

    for (const actionId of actionIds) {
      const action = actionsCfg[actionId];
      if (!action) {
        // if any action is missing, report an error and move on
        console.error('prepareActions: Action definition not found:', actionId);
        errors[actionId] = 'Action not found';
        // eslint-disable-next-line no-continue
        continue;
      }
      // Fill in all template vars and args -- and validate them
      // TODO(herchu) Do this all at once, so robot attributes (when implemented)
      // are retrieved once from DB
      const actionErrors = this._resolveAndValidateContext(
        action,
        context,
        args,
        attributeValues
      );
      if (!actionErrors) {
        // Do action-specific processing of the action (see _postProcess())
        this._postProcess(action);
        // So the field is set for EventLog().sendEvent
        action.actionId = actionId;
        // And collect it to be returned
        actions.push(action);
      } else {
        Object.assign(errors, actionErrors);
      }
    }
    if (isEmpty(errors)) {
      errors = null;
    }
    // All actions are validated and their arguments filled
    return { actions, errors };
  };

  /**
   * Loads all attributes declared as arguments of any of the actions in the map
   * actionsCfg.
   * It will first collect the list of all distinct attributes needed, and then load
   * all their vital values at once from db.
   *
   * Returns a simple map from attributeId to its current value.
   */
  // eslint-disable-next-line class-methods-use-this
  _loadAttributes = async (actionsCfg, robotId) => {
    const attributeIds = {};
    // First collect the IDs of all robots
    for (const actionId of Object.keys(actionsCfg)) {
      const action = actionsCfg[actionId];
      if (action && action.context && 'robotId' in action.context) { // this type of action is executed on a robot
        // Check which attribute values (if any) are needed for this action
        if (action.elementValues) {
          for (const id of Object.keys(action.elementValues)) {
            if (action.elementValues[id] && action.elementValues[id].attributeId) {
              // An attribute that needs to be evaluated
              attributeIds[action.elementValues[id].attributeId] = true;
            }
          }
        }
      }
    }

    // load robot vitals for the collected attribute ids
    const attributeValues = await new AttributesManager().getRobotAttributeValues(robotId, Object.keys(attributeIds));
    // discard attributeId and ts from the loaded values, keep values only
    const selectedAttributeValues = {};
    for (const attributeId of Object.keys(attributeValues)) {
      selectedAttributeValues[attributeId] = attributeValues[attributeId].value;
    }
    return selectedAttributeValues;
  };

  /**
   * Do some action-specific processing of an already prepared action.
   * For example, URL actions (internal and external) allow doing parameter replacement,
   * if the url contains "...{{param}}..." and "param" is an argument provided, it gets
   * replaced in the path and stored in the action ready to be executed.
   */
  _postProcess = (action) => {
    const replaceTemplateByArgs = (argName) => {
      if (action.elementValues && action.elementValues[argName]) {
        action.elementValues[argName] = this.replaceTemplate(
          action.elementValues[argName],
          { ...action.elementValues, ...action.context }
        );
      }
    };
    switch (action.type) {
      case ACTION_TYPES.GO_INORBIT:
        // A page within InOrbit. Normally containing {{robotId}} used from context
        replaceTemplateByArgs(ARGNAME_GO_PATH);
        break;
      case ACTION_TYPES.GO_URL:
        // An external URL - do string replacement in the path
        replaceTemplateByArgs(ARGNAME_GO_URL);
        break;
      case ACTION_TYPES.PUBLISH_TO_TOPIC:
        // Message to be published also supports replacing arguments
        replaceTemplateByArgs(ARGNAME_PUBLISH_MESSAGE);
        break;
      case ACTION_TYPES.RUN_SCRIPT:
        // The script name itself also supports replacing args
        replaceTemplateByArgs(ARGNAME_SCRIPT_FILENAME);
        break;
      default:
      // Ignore and make eslint happy
    }
  };

  /**
   * Helper function to do string replacement with {{param}} format. It replaces all
   * args in `templateStr` using `data` object as values.
   *
   * Example: replaceTemplate("Hello, {{x}}!", { x: "World"} )
   * returns, obviously: "Hello, World!"
   *
   * If the template is malformed, args not resolved, etc., it just returns the original
   * template string -- ie. it never fails.
   */
  // eslint-disable-next-line class-methods-use-this
  replaceTemplate = (templateStr, data) => {
    try {
      return handlebars.compile(templateStr)(data);
    } catch (e) {
      // If anything fails, just leave the original template unchanged
      return templateStr;
    }
  };

  /**
   * Resolves the context for an action, including `robotId`, and arguments (for that,
   * see _resolveAndValidateArgs).
   *
   * It returns an object whose keys are the missing arguments, if there are errors, or
   * null on _success_.
   */
  _resolveAndValidateContext = (action, context, runtimeArgs, attributes) => {
    // Fill in all arguments
    const errors = this._resolveAndValidateArgs(action, runtimeArgs, attributes) || {};
    // Provide other vars from context - mainly robotId
    if (!action.context) {
      action.context = {};
    }
    for (const k in context) {
      if (k in action.context) {
        action.context[k] = context[k];
      }
    }
    this._validateContext(action, context);
    return isEmpty(errors) ? null : errors;
  };

  /**
   * Validates that no value is missing in an action context. Collects
   * errors as keys in the `errors` object (which must not be null).
   */
  // eslint-disable-next-line class-methods-use-this
  _validateContext = (action, errors) => {
    // Validate if any variable is still missing
    for (const k in action.context) {
      if (!action.context[k]) {
        errors[k] = true;
      }
    }
  };



  /**
   * Resolves the argument declared in `action` (they can be constants, placeholders
   * `{type: _, ...}` or simply empty placeholders `null`) with the elements from `args`.
   *
   * If successful, at the end of this call the `action` object is modified to contain
   * its arguments' values in `elementValues` as a mapping `{ argName: arvgalue }`; and it
   * returns null.
   *
   * If there are errors, it returns a non-null object whose keys are the argunment ids
   * that could not be validated.

   * @param {Object} action:  an Action definition object.
   * @param {Object} userArgValues: An object with `{ argName: argValue }` user-provided arguments
   * @param {Object} attributesValues: A mapping `{ attributeId: attrValue }` of current attribute
   *    values in this context (generally: this robot). It normally contains only the attributes
   *    required to run this action: those marked with an `attributeId` in the `elementValues`
   *    element. Not all others are resolved.
   * @return {Object} An object whose keys are the arguments with errors or _null on success_.
   */
  _resolveAndValidateArgs = (action, userArgValues, attributeValues) => {
    // NOTE(herchu) A bad implementation was saving elementList={} and causing keyValueListToSave
    // below. In this branch this is already fixed in keyValueListToObject; feel free to remove
    // this comment after release branches during December 2020 are finally merged
    // See IO-3404. Just calling this function should be OK (without pre-processing elementList)
    const argSpecs = keyValueListToObject(action);
    const argIds = Object.keys(argSpecs);
    // Object to collect missing arguments, args with bad values or even unexpected arguments
    const errors = {};
    const argValues = {};
    // Get all actual argument values: First all defaults from the action, then user provided args
    for (const argName of Object.keys(argSpecs)) {
      if (!isObject(argSpecs[argName])) { // Make sure there are no nulls/undef in the definitions
        // list (it can happen if the argument is in elementList but not in elementValues)
        argSpecs[argName] = { value: argSpecs[argName] };
      }
      if (ARG_FIELDS.VALUE in argSpecs[argName]) {
        argValues[argName] = argSpecs[argName][ARG_FIELDS.VALUE];
      }
    }
    // Now actual arguments, user-provided: Copy all user arguments except those not expected
    // in the action. This is based on `elementList`, plus the hack for `allowUnsafeClientArgs`
    // (until that gets removed)
    if (userArgValues) {
      for (const [argName, argValue] of Object.entries(userArgValues)) {
        if (argIds.includes(argName)) {
          argValues[argName] = argValue;
        } else {
          errors[argName] = `unexpected argument ${argName}`;
        }
      }
    }
    // Validate all argument values now. This will detect missing arguments, or find arguments
    // not passing validations (min/max, etc.).
    this._validateArgs(argSpecs, argValues, errors);
    // Finally assign any value from data sources (attributeId). These are not validated.
    // Note that argument values are used as default value; so if a value for an argument is
    // provided by user (userArgValues), and input for this argument was accepted (checked above)
    // that one takes precedence
    for (const [argName, argSpec] of Object.entries(argSpecs)) {
      if ((ARG_FIELDS.ATTRIBUTE in argSpec)
        && !(argSpec[ARG_FIELDS.INPUT] && userArgValues && (argName in userArgValues))) {
        // Note: The data source value may be missing; this will insert `undefined` in the values.
        // This is a decision so we can distinguish this situation in agent scripts (or any usage)
        argValues[argName] = attributeValues[argSpec[ARG_FIELDS.ATTRIBUTE]];
      }
    }
    if (isEmpty(errors)) {
      // All args ok. Replace values in the action defintiion
      // NOTE(herchu) This is ugly; instead we should just return argSpecs; but I am keeping
      // this functionality to minimize changes to the module
      action.elementValues = argValues;
      return null;
    } else {
      return errors;
    }
  };

  /**
   * Validates that all argument values in argSpecs are correct: no missing
   * values; provided values are within ranges; etc.
   *
   * It collects errors in the keys of `errors` object for each argument
   * not passing validations.
   */
  _validateArgs = (argSpecs, argValues, errors) => {
    // Validate if any argument is still missing
    const schema = {
      $$strict: true // Do not allow any unexpected arg value, not appearing in argSpecs
    };
    for (const [argName, argSpec] of Object.entries(argSpecs)) {
      const argSchema = actionArgSpecToSchema(argSpec);
      if (argSchema) {
        schema[argName] = argSchema;
      }
    }
    try {
      const check = new FastestValidator().compile(schema);
      const validation = check(argValues);
      // If there are errors, `validation` is an array
      Array.isArray(validation) && validation.forEach(
        ({ field, message }) => { errors[field] = message; }
      );
    } catch (err) {
      // This should never happen; unless we fail to parse the argument definition or convert it
      // to a proper schema. In any case, catch and and log the error
      console.error('Error validating action arguments schema', err);
      errors.__schema__ = true;
    }
  };

  /**
   * Validate context and args in an action.
   * Returns an object with an `errors` field (an object itself) if there are validation errors.
   */
  _validate = (action) => {
    const errors = {};
    this._validateContext(action, errors);
    return isEmpty(errors) ? null : errors;
  };

  /**
   * Collect all argument values in an action (already prepared, args resolved)
   * into an array. Each argument appends an element (e.g. "-h") or two elements
   * (e.g. ["-v", "3"]) depending on whether the arg has a value or not.
   *
   * The special action argument "fileName" is skipped.
   */
  // eslint-disable-next-line class-methods-use-this
  _collectRunScriptArgs = (action) => {
    const args = [];
    const fileName = action.elementValues && action.elementValues[ARGNAME_SCRIPT_FILENAME];
    action.elementList && action.elementList.forEach((arg) => {
      if (arg == ARGNAME_SCRIPT_FILENAME) {
        return; // skip this one
      }
      // add the arg name
      if (!isDummyArgName(arg)) {
        args.push(arg);
      }
      // add the value if given
      const argVal = action.elementValues && action.elementValues[arg];
      if (isObject(argVal)) {
        if ('value' in argVal && argVal.value !== null && argVal.value !== undefined) {
          args.push(argVal.value);
        }
      } else if (argVal !== null && argVal !== undefined) {
        args.push('' + argVal); // cast to string
      }
    });
    return { fileName, args };
  };

  /**
   * Executes an action, which needs to be ready for execution (all args
   * and context filled in).
   * This normally results in some mqtt message sent to an agent.
   *
   * @param {action} an Action object to run, already prepared, with arguments values already set.
   * @param {user} Optional, for logging purposes: An object with with { _id, profile } or
   *      a { userId } object.
   */
  _executeAction = async (action, user) => {
    const isOnline = async (robotId) => {
      try {
        return new Robot(robotId).isOnlineAsync();
      } catch (e) {
        // robot not found
        return false;
      }
    };

    const validation = this._validate(action);
    const offlineError = { error: 'Robot is offline' };
    if (validation && validation.errors) {
      console.error('Validation errors while executing action', action, validation.errors);
      return false;
    }
    // If the action was triggered from a proxy robot, find the Id of the proxied robot
    const robotId = action.context?.robotId;
    // If any of the action types needs to log specific arguments, then
    // collect them in eventLogArguments. Note that not every key is accepted by
    // the event log (see TAGS_AND_FIELDS_WHITELIST in events.js). For example,
    // script action sets { fieldName, args, executionId } which are accepted fields
    // in the event log 'schema'.
    let eventLogArguments;
    // Execution id is also returned in by this method, for callers to track action execution
    // NOTE(b-Tomas): Only RunScript actions use `executionId`
    let executionId;
    const executionTs = Date.now();

    // Helper function to log action failures
    const logFailureAndReturn = async (failureResult) => {
      await this._logActionFailure(action, user, failureResult.error || failureResult.errors);
      return failureResult;
    };

    switch (action.type) {
      case ACTION_TYPES.RESTART_AGENT: {
        console.log('Action exec: Restart agent', robotId);
        if (!await isOnline(robotId)) {
          return logFailureAndReturn(offlineError);
        }
        await this._getMqttModule().triggerAgentRestart({ robotId });
        break;
      }
      case ACTION_TYPES.UPDATE_AGENT: {
        console.log('Action exec: Update agent', robotId);
        if (!await isOnline(robotId)) {
          return logFailureAndReturn(offlineError);
        }
        await this._getMqttModule().triggerAgentUpdate({ robotId });
        break;
      }
      case ACTION_TYPES.NAVIGATE_PATH: {
        // JIC this case belongs to the path navigation action
        // used by precision teleop (ff stepwise-navigation)
        // and also Multi Waypoint Navigation (experimental at the moment).
        // TODO: eventually remove the "stepwise" term from the code
        console.log('Action exec: Path Navigation', robotId);
        if (!await isOnline(robotId)) {
          return logFailureAndReturn(offlineError);
        }
        const nav2dModule = this._getNav2DModule();
        if (!nav2dModule) {
          console.warn('NavigatePath: Navigation2DModule instance not found.');
          return logFailureAndReturn(buildErrorResult('Server error running navigation command'));
        }
        // Get arguments from the action
        const { frame, tsHint, waypoints } = action.elementValues;
        await nav2dModule.sendGoalPath({
          robotId,
          tsHint,
          frame,
          waypoints
        });
        eventLogArguments = waypoints;
        break;
      }
      case ACTION_TYPES.CAMERA_TOGGLE: {
        console.log('Action exec: Camera toggles', robotId, action.elementValues);
        if (!await isOnline(robotId)) {
          return logFailureAndReturn(offlineError);
        }
        const imagesModule = this._getImagesModule();
        if (!imagesModule) {
          console.warn('ImagesModule instance not found.');
          return logFailureAndReturn(buildErrorResult('Server error running cameras command'));
        }
        // Determine the type of toggle is requested in this action: the CAMERA_TOGGLE action is a
        // catch-all on camera operations, allowing to focus (high-res) and toggle cameras on/off.
        const args = action.elementValues || {}; // load to `args` so camera number gets logged
        if (ARGNAME_CAMERA_ENABLED in args && ARGNAME_CAMERA_FOCUS in args) {
          console.warn('Bad camera toggle action arguments - multiple actions specified', args);
          return logFailureAndReturn({ error: 'Bad camera toggle action arguments' });
        } else if (ARGNAME_CAMERA_FOCUS in args) {
          if (args[ARGNAME_CAMERA_FOCUS]) { // focus=true starts high-res override
            const cameraId = args[ARGNAME_CAMERA_ID];
            await imagesModule.startHighResOverride({
              robotId,
              cameraNumber: cameraId
            });
            eventLogArguments = {
              cameraAction: 'focus',
              cameraLabel: await new UIPreferencesManager().getCameraLabel({ robotId, cameraId })
            };
          } else { // focus=false resets high-res override
            await imagesModule.configOverrideReset({ robotId });
            eventLogArguments = {
              cameraAction: 'focus reset',
              cameraLabel: ''
            }; // in the logs, this will mean 'reset'
          }
        } else if (ARGNAME_CAMERA_ENABLED in args) {
          const cameraId = args[ARGNAME_CAMERA_ID];
          const enabled = Boolean(args[ARGNAME_CAMERA_ENABLED]);
          await imagesModule.setCameraIsOn({
            robotId,
            cameraId,
            isOn: enabled
          });
          eventLogArguments = {
            cameraAction: enabled ? 'enabled' : 'disabled',
            cameraLabel: await new UIPreferencesManager().getCameraLabel({ robotId, cameraId })
          };
        } else {
          // NOTE(herchu) Consider supporting multiple toggles in the same action. For now,
          // this is not allowed; so we do the sanity check of not receiving multiple toggle fields
          console.warn('Bad camera toggle action arguments - no action taken', args);
          return logFailureAndReturn({ error: 'Bad camera toggle action arguments' });
        }
        break;
      }
      case ACTION_TYPES.RELOCALIZE: {
        console.log('Action exec: Relocalize', robotId);
        // NOTE: Make sure you are passing a delta "pose" inside elementValues
        //                    since 'set_pose' expects a delta pose inside the payload
        // Get arguments from the action
        const { deltaPose } = action.elementValues;
        const robotDeltaPose = await this._resolveDeltaPose(robotId, deltaPose);
        const nav2dModule = this._getNav2DModule();
        if (!nav2dModule) {
          console.warn('Relocalize: Navigation2DModule instance not found.');
          return logFailureAndReturn(buildErrorResult('Server error running navigation command'));
        }

        try {
          // The result is sent to robot event logs (the current pose)
          await nav2dModule.rosLocalizationPublish({
            command: 'set_pose',
            robotId,
            deltaPose: robotDeltaPose
          });
        } catch (e) {
          // We do not use custom exception classes, so interpret any exception with the "Timeout"
          // word as a timeout
          if (e.message.includes('Timeout')) {
            return logFailureAndReturn(buildErrorResult('Timeout waiting for robot response'));
          } else {
            // Unknown error. Do not surface to the client (it can contain code details) but
            // log it here
            console.error('Error running sendNavGoal', e);
            return logFailureAndReturn(buildErrorResult('Server error running navigation command'));
          }
        }
        // we are sending delta pose for the robot event logs
        eventLogArguments = deltaPose;
        break;
      }
      case ACTION_TYPES.NAVIGATE_TO: {
        console.log('Action exec: Waypoint navigation', robotId);
        if (!await isOnline(robotId)) {
          return logFailureAndReturn(offlineError);
        }
        // Resolve pose from the provided action arguments
        const { ok, pose, error } = await this._resolveNavigateToPose(action);
        if (!ok) {
          return logFailureAndReturn(buildErrorResult(error));
        }

        const nav2dModule = this._getNav2DModule();
        if (!nav2dModule) {
          console.warn('NavigateTo: Navigation2DModule instance not found.');
          return logFailureAndReturn(buildErrorResult('Server error running navigation command'));
        }

        try {
          // The result is sent to robot event logs (the current pose)
          eventLogArguments = await nav2dModule.sendNavGoal({
            robotId,
            executionTs,
            pose
          });
        } catch (e) {
          // We do not use custom exception classes, so interpret any exception with the "Timeout"
          // word as a timeout
          if (e.message.includes('Timeout')) {
            return logFailureAndReturn(buildErrorResult('Timeout waiting for robot response'));
          } else {
            // Unknown error. Do not surface to the client (it can contain code details) but
            // log it here
            console.error('Error running sendNavGoal', e);
            return logFailureAndReturn(buildErrorResult('Server error running navigation command'));
          }
        }
        break;
      }
      case ACTION_TYPES.PUBLISH_TO_TOPIC: {
        console.log(
          'Action exec: Publish to topic',
          robotId,
          action.elementValues && action.elementValues[ARGNAME_PUBLISH_MESSAGE]
        );
        if (!await isOnline(robotId)) {
          return logFailureAndReturn(offlineError);
        }
        const message = action.elementValues[ARGNAME_PUBLISH_MESSAGE];
        await this._getMqttModule().sendCustomCommand({
          robotId,
          cmd: message
        });
        eventLogArguments = { message };
        break;
      }
      case ACTION_TYPES.RUN_SCRIPT: {
        // Can't execute an action on an offline robot - and no scheduling for later support yet
        if (!await isOnline(robotId)) {
          return logFailureAndReturn(offlineError);
        }
        const { fileName, args } = this._collectRunScriptArgs(action);
        executionId = await this._getMqttModule().sendCustomScript({
          robotId,
          fileName,
          scriptParams: {
            run: true,
            argOptions: args
          }
        });
        eventLogArguments = { fileName, args, executionId };
        console.log('Action exec: Run script', action, fileName, args, executionId);
        break;
      }
      case ACTION_TYPES.CANCEL_NAV_GOAL: {
        console.log('Action exec: Cancel Navigation Goal', robotId);
        if (!await isOnline(robotId)) {
          return logFailureAndReturn(offlineError);
        }
        const nav2dModule = this._getNav2DModule();
        if (!nav2dModule) {
          console.warn('CancelNavGoal: Navigation2DModule instance not found.');
          return logFailureAndReturn(buildErrorResult('Server error running cancel navigation goal command'));
        }
        await nav2dModule.cancelNavGoal({
          robotId
        });
        break;
      }
      case ACTION_TYPES.MAP_SWITCH: {
        // Action to switch map (topic), equivalent to the UI's map switcher.
        // TODO(herchu): Move mqtt/states logic to a map module wrapper
        if (!await isOnline(robotId)) { // Can't send a direct mqtt command to offline robot
          return logFailureAndReturn(offlineError);
        }
        const label = action.elementValues && action.elementValues[ARGNAME_MAP_LABEL];
        console.log('Action exec: Map switch', robotId, label);
        await this._getMqttModule().setModuleState({
          robotId,
          moduleName: 'RosLocalizationAgentlet',
          newState: { map_topic: label }
        });
        // AGENT_VER_3.17.0
        // From agent version 3.17.0 onwards the MapAgentlet handles the map topic. We keep
        // updating both for backwards compatibility
        await this._getMqttModule().setModuleState({
          robotId,
          moduleName: 'RosMapAgentlet',
          newState: { map_topic: label }
        });
        break;
      }
      case ACTION_TYPES.DISPATCH_MISSION: {
        const missionDefinitionId = action.elementValues[ARGNAME_MISSION_DEFINITION_ID];
        const missionsModule = this._getMissionsModule();
        if (!missionsModule) {
          console.warn('MissionsModule instance not found.');
          return logFailureAndReturn(buildErrorResult('Server error running dispatch mission command'));
        }
        try {
          const result = await missionsModule.dispatchMissionDefinitionAsUser({
            userId: user?._id,
            selector: { robot: { robotId } },
            missionDefinitionId
          });
          if (!result?.ok) {
            return logFailureAndReturn(buildErrorResult(result?.error || 'Unknown error dispatching mission'));
          }
        } catch (e) {
          console.error('Error dispatching mission', e);
          return logFailureAndReturn(buildErrorResult('Server error running dispatch mission command'));
        }
        break;
      }
      default:
        console.error('Error executing action, unknown type', action.type);
        return logFailureAndReturn({ error: 'Unknown action type' });
    }

    // The listener on CustomCommandsModule will find this document upon receving a feedback
    // message, and the value in the `reportResultToId` field will indicate the robot that
    // triggered the action, and thus where the action feedback should be reported.
    // Otherwise all feedback will be reported to the robotId indicated in the incoming message
    // from the agentlet.
    // This document has a TTL defined in the collection settings, and will eventually get deleted.
    if (executionId) {
      await RobotCustomScript.insertAsync({
        fileName: executionId,
        robotId,
        executionId,
        executionStatus: 'Executed on robot'
      });
    }

    // Log event. Use the Id of the robot that called the action
    await new EventLog().logExecutedAction(new Robot(robotId), action, user, eventLogArguments);

    // If it gets to this point, the action was run. Return a success object:
    return {
      ok: true,
      ts: executionTs || Date.now(),
      executionId,
      robotId,
      label: action.label
    };
  };

  /**
   * Garbage-collects action tokens, deleting all tokens considered old and not to
   * be executed.
   */
  // eslint-disable-next-line class-methods-use-this
  _cleanupOldTokens = async () => {
    const oneDayOld = Date.now() - ACTION_TOKEN_EXPIRATION_MS;
    await ActionTokens.removeAsync({ createdTs: { $lt: oneDayOld } });
  };

  /**
   * Runs batch processes from this module, including (and nothing more, for now)
   * garbage-collecting old action tokens.
   */
  _runBatchProcesses = () => {
    // For now, just removing old tokens
    this._cleanupOldTokens();
  };

  /**
   * Meteor call to get custom script actions feedback
   * @see getActionFeedback()
   * @param {string} executionId
   * @param {string} robotId
   */
  async _meteorGetFeedback({ executionId, robotId }) {
    if (!isString(executionId)) {
      throw new Meteor.Error('executionId must be a non-empty string.');
    } else if (!isString(robotId)) {
      throw new Meteor.Error('robotId must be a non-empty string.');
    } else if (!await new OroRoles().canAccessRobot(
      this.userId,
      robotId,
      ACCESS_LEVEL_VIEW
    )) {
      throw new Meteor.Error('User not authorized to read action results on '
        + 'robot ' + robotId);
    }
    return new ActionsEngine().getActionFeedback(executionId, robotId);
  }

  /**
   * Meteor call to execute a persisted action.
   * If a nonce (that uniquely identifies an instantiated action) is given, no permissions
   * are checked.
   * Otherwise a robotId and actionId are expected, and permissions are checked normally.
   *
   * @see runStoredAction() and runAction()
   */

  async _meteorExecuteAction({ actionId, nonce, robotId, args }) {
    if (nonce) {
      // NOTE(herchu) Not checking permissions - given the nonce, it is almost considered
      // an anonymous call (same as in the Slack or api webhook)
      return new ActionsEngine().runStoredAction(
        actionId,
        nonce,
        this.userId,
        (await Meteor.userAsync()).profile
      );
    } else {
      if (!this.userId) {
        throw new Meteor.Error('Unauthorized');
      }
      // If no nonce is given, check if user is logged in and has access to the robot
      const result = await new LockManager().runRobotAction({
        actionId,
        robotId,
        user: await Meteor.userAsync(),
        args
      });
      if (result && result.error) {
        throw new Meteor.Error(result.error);
      }
      return result;
    }
  }

  /**
   * Compiles an action to an object that includes all data required for its execution
   * without requiring further communication with the Platform
   *
   * @see https://docs.google.com/document/d/1QqZkqa1LEl8xFFDZ3ygq_uZsB0fNwrDURylSjxmDWG0/edit#heading=h.8w721uwl4hx0
   * @param {string} robotId
   * @param {string} actionId
   * @param {object} args
   * @returns {object} with the `ok`, `error` and `compiled` properties.
   */
  compileAction = async ({ robotId, actionId, args }) => {
    const prepared = await this.prepareActions({
      robotId,
      actionIds: [actionId],
      context: { robotId },
      args
    });
    if (prepared.errors) { // There are errors, stop
      const prepareError = get(prepared.errors || {}, actionId, prepared.errors);
      const error = 'Error during action compilation while preparing action. '
        + `robotId = ${robotId} errors = ${JSON.stringify(prepareError)}`;
      return {
        ok: false,
        error
      };
    }
    const preparedAction = prepared.actions[0];
    return this._compilePreparedAction(preparedAction);
  };

  /**
   * Compiles a prepared action to an object that includes all data required for its
   * execution without requiring further communication with the Platform
   *
   * @see https://docs.google.com/document/d/1QqZkqa1LEl8xFFDZ3ygq_uZsB0fNwrDURylSjxmDWG0/edit#heading=h.8w721uwl4hx0
   * @param {object} action prepared action
   * @returns {object} with the `ok`, `error` and `compiled` properties.
   */
  _compilePreparedAction = async (action) => {
    // NOTE(mike) This code has some similarity to the one in _executeAction
    // we should try to refactor it to avoid repetition.
    // An option is to split _executeAction into two stages: compilations and
    // sending the message to the robot.
    switch (action.type) {
      case ACTION_TYPES.PUBLISH_TO_TOPIC: {
        const message = action.elementValues[ARGNAME_PUBLISH_MESSAGE];
        return {
          ok: true,
          compiled: {
            type: ACTION_TYPES.PUBLISH_TO_TOPIC,
            message
          }
        };
      }
      case ACTION_TYPES.RUN_SCRIPT: {
        const { fileName, args } = this._collectRunScriptArgs(action);
        return {
          ok: true,
          compiled: {
            type: ACTION_TYPES.RUN_SCRIPT,
            fileName,
            args
          }
        };
      }
      case ACTION_TYPES.NAVIGATE_TO: {
        // Resolve pose from the provided action arguments
        const { ok, pose: waypoint, error } = await this._resolveNavigateToPose(action);
        if (!ok) {
          return { ok: false, error };
        }

        return {
          ok: true,
          compiled: {
            type: ACTION_TYPES.NAVIGATE_TO,
            waypoint
          }
        };
      }
      case ACTION_TYPES.DISPATCH_MISSION: {
        const missionDefinitionId = action.elementValues[ARGNAME_MISSION_DEFINITION_ID];
        return {
          ok: true,
          compiled: {
            type: ACTION_TYPES.DISPATCH_MISSION,
            missionDefinitionId
          }
        };
      }
      default:
        return {
          ok: false,
          error: `Unsupported action type ${action.type}`
        };
    }
  };

  /**
   * Resolves the effective pose value to use in a NAVIGATE_TO action from the
   * specified arguments. This includes resolving named waypoints and applying
   * transformations.
   *
   * @param {object} action
   * @returns {object}
   */
  // eslint-disable-next-line class-methods-use-this
  _resolveNavigateToPose = async (action) => {
    const { robotId } = action.context;
    let { pose } = action.elementValues;
    const { namedWaypointId } = action.elementValues;

    if ((pose && namedWaypointId) || (!pose && !namedWaypointId)) {
      return {
        ok: false,
        error: 'One and only one of "pose" and "namedWaypointId" must be provided'
      };
    }

    if (namedWaypointId && !isString(namedWaypointId)) {
      return {
        ok: false,
        error: 'namedWaypointId should be a string'
      };
    }
    if (namedWaypointId) {
      // try to resolve from annotation
      const annotation = await new AnnotationsManager().findAnnotation({
        annotationId: namedWaypointId
      });
      if (!annotation
        || annotation?.annotation?.type !== SPATIAL_ANNOTATION_TYPES.WAYPOINT) {
        return {
          ok: false,
          error: `Couldn't find named waypoint with id "${namedWaypointId}"`
        };
      }
      pose = {
        frameId: annotation?.entity?.frameId,
        x: annotation?.annotation?.x,
        y: annotation?.annotation?.y,
        theta: annotation?.annotation?.theta,
      };
    }

    if (pose.frameId === undefined) {
      // complete the frameId property of the pose if not provided
      const robotLocalization = await RobotLocalization.findOneAsync({ _id: robotId }) || {};
      const { frameId } = robotLocalization.robotPose || {};
      pose.frameId = frameId;
    }

    // const tPose = await new SpatialTransformationsManager().transformPoseToRobotFrame(
    //   robotId,
    //   pose
    // );
    console.warn('_resolveNavigateToPose: Pose transformation not implemented yet');
    const tPose = { ...pose };
    return { ok: true, pose: tPose };
  };

  /**
   * Transforms a delta pose in the sublocation frame to a delta pose in the robot's world frame
   *
   * @param {string} robotId
   * @param {object} deltaPose delta pose with x, y and theta
   * @returns {object} delta pose in the robot frame
   */
  // eslint-disable-next-line class-methods-use-this
  _resolveDeltaPose = async (robotId, deltaPose) => {
    let { frameId } = deltaPose;
    const { x, y, theta } = deltaPose;

    if (frameId === undefined) {
      // complete the frameId property of the pose if not provided
      const robotLocalization = await RobotLocalization.findOneAsync({ _id: robotId }) || {};
      frameId = robotLocalization.robotPose?.frameId;
    }

    console.warn('_resolveDeltaPose: Pose transformation not implemented yet');
    const transformedDeltaPoint = { ...deltaPose }; // HACK
    const origin = { x: 0, y: 0, theta: 0 }; // HACK
    // const transformedDeltaPoint = await new SpatialTransformationsManager().transformPoseToRobotFrame(
    //   robotId,
    //   { x, y, theta, frameId }
    // );
    // const origin = await new SpatialTransformationsManager().transformPoseToRobotFrame(
    //   robotId,
    //   { x: 0, y: 0, theta: 0, frameId }
    // );
    // The delta in the robot world frame is calculated by the subtraction of deltaPose and the
    // origin, both in the robot world frame
    const robotDeltaPose = {
      x: transformedDeltaPoint.x - origin.x,
      y: transformedDeltaPoint.y - origin.y,
      theta: transformedDeltaPoint.theta - origin.theta
    };
    return robotDeltaPose;
  };

  /**
   * Helper method to log action failures comprehensively to event log
   * This ensures ALL action failures are logged regardless of failure reason
   *
   * @param {Object} action - The action that failed
   * @param {Object} user - The user who triggered the action
   * @param {string} failureReason - The reason for failure
   */
  // eslint-disable-next-line class-methods-use-this
  _logActionFailure = async (action, user, failureReason) => {
    if (failureReason && !isString(failureReason)) {
      throw new Error('failureReason must be a string');
    }
    try {
      const robotId = action.context?.robotId;
      if (!robotId) {
        // No robot context, can't log the failure
        return;
      }

      const robot = new Robot(robotId);
      const robotName = await robot.getNameAsync();
      await new EventLog().sendEvent(buildEvent(EVENT_MODULES.ACTION, EVENT_TYPES.ACTION_FAILED, {
        ...getUserLoggingAttributes(user),
        ts: Date.now(),
        robotId,
        robotName,
        // ACTION_FAILED specific fields
        actionId: action.actionId || 'unknown',
        actionType: action.type || 'unknown',
        type: action.type || 'unknown',
        label: action.label || action.actionId || 'unknown',
        failureReason: failureReason || 'Unknown failure'
      }));
    } catch (error) {
      console.error('Failed to log action failure:', error);
    }
  };
}

/**
 * Publishes actions (templates) configuration.
 */
Meteor.publish('actions.config', async function () {
  if (!await new OroRoles().hasRole(this.userId)) {
    throw new Meteor.Error('`User not authorized to get actions');
  }
  return ActionDefinitions.find({});
});

/**
 * Provide feedback from script execution to clients.
 *
 * Parameters:
 * - robotId
 * - executionId: identifies the particular action execution to track feedback for
 * - executionTs: narrows down to executions started after this timestamp - UNIX epoch (number)
 */
Meteor.publish('actions.feedback', async function ({ robotId, executionId, executionTs }) {
  if (!await new OroRoles().canAccessRobot(this.userId, robotId)) {
    throw new Meteor.Error(`User not authorized to read action results on robot ${robotId}`);
  }

  if (!executionTs) {
    executionTs = Date.now();
  }

  // TODO: Rename fileName to executionId
  return RobotCustomScript.find(
    // NOTE(adamantivm) serverTime is a Date field, but executionTs is a number (epoch)
    { robotId, fileName: executionId, serverTime: { $gte: new Date(executionTs) } },
    {
      fields: {
        robotId: 1,
        fileName: 1,
        serverTime: 1,
        executionStatus: 1,
        executionStatusDetails: 1,
        returnCode: 1,
        stderr: 1,
        stdout: 1
      },
      // Without oplog, sending feedback after 10s makes no sense. There is a 5s timeout
      // in the client, so try to send feedback ASAP (1500ms gives time for 3 retries
      // without client timeout window)
      pollingIntervalMs: 1500
    }
  );
});

/**
 * Webhook to execute actions from an external system. This is simply a GET url handler,
 * and validation is done via a nonce that uniquely identifies the instantiated action and
 * has an expiration.
 * (Initially we are reusing nonces which goes against "nonce" definition, and allow executing
 * the same action multiple times; this could change in the future).
 *
 * Request arguments are "n" for the nonce and "a" for actionId.
 */
// eslint-disable-next-line no-unused-vars
WebApp.connectHandlers.use('/webhook/action', Meteor.bindEnvironment(async (req, res, next) => {
  // Fetch query parameters
  const nonce = req.query && req.query.n;
  const actionId = req.query && req.query.a;
  console.info('Remote action request', nonce, actionId);
  if (!nonce || !actionId) {
    req.writeHead(400);
    res.end('Bad request');
  }
  const ret = await new ActionsEngine().runStoredAction(actionId, nonce, EXTERNAL_USER_ID);
  if (ret) {
    res.writeHead(200);
    const responseStr = isObject(ret)
      ? JSON.stringify(ret)
      : ret;
    res.end(responseStr);
  } else {
    res.writeHead(404);
    res.end('Action not found');
  }
}));

export default ActionsEngine;
