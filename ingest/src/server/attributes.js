/**
 * Handle of all robot attributes and those marked as 'vitals'.
 * It includes the listing of all known (system wide, builtin) attributes
 * like CPU, battery, etc., as well as functionality to enable and disable
 * them for specific groups (system wide, robot) and
 * to define how they map from different sources.
 *
 * Attributes can be built in (only some of them are) or are defined to be fed from a source:
 * key-value pairs or ros-diagnostics are currently implemented.
 *
 * Defining an attribute and/or its mappings also propagates to other modules such as:
 *  - status (to refresh a robot status based on vital values),
 *  - customData, agentlet states (to enable collecting key-values or diagnostics)
 *
 */

// Disable linting rule as this file has multiple classes
/* eslint max-classes-per-file: 0 */

import { isString } from 'lodash';
import { AsyncCache } from './simpleCache';
import moment from 'moment';
// InOrbit modules
import RobotStatusManager from './status';
import MongoManager from '../mongo';
// import StorageManager from '../storage';
import {
  SOURCES,
  VITAL_ROS_DIAGNOSTICS_STATUS,
  AttributeValueParser,
  VITAL_POSE
} from '../shared/attributes';
import { COLLECTIONS, ID_UNIQUE } from '../shared/constants';
// import PeerClient from '../peer';
// import WorkerQueue, { QUEUES } from './messageQueue';
// import { createExpression } from './derivedAttributes/processor';

// "Outputs" (and: pieces of functionality in general) that can be individually
// disabled in the AttributesManager. See setOfflineMode, setOutputEnabled
const OUTPUTS = {
  // REALTIME represents saving each last attribute value in the realtime DB, Mongo
  REALTIME: 'mongo',
  // QUEUES sends every attribute update to internal queues for other services to process them
  QUEUES: 'queues',
  // STATUS toggles the calculation and processing of status updates
  STATUS: 'status'
};

let instance;
class AttributesManager {
  constructor() {
    // Singleton pattern
    if (instance === undefined) {
      instance = this;
      this.mongoManager = new MongoManager();
      // this.storageManager = new StorageManager();
      this._attrDefsColl = this.mongoManager.getCollection(COLLECTIONS.ATTRIBUTE_DEFINITIONS);
      this._attrValuesColl = this.mongoManager.getCollection(COLLECTIONS.ATTRIBUTE_VALUES);
      // Queues
      // this.messageQueue = new WorkerQueue().buildExchangeDirect(QUEUES.ATTRIBUTES);
      // this.poseMessageQueue = new WorkerQueue().buildExchangeTopic(QUEUES.POSES);
      // TODO We should invalidate caches when the config is updated and make cache times longer.
      this._vitalsConfigCache = new AsyncCache({
        maxAge: 1 * 60 * 1000, // 1 minute
        createFunction: this._doGetRobotVitalsConfig
      });
      // this._attrDefsCache = new AsyncCache({
      //   maxAge: 60 * 1000, // 1 minute
      //   createFunction: this._doGetRobotAttributeDefinitions
      // });
      this._derivedAttributesConfigCache = new AsyncCache({
        maxAge: 60 * 1000, // 1 minute
        createFunction: this._doGetRobotDerivedAttributesConfig
      });
      // this.peerClient = new PeerClient();
      this.options = {};
      this._outputs = {}; // none - next line initializes it
      this.enableAllOutputs();
    }
    return instance;
  }

  /**
   * Enables all outputs. This is the default functionality
   */
  enableAllOutputs = () => {
    Object.keys(OUTPUTS).forEach((output) => { this._outputs[OUTPUTS[output]] = true; });
    return this;
  };

  /**
   * Disables all outputs (used to later enabled just one of them)
   */
  disableAllOutputs = () => {
    Object.keys(OUTPUTS).forEach((output) => { this._outputs[OUTPUTS[output]] = false; });
    return this;
  };

  /**
   * Enables or disabled a given output
   */
  setOutputEnabled = (output, isEnabled) => {
    if (!Object.values(OUTPUTS).includes(output)) {
      throw new Error(`Bad output type: ${output}`);
    }
    console.log(`AttributesManager: Manually setting output ${output} to `
      + (isEnabled ? 'enabled' : 'disabled'));
    this._outputs[output] = isEnabled;
    return this;
  };

  /**
   * Tells if a given output is enabled
   */
  isEnabled = (output) => {
    if (!output in OUTPUTS) {
      throw new Error(`Bad output type: ${output}`);
    }
    return this._outputs[output];
  };

