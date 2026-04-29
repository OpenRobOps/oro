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

/* eslint-disable class-methods-use-this */
/* eslint-disable max-classes-per-file */
/**
 * Configuration API implementation for Dashboards
 */
import Validator from 'fastest-validator';
import { pick } from 'lodash';
// ORO modules
import OroRoles from '../roles';
import {
  RESOURCE_SINGLETONS,
  ACCESS_LEVEL_CONFIGURE,
  isSystemUser,
} from '../../shared/roles';
import {
  SchemaError,
  ValidationError,
  AuthorizationError,
  LIST_FORMAT_SHORT,
  LIST_FORMAT_FULL,
  unzipElements,
  zipElementsListAndValues,
} from '../../shared/configAPI';
import DashboardsManager from '../dashboards';
import {
  WIDGET_TYPES_IDS,
  SECTION_SCOPES,
  VITALS_ELEMENT_TYPES,
  WIDGET_TYPE_GROUP,
  CHART_TYPES,
  TIMELINE_CHART_OPS_LIST,
} from '../../lib/uiPreferences';

// Common fields
const F_LABEL = 'label';
// Dashboard fields
const F_ORDER = 'order';
const F_SECTIONS = 'sections';
// Sections fields
const F_SECTION_SCOPE = 'scope';
const F_SECTION_COMMENT = 'comment';
const F_SECTION_WITH_CONTROL_WIDGET = 'withControlWidget';
const F_SECTION_WIDGETS = 'widgets';
// Widgets fields
const F_WIDGET_TYPE = 'type';
const F_WIDGET_CONFIG = 'config';
const F_WIDGET_WIDGETS = 'widgets'; // only used for widget groups
const F_WIDGET_LAYOUT = 'layout';
const F_WIDGET_LAYOUT_CHROMA = 'chroma';
const F_WIDGET_LAYOUT_HEIGHT = 'height';
const F_WIDGET_LAYOUT_GRID = 'grid';
const F_WIDGET_LAYOUT_WITHOUT_BACKGROUND = 'withoutBackground';
const F_WIDGET_DATASOURCES = 'dataSources';
const F_WIDGET_DS_ID = 'id';
const F_WIDGET_DS_PRECISION = 'precision';
const F_WIDGET_DS_UNIT = 'unit';
const F_WIDGET_DS_OP = 'op';
const F_WIDGET_DS_TYPE = 'type';
const F_WIDGET_DS_SCALE = 'scale';
// Specific widget config fields
// - Actions
const F_CONFIG_ACTIONS_BIG_BUTTONS = 'bigButtons';
const F_CONFIG_ACTIONS_EXPANDED = 'expanded';
const F_CONFIG_ACTIONS_ACTION_IDS = 'actionIds';
// - Cameras
const F_CONFIG_CAMERAS_CAMERA_ID = 'cameraId';
// - Fleet Status
const F_CONFIG_FLEET_STATUS_IS_EXPANDED = 'isExpanded';
const F_CONFIG_FLEET_STATUS_STATUSES = 'statuses';
// - Chart
const F_CONFIG_CHART_MIN = 'min';
const F_CONFIG_CHART_MAX = 'max';
const F_CONFIG_CHART_CHARTTYPE = 'chartType';
// Map
const F_CONFIG_MAP_ID = 'mapId';
// Fastest-Validator instance for all schemas in this file (including each widget's config below)
const SchemaValidator = new Validator({ useNewCustomCheckerFunction: true });

/**
 * Custom fastest-validator rule to ensure data source IDs are unique.
 * Validates that the array does not contain duplicate IDs to prevent
 * redundant data sources in a single widget.
 * @param {Array} dataSources - Array of data source objects with 'id' and 'label' properties
 * @param {Array} errors - Array to append validation errors to
 * @returns {boolean} - Returns true if validation passes, false otherwise
 */
export const validateNoDuplicateDataSourceIds = (dataSources, errors) => {
  if (!Array.isArray(dataSources) || dataSources.length === 0) {
    return dataSources;
  }

  // Set to track datasource IDs
  const seenIds = new Set();

  for (const ds of dataSources) {
    if (!ds || !ds[F_WIDGET_DS_ID]) {
      continue; // Skip invalid entries, other validators will handle this
    }

    const dsId = ds[F_WIDGET_DS_ID];

    if (seenIds.has(dsId)) {
      errors.push({
        type: 'duplicateDataSourceId',
        message: `Duplicate datasource '${dsId}' found in the same widget. Each datasource can only be used once per widget.`,
      });
    }

    seenIds.add(dsId);
  }

  return dataSources;
};

