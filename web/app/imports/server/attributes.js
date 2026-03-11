/**
 * Attribute Manager, Application-server side.
 *
 * Handle of all robot attributes.
 * It includes the listing of all known (system wide, builtin) attributes like CPU, battery,
 * etc., and define how they map from different sources.
 *
 * Attributes can be built in (only some of them are) or are defined to be fed from a source:
 * key-value pairs or ros-diagnostics are currently implemented.
 *
 * Defining an attribute and/or its mappings also propagates to other modules such as:
 *  - status (to refresh a robot status based on attribute values),
 *  - timeline (to send data to timeseries for time-series querying),
 *  - customData, agentlet states (to enable collecting key-values or diagnostics)
 *
 * The Application Server-side responsibility is on the management of definitions.
 * The ingest service takes care of processing and distributing attribute value
 * updates.
 */
import { Meteor } from 'meteor/meteor';
import { isEqual } from 'lodash';
// ORO modules
import { STATUS } from '../lib/status';
import RobotStatusManager from './status';
import { ID_UNIQUE } from '../shared/constants';
import { applyDefaults, assignIfDistinct } from '../lib/util';
import OroRoles from './roles';
import {
  VITAL_CPU_LOAD_PERCENTAGE,
  VITAL_RAM_USAGE_PERCENTAGE,
  VITAL_DISK_USAGE_PERCENTAGE,
  VITAL_AGENT_DISK_USAGE_PERCENTAGE,
  VITAL_AGENT_DISK_USAGE_MB,
  VITAL_NET_TOTAL_TX_RATE,
  VITAL_NET_TOTAL_RX_RATE,
  VITAL_NET_TOTAL_RATE,
  VITAL_NET_ORO_TX_RATE,
  VITAL_NET_ORO_RX_RATE,
  VITAL_NET_ORO_RATE,
  VITAL_NET_TOTAL_TX_BYTES,
  VITAL_NET_TOTAL_RX_BYTES,
  VITAL_NET_ORO_TX_BYTES,
  VITAL_NET_ORO_RX_BYTES,
  VITAL_SPEED_LINEAR,
  VITAL_SPEED_ANGULAR,
  VITAL_DISTANCE_LINEAR,
  VITAL_DISTANCE_LINEAR_SINCE,
  VITAL_DISTANCE_ANGULAR,
  VITAL_DISTANCE_ANGULAR_SINCE,
  VITAL_ROS_MASTER_STATUS,
  VITAL_PING_RTT_AVG,
  VITAL_PING_RTT_LAST,
  VITAL_ONLINE,
  VITAL_AGENT_VERSION,
  TMP_VITAL_ROS_DIAGNOSTICS,
  VITAL_ROS_DIAGNOSTICS_STATUS,
  VITAL_POSE,
  VITAL_GPSFIX,
  SOURCES,
  ATTRIBUTE_TYPES
} from '../shared/attributes';
import {
  AttributeDefinitions,
  AttributeMappings,
  queryRobotAttributeValues,
} from '../lib/attributes';
// import { AlertsConfig } from '../lib/alerts';
import {
  RESOURCE_SINGLETONS, ACCESS_LEVEL_VIEW, ACCESS_LEVEL_CONFIGURE
} from '../shared/roles';
// import { Robot } from './model';
// import { publishSingleDocumentFromFunction } from './lib/publicationsHelpers';
// import { TIMESERIES_FIELD, TimeseriesFieldConfig } from '../shared/timeseries';
import { listAttributeUIFields } from '../lib/uiPreferences';

