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
 * Configuration API implementation for Data Source Definitions
 */

import Validator from 'fastest-validator';
import { get, pick } from 'lodash';
// InOrbit
import OroRoles from '../roles';
import {
  RESOURCE_SINGLETONS, ACCESS_LEVEL_CONFIGURE, ACCESS_LEVEL_VIEW, parseResourceId, isSystemUser
} from '../../shared/roles';
import {
  ValidationError, AuthorizationError, LIST_FORMAT_SHORT, LIST_FORMAT_FULL,
  SchemaError, KIND_STATUS_DEFINITION,
} from '../../shared/configAPI';
import { buildCleanerFunction, mergeAndCompleteConfigObject } from './validators';
import AttributesManager from '../attributes';
import { API_RESPONSE_FIELD_MESSAGES } from './utils';
import {
  ATTRIBUTE_TYPES, SOURCES, SOURCE_DERIVED_ID
} from '../../shared/attributes';
import { TIMESERIES_FIELD_TYPES } from '../../shared/timeseries';

// These constants match all supported types from SOURCES (shared/attributes.js), specifying the
// field name to use in the api -- which does not always match the constant in our code: in APIs,
// all names are camelCased
const FIELD_SOURCE_KEY_VALUE = 'keyValue';
const FIELD_SOURCE_DERIVED = 'derived';
const FIELD_SOURCE_NETWORK = 'network';
const FIELD_SOURCE_TEXT_FILE = 'textFile';
const FIELD_SOURCE_IMAGE_FILE = 'imageFile';
const FIELD_SOURCE_DISK_USAGE = 'diskUsage';
const FIELD_SOURCE_NETWORK_USAGE = 'networkUsage';
const FIELD_SOURCE_ROS_DIAGNOSTICS = 'rosDiagnostics';
// Not yet implemented: const FIELD_SOURCE_ROS_MONITOR = 'rosMonitor';
// convenience shortcut for the schema below, used for any "optional yet strict object"
// DataSourceDefinition spec used for config as code
const OPTIONAL_STRICT = { type: 'object', optional: true, strict: true };
const DataSourceDefinitionSpecSchema = {
  $$strict: true,
  label: { type: 'string', empty: false, max: 255, optional: true },
  type: { type: 'enum', values: Object.values(ATTRIBUTE_TYPES), optional: true },
  unit: { type: 'string', empty: false, max: 10, optional: true },
  scale: { type: 'number', empty: false, optional: true },
  precision: { type: 'number', empty: false, optional: true },
  timeline: {
    type: 'object',
    strict: true,
    optional: true,
    props: {
      disabled: { type: 'boolean', optional: true },
      // Our DB supports `fieldType` to define timeseries column typing. This is
      // available for users to configure (e.g. to store historical string values).
      fieldType: { type: 'string', optional: true, enum: Object.values(TIMESERIES_FIELD_TYPES) }
      // NOTE(herchu) We also support configuring (in the DB) a `fieldName` to force changing the
      // internal DB field name only as a HACK for backwards compatibility (with existing
      // values that were stored using a different name than the one chosen normally for a field
      // with fieldType='string').
      // *** The `fieldName` field is an unsafe setting and must NOT surface through ***
      // *** this API.  Do not add it! ***
    },
  },
  /*
  NOTE: timeline is still not implemented (Time Series DB)
  timeline: {
    type: 'object',
    strict: true,
    optional: true,
    props: {
      disabled: { type: 'boolean', optional: true },
      // Our DB supports `fieldType` to define timeseries column typing. This is
      // available for users to configure (e.g. to store historical string values).
      fieldType: { type: 'string', optional: true, enum: Object.values(TIMESERIES_FIELD_TYPES) }
      // NOTE(herchu) We also support configuring (in the DB) a `fieldName` to force changing the
      // internal DB field name only as a HACK for backwards compatibility (with existing
      // values that were stored using a different name than the one chosen normally for a field
      // with fieldType='string').
      // *** The `fieldName` field is an unsafe setting and must NOT surface through ***
      // *** this API.  Do not add it! ***
    },
  },*/
  source: {
    ...OPTIONAL_STRICT,
    props: {
      [FIELD_SOURCE_KEY_VALUE]: {
        ...OPTIONAL_STRICT,
        props: {
          key: { type: 'string' },
          topic: { type: 'string', optional: true }
        }
      },
      [FIELD_SOURCE_DERIVED]: {
        ...OPTIONAL_STRICT,
        props: {
          transform: { type: 'string' },
          filter: { type: 'string', optional: true }
        }
      },
      [FIELD_SOURCE_NETWORK]: {
        ...OPTIONAL_STRICT,
        props: {
          interface: { type: 'string' },
          mappingKey: { type: 'string' },
          optionKey: { type: 'string' }
        }
      },
      [FIELD_SOURCE_TEXT_FILE]: {
        ...OPTIONAL_STRICT,
        props: {
          path: { type: 'string' },
        }
      },
      [FIELD_SOURCE_IMAGE_FILE]: {
        ...OPTIONAL_STRICT,
        props: {
          path: { type: 'string' },
        }
      },
      [FIELD_SOURCE_DISK_USAGE]: {
        ...OPTIONAL_STRICT,
        props: {
          partition: { type: 'string' },
        }
      },
      [FIELD_SOURCE_NETWORK_USAGE]: {
        ...OPTIONAL_STRICT,
        props: {
          interface: { type: 'string' },
        }
      },
      [FIELD_SOURCE_ROS_DIAGNOSTICS]: {
        ...OPTIONAL_STRICT,
        props: {
          namespace: { type: 'string' },
          key: { type: 'string' }
        }
      },
    }
  }
};

