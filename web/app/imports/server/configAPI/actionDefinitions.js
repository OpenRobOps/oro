/**
 * Configuration API implementation for Actions Definitions
 */
import Validator from 'fastest-validator';
import { pick, isEqual } from 'lodash';
// ORO modules
import {
  RESOURCE_SINGLETONS, ACCESS_LEVEL_VIEW, ACCESS_LEVEL_CONFIGURE, parseResourceId,
  isSystemUser
} from '../../shared/roles';
import { ACTION_ARGUMENT_INPUT_TYPES, ACTION_ARGUMENT_TYPES, ARG_FIELDS,
  isDummyArgName, createDummyArgName } from '../../shared/actions';
import {
  ValidationError, AuthorizationError, LIST_FORMAT_SHORT, LIST_FORMAT_FULL,
  SchemaError
} from '../../shared/configAPI';
import { zipKeyValueList } from '../../lib/util';
import ActionsEngine from '../actions';
import { GROUP_LABEL_NONE } from '../../shared/uiPreferences';
// import UIPreferencesManager from '../uiPreferences'; TODO refactor
import OroRoles from '../roles';
import { NAVIGATION_DETAIL_WIDGET } from '../../lib/uiPreferences';

// Mapping from widget "names" (API, external) to paths in UIPreferences.
// This object also defines the accepted values for ActionDefinition schema.
// For now, only NavigationDetail is supported.
const WidgetNamesToUIPrefsPath = {
  navigation: {
    screenKey: NAVIGATION_DETAIL_WIDGET,
    widgetId: undefined
  }
};

// ActionDefinition spec used for Config as Code Apply
const ActionDefinitionSpecApplySchema = {
  $$strict: true,
  // TODO(mike) include order
  type: { type: 'string', empty: false, max: 255 },
  lock: { type: 'boolean', optional: true, default: false },
  label: { type: 'string', empty: false, max: 255, default: '' },
  description: { type: 'string', empty: true, max: 255, optional: true, default: '' },
  group: { type: 'string', empty: true, max: 255, optional: true },
  // confirmation is an object, even if only a boolean is used (room for later expansion, to
  // allow customizing the confirmation message)
  confirmation: {
    type: 'object',
    optional: true,
    default: { required: false },
    strict: true,
    props: {
      required: { type: 'boolean', default: false }
    }
  },
  // condition is an object:
  // - rules uses the old conditions (web/lib/expressions),
  // - expression is reserved for an string expression (to be implemented)
  condition: {
    type: 'object',
    optional: true,
    props: {
      rules: { type: 'array' }
    }
  },
  widgets: {
    type: 'array',
    optional: true,
    items: {
      type: 'string',
      // For now, limit the list of possible widgets to those declared in WidgetNamesToUIPrefsPath
      enum: Object.keys(WidgetNamesToUIPrefsPath),
      empty: false,
      max: 255
    }
  },
  arguments: {
    type: 'array',
    default: [],
    items: {
      type: 'object',
      strict: true,
      props: {
        // only 'number' and 'string' types are accepted (both are string constants)
        type: {
          type: 'string',
          enum: Object.values(ACTION_ARGUMENT_TYPES),
          default: ACTION_ARGUMENT_TYPES.STRING
        },
        // arg name is optional externally, but all args have names -- a trick is used to hide
        // "dummy" argument names
        name: { type: 'string', optional: true },
        // the type of `value` must match the type declared by `type`
        value: Object.values(ACTION_ARGUMENT_TYPES).map(type => ({ type, optional: true })),
        // optional: it maps from 'attributeId' arguments
        dataSourceId: { type: 'string', optional: true },
        input: {
          type: 'object',
          optional: true,
          props: {
            control: { type: 'string', values: Object.values(ACTION_ARGUMENT_INPUT_TYPES) },
            values: {
              type: 'array',
              optional: true,
              items: {
                type: 'object',
                props: {
                  label: 'string',
                  value: 'string'
                }
              }
            }
          }
        },
      }
    }
  }
};

const actionDefinitionSpecValidator = new Validator().compile(ActionDefinitionSpecApplySchema);

/**
 * Translates an action definition to the schema used for list items
 * in our config as code API
 */
