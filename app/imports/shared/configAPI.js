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

/* eslint-disable max-classes-per-file */
/**
 * Configuration as code subsystem
 *
 * @see https://docs.google.com/document/d/1lJwxtz8RAJ8qlpX6YivmlUwuPGH6usRALGM1dWuj1o0/edit#heading=h.jls5u3m7r4k5
 */
import { lowerFirst, isObject, pick } from 'lodash';
// ORO modules
import { RESOURCE_TYPES, serializeResourceId, parseResourceId } from './roles';
import { unzipKeyValueList, zipKeyValueList } from '../lib/util';

// Different error classes used in our configuration as code mechanism.
// TODO(herchu) This exceptions are used in managers as well as ConfigAPI. Move to a common file
// so manager do not have to import ConfigAPI modules.
// HACK(herchu) Declaring these classes like `class SomeError extends Error {}` works fine
// ES2015 target and later; but not in current ingest codebase as of May, 2023. Until we upgrade
// our node/babel stack, we add a hack to constructors as described in:
// See https://stackoverflow.com/questions/33870684/why-doesnt-instanceof-work-on-instances-of-error-subclasses-under-babel-node
class AuthorizationError extends Error {
  constructor(msg = 'Unauthorized') {
    super(msg);
    Object.setPrototypeOf(this, AuthorizationError.prototype); // See note above
  }
}
class ValidationError extends Error {
  constructor(msg) {
    super(msg);
    Object.setPrototypeOf(this, ValidationError.prototype); // See note above
  }
}
class SchemaError extends ValidationError {
  constructor(msg) {
    super(msg);
    Object.setPrototypeOf(this, SchemaError.prototype); // See note above
  }
}
class NotImplementedError extends Error {
  constructor(msg) {
    super(msg);
    Object.setPrototypeOf(this, NotImplementedError.prototype); // See note above
  }
}
class NotFoundError extends Error {
  constructor(msg = 'Not found') {
    super(msg);
    Object.setPrototypeOf(this, NotFoundError.prototype); // See note above
  }
}

// Formats supported by the list operation
const LIST_FORMAT_SHORT = 'short';
const LIST_FORMAT_FULL = 'full';
const LIST_FORMAT_OPTIONS = [LIST_FORMAT_SHORT, LIST_FORMAT_FULL];

// Kinds supported by CaC
const KIND_INCIDENT_DEFINITION = 'IncidentDefinition';
const KIND_ROBOT_CAMERA = 'RobotCamera';
const KIND_DATASOURCE_DEFINITION = 'DataSourceDefinition';
const KIND_STATUS_DEFINITION = 'StatusDefinition';
const KIND_ACTION_DEFINITION = 'ActionDefinition';
const KIND_DASHBOARD_DEFINITION = 'DashboardDefinition';
const KIND_MISSION_TRACKING = 'MissionTracking';
const KIND_SPATIAL_ANNOTATION = 'SpatialAnnotation';
const KIND_TRAFFIC_ZONE = 'TrafficZone';
const KIND_TRAFFIC_ZONE_TYPE = 'TrafficZoneType';
const KIND_ROBOT_FOOTPRINT = 'RobotFootprint';
const KIND_PREFERENCES = 'Preferences';
const KIND_SPATIAL_TRANSFORMATION = 'SpatialTransformation';
const KIND_MISSION_SCHEDULE = 'MissionSchedule';
const KIND_KPI_DEFINITION = 'KpiDefinition';
const KIND_NOTIFICATION_CHANNEL_EMAIL = 'NotificationChannel.Email';
const KIND_NOTIFICATION_CHANNEL_GOOGLE_CHAT = 'NotificationChannel.GoogleChat';
const KIND_TEST = 'Test';
const KIND_MODULE_STATE = 'ModuleState';

// This constant is the only valid element id to use in apply() or clear() config calls for
// kinds that represent "singletons", which don't have individual elmeents to configure.
// Example: Mission Tracking.
const CONFIG_API_GLOBAL_ID = 'all';

// Pattern for alphanumeric strings (with only a couple of allowed symbols: '-' and '_')
const ALPHANUMERIC_PATTERN = '[a-zA-Z0-9-_]+';
// Pattern for an alphanumeric id (without anything around it)
const ID_PATTERN = `^${ALPHANUMERIC_PATTERN}$`;

/**
 * Helper function for fastest-validator schemas that builds a
 * (custom validator)[https://www.npmjs.com/package/fastest-validator#custom-validator]
 * for objects that hold an arbitrary number of keys (their number and form are not validated)
 * but whose values must be all the same type, defined by `validator`
 *
 * (This should be supported by fastest-validator, but we did not find how so we do it through
 * a custom validator)
 *
 * NOTE1: This function is not a fastest-schema Validator instance, but a helper function that fits
 *   into their `custom` fields.
 *
 * NOTE2: This function uses a "new", non-default API from FastestValidator library.
 * For this function to work, the validator must be compiled with option
 *   `{ useNewCustomCheckerFunction: true }. See missionTracking or zonesManager for examples.
 *
 * @param {function} validator A fastest-validator schema validator
 * @param {function} keyValidator (optional) A fastest-validator schema validator, used for keys
 * @param {boolean} allowEmpty Whether null/undefined are accepted values
 * @param {string} typeName The type in the errors collected by this validator
 *    (for fastest-validator to generate error messages)
 */
