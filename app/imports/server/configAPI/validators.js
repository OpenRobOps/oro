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
 * Helper functions for common fastest-validator schema helpers.
 */
import { isObject, cloneDeep, set, get } from 'lodash';
import Validator from 'fastest-validator';

/**
 * Given a fastest-validator schema, it creates a copy of it turning each "strict" object flag
 * into a "remove" one.
 *
 * We create these schemas not to validate user input, but to clean (sanitize) internal DB
 * objects before returning them to users in the Config APIs.
 */
const buildCleanerSchema = (fastestValidatorSchema) => {
  // aux function to recurse into sub-objects changing every `strict: true` by `strict: remove`
  // (except the top level object, whose fastest-validator syntax is `$$strict: true`)
  const recursiveClean = (schema, isTopLevelSchema) => {
    Object.entries(schema).forEach(([key, value]) => {
      const strictKeyName = isTopLevelSchema ? '$$strict' : 'strict';
      if (key == strictKeyName && value == true) {
        schema[key] = 'remove';
      }
      if (isObject(value)) {
        recursiveClean(value, false);
      }
    });
  };
  const schemaCopy = cloneDeep(fastestValidatorSchema);
  recursiveClean(schemaCopy, true);
  return schemaCopy;
};


/**
 * Given a fastest-validator schema, it creates a "cleaner" version of it by turning each "strict"
 * object flag into a "remove" one. It returns a function that will clean objects to conform
 * to the original schema.
 *
 * This function is just a convenience wrapper over buildCleanerSchema and compiling the
 * resulting schema as a function.
 *
 * @return a function that takes objects, clones them and return a new version with unwanted
 *         properties removed.
 */
const buildCleanerFunction = (schema, validator = new Validator()) => {
  // Compile the schema. Do this only once and return a cleaner function that can be reused
  const cleanerFn = validator.compile(buildCleanerSchema(schema));
  return (config) => {
    const cloned = cloneDeep(config); // clone the object for convenience
    cleanerFn(cloned); // side effect is cleaning unwanted keys
    return cloned;
  };
};

/**
 * Given a Config API `schema` from fastest-validator and an `spec` (assumed to be already
 * validated with the same schema), it fills all missing top-level fields with `undefined` values.
 * The spec object is modified _in place_ (and returned).
 *
 * This is done to make sure existing values (for every property allowed in the schema)
 * are cleaned from the DBs when a config is applied, if they are not passed as input in a apply()
 * operation. This functionality is tied to our ConfigManager, that treats `undefined` values
 * not as values to be stored, but as fields to be "unset".
 *
 * Example:
 *    schema = { label: "string", unit: "string" }
 *    spec = { label: "a" }
 * completeMissingFieldsWithUndefined(spec, schema) = { label: "a", unit: undefined }
 *
 * Implementation note: We could use a similar trick as buildCleanerSchema and the built-in
 * "default" functionality from fastest-validator library; but it does no thandle `undefined`
 * values. Alternatively, using `() => undefined` dynamic default value generators could work
 * but they are only present in most recent version of the library, and did not work either on
 * our testing.
 *
 * @param schema A fastest-validator schema, to be modified appending default values.
 * @param object An input config spec
 */
const completeMissingFieldsWithUndefined = (config, schema) => {
  Object.keys(schema).forEach((key) => {
    // Skip properties starting with '$' (fastest-validator modifiers), and append `undefined`
    // values for every key missing in `spec`
    if (key[0] != '$' && !(key in config)) {
      config[key] = undefined;
    }
  });
  return config;
};

/**
 * Given a configuration object `config` and a fastest-validator function `validator`, it collects
 * all paths present in `config` that are not allowed in the schema validated by `validator`.
 *
 * For example, if `validator` is the compiled schema for
 * ```
 *   {
 *      $$strict: true,
 *      name: "string",
 *      address: {
 *        type: "object",
 *        strict: true,
 *        props: {
 *          street: "string",
 *          city: "string"
 *        }
 *      }
 *   }
 * ```
 * and
 * ```
 * config = {
 *   name: 'foo',
 *   address: {
 *     street: 100, // invalid (a number, not a string)
 *     city: 'Mountain View',
 *     zipCode: 94040, // Not in schema
 *   },
 *   age: 42 // Not in schema
 * }
 * ```
 * It returns the "offending" paths as `['age', 'address.zipCode']`.
 * Note that fields that do not pass validations for other reasons than *not being in the schema*
 * (e.g. bad type, ranges, etc.) are ignored in this function.
 *
 * We use this function to decide which fields in an existing config are considered "internal",
 * not to be modified through an API given its schema.
 *
 * @param {object} config a configuration object to validate
 * @param {function} validator a fastest-schema compiled validator
 * @returns {array} A list of paths from `config` that are not present in `validator`
 */
const collectOffendingPaths = (config, validator) => {
  const res = config && validator(config); // returns an array if there are errors
  const errorPaths = [];
  if (Array.isArray(res)) {
    res.forEach(({ type, field, actual }) => {
      // each fastest-validator error contains { type, field, actual, expected, message }
      // We don't care about the formatted message or the expected fields, but will use:
      //  - type: if "objectStrict", meaning a key not expected in an object
      //  - field: path to where it is located (undefined if top lveel)
      //  - actual: the name of the offending key
      if (type == 'objectStrict') {
        errorPaths.push((field ? field + '.' : '') + actual);
      }
    });
  }
  return errorPaths;
};