// All builtin attribute definitions to be used when
// configuring them for the system
const VITAL_DEFAULT_DEFINITIONS = {
  [VITAL_CPU_LOAD_PERCENTAGE]: {
    unit: '%',
    label: 'CPU usage',
    precision: 1,
    timeline: {
      collection: 'robot_stats' // field equals matches attrId
    }
  },
  [VITAL_RAM_USAGE_PERCENTAGE]: {
    unit: '%',
    label: 'RAM usage',
    precision: 1
  },
  [VITAL_DISK_USAGE_PERCENTAGE]: {
    unit: '%',
    label: 'Disk usage',
    precision: 1,
    timeline: {
      collection: 'robot_stats',
      field: 'hddUsagePercentage'
    }
  },
  [VITAL_AGENT_DISK_USAGE_PERCENTAGE]: {
    unit: '%',
    label: 'InOrbit disk usage (%)',
    precision: 1,
    internal: true,
    timeline: {
      collection: 'robot_stats',
      field: 'inorbitHddUsagePercentage'
    }
  },
  [VITAL_AGENT_DISK_USAGE_MB]: {
    unit: 'Mb',
    label: 'InOrbit disk usage (Mb)',
    precision: 0,
    internal: true,
    timeline: {
      collection: 'robot_stats',
      field: 'inorbitHddUsageMb'
    }
  },
  [VITAL_NET_TOTAL_TX_RATE]: {
    unit: 'kB/s',
    label: 'Network upload rate',
    precision: 0,
    internal: true
  },
  [VITAL_NET_TOTAL_RX_RATE]: {
    unit: 'kB/s',
    label: 'Network download rate',
    precision: 0,
    internal: true
  },
  [VITAL_NET_TOTAL_RATE]: {
    unit: 'kB/s',
    label: 'Network rate',
    precision: 0
  },
  [VITAL_NET_ORO_TX_RATE]: {
    unit: 'kB/s',
    label: 'InOrbit upload rate',
    precision: 0,
    internal: true
  },
  [VITAL_NET_ORO_RX_RATE]: {
    unit: 'kB/s',
    label: 'InOrbit download rate',
    precision: 0,
    internal: true
  },
  [VITAL_NET_ORO_RATE]: {
    unit: 'kB/s',
    label: 'InOrbit network rate',
    precision: 0,
    internal: true
  },
  [VITAL_NET_TOTAL_TX_BYTES]: {
    unit: 'bytes',
    label: 'Network upload',
    precision: 0,
    internal: true,
    timeline: {
      collection: 'robot_stats',
      field: 'totalTx'
    }
  },
  [VITAL_NET_TOTAL_RX_BYTES]: {
    unit: 'bytes',
    label: 'Network download',
    precision: 0,
    internal: true,
    timeline: {
      collection: 'robot_stats',
      field: 'totalRx'
    }
  },
  [VITAL_NET_ORO_TX_BYTES]: {
    unit: 'bytes',
    label: 'InOrbit network upload',
    precision: 0,
    internal: true,
    timeline: {
      collection: 'robot_stats',
      field: 'inorbitTx'
    }
  },
  [VITAL_NET_ORO_RX_BYTES]: {
    unit: 'bytes',
    label: 'InOrbit network download',
    precision: 0,
    internal: true,
    timeline: {
      collection: 'robot_stats',
      field: 'inorbitRx'
    }
  },
  [VITAL_SPEED_LINEAR]: {
    unit: 'm/s',
    label: 'Linear speed',
    precision: 3,
    internal: true
  },
  [VITAL_SPEED_ANGULAR]: {
    unit: 'rad/s',
    label: 'Angular speed',
    precision: 3,
    internal: true
  },
  [VITAL_DISTANCE_LINEAR]: {
    unit: 'm',
    label: 'Linear distance',
    precision: 3,
    timeline: {
      field: 'distanceLinear'
    }
  },
  [VITAL_DISTANCE_LINEAR_SINCE]: {
    unit: 'm',
    label: 'Accumulated linear distance',
    precision: 3,
    internal: true
  },
  [VITAL_ROS_MASTER_STATUS]: {
    label: 'ROS Status'
  },
  [VITAL_ONLINE]: {
    label: 'Online',
    internal: true
  },
  [VITAL_AGENT_VERSION]: {
    label: 'Agent version',
    internal: true
  },
  [VITAL_PING_RTT_AVG]: {
    label: 'Averaged Ping Time',
    unit: 'ms',
    internal: true
  },
  [VITAL_PING_RTT_LAST]: {
    label: 'Raw Ping Time',
    unit: 'ms',
    internal: true
  },
  [VITAL_POSE]: {
    label: 'Robot Pose',
    type: ATTRIBUTE_TYPES.JSON,
    internal: true
  },
  [VITAL_GPSFIX]: {
    label: 'GPS Fix',
    type: ATTRIBUTE_TYPES.JSON,
    internal: true
  },
  [TMP_VITAL_ROS_DIAGNOSTICS]: {
    label: 'ROS Diagnostics - legacy'
  },
  [VITAL_ROS_DIAGNOSTICS_STATUS]: {
    label: 'ROS Diagnostics'
  },
};

let instance;
class AttributesManager {
  constructor() {
    // Singleton pattern
    if (instance === undefined) {
      instance = this;
      // TODO(herchu) this code is duplicated in; consider moving to a superclass/interface
      this._configListenerCallbacks = [];

      // Meteor methods to add, edit or remove attributes and mappings
      Meteor.methods({
        'attributes.getValues': this._meteorGetValues,
      });
    }
    // eslint-disable-next-line no-constructor-return
    return instance;
  }

  /**
   * Initializes the attributes manager.
   */
  init = async () => {
    this._attrDefsColl = AttributeDefinitions;
    await this._addDefaults();
  };

