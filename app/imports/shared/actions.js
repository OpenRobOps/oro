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

import { isNumber, isObject, isString } from 'lodash';
// ORO modules
import {
  VITAL_RAM_USAGE_PERCENTAGE,
  VITAL_CPU_LOAD_PERCENTAGE
} from './attributes';

/**
 * Meteor-agnostic library for Actions Manager
 *
 * Actions design doc:
 * https://docs.google.com/document/d/14nbbXkgxc4-ICCvko5SWFmyAf8Usuji8w0E97xeBnis
 */
// System defined action types. These are just IDs; definitions are in server/actions.
const ACTION_TYPES = {
  RESTART_AGENT: 'RestartAgent',
  RUN_SCRIPT: 'RunScript',
  PUBLISH_TO_TOPIC: 'PublishToTopic',
  GO_GO_APP: 'AppPage',
  GO_URL: 'Url',
  MAP_SWITCH: 'MapSwitch', // Beta/Internal: Map switch as action
  DISPATCH_MISSION: 'DispatchMission',
  // Other "operations", defined as (internal) actions
  NAVIGATE_PATH: 'NavigatePath',
  RELOCALIZE: 'Relocalize',
  NAVIGATE_TO: 'NavigateTo',
  CANCEL_NAV_GOAL: 'CancelNavGoal',
  TELEOP: 'Teleop',
  UPDATE_AGENT: 'UpdateAgent',
  CAMERA_TOGGLE: 'CameraToggle',
};

/**
 * Types for action arguments; for arguments that have explicit types. (For backwards
 * compatibility, types are still not required).
 *
 * Note that the values are those accepted by fastest-validator.
 *
 * Added since: Parameterized Actions
 */
const ACTION_ARGUMENT_TYPES = {
  NUMBER: 'number',
  STRING: 'string'
};

// ActionArgument schema fields (for each element of an Action.elementValues)
const ARG_FIELDS = {
  VALUE: 'value',
  TYPE: 'type',
  REQUIRED: 'required',
  INPUT: 'input',
  ATTRIBUTE: 'attributeId',
  // subfields of INPUT:
  CONTROL: 'control',
  VALUES: 'values',
  LABEL: 'label',
  MIN: 'min',
  MAX: 'max'
};

/**
 * Input controls or types for user-input action arguments.
 *
 * Added since: Parameterized Actions
 */
const ACTION_ARGUMENT_INPUT_TYPES = {
  TEXT: 'text',
  SELECT: 'select'
  // TIMER: 'timer' // Future work
  // MULTIPLE: 'multiple' // Future work, for Zippedi
};

// Fields in the actions definition that can be set by the user. All these take
// precedence over any field set in the action templates. When editing an action and changing
// its type, only these fields from the user-defined values are kept.
// @see ActionDefinitions schema below.
const ACTION_UPDATE_USER_FIELDS = [
  // main fields
  'label', 'type', 'elementList', 'elementValues', 'description',
  // flags and options
  'lock', 'confirmation', 'conditions', 
  // other experimental features and UI fields
  'tooltip', 'order', 'group', 'widgets'
];

/**
 * Creates the ID used for internal actions, adding a suffix to easily distinguish
 * system created ids.
 * For example
 * createInternalActionId(ACTION_TYPES.RESTART_AGENT) == 'RestartAgent-000000'
 */
const createInternalActionId = baseId => (baseId + '-000000');

// Constants for special arguments
const ARGNAME_SCRIPT_FILENAME = 'filename';
const ARGNAME_PUBLISH_MESSAGE = 'message';
const ARGNAME_GO_PATH = 'path';
const ARGNAME_GO_URL = 'url';
const ARGNAME_CAMERA_ID = 'cameraId';
const ARGNAME_CAMERA_FOCUS = 'focus';
const ARGNAME_CAMERA_ENABLED = 'enabled';
const ARGNAME_MAP_LABEL = 'label';
const ARGNAME_MISSION_DEFINITION_ID = 'missionDefinitionId';
// IDs for actions used in this component
const NAVIGATE_TO_ACTION_ID = createInternalActionId(ACTION_TYPES.NAVIGATE_TO);
const RELOCALIZE_ACTION_ID = createInternalActionId(ACTION_TYPES.RELOCALIZE);
const TELEOP_ACTION_ID = createInternalActionId(ACTION_TYPES.TELEOP);
const NAVIGATE_PATH_ID = createInternalActionId(ACTION_TYPES.NAVIGATE_PATH);
const CAMERA_TOGGLE_ID = createInternalActionId(ACTION_TYPES.CAMERA_TOGGLE);
const CANCEL_NAV_GOAL_ID = createInternalActionId(ACTION_TYPES.CANCEL_NAV_GOAL);

