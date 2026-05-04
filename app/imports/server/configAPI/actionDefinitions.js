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
 * Configuration API implementation for Actions Definitions
 */
import Validator from 'fastest-validator';
import { pick } from 'lodash';
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
import OroRoles from '../roles';

// Embedded widgets -- for now, only NavigationDetail is supported.
const EMBEDDED_WIDGET_NAVIGATION = 'navigation';
const EMBEDDED_WIDGET_NAMES = [EMBEDDED_WIDGET_NAVIGATION];

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
      enum: EMBEDDED_WIDGET_NAMES,
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
const actionDefinitionToConfigObject = ({ _id: id, widgets, ...definition }) => {
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
    type, label, description, lock, confirmation, conditions, group, elementList, elementValues
  } = definition;
  spec.type = type;
  spec.label = label;
  if (widgets && widgets.length) {
    spec.widgets = widgets;
  }
  // Note: Always exposing the Lock value, It is validated during apply()
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
  if (group) {
    spec.group = group;
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
    arguments: args,
    group,
    widgets
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
    elementValues,
    group,
    widgets
  };
  if (condition && condition.rules) {
    definition.conditions = condition.rules;
  }
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
    // Transform the output to the right format used for Config as Code lists.
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
    } else {
      result = await this.actionsEngine.suppressActionDefinition(
        actionId,
        user
      );
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

    if (!result) {
      throw new Error('ActionsManager did not return a result');
    }
  };
}