  _addDefaults = async () => {
    console.log('AttributesManager: Creating default attribute/ui');
    await this.createDefaultAttribute(VITAL_CPU_LOAD_PERCENTAGE, {
      unit: '%',
      label: 'CPU usage',
      precision: 1
    }, {
      status: [
        { functionName: 'sustainedHigherThan', params: { maxValue: 0.95, minSeconds: 60 }, status: STATUS.ERROR.value },
        { functionName: 'sustainedHigherThan', params: { maxValue: 0.85, minSeconds: 60 }, status: STATUS.WARN.value },
      ],
      ui: {
        vitalsWidget: {
          type: 'gauge'
        },
        timelineWidget: {}
      }
    });
    await this.createDefaultAttribute(VITAL_RAM_USAGE_PERCENTAGE, {
      unit: '%',
      label: 'RAM usage',
      precision: 1,
      internal: true
    }, { ui: false, status: false });
    await this.createDefaultAttribute(VITAL_DISK_USAGE_PERCENTAGE, {
      unit: '%',
      label: 'Disk usage',
      precision: 1
    }, {
      status: [
        { functionName: 'higherThan', params: { max: 0.9 }, status: STATUS.ERROR.value },
        { functionName: 'higherThan', params: { max: 0.7 }, status: STATUS.WARN.value },
      ],
      ui: {
        vitalsWidget: {
          type: 'gauge'
        },
        timelineWidget: {}
      }
    });
    await this.createDefaultAttribute(
      VITAL_AGENT_DISK_USAGE_PERCENTAGE,
      {
        unit: '%',
        label: 'InOrbit disk usage (%)',
        precision: 1,
        internal: true
      },
      {
        ui: false,
        status: false
      }
    );
    await this.createDefaultAttribute(VITAL_AGENT_DISK_USAGE_MB, {
      unit: 'Mb',
      label: 'InOrbit disk usage (Mb)',
      precision: 0,
      internal: true
    }, { ui: false, status: false });
    // This is a snapshot of the current transfer rate for all network interfaces
    // except localhost.
    await this.createDefaultAttribute(VITAL_NET_TOTAL_RATE, {
      unit: 'kB/s',
      label: 'Network rate',
      precision: 0,
      timeline: {}
    }, {
      ui: {
        vitalsWidget: {
          label: 'Network',
          type: 'text'
        },
        timelineWidget: false
      },
      status: false
    });
    await this.createDefaultAttribute(VITAL_NET_ORO_RATE, {
      unit: 'kB/s',
      label: 'Agent network rate',
      precision: 0,
      internal: true,
      timeline: {}
    }, {
      ui: {
        vitalsWidget: {
          label: 'Agent',
          type: 'text'
        },
        timelineWidget: false
      },
      status: false
    });
    await this.createDefaultAttribute(VITAL_NET_TOTAL_TX_RATE, {
      unit: 'kb/s',
      label: 'Network upload rate',
      precision: 0,
      timeline: {
        disabled: true
      },
      internal: true
    }, { ui: false, status: false });
    await this.createDefaultAttribute(VITAL_NET_TOTAL_RX_RATE, {
      unit: 'kB/s',
      label: 'Network download rate',
      precision: 0,
      timeline: {
        disabled: true
      },
      internal: true
    }, { ui: false, status: false });
    await this.createDefaultAttribute(VITAL_NET_ORO_TX_RATE, {
      unit: 'kB/s',
      label: 'Agent upload rate',
      precision: 0,
      timeline: {
        disabled: true
      },
      internal: true
    }, { ui: false, status: false });
    await this.createDefaultAttribute(VITAL_NET_ORO_RX_RATE, {
      unit: 'kB/s',
      label: 'Agent download rate',
      precision: 0,
      timeline: {
        disabled: true
      },
      internal: true
    }, { ui: false, status: false });
    // The following 4 attributes are accumulators, meant to be collected and sent to timeseries
    await this.createDefaultAttribute(VITAL_NET_TOTAL_TX_BYTES, {
      unit: 'bytes',
      label: 'Network upload',
      precision: 0,
      internal: true
    }, { ui: false, status: false });
    await this.createDefaultAttribute(VITAL_NET_TOTAL_RX_BYTES, {
      unit: 'bytes',
      label: 'Network download',
      precision: 0,
      internal: true
    }, { ui: false, status: false });
    await this.createDefaultAttribute(VITAL_NET_ORO_TX_BYTES, {
      unit: 'bytes',
      label: 'Agent network upload',
      precision: 0,
      internal: true
    }, { ui: false, status: false });
    await this.createDefaultAttribute(VITAL_NET_ORO_RX_BYTES, {
      unit: 'bytes',
      label: 'Agent network download',
      precision: 0,
      internal: true
    }, { ui: false, status: false });
    await this.createDefaultAttribute(VITAL_SPEED_LINEAR, {
      unit: 'm/s',
      label: 'Linear speed',
      precision: 3,
      timeline: {
        disabled: true
      },
      internal: true
    }, { ui: false, status: false });
    await this.createDefaultAttribute(VITAL_SPEED_ANGULAR, {
      unit: 'rad/s',
      label: 'Angular speed',
      precision: 3,
      timeline: {
        disabled: true
      },
      internal: true
    }, { ui: false, status: false });
    await this.createDefaultAttribute(VITAL_DISTANCE_LINEAR_SINCE, {
      // Accumulated since tsStart (Used to calculate deltas for VITAL_DISTANCE_LINEAR)
      unit: 'm',
      label: 'Accumulated linear distance',
      precision: 3,
      internal: true
    }, { ui: false, status: false });
    await this.createDefaultAttribute(VITAL_DISTANCE_ANGULAR_SINCE, {
      // Accumulated since tsStart (Used to calculate deltas for VITAL_DISTANCE_ANGULAR)
      unit: 'rad',
      label: 'Accumulated angular distance',
      precision: 3,
      timeline: {
        disabled: true
      },
      internal: true
    }, { ui: false, status: false });
    await this.createDefaultAttribute(VITAL_DISTANCE_LINEAR, {
      unit: 'm',
      label: 'Linear distance',
      precision: 3
    }, { ui: false, status: false });
    await this.createDefaultAttribute(VITAL_DISTANCE_ANGULAR, {
      unit: 'rad',
      label: 'Angular distance',
      precision: 3,
      internal: true,
      timeline: {}
    }, { ui: false, status: false });
    await this.createDefaultAttribute(VITAL_ROS_MASTER_STATUS, {
      label: 'ROS Status'
    }, {
      status: [
        { functionName: 'notEquals', params: { value: 1 }, status: STATUS.ERROR.value }
      ],
      ui: {
        vitalsWidget: false,
        timelineWidget: false
      }
    });
    await this.createDefaultAttribute(VITAL_ONLINE, {
      label: 'Online',
      internal: true
    }, {
      status: false,
      ui: false
    });
    await this.createDefaultAttribute(VITAL_AGENT_VERSION, {
      label: 'Agent version',
      internal: true
    }, {
      status: false,
      ui: false
    });
    await this.createDefaultAttribute(TMP_VITAL_ROS_DIAGNOSTICS, {
      label: 'ROS Diagnostics - legacy',
      internal: true,
      timeline: {
        disabled: true
      },
    }, {
      status: false,
      ui: {
        vitalsWidget: false,
        timelineWidget: false
      }
    });
    await this.createDefaultAttribute(VITAL_ROS_DIAGNOSTICS_STATUS, {
      label: 'ROS Diagnostics',
      internal: true,
      timeline: {
        disabled: true
      },
    }, {
      status: [
        { functionName: 'equals', params: { value: 2 }, status: STATUS.ERROR.value },
        { functionName: 'equals', params: { value: 1 }, status: STATUS.WARN.value }
      ],
      ui: {
        vitalsWidget: false,
        timelineWidget: false
      }
    });
    await this.createDefaultAttribute(VITAL_PING_RTT_AVG, {
      unit: 'ms',
      label: 'Averaged Ping Time',
      internal: true
    }, {
      status: false,
      ui: false
    });
    await this.createDefaultAttribute(VITAL_PING_RTT_LAST, {
      unit: 'ms',
      label: 'Raw Ping Time',
      internal: true
    }, {
      status: false,
      ui: false
    });
    await this.createDefaultAttribute(VITAL_POSE, {
      label: 'Robot Pose',
      type: ATTRIBUTE_TYPES.JSON,
      internal: true,
      timeline: {
        // pose is (still) saved to timeseries as a string, without ".str" suffix, so it needs
        // explicit configuration
        fieldType: 'string',
        fieldName: VITAL_POSE,
        // We decided to reduce precision to millimeters in order to avoid storing
        // unnecessarily long strings for poses.
        fieldPrecision: 3
      }
    }, {
      status: false,
      ui: false
    });
    await this.createDefaultAttribute(VITAL_GPSFIX, {
      label: 'GPS Fix',
      type: ATTRIBUTE_TYPES.JSON,
      internal: true,
    }, {
      status: false,
      ui: false
    });
  };

