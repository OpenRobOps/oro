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
 * Shared functions and constants for timeseries service.
 *
 * This module is meant to be shareable by app-servers and ingest codebases.
 * Adding it to ingest for faster development in the first versions.
 */
import { isString } from 'lodash';
import FastestValidator from 'fastest-validator';

// Field names in configuration objects
const TIMESERIES_FIELD = 'timeline';
const TIMESERIES_FIELD_DISABLED = 'disabled';
const TIMESERIES_FIELD_FIELDNAME = 'fieldName';
const TIMESERIES_FIELD_FIELDTYPE = 'fieldType';
const TIMESERIES_FIELD_PRECISION = 'fieldPrecision';

// Types stored in timeseries db by our implementation
const TIMESERIES_FIELD_TYPES = {
  STRING: 'string',
  NUMBER: 'number',
  BOOLEAN: 'boolean'
};
const VALID_TIMESERIES_FIELD_TYPES_SET = new Set(Object.values(TIMESERIES_FIELD_TYPES));

/**
 * Schema for validating the `timeline` part of an attribute definition.
 * (It's currently not enforced, but the validator is provided)
 */
const TimeseriesFieldConfigSchema = {
  $$strict: true,
  [TIMESERIES_FIELD_FIELDTYPE]: {
    type: 'enum',
    optional: true,
    values: Object.values(TIMESERIES_FIELD_TYPES)
  },
  [TIMESERIES_FIELD_FIELDNAME]: {
    type: 'string',
    optional: true,
    empty: false
  },
  [TIMESERIES_FIELD_DISABLED]: {
    type: 'boolean',
    optional: true,
  }
};
const TimeseriesFieldConfigValidator = new FastestValidator().compile(TimeseriesFieldConfigSchema);

/**
 * TimeseriesFieldConfig represent the configuration for storage of an attribute in our time series
 * db. It applies to data stored in "telemetry" tables, ie. values reported by the robot.
 *
 * This configuration is represented in the `timeline` element of an attribute within
 * AttributeDefinitions collection.
 *
 * See design for this configuration:
 * https://docs.google.com/document/d/1qvFTAHhczRDm1fMaELqmqk3cCT79dPjVC4gIcoqLkZ8/edit#heading=h.l8oj6ft5l7ks
 */
class TimeseriesFieldConfig {
  constructor(attributeId, cfg) {
    if (!isString(attributeId)) {
      throw new Error('attributeId must be a string');
    }
    this._attributeId = attributeId;
    // There are no checks on `cfg`, it can be null or empty (those ARE expected values)
    // Null would mean "no timeseries storage", and empty is "storage with defaut values"
    this._cfg = cfg;
  }

  /**
   * Returns the id of the attribute this configuration represents.
   */
  getAttributeId = () => this._attributeId;

  /**
   * Tells if an data source whose `timeline` (timeseries) config is this object is enabled for
   * storing in timeseries db. Any object (even empty) within `timeline` enabled is, except if there
   * is a boolean flag enabled=false;
   */
  isEnabled = () => {
    if (!this._cfg) {
      return false;
    } else {
      return (TIMESERIES_FIELD_DISABLED in this._cfg)
        ? !this._cfg[TIMESERIES_FIELD_DISABLED]
        : true;
    }
  };

  /**
   * Returns the timeseries type (number, string or boolean) assumed for all data to be stored
   * for this attribute (data source).
   * If the type is not explicitly configured, it defaults to 'number',
   * TIMESERIES_FIELD_TYPES.NUMBER.
   */
  getFieldType = () => (
    (this._cfg && VALID_TIMESERIES_FIELD_TYPES_SET.has(this._cfg[TIMESERIES_FIELD_FIELDTYPE]))
      ? this._cfg[TIMESERIES_FIELD_FIELDTYPE]
      : TIMESERIES_FIELD_TYPES.NUMBER
  );

  /**
   * Returns the precision that must be used for fields of type NUMBER or when
   * persisting objects in JSON for this attribute (data source).
   * If the precision is not explicitly configured, it defaults to infinite, preserving
   * all decimal digits.
   */
  getFieldPrecision = () => this._cfg && this._cfg[TIMESERIES_FIELD_PRECISION];

  /**
   * Returns the field name to use when storing this attribute in timeseries db.
   * The field name can be explicitly configured (by InOrbit, not by customers) in the config,
   * or otherwise it defaults to the attributeId plus an optional suffix (".str", ".bool") to
   * separate data types into different timeseries fields.
   * (Data from multiple types cannot coexist in the some timeseries column, see design doc).
   */
  getFieldName = () => {
    // Left for compatibility with previous codebase. 
    // In TigerData we change the name of the field with a type suffix.
    return this._cfg?.[TIMESERIES_FIELD_FIELDNAME] || this._attributeId;
  };
}

export {
  // config field and objects
  TimeseriesFieldConfig,
  TimeseriesFieldConfigValidator,
  TIMESERIES_FIELD_TYPES,
  TIMESERIES_FIELD,
  // These fields names are exported for compatibility and while we migrate existing code,
  // but we should attempt to use TimeseriesFieldConfig instead
  TIMESERIES_FIELD_DISABLED,
  TIMESERIES_FIELD_FIELDTYPE,
  TIMESERIES_FIELD_FIELDNAME
};