/**
 * Action types list. With labels, used from UI.
 *
 * The template is an action-like object, just as defined in action_defs collection,
 * and used as default value when creating an action.
 *
 * Flags:
 * - `final`: Those marked with "final" cannot be used as template to create another action
 *   (e.g. have no arguments to modify)
 * - `client`: The ones with "client" flag are only executed by users in UI (or Slack).
 *   They should not be added as a runAction to an incident (they can, but will do nothing).
 * - `disableAddingArgs`: No more arguments than those in the template can be added
 *
 */
const ACTION_TYPES_LIST = [
  {
    _id: ACTION_TYPES.RESTART_AGENT,
    name: 'Restart Agent',
    final: true, // cannot "subclass" it
    template: {
      lock: true,
      label: 'Restart Agent',
      disableAddingArgs: true,
      context: {
        robotId: null,
        robotName: null,
      },
    }
  },
  {
    _id: ACTION_TYPES.RELOCALIZE,
    name: 'Relocalize',
    internal: true,
    template: {
      lock: true,
      label: 'Relocalize',
      internal: true, // built-in, used in action definitions to set permissions
      context: {
        robotId: null
      },
      // the only allowed args are the following
      elementList: ['deltaPose'],
      elementValues: {
        deltaPose: { type: 'any' }
      }
    }
  },
  {
    _id: ACTION_TYPES.NAVIGATE_TO,
    name: 'Navigate To',
    final: true,
    template: {
      lock: true,
      label: 'Waypoint Teleop',
      internal: true, // built-in, used in action definitions to set permissions
      context: {
        robotId: null
      },
      // the only allowed args are the following
      elementList: ['pose', 'namedWaypointId'],
      elementValues: {
        pose: { type: 'any', required: false },
        // NOTE namedWaypointId type should be string, but because of how our arguments
        // are validated, that would force us to also use input: {} and that breaks the
        // waypoint navigation UI, making it show a dialog because the action has user inputs.
        // See web/imports/client/inorbit/util/WithActionsContext.js executeAction()
        namedWaypointId: { type: 'any', required: false },
      }
    }
  },
  {
    _id: ACTION_TYPES.CANCEL_NAV_GOAL,
    name: 'Cancel Navigation Goal',
    final: true,
    template: {
      lock: true,
      label: 'Cancel Navigation Goal',
      disableAddingArgs: true,
      context: {
        robotId: null
      }
    }
  },
  {
    // The CAMERA_TOGGLE action is meant to represent actions to control
    // cameras on a robot. There can be multiple actual actions such as
    // turning a camera on/off, temporarily changing resolution, etc.
    // NOTE(herchu): As a test/WIP, I am representing them in the same object.
    // TODO(herchu): Initial version only allows 'focus' control. Add here
    // the ability to enable/disable cameras.
    _id: ACTION_TYPES.CAMERA_TOGGLE,
    name: 'Camera Toggles',
    final: true,
    template: {
      lock: true,
      label: 'Camera Toggles',
      internal: true,
      context: {
        robotId: null,
      },
      // the only allowed args are the following
      elementList: [ARGNAME_CAMERA_ID, ARGNAME_CAMERA_FOCUS, ARGNAME_CAMERA_ENABLED],
      elementValues: {
        // cameraId argument is the camera to enable, disable or focus -- see other args
        [ARGNAME_CAMERA_ID]: {
          type: 'string',
          required: true,
          input: {} // to make parameter typed (otherwise type becomes "any")
        },
        // The 'focus' argument starts or ends "high resolution override" (using the number
        // as a boolean), where argument 'cameraId' is the camera to focus
        [ARGNAME_CAMERA_FOCUS]: {
          type: 'number', // boolean type is not implemented; although we will use it as a boolean
          required: false,
          input: {} // to make parameter typed (otherwise type becomes "any")
        },
        // If 'enabled' argument is sent, the camera cameraId is enabled or disabled
        [ARGNAME_CAMERA_ENABLED]: {
          type: 'number', // boolean type is not implemented; although we will use it as a boolean
          required: false,
          input: {} // to make parameter typed (otherwise type becomes "any")
        }
      }
    },
  },
  {
    _id: ACTION_TYPES.UPDATE_AGENT,
    name: 'Update Agent',
    final: true,
    template: {
      lock: true,
      label: 'Update Agent',
      internal: true, // built-in, used in action definitions to set permissions
      context: {
        robotId: null,
        robotName: null,
      }
    },
  },
  {
    _id: ACTION_TYPES.RUN_SCRIPT,
    name: 'Run script on agent',
    hint: 'Scripts are run in the ~/.inorbit/local/user_scripts directory',
    isTemplate: true,
    template: {
      lock: true,
      label: 'Run a user script',
      context: {
        robotId: null,
        robotName: null,
      },
      // arguments list
      elementList: [ARGNAME_SCRIPT_FILENAME],
      elementValues: {
        [ARGNAME_SCRIPT_FILENAME]: { value: null, required: true }
      }
    }
  },
  {
    _id: ACTION_TYPES.PUBLISH_TO_TOPIC,
    name: 'Publish on ROS topic',
    hint: 'Publishes "' + ARGNAME_PUBLISH_MESSAGE + '" value to topic /inorbit/custom_command; '
          + 'use {{name}} to fill in values from other arguments.',
    isTemplate: true,
    template: {
      lock: true,
      label: 'Publish to topic',
      context: {
        robotId: null,
        robotName: null,
      },
      // arguments list
      elementList: [ARGNAME_PUBLISH_MESSAGE, 'ram'],
      elementValues: {
        [ARGNAME_PUBLISH_MESSAGE]: { value: 'Hello from InOrbit. My memory usage is {{ram}}', required: true },
        ram: { attributeId: VITAL_RAM_USAGE_PERCENTAGE }
      }
    }
  },
  {
    _id: ACTION_TYPES.GO_APP,
    name: 'Jump to an app\'s page',
    hint: 'Use {{robotId}} in the "path" to go to the robot that triggered the incident.',
    isTemplate: true,
    template: {
      lock: true,
      label: 'Open an InOrbit page',
      client: true,
      context: {
        robotId: null,
        robotName: null,
      },
      // arguments list
      elementList: [ARGNAME_GO_PATH],
      elementValues: {
        [ARGNAME_GO_PATH]: { value: '/dashboards/?ctx=(robot:(robotId:{{robotId}}))', required: true }
      }
    }
  },
  {
    _id: ACTION_TYPES.GO_URL,
    name: 'Open URL',
    isTemplate: true,
    hint: 'Point to an external system, replaces any {{argumentName}} in the "'
      + ARGNAME_GO_URL + '" by its actual value.',
    template: {
      lock: true,
      label: 'Open a URL',
      client: true,
      context: {
        robotId: null,
        robotName: null,
      },
      // arguments list
      elementList: [ARGNAME_GO_URL, 'cpu'],
      elementValues: {
        [ARGNAME_GO_URL]: { value: 'https://google.com/search?q=InOrbit robot {{robotName}} uses {{cpu}} CPU', required: true },
        cpu: { attributeId: VITAL_CPU_LOAD_PERCENTAGE }
      }
    }
  },
  {
    _id: ACTION_TYPES.MAP_SWITCH,
    name: 'Switch map',
    isTemplate: true,
    template: {
      label: 'Switch map',
      disableAddingArgs: true,
      context: {
        robotId: null
      },
      // the only allowed args are the following
      elementList: [ARGNAME_MAP_LABEL],
      elementValues: {
        [ARGNAME_MAP_LABEL]: { type: 'string', value: null, required: true }
      }
    }
  },
  {
    _id: ACTION_TYPES.DISPATCH_MISSION,
    name: 'Dispatch Mission',
    isTemplate: true,
    template: {
      lock: true,
      label: 'Dispatch Mission',
      disableAddingArgs: true,
      context: {
        robotId: null
      },
      // the only allowed args are the following
      elementList: [ARGNAME_MISSION_DEFINITION_ID],
      elementValues: {
        [ARGNAME_MISSION_DEFINITION_ID]: { type: 'string', value: null, required: true }
      }
    }
  }
];

