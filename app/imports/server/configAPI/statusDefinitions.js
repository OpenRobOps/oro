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
 * Configuration API implementation for Status Definitions
 *
 * This handler uses the DataSources API handler some operations: when a status contains
 * "calculated" expressions, it delegates on that handler the creation of the attribute, its
 * mapping, etc. To do this, it must know the top level ConfigAPI and use getHandler() to get
 * the DataSourceDefinition handler. Note that by talking to that handler directly (using
 * list() and apply()) it may be skipping checks or other steps done by ConfigAPI. See
 * "Sharing Handlers" section in attached design doc for details.
 *
 * NOTE about namings:
 *  - "status config" is the internal name and schema used by the RobotStatusManager
 *  - config object is the API level object. Its schema is different than the one used by the
 *    manager. So this module needs to convert between them using
 *    statusConfigToConfigObject and configObjectToStatusConfig.
 */

import Validator from 'fastest-validator';
import { upperFirst, lowerFirst, invert, get, isObject, keyBy } from 'lodash';
// InOrbit
import OroRoles from '../roles';
import {
  RESOURCE_SINGLETONS, ACCESS_LEVEL_CONFIGURE, isSystemUser,
} from '../../shared/roles';
import {
  KIND_DATASOURCE_DEFINITION,
  SchemaError, ValidationError, AuthorizationError,
  LIST_FORMAT_SHORT, LIST_FORMAT_FULL
} from '../../shared/configAPI';
import RobotStatusManager from '../status';
import { STATUS, STATUS_FUNCTIONS as INTERNAL_FUNCTIONS } from '../../shared/status';
import { FIELD_SOURCE_DERIVED } from './dataSourceDefinitions';

// API fields
const API_F_CALCULATED = 'calculated';
const API_F_EXPRESSION = 'expression';
const API_F_FILTER = 'filter';
const API_F_LABEL = 'label';

// Mapping between status names as externalized in the config API and internal statuses
const STATUS_OPTIONS = {
  WARNING: STATUS.WARN,
  ERROR: STATUS.ERROR,
};

// Mapping between status values and status names from STATUS_OPTIONS
// example 20 -> error
const STATUS_VALUES_TO_OPTIONS = Object.entries(STATUS_OPTIONS).reduce(
  // eslint-disable-next-line no-return-assign, no-sequences
  (a, [e, i]) => (a[i.value] = e, a), {}
);

// Options for the functions used in statuses in the config API
const FUNCTION_OPTIONS = {
  ABOVE: 'ABOVE',
  BELOW: 'BELOW',
  EQUALS: 'EQUALS',
  NOT_EQUALS: 'NOT_EQUALS',
  CONTAINS: 'CONTAINS',
};

// Mapping between status functions as externalized in the config API and internal function names
const EXTERNAL_TO_INTERNAL_FUNCTIONS = {
  [FUNCTION_OPTIONS.ABOVE]: INTERNAL_FUNCTIONS.HIGHER_THAN,
  [FUNCTION_OPTIONS.BELOW]: INTERNAL_FUNCTIONS.LESS_THAN,
  [FUNCTION_OPTIONS.EQUALS]: INTERNAL_FUNCTIONS.EQUALS,
  [FUNCTION_OPTIONS.NOT_EQUALS]: INTERNAL_FUNCTIONS.NOT_EQUALS,
  [FUNCTION_OPTIONS.CONTAINS]: INTERNAL_FUNCTIONS.CONTAINS
};

// Mapping between internal status functions and the function names used in the config API
// It's the dict above swapping keys and values
const INTERNAL_TO_EXTERNAL_FUNCTIONS = invert(EXTERNAL_TO_INTERNAL_FUNCTIONS);

/**
 * Converts between status function parameters external and internal representation
 *
 * Note that externally there is only one "BELOW" function, but internally some functions, e.g.
 * "minTime" and "sustainedLessThan" receive different argumenst (resp. "min" vs "minValue")
 *
 * For example, if functionName=="ABOVE", params==[30] sustainedForEquals==10,
 * it returns `{ minValue: 30 }`
 *
 * @return {object} An object with one field, such as `min`, `minValue`, `value`. etc. as required
 *   in the function `functionName` configuration.
 */