  /**
   * "Offline mode" represents processing data not from a real time source,
   *  - Status, Modes updates are not represented (for now!)
   *
   * This is an experimental feature added for the Rosbag processing work IO-3671
   */
  setOfflineMode = (isOffline) => {
    this.disableAllOutputs();
    this.options.offlineMode = isOffline;
    return this; // allow chaining
  };

  getRobotVitalsConfig = async (robotId) => this._vitalsConfigCache.get(robotId);

  _doGetRobotVitalsConfig = async (robotId) => {
    // TODO rewrite this function and related attributes handling; it's inefficient and based
    // on the old data representation
    const attrs = await this._attrDefsColl.find({}).toArray();
    const defs = {};
    const mappings = {};
    attrs.forEach((attr) => {
      defs[attr.attributeId] = attr.definition;
      mappings[attr.attributeId] = attr.mapping;
    });
    return new RobotVitalsConfig(robotId, defs, mappings);
  };

  /**
   * Returns the derived attributes configuration for a robot.
   * Note that results are cached.
   * @param {string} robotId
   * @returns {DerivedAttributesConfig}
   */
  getRobotDerivedAttributesConfig = async (robotId) => this._derivedAttributesConfigCache.get(
    robotId
  );

  /**
   * Fetches the derived attributes configuration
   * @param {string} robotId
   * @returns {DerivedAttributesConfig}
   */
  _doGetRobotDerivedAttributesConfig = async (robotId) => {
    const attrDefsConfig = await this.getRobotAttributeDefinitions(robotId);
    return new DerivedAttributesConfig(attrDefsConfig);
  };

  /**
   * Returns the current values for a list of attributes of a robot.
   * @arg robotId (string)
   * @arg attributeId An array of attribute ids to project and return.
   */
  getRobotAttributeValues = async (robotId, attributeIds) => {
    if (!isString(robotId)) {
      throw new Error('robotId must be a string');
    }
    if (!Array.isArray(attributeIds)) {
      throw new Error('attributeIds must be an array');
    }
    const values = await this._attrValuesColl.findOne(
      robotId,
      { fields: attributeIds }
    ) || {};
    delete values._id;
    return values;
  };

  /**
   * Retrieves attribute values for a list of robots
   *
   * @param {Array<string>} robotIds - list of robotIds to retrieve the attribue values for.
   * @param {Array<string>} attrIds - Optional, list of attrIds to filter which attribute values.
   *                            are fetch. If not provided, all attr values are retrieved.
   * @returns {Array<Object>} - An array of objects with the robot attr values documents.
   *                            If no robots are found, returns an empty array.
   */
  getRobotsAttributeValues = async (robotIds, attrIds = null) => {
    if (!robotIds.length) {
      return [];
    }
    // Note: This is live data, we would ideally read it from Redis
    return await this._attrValuesColl.find({ _id: { $in: robotIds }}, { fields: attrIds }).toArray();
  };

  /**
   * Receives a batch of values from the 'system' agentlet from a robot, and saves
   * them those the robot has enabled and defined with a 'bultin' source (otherwise
   * they are ignored).
   *
   * @arg values is a mapping from attributeId to an object
   *      with { value, params }. The additional params are optional.
   */
  async handleSystemUpdates(robotId, values, ts = Date.now(), skip = {}) {
    const robotConfig = await this.getRobotVitalsConfig(robotId);
    const updated = {};
    let hasUpdates = false;
    // eslint-disable-next-line guard-for-in
    for (const attr in values) {
      // Older API used simply Numbers as values in the dictionary; so validate
      // this just in case
      if (!values[attr] || typeof values[attr] != 'object' || !('value' in values[attr])) {
        throw Error('Invalid value for attribute ' + attr + ': ' + values[attr] + ' (should be object)');
      }
      // System value updates come (currently) even if the robot has a vital
      // configured from a different source. Ignore those!
      let attributeId;
      if (robotConfig.isBuiltinVital(attr)) {
        attributeId = attr;
      } else {
        // TODO Make this query more efficient (e.g.: directly by key aka index)
        attributeId = robotConfig.findAttributeIdMappedTo(
          SOURCES.SYSTEM_HDD.value,
          { mappingKey: attr }
        ) || robotConfig.findAttributeIdMappedTo(SOURCES.SYSTEM_NET.value, { mappingKey: attr });
      }
      if (attributeId) {
        updated[attributeId] = values[attr];
        hasUpdates = true;
      }
    }
    // Persist and cascade to dependents... only if some attributes were really updated
    if (hasUpdates) {
      await this.saveAttributeValues({
        robotId, attributeValues: updated, ts, attrDefs: robotConfig.getAttrDefs(), skip
      });
    }
  }