// Pre-build validator functions
const dataSourceDefinitionSpecValidator = new Validator().compile(DataSourceDefinitionSpecSchema);
// "Cleaner" version of the DataSourceDefinition specs schema, to remove unwanted (internal)
// properties from objects retrieved from our DB (which are not surfaced to end users)
const dataSourceDefinitionSpecCleaner = buildCleanerFunction(DataSourceDefinitionSpecSchema);

/**
 * Translates an datasource definition to the schema used for list items
 * in our config as code API
 */
function dataSourceDefinitionToListItem({ attributeId, definition }) {
  const ret = {
    id: attributeId,
    suppressed: definition === null,
  };
  if (definition && definition.label) {
    ret.label = definition.label;
  }
  return ret;
}

// Helper function to determine which fields for a given source type get projected into the
// external facing config object. They come from the schema to avoid listing them twice in the code
const projectedFieldsForType = (sourceType) => {
  if (!(sourceType in DataSourceDefinitionSpecSchema.source.props)) {
    throw new Error(`sourceType ${sourceType} is not defined in SOURCE_TYPE_TO_CONFIG_FIELD`);
  }
  return Object.keys(DataSourceDefinitionSpecSchema.source.props[sourceType].props);
};
// SOURCE_TYPE_TO_CONFIG_FIELD describes which fields are accepted in the "source" field of a spec,
// and from which attribute source type (from AttributesManager) they map.
const SOURCE_TYPE_TO_CONFIG_FIELD = {
  [SOURCES.KEY_VALUE.value]: FIELD_SOURCE_KEY_VALUE,
  [SOURCES.DERIVED.value]: FIELD_SOURCE_DERIVED,
  [SOURCES.SYSTEM_NET.value]: FIELD_SOURCE_NETWORK,
  [SOURCES.FILE_TEXT.value]: FIELD_SOURCE_TEXT_FILE,
  [SOURCES.FILE_IMAGE.value]: FIELD_SOURCE_IMAGE_FILE,
  [SOURCES.SYSTEM_HDD.value]: FIELD_SOURCE_DISK_USAGE,
  [SOURCES.SYSTEM_NET.value]: FIELD_SOURCE_NETWORK_USAGE,
  [SOURCES.ROS_DIAGNOSTICS.value]: FIELD_SOURCE_ROS_DIAGNOSTICS,
  // TODO(herchu) Enable ROS_MONITOR TYPE when completed (see comment earlier in this file)
  // [SOURCES.ROS_MONITOR.value]: FIELD_SOURCE_ROS_MONITOR
};

/**
 * Transforms the "source" field as input from an API request into the "options" used internally
 * in AttributesManager API calls.
 * For example,
 *  - { keyValue: { key: "abc "} } translates to { source: "key-value", key: "abc" }
 *  - { derived: { transform: "now()"} } translates to { source: "derived", transform: "now()" }
 */