const actionDefinitionToListItem = ({ _id: id, ...definition }) => ({
  id,
  label: (definition && definition.label) ? definition.label : '',
  suppressed: !definition
});

/**
 * Helper for actionDefinitionToConfigObject, to transform an actions' arguments definitions
 * to the API schema.
 * Arguments are the argument name and its value, collected from the { elementList, elementValues }
 * representation.
 */
const actionDefinitionArgumentToConfigObject = ({ key, value }) => {
  const arg = pick(value, [ARG_FIELDS.TYPE, ARG_FIELDS.LABEL, ARG_FIELDS.VALUE, ARG_FIELDS.INPUT]);
  // TODO: missing "required" field
  if (!isDummyArgName(key)) {
    arg.name = key;
  }
  if (value && value.attributeId) {
    arg.dataSourceId = value[ARG_FIELDS.ATTRIBUTE];
  }
  return arg;
};

/**
 * Translates an action definition from our model to the schema used by
 * the config as code API.
 *
 * @returns {object}
 */
const actionDefinitionToConfigObject = ({ _id: id, group, widgets, ...definition }) => {
  const configObject = {
    metadata: {
      id,
    },
    apiVersion: 'v0.1'
  };
  if (!definition) {
    configObject.spec = null;
    return configObject;
  }
  const spec = {};
  configObject.spec = spec;
  const {
    type, label, description, lock, confirmation, conditions,
    elementList, elementValues
  } = definition;
  spec.type = type;
  spec.label = label;
  spec.group = (group || {}).label;
  if (widgets && widgets.length) {
    spec.widgets = widgets.map((path) => {
      const [screenKey, widgetId] = path.split('.');
      const widgetMapping = Object.entries(WidgetNamesToUIPrefsPath).find(
        ([, v]) => v.screenKey == screenKey && v.widgetId == widgetId
      );
      return widgetMapping ? widgetMapping[0] : null;
    }).filter(x => x);
  }
  // Note: Always exposing the Lock value, even if the account has no access to it (it is
  // feature flagged). It is validated during apply()
  spec.lock = Boolean(lock);
  spec.description = description;
  spec.confirmation = confirmation; // || { required: false }; // default behavior
  // conditions, if present, is an array of rules from web/lib/expressions: our own (and old)
  // expressions language based on objects with $not, $and, etc.
  // We should migrate to our new expressions language (used in derived attributes).
  // Insert these old rules under key "rules", with room for further enhancements
  if (conditions) {
    spec.condition = { rules: conditions };
  }
  const args = zipKeyValueList(Array.isArray(elementList) ? elementList : [], elementValues);
  spec.arguments = args.map(actionDefinitionArgumentToConfigObject);
  actionDefinitionSpecValidator(spec); // used as sanitizer, adds default values to required fields
  return configObject;
};

/**
 * Builds an action definition from a configuration object
 * @param {object} configObject configuration object with the schema defined in the config API
 * @returns {object} action definition with the schema used internally by the manager
 */
const configObjectToActionDefinition = (configObject) => {
  const { spec } = configObject;
  const {
    type: actionType,
    lock,
    label,
    description,
    confirmation,
    condition,
    arguments: args
  } = spec;

  // Parse args
  const elementList = [];
  const elementValues = {};
  if (Array.isArray(args)) {
    args.forEach((arg) => {
      let { name } = arg;
      if (!name) {
        // Arguments must have a name, even if this one is not visible externally -- this is
        // because our elementList/elementValues schema does not accomodate unnamed arguments.
        // See isDummyArgName/createDummyArgName in shared/actions.js
        name = createDummyArgName();
      }
      elementList.push(name);
      elementValues[name] = pick(arg, ['type', 'value', 'input', 'attributeId']);
    });
  }

  // Build the definition object
  const definition = {
    type: actionType,
    label,
    description,
    lock,
    confirmation,
    elementList,
    elementValues
  };
  if (condition && condition.rules) {
    definition.conditions = condition.rules;
  }
  // TODO(herchu): Reject other `conditions` fields

  return definition;
};

/**
 * API used by the ConfigApi to handle Action related configuration.
 * It allows the user to list, apply (TODO), clear (TODO) actions through the CLI
 */