const FUNCTION_PARAMS_TO_INTERNAL = (functionName, params, sustainedForSeconds) => {
  const isSustained = sustainedForSeconds > 0;
  switch (functionName) {
    case FUNCTION_OPTIONS.ABOVE:
      return ({ [isSustained ? 'maxValue' : 'max']: params && params[0] });
    case FUNCTION_OPTIONS.BELOW:
      return ({ [isSustained ? 'minValue' : 'min']: params && params[0] });
    case FUNCTION_OPTIONS.EQUALS:
      return ({ value: params && params[0] });
    case FUNCTION_OPTIONS.NOT_EQUALS:
      return ({ value: params && params[0] });
    case FUNCTION_OPTIONS.CONTAINS:
      return ({ value: params && params[0] });
    default:
      // This should never occur as the caller (configObjectRuleToStatusConfigRule) checks for
      // EXTERNAL_TO_INTERNAL_FUNCTIONS validity first
      throw new Error(`Invalid function name ${functionName}`);
  }
};

/**
 * Converts between status function parameters internal and external representation.
 *
 * For example, if internalFunctioName is "lessThan" (INTERNAL_FUNCTIONS.LESSTHAN) and
 * params is { min: 10 }, it returns `[10];
 *
 * @return {array} An array of values to used as arguments externally.
 */
const FUNCTION_PARAMS_TO_EXTERNAL = (internalFunctionName, params, isSustained) => {
  switch (internalFunctionName) {
    case INTERNAL_FUNCTIONS.HIGHER_THAN:
      return [isSustained ? params.maxValue : params.max];
    case INTERNAL_FUNCTIONS.LESS_THAN:
      return [isSustained ? params.minValue : params.min];
    case INTERNAL_FUNCTIONS.EQUALS:
      return [params.value];
    case INTERNAL_FUNCTIONS.NOT_EQUALS:
      return [params.value];
    case INTERNAL_FUNCTIONS.CONTAINS:
      return [params.value];
    default:
      // This should never occur as the caller (configObjectRuleToStatusConfigRule) checks for
      // EXTERNAL_TO_INTERNAL_FUNCTIONS validity first
      throw new Error(`Invalid function name ${internalFunctionName}`);
  }
};

// StatusDefinition spec used for Config as Code Apply
const StatusDefinitionSpecApplySchema = {
  $$strict: true,
  rules: {
    type: 'array',
    items: {
      type: 'object',
      props: {
        function: { type: 'enum', values: Object.keys(FUNCTION_OPTIONS) },
        params: { type: 'array', optional: true },
        sustainedForSeconds: { type: 'number', min: 1, optional: true },
        status: { type: 'enum', values: Object.keys(STATUS_OPTIONS) }
      }
    }
  },
  [API_F_CALCULATED]: {
    type: 'object',
    optional: true,
    strict: true,
    props: {
      [API_F_LABEL]: { type: 'string', optional: true },
      [API_F_EXPRESSION]: { type: 'string' },
      [API_F_FILTER]: { type: 'string', optional: true }
    }
  }
};

const statusDefinitionSpecValidator = new Validator().compile(StatusDefinitionSpecApplySchema);

/**
 * Modifies an internal status function to make it sustained
 * @param {number} sustainedForSeconds
 * @param {object} statusConfig
 */
const makeSustained = (sustainedForSeconds, statusConfig) => {
  if (sustainedForSeconds) {
    statusConfig.functionName = `sustained${upperFirst(statusConfig.functionName)}`;
    statusConfig.params.minSeconds = sustainedForSeconds;
  }
};

/**
 * Translates a rule from a status definition in our config as code schema to rule
 * with the schema used internally.
 *
 * @param {object}
 * @returns {object}
 */
const configObjectRuleToStatusConfigRule = ({
  status, function: functionName, params, sustainedForSeconds
}) => {
  if (!EXTERNAL_TO_INTERNAL_FUNCTIONS[functionName]) {
    throw new Error(`Invalid function name ${functionName}`);
  }
  if (!STATUS_OPTIONS[status]) {
    throw new Error(`Invalid status ${status}`);
  }

  const statusConfig = {
    functionName: EXTERNAL_TO_INTERNAL_FUNCTIONS[functionName],
    status: STATUS_OPTIONS[status].value,
    params: FUNCTION_PARAMS_TO_INTERNAL(functionName, params, sustainedForSeconds)
  };

  makeSustained(sustainedForSeconds, statusConfig);
  return statusConfig;
};

/**
 * Translates a rule from a status config used internally to a rule
 * with the schema used by the config API.
 *
 * @param {object}
 * @returns {object}
 */