  /**
   * Subscribes a listener for configuration changes.
   */
  addConfigListener = (callback) => {
    this._configListenerCallbacks.push(callback);
  };

  /**
   * Propagates a configuration change in this module through AMQP queues.
   * This makes dynamic collections service expire its caches to pick up
   * changes immediately.
   */
  propagateConfigChange = () => {
    for (const callback of this._configListenerCallbacks) {
      callback();
    }
  };

  /**
   * Add defaults and validates input for attribute creation.
   */
  // eslint-disable-next-line class-methods-use-this
  _applyDefaults = (definition, options) => {
    // HACK(adamantivm) For now: suppress status for file type sources
    const isFile = options.source
      && [SOURCES.FILE_IMAGE.value, SOURCES.FILE_TEXT.value].includes(options.source.source);
    if (isFile) {
      options.status = false;
    }
    const statusSuppressed = options.status === null || options.status === false;

    // Create defaults object
    // TODO Choose between different default objects based on value of isVital
    const defaults = {
      ui: {
        // Show the attribute in the vitals widget as a text or gauge element
        vitalsWidget: !isFile ? {} : null,
        // Show the attribute in timeline widget too
        timelineWidget: !isFile ? {} : null,
        // Show in the fleet status widget unless it's specifically
        // configured to not have a status
        fleetStatusWidget: { display: !statusSuppressed }
      },
      // By default, consider the attribute a vital
      isVital: true,
      // NOTE Setting an empty array as the configuration for
      // an attribute status results in no status ever triggered, and thus
      // a "trival" - always OK - status value.
      status: []
    };
    return applyDefaults(options, defaults);
  };

  /**
   * Similar to createAttribute but used for auto-creation of default attributes.
   * It only creates an attribute if it does not exist at all (not even nullified).
   */
  createDefaultAttribute = async (attributeId, definition, options = {}) => {
    const existingDef = await this._getAttributeDefinition(attributeId);
    if (existingDef !== undefined) { // even with null, return
      if (!Meteor.isDevelopment) {
        // Only in development mode, always re-create all attributes
        return;
      }
    }
    return this.createAttribute(attributeId, definition, options);
  };

  /**
   * Main entry point to create a new attribute.
   *
   * It will create an attribute with ID attributeId
   *
   * @param definition    is an object that includes the key elements that define
   *                      the attribute, including:
   *
   * {
   *      unit: "bytes",
   *      label: "Agent network download",
   *      precision: 0,
   *      timeline: {}
   * }
   *
   * @param options       is an object that specifies how other managers
   *                      are configured for this new attribute.
   *
   * {
   *    source: { mapping },
   *    status: [ ... rules ... ],
   *    ui: {  preferences },
   * }
   *
   * Before processing the request, defaults are applied to this options object.
   *
   * In order to avoid defaults from being applied for a given options section,
   * simply set the corresponding options section to false, e.g: { ui: false }.
   *
   * The change gets sent to event logs.
   *
   * @param {object} user A User object with { _id, profile } (or userId) that authors this change.
   */
  createAttribute = async (
    attributeId,
    definition,
    options = {},
    user = null
  ) => {
    // Validate this definition; and throw if it is wrong (before attempting any change)
    await this.validateAttributeDefinition({ definition, options });
    const { status, ui, source } = this._applyDefaults(definition, options);
    // Attempt to do something smart when creating attributes
    // Add a decent label if one was not provided
    if (!('label' in definition)) {
      if (source) {
        definition.label = source.key || source.namespace;
      }
    }
    // Set timeseries tracking by default, unless otherwise specified
    if (!('timeline' in definition)) {
      definition.timeline = {};
    }
    // Save core attribute definition details
    await this._setAttributeDefinition(attributeId, definition);

    // Propagate to attribute mappings
    if (source) {
      source.attributeId = attributeId;
      await this.setAttributeMapping(
        attributeId,
        definition,
        source,
      );
    }

    const autoCreateUIElements = true; // TODO: Make this a preference
    if (autoCreateUIElements) {
      // Propagate to status configuration
      if (status) {
        console.log("TODO propagate to RobotStatusManager")
        await new RobotStatusManager().setStatusConfig(
          attributeId,
          status,
          definition.label,
          user
        );
      }
      // Propagate to UI elements
      if (ui) {
        console.log("TODO propagate to UIPreferencesManager")
        // await new UIPreferencesManager().createUiPreferences({
        //   attributeId,
        //   attrDef: definition,
        //   prefs: ui
        // });
      }
    }
    await this.propagateConfigChange();
  };