export default class ActionDefinitionConfigAPI {
  // Create class with access to ActionsEngine
  constructor(configApi, options = {}) {
    const {
      actionsEngine = new ActionsEngine()
    } = options;
    this.actionsEngine = actionsEngine;
  }

  /**
   * Since ids are used for individual config elements, isGlobalConfig returns false
   */
  // eslint-disable-next-line class-methods-use-this
  isGlobalConfig = () => false;

  /**
   * Lists actions definitions configuration objects
   *
   * @returns {array}
   */
  list = async ({ id, user, format = LIST_FORMAT_SHORT }) => {
    // Permissions validations: require access to the actions singleton
    if (!isSystemUser(user) && !await new OroRoles().canAccessSystemElement(
      user._id,
      RESOURCE_SINGLETONS.ACTIONS,
      ACCESS_LEVEL_VIEW
    )) {
      throw new AuthorizationError('Unauthorized');
    }

    // Retrieve configs filtering by id
    let actionDefinitions = Object.values(await this.actionsEngine.getActionDefinitions(id ? [id] : undefined));
    
    // TODO re-enable this code or refactor how groups work
    // const actionToGroupMapping = await new UIPreferencesManager().getActionToGroupMapping({
    // });
    // const actionToWidgetMapping = await new UIPreferencesManager().getActionToWidgetsMapping({
    // });
    // Complete the group for each definition
    actionDefinitions.forEach((i) => {
      // i.group = actionToGroupMapping[i.id] || { label: GROUP_LABEL_NONE };
      // i.widgets = actionToWidgetMapping[i.id];
      i.group = { _id: 'Other', label: 'Other' };
    });

    // Transform the output to the right format used for Config as Code lists.
    // TODO(franguerini): Handle other formats like: LIST_FORMAT_FULL
    if (format === LIST_FORMAT_SHORT) {
      return actionDefinitions.map(actionDefinitionToListItem);
    } else if (format === LIST_FORMAT_FULL) {
      return actionDefinitions.map(actionDefinitionToConfigObject);
    } else {
      throw new ValidationError(`Invalid format ${format}`);
    }
  };

  /**
   * Configuration API Apply implementation for actions
   */
  apply = async ({ configObject, user }) => {
    if (!configObject.metadata) {
      throw new ValidationError('Configuration object must have metadata');
    }
    // Permissions validations: require access to the actions singleton
    // and configure access to the whole fleet
    // TODO: It should be possible to grant access to the actions
    // singleton at robot level, but currently our roles implementation
    // does not support that.
    if (!isSystemUser(user) // do not validate authorization when using peer api calls
      && (!await new OroRoles().canAccessSystemElement(
        user._id,
        RESOURCE_SINGLETONS.ACTIONS,
        ACCESS_LEVEL_CONFIGURE
      ))
    ) {
      throw new AuthorizationError('Unauthorized');
    }
    const actionId = configObject.metadata.id;
    const { spec } = configObject;
    // Apply the config
    let result;
    if (spec) {
      // Schema and logic validations
      const validation = actionDefinitionSpecValidator(spec);
      if (validation !== true) {
        throw new SchemaError((validation.length && validation[0].message) || 'Invalid schema');
      }
      const definition = configObjectToActionDefinition(configObject);
      // TODO(mike): Limits validations
      result = await this.actionsEngine.createOrUpdateActionDefinition(
        actionId,
        definition,
        user
      );
      await this._updateActionGroup(actionId, configObject.spec.group, user);
      await this._updateActionEmbeds({ actionId, user, widgets: spec.widgets });
    } else {
      console.log('suppressing action', actionId);
      result = await this.actionsEngine.suppressActionDefinition(
        actionId,
        user
      );
      console.log("suppressed")
      await this._updateActionGroupAfterDelete(actionId);
      await this._updateActionEmbeds({ actionId, user, widgets: null });
    }
    if (!result.success) {
      // TODO make sense of the error
      throw new ValidationError(result.message || 'Invalid action');
    } else if (result && result.success) {
      // ok, passed. Ignore result
    } else {
      throw new Error('ActionsManager did not return a result');
    }
  };