/**
 * Merges two objects in place over `config`, assigning to it values taken from an object
 * `valuesObject` for every key listed in `paths`.
 *
 * NOTE: This function is similar to lodash assign(), but that one does not merge objects
 *
 * @param {object} config A configuration object where values will be set (in place)
 * @param {array} keys A list of strings, with paths to pick values from valuesObject
 * @param {object} valuesObject An object with existing values, to pick
 */
const multiSetByKeys = (config, paths, valuesObject = {}) => {
  paths.forEach(path => set(config, path, get(valuesObject, path)));
};

/**
 * Given configuration object `config` about to be persisted, and an existing configuration
 * object (assumed to come from a DB) `existingConfig`, it merges both in place (over `config`)
 * so that the resulting object contains also any values that are not in the schema
 * validated by `validator`.
 *
 * For example, if `validator` is the compiled schema for
 * ```
 *   {
 *      $$strict: true,
 *      name: "string",
 *      address: {
 *        type: "object",
 *        strict: true,
 *        props: {
 *          street: "string",
 *          city: "string"
 *        }
 *      }
 *   }
 * ```
 * and
 * ```
 * config = {
 *   name: 'foo',
 *   address: {
 *     street: 100, // invalid (a number, not a string), but this error is not checked here
 *     city: 'Mountain View',
 *   }
 * }
 * existingConfig = {
 *   name: 'bar',
 *   address: {
 *     city: 'San Jose',
 *     zipCode: 95008, // Not in schema
 *   },
 *   age: 42 // Not in schema
 * }
 * ```
 * Then config is modified resulting in:
 * ```
 * config = { // modified!
 *   name: 'foo',
 *   address: {
 *     street: 100, // invalid (a number, not a string)
 *     city: 'Mountain View',
 *     zipCode: 95008, // Not in schema, so it's preserved
 *   },
 *   age: 42 // Not in schema, so it's preserved
 * }
 * ```
 *
 * We use this function to preserve existing configuration values for "internal" fields, which
 * are not surfaced in APIs.
 *
 * @param {object} config A new configuration object about to be persisted. Modified in place
 * @param {object} existingConfig An existing configuration object about to be overwritten
 * @param {function} validator a fastest-schema compiled validator
 */
const mergeWithExistingConfig = (config, existingConfig, validator) => {
  const internalKeys = collectOffendingPaths(existingConfig, validator);
  multiSetByKeys(config, internalKeys, existingConfig);
};

/**
 * This is a very specific function used at the end of apply() steps in ConfigAPI kind handlers,
 * it just runs through two steps:
 *  1. Merges a config object `config` with an existing `existingConfig`, preserving from the
 *     existing configuration ONLY those properties not in the `schema` object (a fastest-validator
 *     function, already compiled). See mergeWithExistingConfig()
 *  2. Completes any missing fields present in  `schema` (the fastest-validator schema object,
 *     not compiled) with `undefined`, so they are cleared when calling setEntityConfig().
 *     This corresponds to mergeWithExistingConfig()
 *
 * Note that `validator` should correspond to the "compiled" version of the `schema` object.
 * @see mergeWithExistingConfig
 * @see completeMissingFieldsWithUndefined
 */
const mergeAndCompleteConfigObject = (config, existingConfig, schema, validator) => {
  mergeWithExistingConfig(config, existingConfig, validator);
  completeMissingFieldsWithUndefined(config, schema);
};

/**
 * Validates that only of the specified fields is provided
 *
 * Example where the user can provide a mission definition id or a definition object:
 *  const MyValidatorSchema = {
 *    $$strict: true,
 *    missionDefinitionId: 'string|optional',
 *    missionDefinition: {
 *      type: 'object',
 *      blackbox: true,
 *      optional: true,
 *      empty: false,
 *      custom: exactlyOneOf(['missionDefinitionId', 'missionDefinition'])
 *    }
 *  };
 *  const MyValidator = new FastestValidator({
 *    useNewCustomCheckerFunction: true,
 *  }).compile(MyValidatorSchema);
 *
 * @param {array} mutuallyExclusiveFields List of field names
 * @returns {function} Function that can be used for fasters-validator custom rules
 */
const exactlyOneOf = (mutuallyExclusiveFields) => {
  const validatorFn = (value, errors, schema, name, parent, context) => {
    const { data } = context;
    if (!data || mutuallyExclusiveFields.length < 2) {
      return value;
    }
    const values = mutuallyExclusiveFields.map(k => data[k]);
    const fieldsList = mutuallyExclusiveFields.reduce((res, k, i) => [res, k].join(
      i === mutuallyExclusiveFields.length - 1 ? ' or ' : ', '
    ));
    if (values.every(v => v === undefined)) {
      errors.push({ message: `One of ${fieldsList} must be specified.` });
    }
    if (values.filter(v => v !== undefined).length > 1) {
      errors.push({ message: `Only one of ${fieldsList} must be specified.` });
    }
    return value;
  };
  return validatorFn;
};

export {
  buildCleanerSchema,
  buildCleanerFunction,
  completeMissingFieldsWithUndefined,
  collectOffendingPaths,
  mergeWithExistingConfig,
  mergeAndCompleteConfigObject,
  exactlyOneOf
};