  /**
   * Main call to update a set of attribute values. It will persist the attributes in the current
   * snapshot db, and on any dependent storage (data lake, etc)
   *
   * @arg robotId (string) is mandatory
   * @arg attributeValues is a map from attributeId to a _value object_ with at least a `{ value }`
   *      field. These objects may contain their own `ts`, or will default to the provided `ts`
   *      argument. They can also contain other fields such as `tsAgent`, `elapsedSeconds`, etc.
   * @arg ts Is the timestamp to apply to all updated attributes (unless they have their own `ts`
   *      field in the _value object_)
   * @arg attrDefs The attrDefinitions part of this.getRobotVitalsConfig(robotId);
   *      and it is optional. If not given, it will be retrieved.
   * @arg skip is an optional object for _cascadeUpdates, allowing to skip evaluation of some
   *      modules (used today to skip evaluating statuses if `skip = { status: true }`, called
   *      from mqtt.js)
   */
  saveAttributeValues = async ({
    robotId, attributeValues, ts = Date.now(), attrDefs = null, skip = {}
  }) => {
    // Store time for attributes metrics calculation.
    const t0 = Date.now();
    // It's also async and we don't wait for the results
    if (!attrDefs) {
      const robotConfig = await this.getRobotVitalsConfig(robotId);
      attrDefs = robotConfig.getAttrDefs();
    }

    // Parse the value according to the type declared in attr_defs
    // TODO Cache parsers together with the attribute definitions
    Object.keys(attributeValues).forEach((attrId) => {
      const attributeValue = attributeValues[attrId];
      let parsedValue;
      try {
        const parser = AttributeValueParser(attrDefs[attrId]);
        parsedValue = parser(attributeValue.value);
      } catch (e) {
        console.warn(`Failed to parse attributeId=[${attrId}], value=[${attributeValue.value}]`, e);
      }

      // Only update the value if the parsed result is not undefined
      attributeValue.value = parsedValue === undefined ? attributeValue.value : parsedValue;
    });

    if (!skip.persist) {
      // Call to persist values in DB. This is async; but no need to wait for the result
      await this._persistAttributeValues({ robotId, attributeValues, ts });
    }

    // Call to "cascade" all values to other modules and storage: status, data lake...
    await this._cascadeUpdates(robotId, attributeValues, attrDefs, ts, skip);

    // metricsProxy.record(
    //   measureAttrsProcessed,
    //   Object.keys(attributeValues).length
    // );
    // const durationMs = Date.now() - t0;
    // metricsProxy.record(
    //   measureAttrsProcessedTime,
    //   durationMs
    // );
  };

  /**
   * Call to save a batch of attribute values to mondodb.
   *
   * Note: Internal call; this is _only_ the mongodb part; ony called from saveAttributeValues
   *
   * @arg robotId (string) is mandatory
   * @arg attributeValues is a map from attributeId to a _value object_ with at least a `{ value }`
   *      field. These objects may contain their own `ts`, or will default to the provided `ts`
   *      argument. They can also contain other fields such as `tsAgent`, `elapsedSeconds`, etc.
   * @arg ts Is the timestamp to apply to all updated attributes (unless they have their own `ts`
   *      field in the _value object_)
   */
  _persistAttributeValues = async ({ robotId, attributeValues, ts = Date.now() }) => {
    if (!this.isEnabled(OUTPUTS.REALTIME)) {
      return;
    }
    const $set = {
      _id: robotId,
    };
    const reservedKeys = ['_id'];
    // Append all attribute value updates to the $set mongo update
    Object.keys(attributeValues).forEach((attributeId) => {
      if (!reservedKeys.includes(attributeId)) {
        const valueObj = attributeValues[attributeId];
        // the `ts` in each value element is optional; append it if absent
        if (!valueObj.ts) {
          valueObj.ts = ts;
        }
        $set[attributeId] = valueObj;
      }
    });
    // Note: Here we would save values to Redis. Saving directly to MongoDB instead.
    await this._attrValuesColl.updateOne({ _id: robotId }, { $set }, { upsert: true });
  };