  /**
   * Updates an attribute definition with the provided updated
   * definition and options.
   *
   * It will cascade updates to corresponding dependent managers.
   *
   * The change gets sent to event logs.
   *
   * @param {object} user OPTIONAL: A User object with { _id, profile } that authors this change.
   *                      if user is undefined, the change will NOT be logged.
   *
   * @return {object} The updated (and complete) attribute definition, including a merge
   *     of existing and new fields.
   */
  updateAttribute = async ({
    attributeId, definition, options = {}, user = null,
    // TODO These field is a little ugly and used only by the DataSources config API
    // handler (web/imports/server/configAPI/dataSourceDefinitions.js)
    // We should refactor this in a better way.
    allowAllFields = false
  }) => {
    // Validate this definition; and throw if it is wrong (before attempting any change)
    this.validateAttributeDefinition({ definition, options });
    // NOTE Using intensive fetch, compare, set here since configuration is something
    // that should happen rarely.
    // Fetch current version to update
    // NOTE: we are assuming that the attributeId is always different
    // That is why we can do a logical delete, and nullify the object without problem
    // However, if we want to apply an already deleted data source
    // (using the same attributeId), this logic will break
    // As a workaround, we are evaluating the real value that comes from mongo
    // and if it is null, it will be cleared to apply the update from scratch
    const oldDefinition = await this._getAttributeDefinition(attributeId) || {};

    // Determine which fields changed
    const delta = !isEqual(definition, oldDefinition)
      && assignIfDistinct(oldDefinition, definition, Object.keys(definition));
    if (delta) {
      const newConfig = {};
      // There was an update to the definition itself
      // NOTE Here I am unfolding all the detailed logic on how each portion
      // of the incoming updates should be handled. I didn't generalize this on purpose,
      // in order to allow deciding what to update and how depending on each portion
      // of the definition and options provided.

      // select fields for the update
      listAttributeUIFields().forEach((field) => {
        if (field in delta) {
          newConfig[field] = definition[field];
        }
      });

      if (allowAllFields) {
        // In some cases, like when using config as code, we allow overriding any field
        // See web/imports/server/configAPI/dataSourceDefinitions.js
        // eslint-disable-next-line guard-for-in
        for (const k in definition) {
          newConfig[k] = definition[k];
        }
      }

      // Propagate to UI settings to any widget this attribute may appear
      console.log("TODO propagate to UIPreferencesManager", delta)
      // await new UIPreferencesManager().updateUiPreferences(attributeId, delta);
      await this._setAttributeDefinition(attributeId, newConfig);
    }

    // Update mapping
    await this.setAttributeMapping(
      attributeId,
      definition,
      options.source
    );

    await this.propagateConfigChange();
    user && new EventLog().logSetting({
      settingGroupName: EVENT_SETTINGS_SECTION_NAMES.ATTRIBUTES,
      settingName: (oldDefinition && oldDefinition.label) || attributeId,
      eventType: EVENT_TYPES.SETTING_UPDATED,
      user
    });
    return { ...oldDefinition, ...definition };
  };

  getAttributeDefinition = async (attributeId) => (
    this._getAttributeDefinition(attributeId)
  )

  _getAttributeDefinitionDoc = async (attributeId) => (
    await this._attrDefsColl.findOneAsync({ attributeId })
  )

  _getAttributeDefinition = async (attributeId) => {
    const doc = this._getAttributeDefinitionDoc(attributeId);
    return doc?.definition;
  }

  _setAttributeDefinition = async (attributeId, definition) => (
    this._attrDefsColl.upsertAsync({ attributeId }, { $set: { definition } })
  )

  _unsetAttributeDefinition = async (attributeId) => (
    this._attrDefsColl.upsertAsync({ attributeId }, { $unset: { definition: true } })
  )

  _removeAttributeDefinition = async (attributeId) => (
    this._attrDefsColl.removeAsync({ attributeId })
  )

  _getAttributeMapping = async (attributeId) => {
    const doc = await this._getAttributeDefinitionDoc(attributeId);
    return doc?.mapping;
  }

  _setAttributeMapping = async (attributeId, mapping) => (
    this._attrDefsColl.upsertAsync({ attributeId }, { $set: { mapping } })
  )

  _unsetAttributeMapping = async (attributeId) => (
    this._attrDefsColl.upsertAsync({ attributeId }, { $unset: { mapping: true } })
  )

  /**
   * For the given entity, make the given attribute inexistent.
   *
   * This may require specifically adding settings to prevent a default or
   * higher-level configuration from introducing this attribute.
   *
   * The change gets sent to event logs.
   *
   * @param {boolean} propagate Also suppresses settings from dependent managers (state, etc.)
   * @param {object} user A User object with { _id, profile } (or userId) that authors this change.
   *
   * @return {object} The attribute definition that was just deleted.
   */
  suppressAttribute = async ({
    attributeId,
    propagate = false,
    user
  }) => {
    const oldAttrDefs = await this._getAttributeDefinition(attributeId);
    if (propagate) {
      // status
      await new RobotStatusManager().suppressStatusConfig(attributeId);
      // mappings
      await this.suppressAttributeMapping(attributeId);
      // UI elements
      console.log("TODO suppress UI/Dashboards/Alerts elements", attributeId)
      // await new UIPreferencesManager().suppressUiPreferences(attributeId);
      // await new DashboardsManager().suppressAttributeFromDashboards(attributeId);
      // remove related incident definitions
      // await this.alertsManager.suppressIncidentDefinition(attributeId);
    }
    // Suppress the attribute definition
    await this._unsetAttributeDefinition(attributeId);
    await this.propagateConfigChange();
    console.log("TODO log event log", attributeId)
    // new EventLog().logSetting({
    //   settingGroupName: EVENT_SETTINGS_SECTION_NAMES.ATTRIBUTES,
    //   settingName: oldAttrDef?.label || attributeId,
    //   eventType: EVENT_TYPES.SETTING_REMOVED,
    //   user
    // });
    return oldAttrDef;
  };