const keyValueObjectValidator = ({
  validator,
  keyValidator = null,
  allowEmpty = true,
  typeName,
}) => {
  const fn = (val, errors) => {
    if (isObject(val)) {
      Object.entries(val).forEach(([key, elem]) => {
        if (keyValidator) { // validate the actual keys (optional)
          const keyValidation = keyValidator(key);
          if (keyValidation !== true) {
            keyValidation.forEach(errors.push, errors);
          }
        }
        const validation = validator(elem);
        if (validation !== true) {
          validation.forEach(errors.push, errors);
        }
      });
    } else if (allowEmpty && (val == null || val === undefined)) {
      // attributes field is missing or null: ignore
    } else {
      errors.push({ type: typeName });
    }
    return val;
  };
  Object.defineProperty(fn, 'name', {
    value: `keyValueValidator(${typeName})`,
    configurable: true
  });
  return fn;
};

// Various schemas. Note that these are used by server/configAPI, but also shared with "peer kind
// api handlers"

// Schema of a configuration object for apply operations
const buildConfigObjectApplySchema = (isExternal = true, allowRoot = false) => ({
  $$strict: true,
  kind: { type: 'string', empty: false, max: 255 },
  apiVersion: { type: 'enum', values: ['v0.1'] },
  metadata: {
    type: 'object',
    props: {
      id: { type: 'string', optional: false, max: 255, pattern: ID_PATTERN },
    }
  },
  // spec is optional. A null spec means that the configuration object was suppressed
  spec: { type: 'object', optional: true },
});

// Schema of a configuration object for clear operations
const buildConfigObjectClearSchema = (isExternal = true) => ({
  $$strict: true,
  kind: { type: 'string', empty: false, max: 255 },
  apiVersion: { type: 'enum', values: ['v0.1'] },
  metadata: {
    type: 'object',
    props: {
      id: { type: 'string', optional: false, max: 255, pattern: ID_PATTERN },
    }
  }
});

// Schema of a configuration object for list operations
const buildListFiltersSchema = (isExternal = true) => ({
  $$strict: true,
  kind: { type: 'string', empty: false, max: 255 },
  id: { type: 'string', optional: true, max: 255, pattern: ID_PATTERN },
  format: { type: 'enum', values: LIST_FORMAT_OPTIONS }
});

/**
 * Helper function for format elements for LIST_FORMAT_SHORT. This is a default implementation,
 * which only lists "label" field (in addition to id, which is mandatory), which is
 * how we normally output all config object Kinds.
 * Kind handlers may or may not use it during list().
 *
 * @param {Object} A Config object with { metadata, spec }
 *
 * @returns {Object} An object with { id, label, suppressed }
 */
const formatConfigObjectForShortOutput = ({ metadata, spec }) => (
  {
    id: metadata.id,
    label: (spec && spec.label) || '',
    suppressed: !spec,
  }
);

/**
 * Converts a list of elements from our config objects of the form `{ elementList, elementValues }`
 * into an array of objects, each with `{ id, ...fields }` where `id` is the element from
 * `elementList` (ie. the key from `elementValues) and the rest of the fields are selected from
 * each object in `elementValues`
 *
 * For example,
 * ```
 *   zipElementsListAndValues({
 *     {
 *       elementList: ['a', 'b'],
 *       elementValues: { b: { label: 'B'}, a: { label: 'A', 'unit': '$' } },
 *     }
 *     ['label', 'unit']
 *   })
 * ```
 * Returns:
 * ```
 * [
 *   { id: 'a', label: 'A' }
 *   { id: 'b', label: 'B', unit: '$' }
 * ]
 * ```
 *
 * @param {Object} config A Config object with { elementList, elementValues }
 * @param {Array} fields A list of fields to select from each of the elementValues keys
 * @returns {Array} List with { id, ...fields }
 */
const zipElementsListAndValues = (config, fields) => (
  zipKeyValueList(config.elementList, config.elementValues)
    .map(({ key, value }) => ({ id: key, ...pick(value, fields) }))
);

/**
 * Converts a list of object with `{ id, ...otherFields }` into an object
 * { elementList, elementValues } as used regularly in our configurations. Each `id` field is
 * used as the element in `elementList` (and the key in `elementValues`).
 *
 * This is the converse function of zipElementsListAndValues.
 *
 * @param {Array} elements
 * @returns {Object} Object with { elementList, elementValues }
 */
const unzipElements = elements => (
  unzipKeyValueList((elements || []).map(({ id, ...object }) => ({ key: id, value: object })))
);

export {
  ValidationError,
  SchemaError,
  AuthorizationError,
  NotImplementedError,
  NotFoundError,
  LIST_FORMAT_SHORT,
  LIST_FORMAT_FULL,
  LIST_FORMAT_OPTIONS,
  KIND_INCIDENT_DEFINITION,
  KIND_ROBOT_CAMERA,
  KIND_DATASOURCE_DEFINITION,
  KIND_STATUS_DEFINITION,
  KIND_ACTION_DEFINITION,
  KIND_DASHBOARD_DEFINITION,
  KIND_MISSION_TRACKING,
  KIND_SPATIAL_ANNOTATION,
  KIND_TRAFFIC_ZONE,
  KIND_TRAFFIC_ZONE_TYPE,
  KIND_ROBOT_FOOTPRINT,
  KIND_PREFERENCES,
  KIND_SPATIAL_TRANSFORMATION,
  KIND_MISSION_SCHEDULE,
  KIND_KPI_DEFINITION,
  KIND_NOTIFICATION_CHANNEL_EMAIL,
  KIND_NOTIFICATION_CHANNEL_GOOGLE_CHAT,
  KIND_TEST,
  KIND_MODULE_STATE,
  keyValueObjectValidator,
  CONFIG_API_GLOBAL_ID,
  ALPHANUMERIC_PATTERN,
  ID_PATTERN,
  buildConfigObjectApplySchema,
  buildConfigObjectClearSchema,
  buildListFiltersSchema,
  formatConfigObjectForShortOutput,
  zipElementsListAndValues,
  unzipElements,
};