// Factory function for widget config converters and validators. Defined below.
let BuildWidgetConfigConverterForType;

// External name for WIDGET_TYPE_GROUP ("__group__", which is ugly to be externalized)
const EXTERNAL_WIDGET_TYPE_GROUP = 'group';

// Schema for *widgets*. Not a top level fastest-validator schema, but instead referenced from
// within Sections schemas. Kept as a separate object and built with Object.assign() as it is
// recursive: widgets can contain groups... that contain widgets.
// See https://github.com/icebob/fastest-validator/pull/34
const WidgetSchema = {};
Object.assign(WidgetSchema, {
  type: 'object',
  strict: true,
  // In addition to all fields (within props) below, we perform a custom validation to make sure
  // that the 'widgets' property can only appear if the type is 'group'.
  // This _could_ be represented as a custom validator for group, but as that one contains the
  // recursive reference to this top level schema, it would be awful or impossible to implement.
  custom: (value, errors) => {
    if (!value) {
      return value; // never crash. Validation should not pass anyway
    }
    if (
      value[F_WIDGET_TYPE] != EXTERNAL_WIDGET_TYPE_GROUP
      && value[F_WIDGET_WIDGETS]
    ) {
      // cannot have widgets
      errors.push({
        type: 'required',
        message: `The '${F_WIDGET_WIDGETS}' field cannot be used in widgets of type '${value[F_WIDGET_TYPE]}'`,
      });
    } else if (
      value[F_WIDGET_TYPE] == EXTERNAL_WIDGET_TYPE_GROUP
      && !value[F_WIDGET_WIDGETS]
    ) {
      // must have widgets
      errors.push({
        type: 'required',
        message: `The '${F_WIDGET_WIDGETS}' field is required for widgets of type ${EXTERNAL_WIDGET_TYPE_GROUP}`,
      });
    }
    return value;
  },
  props: {
    [F_LABEL]: 'string|required',
    [F_WIDGET_TYPE]: {
      type: 'enum',
      // Note that any widget type, including 'group', is allowed. Validation for consistency
      // (ie. a group must also have 'widgets') is done at top level in the custom() rule
      values: [EXTERNAL_WIDGET_TYPE_GROUP, ...Object.values(WIDGET_TYPES_IDS)]
    },
    [F_WIDGET_WIDGETS]: {
      // The widgets property is only allowed on (non)widgets of type "group". The items
      // of this array refer to this schema, recursively
      type: 'array',
      optional: true,
      items: WidgetSchema,
    },
    [F_WIDGET_LAYOUT]: {
      type: 'object',
      optional: true,
      strict: true,
      props: {
        // height: number of rows, or height in px (string)
        [F_WIDGET_LAYOUT_HEIGHT]: ['string|optional', 'number|optional'],
        // grid (width): number of columns, or width in px (string)
        [F_WIDGET_LAYOUT_GRID]: ['string|optional', 'number|optional'],
        [F_WIDGET_LAYOUT_CHROMA]: 'boolean|optional',
        [F_WIDGET_LAYOUT_WITHOUT_BACKGROUND]: 'boolean|optional',
      },
    },
    [F_WIDGET_CONFIG]: {
      // Each widget type has a different `config` object format. We handle those
      // by building a widget validator from this object's F_WIDGET_TYPE, and performing
      // validation recursively on that config (collecting all errors in this functions'
      // `errors` argument).
      type: 'custom',
      optional: true,
      check: (value, errors, schema, name, parent, context) => {
        const converter = BuildWidgetConfigConverterForType(
          parent?.[F_WIDGET_TYPE]
        );
        converter.validate(value, errors, name, context);
        return value;
      },
    }
  },
});

// DashboardDefinition spec used for Config as Code Apply
const DashboardSpecApplySchema = {
  $$strict: true,
  [F_LABEL]: 'string|required',
  [F_ORDER]: 'number|optional',
  [F_SECTIONS]: {
    type: 'array',
    items: {
      type: 'object',
      strict: true,
      props: {
        [F_LABEL]: 'string|required',
        [F_SECTION_SCOPE]: {
          type: 'enum',
          values: Object.values(SECTION_SCOPES),
        },
        [F_SECTION_COMMENT]: 'string|optional',
        [F_SECTION_WITH_CONTROL_WIDGET]: 'boolean|optional',
        [F_SECTION_WIDGETS]: {
          type: 'array',
          items: WidgetSchema,
        },
      },
    },
  },
};
const dashboardSpecValidator = SchemaValidator.compile(
  DashboardSpecApplySchema
);