  /**
   * Removes an attribute definition, if there is one.
   *
   * @param propagate: Also remove settings from dependent managers (state, etc.)
   */
  clearAttribute = async (
    attributeId,
    propagate = false,
  ) => {
    const attrDef = await this._getAttributeDefinition(attributeId);
    const attrMapping = await this._getAttributeMapping(attributeId);
    if (attrDef !== undefined || attrMapping !== undefined) {
      if (propagate) {
        // status
        new RobotStatusManager().clearStatusConfig(attributeId);
        // mappings
        await this.clearAttributeMapping(attributeId);
        // UI elements
        // TODO The following one won't cause the desired effect. Implement properly.
        // await new UIPreferencesManager().suppressUiPreferences(attributeId);
        console.log("TODO suppress UI/Dashboards/Alerts elements", attributeId)
      }
      // Attribute itself
      await this._removeAttributeDefinition(attributeId);
      await this.propagateConfigChange();
    }
  };

  /**
   * Updates mapping from a given attribute to a given source.
   *
   * It also takes care of (re) configuring dependent agent modules
   * appropriately, so that robots will send the required data to
   * be mapped.
   */
  setAttributeMapping = async (
    attributeId,
    definition = null,
    mapping = {}
  ) => {
    if (!mapping) { // UI calls may send 'null' so this does not properly default to {}
      mapping = {};
    }
    // Fist see if there were previous mappings to this attributeId or from this same source

    const oldMapping = await this._getAttributeMapping(attributeId) || {};
    if (isEqual(mapping, oldMapping)) {
      // No change in mapping, skip
      return;
    }

    // If the source changes, suppress the old config in dependent
    // agent modules.
    if (oldMapping.source && mapping.source != oldMapping.source) {
      // TODO await this._suppressSource(oldMapping);
      // If the source mapping is being removed, also remove the widget from GC if it was there
      // TODO await new UIPreferencesManager().removeGCDataWidget(
      //   attributeId
      // );
    }

    // This block takes care of configuring dependent agent modules, depending
    // on the selected source.
    // As a result of the configuration, additional information used by the
    // agent module may be required to be stored in the mapping definition.
    switch (mapping.source) {
      case SOURCES.SYSTEM_NET.value:
        if (!mapping.interface) {
          console.warn('setAttributeMapping: interface missing in mapping', {
            attributeId, mapping
          });
          break;
        }

        await this._configureSystemSource(
          SystemModule.OPTION_TYPES.NET,
          mapping,
          oldMapping,
        );

        break;
      case SOURCES.SYSTEM_HDD.value:
        if (!mapping.partition) {
          console.warn('setAttributeMapping: partition missing in mapping', {
            attributeId,
            mapping
          });
          break;
        }

        await this._configureSystemSource(SystemModule.OPTION_TYPES.DISK, mapping, oldMapping);

        break;
      case SOURCES.KEY_VALUE.value:
        if (mapping.key === undefined) {
          console.warn('setAttributeMapping: key missing in mapping', { attributeId, mapping });
        }

        // There is an old mapping that we're updating for this same source
        if (oldMapping.source == mapping.source) {
          // If the old mapping was a custom k/v field and the topic changed
          // then we need to first suppress the previous source
          if (oldMapping.sourceId && oldMapping.topic && oldMapping.topic != mapping.topic) {
            await this._suppressSource(oldMapping);
          }
        }

        // If a topic is specified, then we need to configure the underlying CustomData module
        if (mapping.topic !== undefined) {
          // Create the data source configuration and save the sourceId to be used for
          // future updates to this data source configuration due to mapping updates.
          mapping.sourceId = await new CustomDataModule().addDataSource({
            params: {
              type: 'key_value',
              topic: mapping.topic
            }
          });

          // Get a mapping Key that will be used to locate the mapping when processing data
          mapping.mappingKey = await CustomDataModule.getAttributeKey({
            sourceId: mapping.sourceId
          });
        }

        break;

      case SOURCES.FILE_IMAGE.value:
      case SOURCES.FILE_TEXT.value: {
        if (mapping.path === undefined) {
          console.warn('setAttributeMapping: path missing in mapping', { attributeId, mapping });
          break;
        }

        // Logic in case we're updating a mapping within the same source
        if (oldMapping.source == mapping.source) {
          if (mapping.sourceId === undefined) {
            mapping.sourceId = oldMapping.sourceId;
          }
          if (mapping.sourceId != oldMapping.sourceId) {
            await new CustomDataModule().suppressDataSource({ sourceId: mapping.sourceId });
          }
        }

        const methodArguments = {
          params: {
            // TODO use a constant from the agent module being configured
            // (CustomDataModule) instead of hard-coded strings.
            type: mapping.source == SOURCES.FILE_IMAGE.value ? 'image' : 'text_file',
            path: mapping.path,
            name: mapping.path
          }
        };

        if (mapping.sourceId === undefined) {
          mapping.sourceId = await new CustomDataModule().addDataSource(methodArguments);

          // By default, create a widget immediately to display it
          await new UIPreferencesManager().createGCDataWidget(
            attributeId,
            definition,
            mapping
          );
        } else {
          methodArguments.sourceId = mapping.sourceId;
          await new CustomDataModule().updateDataSource(methodArguments);
          // Find and update any widget showing this attribute
          await new UIPreferencesManager().updateGCDataWidget(
            attributeId,
            definition,
            mapping
          );
        }

        mapping.mappingKey = await CustomDataModule.getAttributeKey({
          sourceId: mapping.sourceId
        });

        break;
      }

      case SOURCES.ROS_DIAGNOSTICS.value: {
        if (mapping.key === undefined || mapping.namespace === undefined) {
          console.warn('setAttributeMapping: key or namespace missing in mapping', {
            attributeId, mapping
          });
          break;
        }

        // Logic in case we're updating a mapping within the same source
        if (oldMapping.source == SOURCES.ROS_DIAGNOSTICS.value) {
          if (mapping.sourceId === undefined) {
            mapping.sourceId = oldMapping.sourceId;
          }
          if (mapping.sourceId != oldMapping.sourceId) {
            await new CustomDataModule().suppressDataSource({
              sourceId: mapping.sourceId
            });
          }
        }

        const methodArguments = {
          params: {
            // TODO use a constant from the module for type
            type: 'diagnostics',
            diagnostics_key: mapping.key,
            diagnostics_name: mapping.namespace,
            // NOTE(herchu) The agent needs a "name" field to be sent back
            //              as the name (readable label) for the custom data
            //              key/values widget.
            //              The agent should be totally unaware of this value; but
            //              we keep sending _something_ in this field (the same diagnostics_key!)
            //              just for compatibility with old agents. This value is sent
            //              back in a `label` key and is soon to be ignored in customData.js
            // TODO(herchu) Remove this field once customData#onMessage and the agent are updated.
            name: mapping.key
          }
        };

        if (mapping.sourceId === undefined) {
          mapping.sourceId = await new CustomDataModule().addDataSource(methodArguments);
        } else {
          methodArguments.sourceId = mapping.sourceId;
          await new CustomDataModule().updateDataSource(methodArguments);
        }

        mapping.mappingKey = await CustomDataModule.getAttributeKey({
          sourceId: mapping.sourceId
        });

        break;
      }
      case SOURCES.DERIVED.value:
        // TODO Validate expressions See IO-6165
        if (!mapping.transform) {
          console.warn('setAttributeMapping: derived attribute transform missing in mapping', {
            attributeId, mapping
          });
        }
        break;
      default:
        console.warn('setAttributeMapping: unknown mapping source', { attributeId, mapping });
        return;
    }
    // Finally, update mapping definition in the mappings collection.
    this._setAttributeMapping(attributeId, mapping);
    await this.propagateConfigChange();
  };