  /**
   * Cascades a batch updates to dependent modules, like Modes, status, data lake.
   *
   * Note: Internal call; this is only called from saveAttributeValues (normally also calling
   * _persistAttributeValues)
   *
   * Arguments are already preprocessed and/or fetched from DB:
   *
   * @arg attrValues are only those vitals enabled for the robot (no noise); each is a
   *      { value, ...otherParams } object.
   * @arg attrDefs are the definition of all attributes of this robot
   * @arg ts is valid, nonzero.
   * @arg skip is an optional object for _cascadeUpdates, allowing to skip evaluation of
   *      some modules (used today to skip evaluating statuses if `skip = { status: true }`,
   *      called from mqtt.js)
   */
  async _cascadeUpdates(robotId, attrValues, attrDefs, ts, skip = {}) {
    // Hook to process status update for the robot
    if (!skip.status && this.isEnabled(OUTPUTS.STATUS)) {
      new RobotStatusManager().evaluateStatus(robotId, attrValues);
    }

    // Hook to send data to time series and long term storage
    // TODO Bubble up this guard, it should be everywhere we receive info
    if (ts == 0) {
      // This is very suspicious, we're probably sending wrong data from the agent in the
      // first place, but just in case fix the timestamp to be now.
      ts = Date.now();
    }

    // if (this.isEnabled(OUTPUTS.QUEUES)) {
    //   await this.messageQueue.sendAttributesUpdate(robotId, attrValues, ts)
    //     .catch((e) => {
    //       console.error(`Error queuing attributes updates to processing queues; robotId=${robotId}: ${e.message}`);
    //     });
    //   if (VITAL_POSE in attrValues) {
    //     await this.poseMessageQueue.sendPoseUpdate(
    //       robotId,
    //       attrValues[VITAL_POSE].value,
    //       ts
    //     ).catch((e) => {
    //       console.error(`Error queuing pose updates to processing queues; robotId=${robotId}: ${e.message}`);
    //     });
    //   }
    // }
  }

  /**
   * Handle an incoming list of events
   * Modified version of handleKeyValuePairs that accounts for the case that the provided
   * list of events may have duplicate keys.
   * Implemented as a separate method to avoid modifying the delicate and high-traffic
   * code in handleKeyValuePairs below.
   *
   * TODO Refactor and consolidate all of the handleXxxxYyy calls
   */
  async handleEvents({ robotId, customField }, events, ts = Date.now()) {
    const robotConfig = await this.getRobotVitalsConfig(robotId);

    // saveAttributeValues expects a flat object with each key/value as a key and thus
    // it doesn't work with repeated keys.
    // Keep a list of update objects to call saveAttributeValues multiple times if necessary
    // in the case that a key is present more than once in the events list.
    const updates = [{}];
    let hasUpdates = false; // cheaper than any isEmpty function

    // Identify the data source by customFieldId
    events.forEach((kv) => {
      const attributeId = robotConfig.findAttributeIdMappedTo(SOURCES.KEY_VALUE.value, {
        key: kv.key,
        mappingKey: customField
      });
      if (attributeId) {
        hasUpdates = true;
        const { value, kvTs } = kv;
        if (attributeId in updates[updates.length - 1]) {
          updates.push({});
        }
        updates[updates.length - 1][attributeId] = { value, kvTs };
      } // else: this robot does not use this key-value pair, ignore it
    });

    if (hasUpdates) {
      // NOTE Using a for loop because there are awaits inside
      for (let i = 0; i < updates.length; i++) {
        await this.saveAttributeValues({
          robotId, attributeValues: updates[i], ts, attrDefs: robotConfig.getAttrDefs()
        });
      }
    }
  }

  /**
   * Receives a list of {key, value} pair objects coming from the custom data agentlet,
   * and saves values for the  attributes mapped to a vital in the robot.
   * The values in the key-value pairs must have been parsed already (into numbers, strings,
   * anything).
   */
  async handleKeyValuePairs(robotId, customField, pairs, ts = Date.now()) {
    const robotConfig = await this.getRobotVitalsConfig(robotId);
    const updated = {};
    let hasUpdates = false; // cheaper than any isEmpty function
    // Identify the data source by customFieldId
    pairs.forEach((kv) => {
      const attributeId = robotConfig.findAttributeIdMappedTo(SOURCES.KEY_VALUE.value, {
        key: kv.key,
        mappingKey: customField
      });
      if (attributeId) {
        updated[attributeId] = { value: kv.value };
        hasUpdates = true;
      } // else: this robot does not use this key-value pair, ignore it
    });
    if (hasUpdates) {
      await this.saveAttributeValues({
        robotId, attributeValues: updated, ts, attrDefs: robotConfig.getAttrDefs()
      });
    }
  }