const dashboardDocToShortConfigObject = doc => ({
  id: doc._id,
  label: doc.label
});

// Dictionary of type-specific widget configuration readers/converters
// NOTE: Built after classes declarations below
let WidgetConfigConvertersByType;

class WidgetConfigConverter {
  constructor(type, sectionScope) {
    this._type = type;
    this._sectionScope = sectionScope;
  }

  // Dictionaty to cache compiled config schemas for each subclass
  static _configSchemaValidators = {};

  // By default, we dont expose any config (which could be experimental/internal)
  configToSpec = (/* config */) => null;

  // By default, we don't allow to input any config in spec; so widget config in DB becomes {}
  specToConfig = (/* spec */) => ({});

  /**
   * Returns a fastest-validator schema to validate configs (of each widget type). Subclasses
   * must reimplement this method and return their own schema.
   * Note that this validators are "schema" validators, not "semantic" validators.
   * Semantic validation is handled by the widget validators in web/imports/server/dashboards.js.
   */
  getConfigSchema = () => ({
    $$strict: true, // and no properties - only empty object is allowed
  });

  /**
   * Validate a the `config` object of a widget. This configuration depends on the widget `type`,
   * so its schema is provided by the subclasses of this class.
   * This method will aggregate validation errors into the `errors` object, by appending the
   * fastest-validator path to this object.
   * Subclasses should not reimplement this method; just provide a getConfigSchema() implementation.
   */
  validate = (config, errors, name, context) => {
    // Get the schema for this widget type. To avoid compiling schemas multiple times,
    // we store them compiled in _configSchemaValidators, by demand as we instantiate subclasses.
    const className = this.constructor.name; // a subclass: e.g. VitalsWidgetConfigValidator
    let validator = WidgetConfigConverter._configSchemaValidators[className];
    if (!validator) {
      validator = SchemaValidator.compile(this.getConfigSchema());
      WidgetConfigConverter._configSchemaValidators[className] = validator;
    }
    // Pass context to validator so custom check functions can access it
    const nestedErrors = validator(config, context);
    if (Array.isArray(nestedErrors)) {
      // Re-surface any problem in the nested config validator, just appending the actual
      // path of this config. Our best attempt to make the error readable
      nestedErrors.forEach(({ message, type }) => (
        errors.push({
          type,
          message: `Bad widget config '${name}': ${message}`,
        })
      ));
    }
    return config;
  };

  getSectionScope = () => this._sectionScope;
}

class UnknownWidgetConfigConverter extends WidgetConfigConverter {
  configToSpec = (config) => {
    console.warn(
      `Unknown widget type ${this._type} in Dashboards ConfigAPI; cannot interpret config`,
      config
    );
    return {};
  };
}

BuildWidgetConfigConverterForType = (type, scope) => {
  if (WidgetConfigConvertersByType[type]) {
    return new WidgetConfigConvertersByType[type](type, scope);
  } else {
    // Don't crash, but create errors in logs. They will not be spammy (only printed in
    // config api calls), and should not crash either
    return new UnknownWidgetConfigConverter(type, scope);
  }
};

class VitalsWidgetConfigConverter extends WidgetConfigConverter {
  configToSpec = config => ({
    // TODO(herchu)
    [F_WIDGET_DATASOURCES]: zipElementsListAndValues(config, [
      F_LABEL,
      F_WIDGET_DS_UNIT,
      F_WIDGET_DS_TYPE,
    ]),
  });

  specToConfig = config => unzipElements(config?.[F_WIDGET_DATASOURCES]);

  getConfigSchema = () => ({
    $$strict: true,
    [F_WIDGET_DATASOURCES]: {
      type: 'array',
      items: {
        type: 'object',
        strict: true,
        props: {
          [F_WIDGET_DS_ID]: { type: 'string', empty: false },
          [F_LABEL]: 'string',
          [F_WIDGET_DS_UNIT]: 'string|optional',
          [F_WIDGET_DS_TYPE]: {
            type: 'enum',
            values: VITALS_ELEMENT_TYPES.map(o => o._id),
          },
        },
      },
      custom: validateNoDuplicateDataSourceIds,
    },
  });
}