  /**
   * Internal helper method to configure sources from the SystemModule
   * with a new configuration. Old configuration if existing could also be provided.
   *
   * optionType is the specific type within the SystemModule being configured.
   *
   * NOTE: The mapping object can be modified inside this method.
   */
  _configureSystemSource = async (
    optionType,
    mapping,
    oldMapping = {}
  ) => {
    // See if we are updating an existing mapping
    if (oldMapping.source == mapping.source) {
      if (mapping.optionKey === undefined) {
        // Re-use option key!
        mapping.optionKey = oldMapping.optionKey;
      }
      if (oldMapping.optionKey != mapping.optionKey) {
        await this._suppressSource(oldMapping);
      }
    }

    // Get an option key if necessary
    if (mapping.optionKey === undefined) {
      mapping.optionKey = await new SystemModule().nextOptionKey({
        type: optionType
      });
    }

    // Key used by the source to identify this attribute on handleSystemUpdates
    mapping.mappingKey = await SystemModule.getAttributeKey(optionType, mapping.optionKey);

    // The call to SystemModule below supports only DISK and NET. Log an error if this is
    // a different type
    if (optionType != SystemModule.OPTION_TYPES.DISK
      && optionType !== SystemModule.OPTION_TYPES.NET) {
      console.error('_configureSystemSource: optionType is not NET or DISK, not updating SystemModule for an unknown source type: ' + optionType);
      return;
    }

    // update source configration
    // TODO Only do this if necessary
    await SystemModule.setOptionalSource({
      type: optionType,
      key: mapping.optionKey,
      // HACK(herchu) Selecting the `option` for SystemModule based on the source type,
      //              currently only supporting NET (comes identified with `interface`)
      //              and DISK (which contains a `partition`). This could be more elegant!
      option: optionType == SystemModule.OPTION_TYPES.DISK ? mapping.partition
        : optionType == SystemModule.OPTION_TYPES.NET ? mapping.interface
          : undefined // Never reached - left to make the conditional above explicity about
          // which types are supported
    });
  };

  /**
   * Suppress a given mapping and any related agent module or source configurations
   */
  suppressAttributeMapping = async (attributeId) => {
    // Get current mapping
    const mapping = await this._getAttributeMapping(attributeId);

    // Suppress the corresponding agent module or source if there was
    // a previous configuration.
    //
    // NOTE Here we suppress instead of clearing in case
    // there is a mapping configured for higher-level item in the hierarchy.
    // In that case, we don't want the agent module to send data that we're
    // not going to process now.
    if (mapping) {
      await this._suppressSource(mapping);
      // As the source gets suppressed, also remove any CustomData widget displaying it
      await new UIPreferencesManager().removeGCDataWidget(attributeId);
    }

    // Suppress the actual mapping
    await this._setAttributeMapping(attributeId, null);
    await this.propagateConfigChange();
  };

  /**
   * Helper method to suppress the configuration for a data source
   * (currently only agent module sources), with the provided
   * attribute mapping configuration (which in turn is about to be removed).
   * Effectively stops a data source from reporting data to the server.
   */
  _suppressSource = async (mapping = {}) => {
    switch (mapping.source) {
      case SOURCES.SYSTEM_HDD.value:
      case SOURCES.SYSTEM_NET.value: {
        // Select the appropriate option 'type' for the SystemModule
        // based on the selected source input
        const type = mapping.source == SOURCES.SYSTEM_HDD.value
          ? SystemModule.OPTION_TYPES.DISK
          : SystemModule.OPTION_TYPES.NET;

        // Update the system agent module
        await SystemModule.clearOptionalSource({
          type,
          key: mapping.optionKey
        });
        break;
      }
      case SOURCES.KEY_VALUE.value:
        // if (mapping.sourceId) {
        //   // For key/value pairs, the agent module data source is shared between
        //   // multiple keys, so we should only delete the source if this is the
        //   // last mapping for this sourceId remaining.

        //   // NOTE This is an expensive operation, but it should be infrequent
        //   const allMappings = await this._attrMappingsColl.findOneAsync(this.DEFAULT_ENTITY);
        //   const anotherMappingSameTopic = Object.values(allMappings).find(m => (
        //     m && m.attributeId != mapping.attributeId && m.sourceId == mapping.sourceId
        //   ));

        //   if (!anotherMappingSameTopic) {
        //     await new CustomDataModule().suppressDataSource(mapping.sourceId);
        //   }
        // }
        break;

      case SOURCES.ROS_DIAGNOSTICS.value:
      case SOURCES.FILE_IMAGE.value:
      case SOURCES.FILE_TEXT.value:
        await new CustomDataModule().suppressDataSource(mapping.sourceId);
        break;

      default:
        console.warn(
          'suppressAttribute: unknown mapping source type (ignoring suppress)', mapping);
        break;
    }
  };