  /**
   * Given a list of updates from an arbitrary source (see SOURCES) and persists them as
   * attributes values if they are mapped to attributes.
   *
   * It receives a list `updates`, each of them an object with `{ value, ...keys }`.
   * The `keys` should be enough to identify a data source mapping, and
   * depend on the `source`.
   * For example:
   *  - key-value sources use a `key`,
   *  - ros-monitor data use a `type` and `key` to identify the "task" monitored,
   *  - file sources have a `mappingKey`.
   * These keys are passed to `findAttributeIdMappedTo` to find which attribute gets mapped.
   *
   * TODO(herchu) Migrate modules calling various other methods to persist attributes,
   * namely `handle*()`, to use this more generic method.
   * This includes handleDiagnosticsData(), handleSystemUpdates(), handleEvents(),
   * handleKeyValuePairs().
   * Some changes to this interface might be required; and serious testing (incl. new unit tests).
   */
  saveAttributesFromMappings = async ({ robotId, source, updates, ts = Date.now() }) => {
    if (!robotId) {
      throw new Error('robotId are required');
    }
    if (!Array.isArray(updates)) {
      throw new Error('updates must be an array');
    }
    if (!source || !(source in SOURCES.FROM_VALUE)) {
      throw new Error('invalid source: ' + source);
    }
    const robotConfig = await this.getRobotVitalsConfig(robotId);
    const updated = {};
    let hasUpdates = false; // cheaper than any isEmpty function
    // Identify the data source by customFieldId
    updates.forEach((update) => {
      const { value, ...keys } = update;
      const attributeId = robotConfig.findAttributeIdMappedTo(source, keys);
      if (attributeId) {
        updated[attributeId] = { value };
        hasUpdates = true;
      } // else: this robot does not map mapping key to any attribute; ignore
    });
    if (hasUpdates) {
      await this.saveAttributeValues({
        robotId, attributeValues: updated, ts, attrDefs: robotConfig.getAttrDefs()
      });
    }
  };

  /**
   * Receives a ros-diagnostics message from the custom data agentlet, and if this
   * {customFieldId,key} is mapped to a vital in the robot, saves its value to vitals.
   */
  async handleDiagnosticsData(robotId, attr, value, ts = Date.now()) {
    // Identify the data source by its attr, which is saved in the mapping DB
    // as mappingKey.

    // Load attribute mappings for this robot
    const robotConfig = await this.getRobotVitalsConfig(robotId);
    const attributeId = robotConfig.findAttributeIdMappedTo(SOURCES.ROS_DIAGNOSTICS.value, {
      mappingKey: attr
    });
    if (attributeId) {
      const updated = { [attributeId]: { value } }; // updated a single attribute
      this.saveAttributeValues({
        robotId, attributeValues: updated, ts, attrDefs: robotConfig.getAttrDefs()
      });
    } // else: ignore this diagnostics data
  }

  /**
   * Receives a diagnostics status message from RosDiagnosticsAgentlet, and saves
   * its value to a robot's vitals.
   *
   * NOTE: This is valid for robots with AGENT_VER_1.16.1 onwards. Previous
   * diagnostics status are mapped to tmpAgentStatus attribute and handled on
   * a separate path.
   */
  async handleDiagnosticsStatus(robotId, status, ts = Date.now()) {
    const robotConfig = await this.getRobotVitalsConfig(robotId);
    // Since this is a single attribute, with no options, it doesn't need
    // additional mapping.
    const updated = { [VITAL_ROS_DIAGNOSTICS_STATUS]: { value: status } };
    this.saveAttributeValues({
      robotId, attributeValues: updated, ts, attrDefs: robotConfig.getAttrDefs()
    });
  }