class HistoryWidgetConfigConverter extends WidgetConfigConverter {
  configToSpec = config => ({
    [F_WIDGET_DATASOURCES]: zipElementsListAndValues(config, [
      F_LABEL,
      F_WIDGET_DS_TYPE,
    ]),
  });

  specToConfig = config => unzipElements(config?.[F_WIDGET_DATASOURCES]);

  getConfigSchema = () => ({
    $$strict: true,
    [F_WIDGET_DATASOURCES]: {
      type: 'array',
      items: {
        type: 'object',
        strict: true,
        props: {
          [F_WIDGET_DS_ID]: { type: 'string', empty: false },
          [F_LABEL]: 'string',
          [F_WIDGET_DS_TYPE]: 'string',
        },
      },
      custom: validateNoDuplicateDataSourceIds,
    },
  });
}

class ListDataWidgetConfigConverter extends WidgetConfigConverter {
  configToSpec = config => ({
    [F_WIDGET_DATASOURCES]: zipElementsListAndValues(config, [
      F_LABEL,
      F_WIDGET_DS_PRECISION,
      F_WIDGET_DS_TYPE,
      F_WIDGET_DS_UNIT,
    ]),
  });

  specToConfig = config => unzipElements(config?.[F_WIDGET_DATASOURCES]);

  getConfigSchema = () => ({
    $$strict: true,
    [F_WIDGET_DATASOURCES]: {
      type: 'array',
      items: {
        type: 'object',
        strict: true,
        props: {
          [F_WIDGET_DS_ID]: { type: 'string', empty: false },
          [F_LABEL]: 'string',
          [F_WIDGET_DS_PRECISION]: { type: 'number', optional: true },
          [F_WIDGET_DS_TYPE]: 'string',
          [F_WIDGET_DS_UNIT]: { type: 'string', optional: true },
        },
      },
      custom: validateNoDuplicateDataSourceIds,
    },
  });
}

class ChartWidgetConfigConverter extends WidgetConfigConverter {
  configToSpec = (config) => {
    const chartConfig = {
      ...pick(config, [
        F_CONFIG_CHART_MIN,
        F_CONFIG_CHART_MAX,
        F_CONFIG_CHART_CHARTTYPE,
      ]),
    };
    // Filter out min/max if they are empty strings
    // NOTE(lean): this cleanup is needed to support the old format of chart widgets, where
    // min/max were empty strings as previously defined in the default dashboard definitions.
    if (chartConfig[F_CONFIG_CHART_MIN] === '') {
      delete chartConfig[F_CONFIG_CHART_MIN];
    }
    if (chartConfig[F_CONFIG_CHART_MAX] === '') {
      delete chartConfig[F_CONFIG_CHART_MAX];
    }
    const spec = {
      ...chartConfig,
      [F_WIDGET_DATASOURCES]: zipElementsListAndValues(config, [
        F_LABEL,
        F_WIDGET_DS_PRECISION,
        F_WIDGET_DS_SCALE,
        F_WIDGET_DS_OP,
      ]),
    };
    return spec;
  };

  specToConfig = config => ({
    ...pick(config, [
      F_CONFIG_CHART_MIN,
      F_CONFIG_CHART_MAX,
      F_CONFIG_CHART_CHARTTYPE,
    ]),
    ...unzipElements(config?.[F_WIDGET_DATASOURCES]),
    ...(this.getSectionScope() == SECTION_SCOPES.TIME_CAPSULE
      ? { staticTimeOnly: true }
      : {}), // In TimeCapsule, chart widgets get added a
    // 'staticTimeOnly' flag to disable "Live" button
  });

  getConfigSchema = () => ({
    $$strict: true,
    [F_CONFIG_CHART_MIN]: 'number|optional',
    [F_CONFIG_CHART_MAX]: 'number|optional',
    [F_CONFIG_CHART_CHARTTYPE]: {
      type: 'enum',
      values: CHART_TYPES.map(type => type._id),
    },
    [F_WIDGET_DATASOURCES]: {
      type: 'array',
      items: {
        type: 'object',
        strict: true,
        props: {
          [F_WIDGET_DS_ID]: { type: 'string', empty: false },
          [F_LABEL]: 'string',
          [F_WIDGET_DS_PRECISION]: 'number|optional',
          [F_WIDGET_DS_SCALE]: 'number|optional',
          [F_WIDGET_DS_OP]: {
            type: 'enum',
            optional: true,
            values: TIMELINE_CHART_OPS_LIST.map(type => type._id),
          },
        },
      },
      custom: validateNoDuplicateDataSourceIds,
    },
  });
}