  /**
   * Clears an attribute mapping at the specified level.
   *
   * This is an internal method only meant to be called through attribute definition CRUD methods.
   */
  clearAttributeMapping = async (attributeId) => {
    // Get current mapping information
    // NOTE I'm not sure that using the effective mapping (vs. the specific mapping for
    // this scope) is the right thing to do, but doing it like this for consistency with the rest
    // of the implementation at this time
    const mapping = await this._getAttributeMapping(attributeId);

    if (mapping !== undefined) {
      // Clear the attribute mapping configuration at this level
      await this._unsetAttributeMapping(attributeId);
      if (mapping !== null) {
        // Clear configuration in corresponding modules according to the mapping
        await this._clearSource(mapping);

        // TODO Perform automatic dashboard widgets clean-up

        // Notify caches of a config change
        await this.propagateConfigChange();
      }
    }
  };

  /**
   * Helper method to clear configurations from dependent module sources
   *
   * NOTE This is taken from _suppressSource and incrementally being improved
   * Depending on the module source and the circumstance, some of the operations may be
   * currently incomplete or be doing a suppress where it should be instead clearing.
   */
  // eslint-disable-next-line class-methods-use-this
  _clearSource = async (mapping = {}) => {
    switch (mapping.source) {
      case SOURCES.SYSTEM_HDD.value:
      case SOURCES.SYSTEM_NET.value: {
        // Select the appropriate option 'type' for the SystemModule
        // based on the selected source input
        const type = mapping.source == SOURCES.SYSTEM_HDD.value
          ? SystemModule.OPTION_TYPES.DISK
          : SystemModule.OPTION_TYPES.NET;

        // TODO Update this to actually clear instead of suppressing
        await SystemModule.clearOptionalSource({
          type,
          key: mapping.optionKey
        });
        break;
      }
      case SOURCES.KEY_VALUE.value:
        // TODO Identify the cases where the 'clear' operation needs an update
        // in the CustomDataModule.
        // Note that individual custom fields in the Custom Data module are represented as
        // arrays and so a proper "clear" is not feasible
        break;

      case SOURCES.ROS_DIAGNOSTICS.value:
      case SOURCES.FILE_IMAGE.value:
      case SOURCES.FILE_TEXT.value:
        // TODO Implement clear instead of suppress
        await new CustomDataModule().suppressDataSource(mapping.sourceId);
        break;

      case SOURCES.DERIVED.value:
        // No need to do anything on any module
        break;

      default:
        console.warn(
          'clearAttribute: unknown mapping source type (ignoring clear)', mapping);
        break;
    }
  };

  /**
   * Returns a "snapshot" of the current values for a list of attributes of a robot.
   * It is similar to publication
   * `attributes.values` from this same manager, but returning a static copy of the current
   * attribute values.
   */
  async _meteorGetValues({ robotId, attributes }) {
    if (!await new OroRoles().canAccessRobot(this.userId, robotId, ACCESS_LEVEL_VIEW)) {
      throw new Meteor.Error(`User not authorized to view robot's ${robotId} data`);
    }
    const robot = new Robot(robotId);
    return await robot.getAttrValuesAsync(attributes);
  }

  /**
   * Validates an attribute definition about to be created or updated.
   *
   * TODO(herchu) This was just added to validate derived attributes but there is no other
   * validation implemented. Add more validations here!
   */
  // eslint-disable-next-line class-methods-use-this
  validateAttributeDefinition = ({ definition, options }) => {
    if (!definition) {
      throw new Error('Invalid (empty) attribute definition');
    }
    if (options && options.source && options.source.source == SOURCES.DERIVED.value) {
      const { transform, filter } = options.source;
      // TODO(herchu) Validate the following:
      // - transform must be a string
      // - filter is optional; must be a string if given
      // - in any case, use createExpression() to build a expression. It will throw if
      //   there are syntax errors, just let it throw. Do it for transform and filter
      // But for all this: We need to share the code between ingest and app-server! :(
    }
  };

  findAttributeDefinitions = async ({ id = null }) => {
    const query = id ? { attributeId: id } : {};
    const docs = await this._attrDefsColl.find(query).fetchAsync();
    docs.forEach(doc => {
      delete doc._id;
    });
    return docs;
  }
}

Meteor.publish('attributes.mappings', async function () {
  if (!this.userId) { // User must be logged in
    return this.ready();
  }
  // Check permissions
  if (!await new OroRoles().hasRole(this.userId)) {
    throw new Meteor.Error(`User not authorized to query mappings`);
  }
  const attrsMgr = new AttributesManager();
  return attrsMgr._attrMappingsColl.find(attrsMgr.DEFAULT_ENTITY);
});

Meteor.publish('attributes.values', async function ({ robotId, attributes, pollingIntervalMs = 5000 }) {
  if (!this.userId) { // User must be logged in
    return this.ready();
  }
  // Check permissions
  if (!await new OroRoles().canAccessRobot(this.userId, robotId, ACCESS_LEVEL_VIEW)) {
    throw new Meteor.Error(`User not authorized to view robot's ${robotId} data`);
  }
  return queryRobotAttributeValues({ robotId, attributes, pollingIntervalMs });
});

export default AttributesManager;