  /**
   * Hack for offline mission tracking. Replace the outgoing message queue so that instead of
   * propagating attributes updates to other remote services, this gives the chance of process
   * them locally.
   *
   * This also allows for unit-testing too, replacing queues by mocks.
   *
   * TODO(herchu) Replace this mechanism by initialization or config options -- not possible today
   * since these objects are all built in the singleton's constructor, before settings are read.
   *
   * See
   * https://docs.google.com/document/d/1eiDLuTlm43Ey6-VocDOtqZIJjP3Vlok710UhafMI3uc/edit#heading=h.i7kt1ymd019r
   */
  replaceMessageQueue = (messageQueue) => {
    console.warn('HACK! Replacing AttributeManager\'s outgoing message queue. '
      + 'Only OK if this is a test, or a specific service (e.g. rosbag-importer)');
    this.messageQueue = messageQueue;
  };

  replacePosesQueue = (posesQueue) => {
    console.warn('HACK! Replacing AttributeManager\'s outgoing poses queue. '
      + 'Only OK if this is a test, or a specific service (e.g. rosbag-importer)');
    this.poseMessageQueue = posesQueue;
  };
}

/**
 * Vitals configuration for a given robot.
 * This includes the listing of vital attributes, and their mapping from data sources
 */
class RobotVitalsConfig {
  constructor(robotId, attrDefs, attrMappings) {
    this.robotId = robotId;
    this.attrDefs = attrDefs;
    this.mappings = attrMappings;
  }

  /**
   * Tells if an attribute is marked as vital for this robot.
   */
  isAttribute(field) {
    return field in this.attrDefs;
  }

  /**
   * Tells if an attribute is computed by the system as 'builtin', ie. no robot data source given.
   * This normally returns true for CPU, HDD, network, etc.
   */
  isBuiltin(field) {
    const src = this.getSource(field);
    return !src || src == SOURCES.BUILTIN.value;
  }

  /**
   * Convenience method: Tells is a field is enabled as vital AND is configured as builtin.
   */
  isBuiltinVital(field) {
    return this.isAttribute(field) && this.isBuiltin(field);
  }

  getAttrDefs = () => {
    return this.attrDefs
  }

  /**
   * Returns the source type for an attribute: 'builtin', 'key-value', etc. (Or empty if no
   * source was defined; normally meaning 'builtin')
   */
  getSource(field) {
    return null; // FIXME(herchu) no mappings are yet loaded
  }

  /**
   * Finds an attribute matching the given source (by type, namespace and key).
   * Note this is implemented by iterating a dictionary - not efficient.
   */
  findAttributeIdMappedTo(sourceType, { key, mappingKey, type }) {
    const ret = Object.keys(this.mappings).find((k) => {
      const m = this.mappings[k];
      return m && m.source == sourceType
        // NOTE Mappings configured with the default k/v field don't have a mappingKey
        // defined on its mapping. Allow matching with any mapping key.
        // TODO Finish porting custom data k/v fields to only use mappingKey to match
        // attributes. See https://inorbit.atlassian.net/browse/IO-2076
        && (mappingKey === undefined || m.mappingKey === undefined || m.mappingKey == mappingKey)
        && (key === undefined || m.key == key)
        && (type === undefined || m.type == type);
    });
    return ret;
  }

  /**
   * Returns an attribute definition given its id
   * (or null is not defined for this robot)
   */
  getAttributeDefinition(attributeId) {
    return this.attrDefs[attributeId];
  }

  /**
   * Returns an attribute mapping given its id
   * (or null if it's not set for this robot)
   */
  getAttributeMapping(attributeId) {
    return this.attrDefs[attributeId];
  }
}

/**
 * Derived attributes configuration for a given robot.
 *
 * NOTE: consider moving this to a separate module.

 */
class DerivedAttributesConfig {
  constructor(attrDefsConfig) {
    this.attrDefsConfig = attrDefs;
    // See RobotVitalsConfig.getDependentDerivedAttributes
    this.memoDependentAttributes = {};
    // See RobotVitalsConfig.getDerivedAttributeDependencies
    this.memoDerivedAttrDeps = {};
  }

  /**
   * Returns a set with the ids of derived attributes that depend on the attribute with id
   * attributeId.
   * Note that results are memoized for efficiency.
   *
   * @param {string} attributeId
   */
  getDependentDerivedAttributes(attributeId) {
    // Memoize results to avoid computing the same dependencies many times
    if (!this.memoDependentAttributes[attributeId]) {
      this.memoDependentAttributes[attributeId] = this._getDependentDerivedAttributes(attributeId);
    }
    return this.memoDependentAttributes[attributeId];
  }