class ActionsWidgetConfigConverter extends WidgetConfigConverter {
  configToSpec = config => (
    pick(config, [
      F_CONFIG_ACTIONS_BIG_BUTTONS,
      F_CONFIG_ACTIONS_EXPANDED,
      F_CONFIG_ACTIONS_ACTION_IDS,
    ])
  );

  specToConfig = config => (
    pick(config, [
      F_CONFIG_ACTIONS_BIG_BUTTONS,
      F_CONFIG_ACTIONS_EXPANDED,
      F_CONFIG_ACTIONS_ACTION_IDS,
    ])
  );

  getConfigSchema = () => ({
    $$strict: true,
    [F_CONFIG_ACTIONS_BIG_BUTTONS]: 'boolean|optional',
    [F_CONFIG_ACTIONS_EXPANDED]: 'boolean|optional',
    [F_CONFIG_ACTIONS_ACTION_IDS]: {
      type: 'array',
      optional: true,
      items: 'string',
    },
  });
}

class CameraWidgetConfigConverter extends WidgetConfigConverter {
  configToSpec = config => pick(config, [F_CONFIG_CAMERAS_CAMERA_ID]);

  specToConfig = config => pick(config, [F_CONFIG_CAMERAS_CAMERA_ID]);

  getConfigSchema = () => ({
    $$strict: true,
    [F_CONFIG_CAMERAS_CAMERA_ID]: { type: 'string', empty: false },
  });
}

class MapWidgetConfigConverter extends WidgetConfigConverter {
  configToSpec = config => pick(config, [F_CONFIG_MAP_ID]);

  specToConfig = config => pick(config, [F_CONFIG_MAP_ID]);

  getConfigSchema = () => ({
    $$strict: true,
    [F_CONFIG_MAP_ID]: { type: 'string', optional: true },
  });
}

class FleetStatusWidgetConfigConverter extends WidgetConfigConverter {
  configToSpec = config => ({
    ...pick(config, [F_CONFIG_FLEET_STATUS_IS_EXPANDED]),
    ...(config.elementList // expose "stauses" only if they are configured on this widget
      ? { // (as opposed to using the "old" format of statuses list configured in uiPreferences)
        [F_CONFIG_FLEET_STATUS_STATUSES]: zipElementsListAndValues(
          config,
          [F_LABEL]
        )
      }
      : null)
  });

  specToConfig = config => ({
    ...pick(config, [F_CONFIG_FLEET_STATUS_IS_EXPANDED]),
    ...unzipElements(config?.[F_CONFIG_FLEET_STATUS_STATUSES]),
  });

  getConfigSchema = () => ({
    $$strict: true,
    [F_CONFIG_FLEET_STATUS_IS_EXPANDED]: 'boolean|optional',
    [F_CONFIG_FLEET_STATUS_STATUSES]: {
      type: 'array',
      optional: true,
      items: {
        type: 'object',
        strict: true,
        props: {
          [F_WIDGET_DS_ID]: { type: 'string', empty: false },
          [F_LABEL]: 'string|optional',
        },
      },
      custom: validateNoDuplicateDataSourceIds,
    },
  });
}