const statusConfigRuleToConfigObjectRule = ({ functionName, params = {}, status }) => {
  const match = functionName.match(/^(?<sustained>sustained)?(?<internalFunction>.+)/);
  // eslint-disable-next-line prefer-const
  let { sustained, internalFunction } = match.groups || {};
  internalFunction = lowerFirst(internalFunction);
  const externalFunction = INTERNAL_TO_EXTERNAL_FUNCTIONS[internalFunction];
  if (!externalFunction) {
    throw new Error(`Couldn't convert internal function name ${functionName}`);
  }
  const rule = {
    function: externalFunction,
    status: STATUS_VALUES_TO_OPTIONS[status],
    params: FUNCTION_PARAMS_TO_EXTERNAL(internalFunction, params, sustained)
  };

  if (sustained) {
    rule.sustainedForSeconds = params.minSeconds;
  }
  return rule;
};

/**
 * Translates an status definition in our config as code schema to an
 * object with the schema used internally.
 *
 * @param {object} configObject
 * @returns {object}
 */
const configObjectToStatusConfig = (configObject) => {
  const { spec } = configObject;
  const statusConfig = (spec.rules && spec.rules.map(configObjectRuleToStatusConfigRule)) || [];
  return statusConfig;
};

/**
 * Translates a status config to the schema used for list items
 * in our config as code API
 */
const statusConfigToListItem = ({ attributeId, dataSourceObject, rules }) => {
  return {
    id: attributeId,
    label: dataSourceObject?.spec?.label || '',
    suppressed: !rules,
  };
};

/**
 * Translates an status config from our model to the schema used by
 * the config as code API.
 *
 * @returns {object}
 */
const statusConfigToConfigObject = ({ attributeId, rules: config, dataSourceObject }) => {
  const configObject = {
    metadata: { id: attributeId },
    apiVersion: 'v0.1'
  };

  if (config === null) {
    configObject.spec = null;
    return configObject;
  }
  configObject.spec = {
    rules: (
      (Array.isArray(config) && config.map(statusConfigRuleToConfigObjectRule))
      || [])
  };
  // If there is a derived attribute with this same ID, include its definition as the
  // 'calculated expression' of the status
  // Note: some day we will get rid of lodash.get and use ES7 syntax
  const mappingSource = get(dataSourceObject, `spec.source.${FIELD_SOURCE_DERIVED}`);
  if (isObject(mappingSource)) {
    const calculated = {
      [API_F_EXPRESSION]: mappingSource.transform || ''
    };
    if (mappingSource.filter) {
      calculated[API_F_FILTER] = mappingSource.filter;
    }
    configObject.spec[API_F_CALCULATED] = calculated;
  }
  return configObject;
};

export default class StatusConfigAPIHandler {
  constructor(configApi, options = {}) {
    const {
      robotStatusManager = new RobotStatusManager()
    } = options;
    if (!configApi) {
      throw new Error('reference to configApi must be received');
    }
    this._configApi = configApi;
    this._robotStatusManager = robotStatusManager;
  }

  /**
   * Since ids are used for individual config elements, isGlobalConfig returns false
   */
   isGlobalConfig = () => false;

   /**
   * Configuration API Apply implementation for status definitions
   */
  apply = async ({ configObject, user }) => {
    if (!configObject.metadata) {
      throw new ValidationError('Configuration object must have metadata');
    }
    if (!isSystemUser(user) && ( // do not validate authorization when using peer api calls
      !await new OroRoles().canAccessSystemElement(
        user._id,
        RESOURCE_SINGLETONS.DATASOURCES,
        ACCESS_LEVEL_CONFIGURE))) {
      throw new AuthorizationError('Unauthorized');
    }

    const { spec } = configObject;
    const statusId = configObject.metadata.id;
    if (spec) {
      // Schema and logic validations
      const validation = statusDefinitionSpecValidator(spec);
      if (validation !== true) {
        throw new SchemaError((validation.length && validation[0].message) || 'Invalid schema');
      }
      // Build status definition object
      const statusConfig = configObjectToStatusConfig(configObject);
      // if there is a 'calculated' field, it creates a derived attribute under the hood
      await this._applyCalculatedField({ configObject, user });
      // finally, apply the status rules
      await this._robotStatusManager.setStatusConfig(
        statusId,
        statusConfig,
        statusId,
        user,
        false
      );
    } else {
      // Null spec means suppress
      await this._robotStatusManager.suppressStatusConfig(statusId, user);
    }
  }