const configSourceToMappingSource = (attributeId, sourceObject) => {
  const [sourceField, ...more] = Object.keys(sourceObject);
  if (!sourceField || more.length) {
    throw new ValidationError('source must contain exactly one key');
  }
  // select the config object part to apply (the `{ key: "" }` from `keyValue: { key... }`)
  const options = sourceObject[sourceField];
  // Determine which fields are accepted and copied to config, by finding the
  // SOURCE_TYPE_TO_CONFIG_FIELD element corresponding to this source type
  const typeEntry = Object.entries(SOURCE_TYPE_TO_CONFIG_FIELD).find(
    ([, fieldName]) => fieldName == sourceField
  );
  if (typeEntry) {
    const [source] = typeEntry; // typeEntry is a [sourceType, ...various fields]
    // HACK(herchu) The `attributeId` field should not be necessary within the "source" object
    // (which lives in attr_mappings). However, parts of the UI (including settings screen,
    // selectors to add data sources to widgets) assume this field exists. It is redundant and
    // error prone, but the DataSources kind handler still sends it to AttributesManager for
    // compatibility with the rest of the code. It should be removed once we know it is not used.
    return { ...options, source, attributeId };
  } else {
    console.warn('Unable to serialize unknown DataSource configuration', sourceObject);
    return {};
  }
};

/**
 * Transforms the value of the mapping part of an attribute definition (from attr_mappings)
 * into the external representation, which appears in the "source" field.
 * For example:
 *  - { source: "key-value", key: "abc" } translates to { keyValue: { key: "abc "} }
 *  - { source: "derived", transform: "now()" } translates to { derived: { transform: "now()"} }
 */
const mappingToConfigSource = (mapping) => {
  // If the mapping has no source, make 'builtin' the default.
  const { source = SOURCES.BUILTIN.value, ...rest } = mapping || {};
  const sourceType = source && SOURCES.FROM_VALUE[source];
  // Source isn't within the known sources.
  if (!sourceType) {
    console.warn('Unknown DataSource source:', source);
    return undefined;
  }
  const configType = SOURCE_TYPE_TO_CONFIG_FIELD[sourceType.value];
  if (sourceType && configType) {
    return {
      [configType]: pick(rest, projectedFieldsForType(configType))
    };
  }
  return undefined; // for unknown types. It will output in the API as with no definition
};

/**
 * Translates an datasource definition from our model to the schema used by
 * the config as code API.
 *
 * @returns {object}
 */
function dataSourceDefinitionToConfigObject({ attributeId, definition = {}, mapping }) {
  const configObject = {
    metadata: {
      id: attributeId,
    },
    apiVersion: 'v0.1'
  };

  if (definition === null) {
    configObject.spec = null;
    return configObject;
  }

  const source = mapping && mappingToConfigSource(mapping);
  if (source) {
    // the 'source' element comes from the "attribute mapping". If it is unknown or badly defined
    // (see sourceToConfig) it returns undefined and the `source` field is then skipped
    definition.source = source;
  }

  // clean any internal property from the attribute spec retrieved from the DB
  configObject.spec = dataSourceDefinitionSpecCleaner(definition);
  return configObject;
}

export default class DataSourcesConfigAPI {
  constructor(configApi, options = {}) {
    const {
      attributesManager = new AttributesManager(),
    } = options;
    this._configApi = configApi;
    this._attributesManager = attributesManager;
  }

  /**
   * Since ids are used for individual config elements, isGlobalConfig returns false
   */
  // eslint-disable-next-line class-methods-use-this
  isGlobalConfig = () => false;

  /**
   * Configuration API Apply implementation for data source definitions
   */
  apply = async ({ configObject, user }) => {
    if (!configObject.metadata) {
      throw new ValidationError('Configuration object must have metadata');
    }
    // Permissions validations: require access to the data source singleton
    // and configure access to the whole fleet
    // TODO: It should be possible to grant access to the data source
    // singleton at the tag or robot level, but currently our roles implementation
    // does not support that.
    if (!isSystemUser(user) && ( // do not validate authorization when using peer api calls
      (!await new OroRoles().canAccessSystemElement(
        user._id,
        RESOURCE_SINGLETONS.DATASOURCES,
        ACCESS_LEVEL_CONFIGURE
      ))
    )) {
      throw new AuthorizationError('Unauthorized');
    }

    const { spec } = configObject;
    const attributeId = configObject.metadata.id;

    const warningMessages = [];
    if (spec) {
      // Schema validations (note: the following Validator also appends defaults values)
      const validation = dataSourceDefinitionSpecValidator(spec);
      if (validation !== true) {
        throw new SchemaError((validation.length && validation[0].message) || 'Invalid schema');
      }
      const { source, ...definition } = spec;
      let options;
      if (source) {
        options = {
          // Since the only module from AttributesManager that can be configured from the config API
          // is the source (mapping), we only create `source` field here. In the future we may
          // also add `ui`, `status` or other options.
          source: configSourceToMappingSource(attributeId, source)
        };
      }
      await this._attributesManager.updateAttribute({
        attributeId,
        definition,
        options,
        allowAllFields: true
      });
      return warningMessages.length ? { [API_RESPONSE_FIELD_MESSAGES]: warningMessages } : null;
    } else {
      // Null spec means supress
      // (Elvio): we use "propagate: true" because we want the statuses and
      // the incidents related to the data sources to be deleted
      await this._attributesManager.suppressAttribute({
        attributeId,
        propagate: true,
        user
      });
    }
    return {};
  };