WidgetConfigConvertersByType = {
  // Widgets without configs
  [WIDGET_TYPES_IDS.DATA_BAGS]: WidgetConfigConverter,
  [WIDGET_TYPES_IDS.AUDIT_LOG]: WidgetConfigConverter,
  [WIDGET_TYPES_IDS.AUDIT_LOG_FLEET]: WidgetConfigConverter,
  [WIDGET_TYPES_IDS.KEY_VALUES]: WidgetConfigConverter,
  [WIDGET_TYPES_IDS.ROS_DIAGNOSTICS]: WidgetConfigConverter,
  [WIDGET_TYPES_IDS.LOCALIZATION]: MapWidgetConfigConverter,
  // [WIDGET_TYPES_IDS.MISSION_TRACKER]: WidgetConfigConverter,
  // [WIDGET_TYPES_IDS.FLEET_MISSION_TRACKER]: WidgetConfigConverter,
  [WIDGET_TYPES_IDS.INCIDENT_TIMELINE]: WidgetConfigConverter,
  [WIDGET_TYPES_IDS.INCIDENT_LIST]: WidgetConfigConverter,
  [WIDGET_TYPES_IDS.NAVIGATION]: WidgetConfigConverter,
  [WIDGET_TYPES_IDS.LOGS]: WidgetConfigConverter,
  [WIDGET_TYPES_IDS.CUSTOM_DATA_TEXT]: WidgetConfigConverter,
  [WIDGET_TYPES_IDS.CUSTOM_DATA_IMAGE]: WidgetConfigConverter,
  [WIDGET_TYPES_IDS.VITALS]: VitalsWidgetConfigConverter,
  [WIDGET_TYPES_IDS.HISTORY]: HistoryWidgetConfigConverter,
  [WIDGET_TYPES_IDS.LIST_DATA]: ListDataWidgetConfigConverter,
  [WIDGET_TYPES_IDS.CHART]: ChartWidgetConfigConverter,
  [WIDGET_TYPES_IDS.ACTIONS]: ActionsWidgetConfigConverter,
  [WIDGET_TYPES_IDS.CAMERA]: CameraWidgetConfigConverter,
  [WIDGET_TYPES_IDS.FLEET_STATUS]: FleetStatusWidgetConfigConverter,
};

const dashboardWidgetToWidgetSpec = (widget) => {
  const ret = pick(widget, [F_LABEL, F_WIDGET_TYPE]);
  ret[F_WIDGET_LAYOUT] = pick(widget[F_WIDGET_LAYOUT], [
    F_WIDGET_LAYOUT_CHROMA,
    F_WIDGET_LAYOUT_GRID,
    F_WIDGET_LAYOUT_HEIGHT,
    F_WIDGET_LAYOUT_WITHOUT_BACKGROUND,
  ]);
  if (ret[F_WIDGET_TYPE] == WIDGET_TYPE_GROUP) {
    ret[F_WIDGET_TYPE] = EXTERNAL_WIDGET_TYPE_GROUP;
    const widgets = widget[F_WIDGET_WIDGETS];
    ret[F_WIDGET_WIDGETS] = Array.isArray(widgets)
      ? widgets.map(dashboardWidgetToWidgetSpec)
      : [];
  }
  const config = BuildWidgetConfigConverterForType(widget.type).configToSpec(
    widget.config
  );
  if (config) {
    ret.config = config;
  }
  return ret;
};

// Converts from external DashboardDefinition `widgets` field to a db dashboard field value
// The scope of the section that contains is given, as some widgets are configured differently
// depending on the scope they live in.
const widgetSpecToConfigDoc = (widget, scope) => {
  const ret = pick(widget, [F_LABEL, F_WIDGET_TYPE, F_WIDGET_LAYOUT]);
  if (ret[F_WIDGET_TYPE] == EXTERNAL_WIDGET_TYPE_GROUP) {
    ret[F_WIDGET_TYPE] = WIDGET_TYPE_GROUP;
    ret[F_WIDGET_WIDGETS] = widget.widgets.map(w => widgetSpecToConfigDoc(w, scope));
  }
  const config = BuildWidgetConfigConverterForType(
    widget.type,
    scope
  ).specToConfig(widget.config);
  if (config) {
    ret.config = config;
  }
  return ret;
};

// Sections conversion -------------------------------------------------

// Converts the `section` field value from a db dashboard doc into external DashboardDefinition spec
const dashboardSectionToSectionSpec = (section) => {
  const ret = pick(section, [
    F_LABEL,
    F_SECTION_SCOPE,
    F_SECTION_COMMENT,
    F_SECTION_WITH_CONTROL_WIDGET,
  ]);
  ret[F_SECTION_WIDGETS] = (section[F_SECTION_WIDGETS] || []).map(
    dashboardWidgetToWidgetSpec
  );
  return ret;
};

// Converts from external DashboardDefinition `section` field to a db dashboard field value
const sectionSpecToConfigDoc = (sectionSpec) => {
  const ret = pick(sectionSpec, [
    F_LABEL,
    F_SECTION_SCOPE,
    F_SECTION_COMMENT,
    F_SECTION_WITH_CONTROL_WIDGET,
  ]);
  ret[F_SECTION_WIDGETS] = (sectionSpec[F_SECTION_WIDGETS] || []).map(
    widget => widgetSpecToConfigDoc(widget, sectionSpec[F_SECTION_SCOPE])
  );
  return ret;
};

