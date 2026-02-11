/**
 * Collections and queries to handle robot attributes and vitals; and their mappings to data sources.
 *
 * Also all known attribute IDs are defined here.
 *
 * A couple of calls to query the collections are provided from this module (for usage in the client and
 * publications); then all manipulation of these collections is performed from server/attributes.js
 *
 * Design Document: https://docs.google.com/document/d/1ae2grqOfrAOhLBpbgjLAQzwBFGk_jSIzlXirnAUQgBg/edit#
 */
import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
// ORO modules
import { COLLECTIONS } from '../shared/constants';

const AttributeDefinitions = new Mongo.Collection(COLLECTIONS.ATTRIBUTE_DEFINITIONS);
/*
 * entityId: string
 * entityType: string
 * <attributeId1> : {
 *   unit: string
 *   label: string
 *   precision: number,
 *   type: <String>,       // Optional: attribute type. Used by AttributeManager to parse values
 *                         // Takes a value from ATTRIBUTE_TYPES (as in shared/attributes.js)
 *   modeId: <taxonomyId>, // optional, if changing this attributes triggers
 *                         // recalculating a robot Mode
 * },
 * ...
 */
if (Meteor.isServer) {
  AttributeDefinitions.rawCollection().createIndex({ entityId: 1, entityType: 1 }, { unique: true });
}

const VitalDefinitions = new Mongo.Collection(COLLECTIONS.VITAL_DEFINITIONS);
/*
 * entityId: string
 * entityType: string
 * <attributeId1> : {
 *   unit: String, (optional)
 *   label: String,
 *   precision: Number, (optional)
 *   timeline: Object {    // (optional) If absent, no timeseries archiving is done.
 *     enabled: Boolean,   // (optional): If present and false, same effect as
 *                         // if no 'timeline' object (disabled)
 *   }
 * },
 * ...
 */
if (Meteor.isServer) {
  VitalDefinitions.rawCollection().createIndex({ entityId: 1, entityType: 1 }, { unique: true });
}

const AttributeMappings = new Mongo.Collection(COLLECTIONS.ATTRIBUTE_MAPPINGS);
/*
 * entityId: string
 * entityType: string
 * <attributeId1> : object {
 *   source: string // "key-value" or "builtin" (default) or "diagnostics"
 *   path: string
 *   namespace: string
 *   key: string
 *   id: string // an internal ID used by customData. Used to build/rebuild custom data module state
 *   // missing one more field for diagnostics?
 *   transform: TBD
 * }
 * ...
 */
if (Meteor.isServer) {
  AttributeDefinitions.rawCollection().createIndex({ entityId: 1, entityType: 1 }, { unique: true });
}

const AttrValues = new Mongo.Collection(COLLECTIONS.ATTR_VALUES);
/*
 * _id: string (robotId)
 * <attributeId> : object {
 *   value: string/int32/double/boolean // Attribute value.
 *   ts: double // Timestamp of when this attribute was last updated.
 *   // Some attributes will, optionally, have additional metadata
 *   tsAgent: { type: Number, optional: true },
 *   // For accumulators, tsStart optionally marks the time when data started accumulated
 *   // (and allows deciding when to reset if agents send a different tsStart)
 *   tsStart: { type: Number, optional: true },
 *   // For delta-type fields (most of them!), a deltaSeconds tells for how long the attribute
 *   // accumulated to this value. It is optional.
 *   // NOTE(herchu): Used originally in
 *   elapsedSeconds: { type: Number, optional: true }
 * }
 * ...
 */

/**
 * Builds a query to get a robot's attributes values.
 * Note that the return is a mongo find() without a fetch(), so it can be shared between the publication
 * and the widget doing the query.
 *
 * @arg attributes an optional array of attribute IDs. If given, only these are queried; otherwise, all
 *    attributes are returned. Each attribute value is returned in an object with { value, ts }
 * @param {Number} pollingIntervalMs - Number of milliseconds determining how often to poll
 *                                     attributes when observing on the server. If no argument is
 *                                     passed, this defaults to 10 seconds in prod-like env.
 *                                     When setting to less than 10000(ms) this will have a huge
 *                                     performance impact in both server and database. Use very
 *                                     sparingly unless absolutely necessary.
 *
 */
const queryRobotAttributeValues = ({ robotId, attributes = null, pollingIntervalMs = null }) => {
  const options = {};
  if (attributes) {
    options.fields = attributes.reduce((acc, attr) => {
      acc[attr] = 1;
      return acc;
    }, { _id: 1 });
  }
  if (pollingIntervalMs && !Number.isNaN(pollingIntervalMs) && pollingIntervalMs > 50) {
    options.pollingIntervalMs = pollingIntervalMs;
  }
  return AttrValues.find({ _id: robotId }, options);
};

/**
 * Retrieves a robot's vitals. The result is aggregated into one object with attribute IDs as keys,
 * and objects with { ts, value } in the values.
 * (This call uses queryRobotAttributeValues, then fetches and cleans the the results).
 *
 * @arg attributes an optional array of attribute IDs. If given, only these are queried; otherwise, all
 *    attributes are returned. Each attribute value is returned in an object with { value, ts }
 */
const fetchRobotAttributeValues = ({ robotId, attributes = null }) => {
  const results = queryRobotAttributeValues({ robotId, attributes }).fetch();
  const data = results && results[0] && results[0]._id == robotId
    ? results[0]
    : {};
  // remove the robot to turn into a pure attrId-to-value dictionary
  delete data._id;
  return data;
};

/**
 * Builds a query to get attributes definitions.
 * Note that the return is a mongo find() without a fetch(), so it can be shared between the publication
 * and the widget doing the query.
 */
const queryAttributeDefinitions = ({ entityId, entityType }) => {
  return AttributeDefinitions.find({ entityId, entityType });
};

/**
 * Retrieves attributes definitions. The result is aggregated into one object with attribute IDs as keys,
 * and objects with { ts, value } in the values.
 * (This call uses queryAttributeDefinitions), and fetches the result.
 *
 * NOTE: This is like a low level function which does NOT apply hierarchical config,
 * ie. system defaults > company settings > robot settings. This is used from configuration
 * pages to list exactly the attributes set at a given level (entityType) and most likely
 * that should be the only use of this method.
 */
const fetchAttributeDefinitions = ({ entityId, entityType }) => {
  const results = queryAttributeDefinitions({ entityId, entityType }).fetch();
  return results[0] || {};
};

export {
  // Collections
  AttributeDefinitions,
  VitalDefinitions,
  AttributeMappings,
  AttrValues,

  // Queries
  queryRobotAttributeValues,
  fetchRobotAttributeValues,
  queryAttributeDefinitions,
  fetchAttributeDefinitions
};