/**
 * Transforms an action argument definition (element of action.elementValues) into a schema
 * to validate argument values (valid for fastest-validator library).
 * The schema is based on the `type` field, the `required` flag and the possible values
 * given in `input` arguments.
 * This schema could be cached; although we are not currently doing it.
 *
 * @see https://www.npmjs.com/package/fastest-validator
 *
 * @param {Object} argSpec an ActionArgument arg definition
 * @return {Object} a valid sub-schema for fastest-validator
 */
const actionArgSpecToSchema = (argSpec) => {
  const schema = {};
  if (argSpec[ARG_FIELDS.TYPE] == 'any') {
    // As a backdoor to pass non-validated user arguments, we allow defining an arg with
    // just { type: 'any' }. This is equivalent to the former allowUnsafeUserArgs, at
    // parameter level (not action-wide), and we can still use it for work-in-progress actions.
    schema.type = 'any';
    schema.optional = !argSpec[ARG_FIELDS.required];
  } else if (!argSpec[ARG_FIELDS.INPUT]) {
    // No user input is expected. If this is a built-in, a constant attribute, or
    // a data source. Its configured value will pass validations. Otherwise, no value.
    if ([ARG_FIELDS.ATTRIBUTE] in argSpec) {
      // A data source (attributeId)
      schema.type = 'forbidden';
    } else if (ARG_FIELDS.VALUE in argSpec) {
      schema.type = 'equal';
      schema.value = argSpec[ARG_FIELDS.VALUE];
    } else {
      schema.type = 'forbidden';
    }
  } else {
    // `input` field exists
    schema.type = [ARG_FIELDS.TYPE] in argSpec
        && Object.values(ACTION_ARGUMENT_TYPES).includes(argSpec[ARG_FIELDS.TYPE])
      ? argSpec[ARG_FIELDS.TYPE]
      : 'any';
    schema.optional = !argSpec.required;
    schema.empty = !argSpec.required;
    schema.messages = { ...schema.messages, optional: 'Required', empty: 'Required', number: 'Must be a number' };
    const inputProps = argSpec[ARG_FIELDS.INPUT];
    // minimum value
    if (schema.type == ACTION_ARGUMENT_TYPES.NUMBER && ARG_FIELDS.MIN in inputProps) {
      schema.min = inputProps[ARG_FIELDS.MIN];
      schema.messages = { ...schema.messages, numberMin: 'Must be >= {expected}' };
    }
    // maximum value
    if (schema.type == ACTION_ARGUMENT_TYPES.NUMBER && ARG_FIELDS.MAX in inputProps) {
      schema.max = inputProps[ARG_FIELDS.MAX];
      schema.messages = { ...schema.messages, numberMax: 'Must be <= {expected}' };
    }
    // accepted values
    if (Array.isArray(inputProps[ARG_FIELDS.VALUES])) {
      schema.enum = inputProps[ARG_FIELDS.VALUES].map(obj => obj && obj[ARG_FIELDS.VALUE]);
    }
  }
  return schema;
};