// Dashboards conversion ------------------------------------------------

// Converts a db dashboard doc into external DashboardDefinition spec
const dashboardDocToFullConfigObject = doc => ({
  apiVersion: 'v0.1',
  metadata: {
    id: doc._id,
  },
  spec: {
    order: doc[F_ORDER],
    label: doc[F_LABEL],
    sections: (doc[F_SECTIONS] || []).map(dashboardSectionToSectionSpec),
  },
});

// Converts from external DashboardDefinition spec field to a db dashboard doc
const dashboardSpecToConfigDoc = spec => ({
  ...pick(spec, [F_LABEL, F_ORDER]),
  [F_SECTIONS]: (spec[F_SECTIONS] || []).map(sectionSpecToConfigDoc),
});

export default class DashboardsConfigAPIHandler {
  constructor(configApi, options = {}) {
    const { dashboardsManager = new DashboardsManager() } = options;
    if (!configApi) {
      throw new Error('reference to configApi must be received');
    }
    this._configApi = configApi;
    this._dashboardsManager = dashboardsManager;
  }

  /**
   * Since ids are used for individual config elements, isGlobalConfig returns false
   */
  isGlobalConfig = () => false;

  /**
   * Configuration API Apply implementation for Dashboard definitions
   */
  apply = async ({ configObject, user }) => {
    if (!configObject.metadata) {
      throw new ValidationError('Configuration object must have metadata');
    }
    // Authorization
    const userId = user._id;
    if (
      !isSystemUser(user)
      // do not validate authorization when using peer api calls
      && !await new OroRoles().canAccessSystemElement(
        userId,
        RESOURCE_SINGLETONS.DASHBOARDS,
        ACCESS_LEVEL_CONFIGURE
      )
    ) {
      throw new AuthorizationError('Unauthorized');
    }
    const { spec } = configObject;
    const dashboardId = configObject.metadata.id;
    const mgr = new DashboardsManager();
    if (spec) {
      // Schema validations
      const validation = dashboardSpecValidator(spec);
      if (validation !== true) {
        throw new SchemaError(
          (validation.length && validation[0].message) || 'Invalid schema'
        );
      }
      const dashboardConfig = dashboardSpecToConfigDoc(spec);
      await mgr.updateDashboard({ dashboardId, newDashboardConfig: dashboardConfig });
      // TODO(herchu) handle dashboard visibility
    } else {
      // Null spec means suppress. Not supported in DashboardDefinition so we simply delete it
      await mgr.deleteDashboard({ dashboardId });
    }
  };

  /**
   * Configuration API clear implementation
   */
  clear = async ({ configObject, user }) => {
    const { id: dashboardId } = configObject.metadata;
    // Authorization
    if (
      !isSystemUser(user)
      // do not validate authorization when using peer api calls
      && !await new OroRoles().canAccessSystemElement(
        user._id,
        RESOURCE_SINGLETONS.DASHBOARDS,
        ACCESS_LEVEL_CONFIGURE
      )
    ) {
      throw new AuthorizationError('Unauthorized');
    }
    await new DashboardsManager().deleteDashboard({ dashboardId });
  };

  /**
   * Lists DashboardDefinitions
   *
   * @returns {array}
   */
  list = async ({ id, user, format = LIST_FORMAT_SHORT }) => {
    if (
      !isSystemUser(user)
      // do not validate authorization when using peer api calls
      && !await new OroRoles().canAccessSystemElement(
        user._id,
        RESOURCE_SINGLETONS.DASHBOARDS,
        ACCESS_LEVEL_CONFIGURE
      )
    ) {
      throw new AuthorizationError('Unauthorized');
    }
    // Retrieve configs for the scope, filtering by id
    let dashboards = await this._dashboardsManager.listDashboards();
    if (id) {
      dashboards = dashboards.filter(({ _id }) => _id == id);
    }
    if (format === LIST_FORMAT_SHORT) {
      return dashboards.map(dashboardDocToShortConfigObject);
    } else if (format === LIST_FORMAT_FULL) {
      return dashboards.map(dashboardDocToFullConfigObject);
    } else {
      throw new ValidationError(`Invalid format ${format}`);
    }
  };
}