  /**
   * Configuration API Clear implementation for action definitions
   */
  clear = async ({ configObject, user }) => {
    if (!configObject.metadata) {
      throw new ValidationError('Configuration object must have metadata');
    }
    // Permissions validations: require access to the actions singleton
    // and configure access to the whole fleet
    // TODO: It should be possible to grant access to the actions
    // singleton at robot level, but currently our roles implementation
    // does not support that.
    if (!await new OroRoles().canAccessSystemElement(
      user._id,
      RESOURCE_SINGLETONS.ACTIONS,
      ACCESS_LEVEL_CONFIGURE
    )) {
      throw new AuthorizationError('Unauthorized');
    }
    const { id: actionId } = configObject.metadata;

    // Validate if trying to clear a non-existing action
    const oldActionDefinition = await this.actionsEngine.getActionDefinition(actionId);
    if (!oldActionDefinition) {
      return;
    }
    const result = await this.actionsEngine.removeActionDefinition(actionId, user);
    await this._updateActionGroupAfterDelete(actionId);
    await this._updateActionEmbeds({ actionId, user, widgets: null });

    if (!result) {
      throw new Error('ActionsManager did not return a result');
    }
  };

  /**
   * Updates UI preferences at the after an action is deleted (cleared or suppressed).
   *
   * @param {string} actionId
   */
  _updateActionGroupAfterDelete = async (actionId) => {
    // TODO re-enable 
    console.warn('_updateActionGroupAfterDelete: TODO propagate to UIPreferences');
    // await new UIPreferencesManager().removeActionFromGroups({ actionId });
    // await new UIPreferencesManager().removeActionFromWidgetsEmbeddedActions({ actionId });
  };

  /**
   * Updates UI preferences after an action is created or updated.
   * If groupLabel is defined, the action is moved to that group.
   *
   * @param {string} actionId
   * @param {string} groupLabel
   * @param {object} user
   */
  // eslint-disable-next-line class-methods-use-this
  _updateActionGroup = async (actionId, groupLabel, user) => {
    let newGroupObj;
    if (groupLabel) {
      // Add action to the group
      newGroupObj = { label: groupLabel };
    } else {
      // If the action isn't in any group, add it to the default one
      console.warn('_updateActionGroup: TODO get current group');
      const currentGroup = null;
      // const currentGroup = await new UIPreferencesManager().getActionGroup({
      //   actionId
      // });
      if (!currentGroup) {
        newGroupObj = { label: GROUP_LABEL_NONE };
      }
    }
    if (newGroupObj) {
      console.warn('_updateActionGroup: TODO add action to group');
      // await new UIPreferencesManager().addActionToGroup({
      //   actionId,
      //   newGroupObj,
      //   user
      // });
    }
  }

  /**
   * Updates the widgets an action is embedded on. This operation is delegated to the
   * UIPreferencesManager.
   */
  // eslint-disable-next-line class-methods-use-this
  _updateActionEmbeds = async ({ actionId, widgets, user }) => {
    // Get the list of widgets the action is already embedded on; default to empty array
    console.log('_updateActionEmbeds: TODO get existing widgets');
    // const existingWidgets = await new UIPreferencesManager().getActionToWidgetsMapping({
    // })[actionId] || [];
    const existingWidgets = [];
    // Normalize the desired list of widgets to emtpy array (ignore both null or undefined)
    widgets = widgets || [];
    // If the two lists differ, embed this action in the desired widgets by resetting it (clearing
    // it from all widgets) and re-add them
    if (!isEqual(existingWidgets, widgets)) {
      // If the two arrays are not equal, delete it from everywhere and re-add it (it's easier
      // than going through the diff one by one, and there is no operation in UIPrefsMgr to remove
      // actions from an individual widget)
      if (existingWidgets.length) {
        await new UIPreferencesManager().removeActionFromWidgetsEmbeddedActions({
          actionId
        });
      }
      if (widgets.length) {
        for (const widget of widgets) {
          const { screenKey, widgetId } = WidgetNamesToUIPrefsPath[widget];
          if (screenKey) {
            // eslint-disable-next-line no-await-in-loop
            await new UIPreferencesManager().addEmbeddedAction({
              screenKey,
              widgetId,
              actionId,
              user
            });
          } else {
            console.error(`Invalid widget path accepted for embedded action; ignored: ${widget}`);
          }
        }
      }
    }
  }
}