/**
 * Determines if an action requires user confirmation before being executed
 *
 * @param {Object} action an Action object, for which only its `confirmation` flag
 *    is used`
 * @return {Boolean} true if the action requires confirmation
 */
const actionHasConfirmation = ({ confirmation }) => (
  isObject(confirmation) && confirmation.required
);

/**
 * Determines if an action requires any user input to get arguments values. This is true if
 * _any_ of its arguments contains an `input` property (meaning it has to be retrieved from)
 * user input at runtime, and that property contains the input parameters like type of
 * control, allowed values, etc).
 *
 * @param {Object} action an Action object, for which only its argument properties
 *    (elementList and elementValues) are used
 * @return {Boolean} true if the action requires user input
 */
const actionHasUserInput = ({ elementList, elementValues }) => (
  Array.isArray(elementList) && elementList.some(
    // For this type of function it will be great to use `.?` from ES11!
    arg => isObject(elementValues)
      && isObject(elementValues[arg])
      && isObject(elementValues[arg].input)
  )
);

/**
 * Given an action definition, it returns an array with all the attributeIds whose values
 * are necessary to display the user arguments values. Only { elementList, elementValues } are
 * used from the Action object, which represent the arguments.
 *
 * Both the `input.argumentId` (that gives the argument options) and `argumentId` (if the argument
 * is for user input -- this is the default value) are collected for each argument.
 */