  /**
   * Applies the 'calculated' part of a status, if there is any.
   * This field creates a derived attribute with an expression to calculate its value.
   * The attribute takes the same id as the status rule.
   */
  _applyCalculatedField = async ({ configObject, user }) => {
    const dataSourceHandler = this._configApi.getHandler(KIND_DATASOURCE_DEFINITION);
    const { spec } = configObject;
    const calculated = spec[API_F_CALCULATED];
    if (!calculated) {
      return undefined; // nothing to do
    }
    const mappingSource = {};
    // NOTE(herchu) As this Status API is calling DataSources API directly, it formats its input
    // to what DataSourcesAPI expects. However, this input is currently not validated, and just
    // passed through all the way to DB! So here we use "transform" and "filter" (as well as
    // language="safe") which are INTERNAL properties, should not be part of the API. This should
    // be translated to whatever schema we use in config APIs when we finish that implementation.
    if (API_F_EXPRESSION in calculated) {
      mappingSource.transform = calculated[API_F_EXPRESSION];
    }
    if (API_F_FILTER in calculated) {
      mappingSource.filter = calculated[API_F_FILTER];
    }
    const dataSourceConfigObject = {
      metadata: {
        // It uses the same id (attributeId, statusId) as the status; and the same scope.
        ...configObject.metadata
      },
      apiVersion: configObject.apiVersion,
      spec: {
        label: API_F_LABEL in calculated ? calculated[API_F_LABEL] : `Calculated Status for [${configObject.metadata.id}]`, // TBD
        source: {
          [FIELD_SOURCE_DERIVED]: mappingSource
        }
      }
    };
    return dataSourceHandler.apply({ configObject: dataSourceConfigObject, user });
  }

  /**
   * Configuration API clear implementation
   */
  clear = async ({ configObject, user }) => {
    if (!configObject.metadata) {
      throw new ValidationError('Configuration object must have metadata');
    }
    const { id } = configObject.metadata;
    // Permissions validation
    if (!await new OroRoles().canAccessSystemElement(
      user._id, 
      RESOURCE_SINGLETONS.DATASOURCES,
      ACCESS_LEVEL_CONFIGURE)) {
      throw new AuthorizationError('Unauthorized');
    }
    await this._robotStatusManager.clearStatusConfig(id);
  }

  /**
   * Lists status definitions configuration objects
   *
   * @returns {array}
   */
  list = async ({ id, user, format = LIST_FORMAT_SHORT }) => {
    // Permissions validations: Unlike most other Config API kinds, this one does NOT require
    // access to a singleton (such as DATASOURCES). Instead, we only require View access to the
    // robots the config objects listed here would include. The reason is that this is not
    // "just" a Config API, but also used by UI widgets (see Fleet Status for Unified Fleet) to
    // display regular dashboards.
    // Then the permissions are checked in two stages: any access to the account, and then
    // filtering for robots/tags with access if there is no access to the entire fleet.
    // The same applies to StatusDefinition kind.
    if (!isSystemUser(user) && // do not validate authorization when using peer api calls
      !await new OroRoles().hasRole(user._id)
    ) {
      throw new AuthorizationError('Unauthorized');
    }
    // Retrieve configs for the scope, filtering by id
    const statusConfigsMap = await this._robotStatusManager.getStatusConfigs();
    const statusConfigs = id ? [statusConfigsMap[id]] : Object.values(statusConfigsMap);
    const dataSourceHandler = this._configApi.getHandler(KIND_DATASOURCE_DEFINITION);
    // in full format, derived attribute definitions associated to a status are included in output
    const dataSources = keyBy(await dataSourceHandler.list({
      id,
      user,
      format: LIST_FORMAT_FULL,
      // include also "hidden" attributes (exactly those that could come from StatusDefinitions)
      includeAll: true
    }), 'metadata.id');
    statusConfigs.forEach((statusConfig) => {
      statusConfig.dataSourceObject = dataSources[statusConfig.attributeId]
    });
    // Transform the output to the right format used for Config as Code lists.
    if (format === LIST_FORMAT_SHORT) {
      return statusConfigs.map(statusConfigToListItem);
    } else if (format === LIST_FORMAT_FULL) {
      return statusConfigs.map(statusConfigToConfigObject);
    } else {
      throw new ValidationError(`Invalid format ${format}`);
    }
  }
}

export {
  configObjectRuleToStatusConfigRule,
  statusConfigRuleToConfigObjectRule
};