  /**
   * Configuration API Clear implementation for data sources
   */
  clear = async ({ configObject, user }) => {
    if (!configObject.metadata) {
      throw new ValidationError('Configuration object must have metadata');
    }
    // Permissions validations: require access to the data source singleton
    // and configure access to the whole fleet
    // TODO: It should be possible to grant access to the data source
    // singleton at the tag or robot level, but currently our roles implementation
    // does not support that.
    if (!isSystemUser(user) && !await new OroRoles().canAccessSystemElement(
      user._id,
      RESOURCE_SINGLETONS.DATASOURCES,
      ACCESS_LEVEL_CONFIGURE
    )) {
      throw new AuthorizationError('Unauthorized');
    }
    const { id: attributeId } = configObject.metadata;
    await this._attributesManager.clearAttribute(attributeId, true);
  };

  /**
   * Lists datasource definitions configuration objects
   *
   * @returns {array}
   */
  list = async ({ id, user, format = LIST_FORMAT_SHORT, includeAll = false }) => {
    if (!isSystemUser(user) // do not validate authorization when using peer api calls
      && !await new OroRoles().hasRole(user._id)) {
      throw new AuthorizationError('Unauthorized');
    }
    // Retrieve configs, filtering by id
    const allDataSourceDefs = await this._attributesManager.findAttributeDefinitions({ id });
    // Filter out data sources created automatically from calculated statuses ("hidden").
    // See filterHiddenDataSources() for details.
    const dataSourceDefs = !includeAll
      ? await this.filterHiddenDataSources(allDataSourceDefs, user)
      : allDataSourceDefs;
    // Transform the output to the right format used for Config as Code lists.
    if (format === LIST_FORMAT_SHORT) {
      return dataSourceDefs.map(dataSourceDefinitionToListItem);
    } else if (format === LIST_FORMAT_FULL) {
      return dataSourceDefs.map(dataSourceDefinitionToConfigObject);
    } else {
      throw new ValidationError(`Invalid format ${format}`);
    }
  };

  /**
   * Given a list of DataSourceDefinitions retrieved by user `user`
   * it filters out those that should be hidden from users.
   * Currently, this means hiding those data sources created as byproduct of creating
   * "advanced" status definitions (those with a `calculated` field). Only those DataSources
   * defined as *derived*, and with a corresponding status at the exact same `id`
   * are hidden.
   *
   * NOTE(herchu) In the future this definition might change; for example the link between a
   * status and its attribute (DataSourceDefinition) could be make explicit via an id, or we could
   * introduce new "hidden" types of data sources. Let us keep all logic for hiding data sources in
   * the same place.
   *
   * @param {array} dataSourceDefinitions A list of data sources with { id, mapping } to
   *   filter.
   * @param {object} user Current user listing the objects (for access control)
   *
   * @returns {array} A subset of dataSourceDefinitions; filtering those that are not hidden
   *   to users. (See definition above)
   */
  filterHiddenDataSources = async (dataSourceDefinitions, user) => {
    const statusHandler = this._configApi.getHandler(KIND_STATUS_DEFINITION);
    // Obtain the list of all statuses. Only ids are important; just to know they exist
    const statuses = [] // TODO: await statusHandler.list({ user, format: LIST_FORMAT_SHORT });
    return dataSourceDefinitions.filter((ds) => {
      const mappingSource = get(ds, 'mapping.source');
      if (mappingSource == SOURCE_DERIVED_ID) { // only for derived DSs, check if a status exists
        return !statuses.find(status => (
          status.id == ds.id && !status.suppressed
        ));
      } else {
        return true;
      }
    });
  };
}

export {
  FIELD_SOURCE_KEY_VALUE,
  FIELD_SOURCE_DERIVED,
  FIELD_SOURCE_NETWORK,
  FIELD_SOURCE_TEXT_FILE,
  FIELD_SOURCE_IMAGE_FILE,
  FIELD_SOURCE_DISK_USAGE,
  FIELD_SOURCE_NETWORK_USAGE,
  FIELD_SOURCE_ROS_DIAGNOSTICS
};