const collectAttributeIdsForUserInput = ({ elementList, elementValues }) => {
  const attributeIdsSet = new Set();
  Array.isArray(elementList) && elementList.forEach((attrId) => {
    const argDef = elementValues && elementValues[attrId];
    if (argDef && argDef[ARG_FIELDS.INPUT]) {
      // a input.attributeId is used for the options in the arguments dialog
      if (argDef[ARG_FIELDS.INPUT][ARG_FIELDS.ATTRIBUTE]) {
        attributeIdsSet.add(argDef[ARG_FIELDS.INPUT][ARG_FIELDS.ATTRIBUTE]);
      }
      // an attributeId at top level is the default value when user is prompted for arguments
      if (argDef[ARG_FIELDS.ATTRIBUTE]) {
        attributeIdsSet.add(argDef[ARG_FIELDS.ATTRIBUTE]);
      }
    }
  });
  return [...attributeIdsSet];
};

/**
 * Function to create a fake script argument name. This is used for 'unnamed'
 * scripts arguments; because we actually need a name for all scripts arguments,
 * as we use the elementList/elementValues schema and so all arguments
 * are required to have a unique name.
 *
 * The format is `arg-[:xdigit:]{10}`
 *
 * Note that the format used here must be exactly what isDummyArgName
 * recognizes.
 */
const createDummyArgName = () => 'arg-' + Math.random().toString(36).substring(2, 12);

/**
 * Tells if an argument name is actually a dummy or 'unnamed' argument.
 * These arguments are a unique name (as all arguments) within a script,
 * but they show up as empty (no name) in the UI editor and are not used
 * when executing a script: they are skipped.
 *
 * Note that this function returns true for the names created with
 * createDummyArgName.
 */
const isDummyArgName = name => (/^arg-[a-zA-Z0-9]{10}$/.test(name));

/**
 * Creates a string simulating what the invocation of a script execution
 * action will look like; leaving some placeholders such us
 * "<data source name>" where attributes are used, or adding constants
 * where the arguments are simply receiving constants. This helps the user
 * understand how the script will be execute and its actual parameters.
 *
 * The `action` arguments is an Action object with its arguments specified
 * in elementList/elementValues fields, and `attributes` is an optional list
 * of attributes (data sources), that can be referenced to in elements
 * for the form `{ attributeId: <id> }` in elementValues.
 *
 * It returns a string like the following example:
 * "~/.inorbit/local/user_scripts/myscript.sh --debug 3 -t <temperature>"
 *
 */
const formatScriptAction = (action, attributes) => {
  if (!action || !action.elementList || !action.elementValues) {
    return null;
  }
  const arr = [];
  action.elementList && action.elementList.forEach((arg) => {
    const val = action.elementValues[arg] || {};
    if (arg == ARGNAME_SCRIPT_FILENAME) {
      // the script filename
      arr.push('runs: ~/.inorbit/local/user_scripts/' + val.value);
    } else {
      if (!isDummyArgName(arg)) {
        arr.push(arg);
      }
      if ('value' in val) {
        // A constant
        arr.push(val.value);
      } else if ('attributeId' in val) {
        // A data source
        const attr = attributes && attributes.find(a => a._id == val.attributeId);
        arr.push('<' + (attr && attr.label ? attr.label : val.attributeId).replace(/ /g, '_') + '>');
      } else if (val.required) {
        arr.push('<value>'); // user provided argument with no default value: show placeholder
      }
    }
  });
  return arr.join(' ');
};