  /**
   * Returns a list with the ids of all the derived attributes defined for this robot
   * @returns {array}
   */
  _getDerivedAttributesIds = () => Object.entries(this.robotVitalsConfig.mappings || {})
    .filter(([, mapping]) => mapping && mapping.source == SOURCES.DERIVED.value)
    .map(([id]) => id);

  /**
   * Returns a set with the ids of derived attributes that depend on the attribute with id
   * attributeId.
   *
   * @param {string} attributeId
   */
  _getDependentDerivedAttributes = (attributeId) => {
    const dependents = new Set();
    for (const derivedId of this._getDerivedAttributesIds()) {
      // Find derived attributes that depend on attributeId
      const { attributeIds } = this.getDerivedAttributeDependencies(derivedId);
      if (attributeIds.has(attributeId)) {
        dependents.add(derivedId);
      }
    }
    return dependents;
  };

  /**
   * Returns a list of attribute ids that a derived attribute depends on.
   * Note that results are memoized for efficiency.
   *
   * @param {string} attributeId The derived attribute id
   * @returns {array} List of ids of attributes that derived attribute expressions (transform or
   * filter reference). 
   */
  getDerivedAttributeDependencies(attributeId) {
    if (!this.memoDerivedAttrDeps[attributeId]) {
      this.memoDerivedAttrDeps[attributeId] = this._getDerivedAttributeDependencies(attributeId);
    }
    return this.memoDerivedAttrDeps[attributeId];
  }

  /**
   * Returns a list of attribute ids that a derived attribute depends on.
   *
   * @param {string} attributeId The derived attribute id
   * @returns {array} List of ids of attributes that derived attribute expressions (transform or
   * filter reference). 
   */
  _getDerivedAttributeDependencies = (attributeId) => {
    const mapping = this.robotVitalsConfig.getAttributeMapping(attributeId);
    if (!mapping || !mapping.source == SOURCES.DERIVED.value) {
      // Not a derived attribute
      return {};
    }
    const { attributeIds: explicitAttributeIds = [], filter, transform } = mapping;
    const attributeIds = new Set();
    const tags = new Set();
    if (Array.isArray(explicitAttributeIds)) {
      explicitAttributeIds.forEach(attributeIds.add, attributeIds);
    }
    let time;
    for (const exprStr of [transform, filter]) {
      if (exprStr) {
        // Get attribute dependencies. To do this, the expression must be well formed.
        try {
          const expr = createExpression(exprStr, mapping);
          const {
            attributeIds: depAttributeIds,
            time: depTime,
            tags: depTags
          } = expr.getDependencies();
          if (depAttributeIds) {
            depAttributeIds.forEach(attributeIds.add, attributeIds);
          }
          if (depTags) {
            depTags.forEach(tags.add, tags);
          }
          if (depTime) {
            // NOTE: if time elements are objects, we should do a merge. If they are timestamps,
            // e.g. one says "every 10s" and the other one "every 30s", a clever merge is needed
            time = time || depTime;
          }
        } catch (e) {
          // Inore error to avoid spamming logs with bad configs
          // TODO(herchu): Print a console warning only in development (local) mode
        }
      }
    }
    const ret = { attributeIds };
    if (tags.size) {
      ret.tags = tags;
    }
    if (time) {
      ret.time = time;
    }
    // HACK(herchu) If the expression depends on time, add an artificial dependency on CPU usage,
    // which we know it gets refreshed often (as long as the agent is online), rarely suppressed.
    // Keep this hack isolated here to avoid hacking the dependencies inference (which depends
    // on functions and will be spread in many points).
    // TODO(herchu) Remove this hack when we implement proper time-based processing in
    // svc-derived-attributes; find discussion in IO-6318.
    if (ret.time) {
      ret.attributeIds.add('cpuLoadPercentage'); // Not importing the constant, less lines to un-do
    }
    return ret;
  };

  /**
   * Returns the expressions used by a derived attribute
   * @param {string} attributeId
   * @returns {object}
   */
  getExpressions = (attributeId) => {
    const mapping = this.robotVitalsConfig.getAttributeMapping(attributeId) || {};
    // include filter, expression and attributeIds; all necessary to know how this
    // attribute will be evaluated
    // NOTE: attributeIds (list of dependencies) is deprecated but still in use, so it is returned
    const { filter, transform, attributeIds } = mapping;
    return { filter, transform, attributeIds };
  };
}

export default AttributesManager;
export { OUTPUTS, RobotVitalsConfig, DerivedAttributesConfig };