/**
 * Finds and returns the action template (one of ACTION_TYPES_LIST) for a given action type.
 * It returns undefined if the given type does not exist.
 */
const findActionTemplateFromType = type => (
  ACTION_TYPES_LIST.find(obj => obj._id == type)
);

/**
 * Receives an action and returns the tooltip message it should display
 */
const getActionTooltip = action => action && action.ui
  && (action.ui.isDisabled ? action.ui.disabledTooltip : action.ui.tooltip);

/**
 * Validates the definition of an action before saving.
 * Checks performed:
 *  - Action type is valid
 *  - Mandatory arguments are present, with values (or marked as user input)
 *
 * @return {object} As several methods in ActionsManager (users of this function), it returns
 *   an object with { success, errors, message } indicating if the action definition is correct.
 *   If it is not, then `success=false`, `errors` contains the wrong fields as keys, and `message`
 *   is a human-readable message to display (e.g. in APIs).
 *
 * TODO(herchu) Also verify that any argument referred from within the replaced templates
 * (e.g. the message in a PublishToTopic action) actually exist. See ActionsManager.postProcess
 * for a list of which parameters in which action types receive replacements.
 * Given the free-form handlebars syntax this may not be possible to implement (except perhaps by
 * generating warnings, not errors, to avoid false positives from preventing to save correct
 * actions).
 */
const validateActionDefinition = (definition) => {
  const actionTypeDefinition = findActionTemplateFromType(definition.type);
  if (!actionTypeDefinition) { // invalid type
    return {
      success: false,
      errors: { type: true },
      message: 'Invalid action type: ' + definition.type
    };
  }
  // helper function to tell if an argument exists (and optionally: if it has a value)
  // in an action definition. It could be moved outside validateActionDefinition() if it needs
  // to be reused
  const checkArgExists = (name, checkHasValue) => {
    const value = definition.elementValues && definition.elementValues[name];
    return definition.elementList
      && definition.elementList.includes(name)
      && (name in definition.elementValues)
      && (
        !checkHasValue // if the argument needs to have a value...
        || (isString(value) || isNumber(value) || (isObject(value) && 'value' in value)) // ...then the value is given...
        || 'input' in value // ...or is declared as user input
      );
  };
  // Check the action template for any required argument. Every required argument must exist
  // in the new action definition, and have a value (or declared user-provided)
  if (actionTypeDefinition.isTemplate && actionTypeDefinition.template
      && Array.isArray(actionTypeDefinition.template.elementList)) {
    const { elementList, elementValues } = actionTypeDefinition.template;
    for (const argName of elementList) {
      if (elementValues[argName].required && !checkArgExists(argName, true)) {
        return {
          success: false,
          errors: { arguments: true },
          message: `Missing action argument: ${argName}`
        };
      }
    }
  }
  return { success: true };
};

export {
  // Action types, schemas and system IDs
  ACTION_TYPES,
  ACTION_TYPES_LIST,
  ACTION_ARGUMENT_TYPES,
  ACTION_ARGUMENT_INPUT_TYPES,
  ACTION_UPDATE_USER_FIELDS,
  NAVIGATE_TO_ACTION_ID,
  RELOCALIZE_ACTION_ID,
  TELEOP_ACTION_ID,
  NAVIGATE_PATH_ID,
  CAMERA_TOGGLE_ID,
  CANCEL_NAV_GOAL_ID,
  // DB fields
  ARG_FIELDS,
  // Special arguments
  ARGNAME_SCRIPT_FILENAME,
  ARGNAME_PUBLISH_MESSAGE,
  ARGNAME_GO_URL,
  ARGNAME_GO_PATH,
  ARGNAME_CAMERA_ID,
  ARGNAME_CAMERA_FOCUS,
  ARGNAME_CAMERA_ENABLED,
  ARGNAME_MAP_LABEL,
  ARGNAME_MISSION_DEFINITION_ID,
  // Utility functions
  createInternalActionId,
  actionArgSpecToSchema,
  actionHasUserInput,
  actionHasConfirmation,
  collectAttributeIdsForUserInput,
  createDummyArgName,
  isDummyArgName,
  formatScriptAction,
  getActionTooltip,
  validateActionDefinition,
  findActionTemplateFromType
};
