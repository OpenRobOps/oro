/*
 * This modules implements Dashboard contexts, the per-Dashboard global state
 * that Dashboard widgets can use to publish or read data. This way widgets in
 * a Dashboard can be synchronized. For example, a Fleet status can publish to
 * the context its robot selection, which a Vital widgets can  read to follow
 * the Fleet's selected robot.
 *
 * The context is divided into *slots*. Currently we have four slots:
 *   - Robot slot (for the moment, only robotId)
 *   - Fleet slot (robotStatus, metricStatus, groupBy, sortBy)
 *   - Incident slot (for the moment, only incidentId)
 *   - Time slot (start, end, focus)
 *
 * For instance, a possible context is:
 *   {
 *     robot: { robotId : '576896174' },
 *     fleet: {
 *       robotStatus: 'e',
 *       metricStatus: { cpuLoadPct: 'w' },
 *       groupBy: 'hardware',
 *       sortBy: 'n'
 *     },
 *     time: {
 *       start: 1606910700066,
 *       end: 1606918700066,
 *       focus: 1606910900036
 *     }
 *   }
 *
 * To avoid overwriting the context in cases where a Dashboard could host more
 * than one instance of the same widget, widgets can be scoped. For example we
 * can have a Dashboard with two scoped Fleet status widgets, one writing its
 * robot and fleet slots to scope "a" and the other to scope "b". That is the
 * widget's write scope. Widgets can also define a converse read scope: we can
 * have two Vitals: one with read scope "a" following the first Fleet status
 * robot slot, and other with read scope "b" following the second Fleet status
 * robot slot. In this case the context would be:
 *
 *   {
 *     // Slots for first fleet status, one vitals reads from a.robot.robotId
 *     a: { robot: { ... }, fleet: { ... } },
 *     // Slots for second fleet status, other vitals reads from b.robot.robotId
 *     b: { robot: { ... }, fleet: { ... } }
 *   }
 */
import { isEmpty, isPlainObject, isArray } from 'lodash';
// ORO modules
import { empty, string, char, re, oneOf, chain, many, pmap, parens } from './miniparsers';
import { getUrlParams } from './urlParser';

// Slots we can find in a context
const CONTEXT_SLOTS = {
  ROBOT: 'robot',
  ROBOTS: 'robots',
  FLEET: 'fleet',
  INCIDENT: 'incident',
  TIME: 'time',
  NAVIGATION: 'navigation',
  AUDIT_LOG: 'auditLog',
  MISSION: 'mission',
  LOCATION: 'location',
};

// Properties for all context slots, all in one list for convenience
const CTX_PROPS = {
  // Robot slot properties
  ROBOT_ID: 'robotId',
  // Robots slot properties
  ROBOT_IDS: 'robotIds',
  // ROS out properties
  ROS_VERBOSITY: 'RosVerbosity',
  // Ros diagnostics properties
  DIAGNOSTICS_LEVEL: 'RosDiagnosticsLevel',
  // Fleet slot properties
  ROBOT_STATUS: 'robotStatus',
  ATTR_STATUS: 'attrStatus',
  GROUP_BY: 'groupBy',
  SORT_BY: 'sortBy',
  SUMMARY: 'summary', // Toggles the summary view in fleet widget
  // Incident properties
  INCIDENT_ID: 'incidentId',
  ICM_COMPONENT: 'componentId',
  ICM_SEVERITY: 'severity',
  // Time properties
  START_TIME: 'startTime',
  TIME_RANGE: 'timeRangeMs',
  FOCUS_TIME: 'focusTime',
  // Time Capsule properties (used in the playback / Time Capsule app)
  MAP_VISUALIZATION_TYPE: 'mapVisualizationType',
  SAVED_PATH_TYPE: 'savedPathType',
  MAP: 'map',
  IS_PLAYING: 'isPlaying',
  // Audit Log properties
  EVENT_MODULE: 'module',
  EVENT_TYPE: 'eventType',
  USER_ID: 'userId',
  ACTION_ID: 'actionId',
  // Missions properties
  MISSION_LABEL_FILTER: 'label',
  // Location properties
  LOCATION_ID: 'locationId',
  SUBLOCATION_ID: 'sublocationId',
  MAP_ID: 'mapId',
  // Orders properties
  ORDER_STATES: 'orderStates',
  ORDER_FIELDS: 'orderFields',
};

/**
 * Get property from a context slot, with an optional scope.
 *
 * @param {object} ctx
 * @param {string} slot
 * @param {string} prop Optional: If passed it returns the value of this prop
 *        inside the context slot.
 *        If it is not passed then it reads the whole context slot
 * @param {string} scope
 * @param {function} type Optional: A function (constructor) to cast the string
 *        property to another type. For example: `Number` or `x => x == 'true'`
 */
const readCtx = ({ ctx = {}, scope, slot, prop, type }) => {
  const readSlot = (scope ? (ctx[scope] || {})[slot] : ctx[slot]) || {};
  const value = prop ? readSlot[prop] : readSlot;
  return type ? type(value) : value;
};

/**
 * Build a context transformer that given a context, will remove the given
 * property from it. This function ensures no empty slots or scopes remain
 * once a property is removed. For example, for the context:
 *
 *   ctx = { scope_0: fleet: { fleetId: '123' } }
 *
 * After calling deleteCtx({ scope: 'scope_0', slot: 'fleet', prop: 'fleetId' })(ctx)
 * we will get {} as the resulting context, since fleet (and transitively, scope_0)
 * become empty.
 *
 * @param {string} scope
 * @param {string} slot
 * @param {string} prop
 */
const deleteCtx = ({ scope, slot, prop }) => (ctx) => {
  // Delete property from an object without mutation
  // eslint-disable-next-line no-shadow
  const deleteProp = (prop, { [prop]: _, ...rest }) => rest;
  // Set parent[prop] = obj if obj is not empty, otherwise remove prop
  // eslint-disable-next-line no-shadow
  const addIfNotEmpty = (parent, prop, obj) => (
    isEmpty(obj) ? deleteProp(prop, parent) : { ...parent, [prop]: obj }
  );
  const oldSlot = (scope ? (ctx[scope] || {})[slot] : ctx[slot]) || {};
  const newSlot = deleteProp(prop, oldSlot);
  if (scope) {
    const newScope = addIfNotEmpty(ctx[scope] || {}, slot, newSlot);
    return addIfNotEmpty(ctx, scope, newScope);
  } else {
    return addIfNotEmpty(ctx, slot, newSlot);
  }
};

/**
 * Given a value, return a context transformer writing a property
 * to a context slot, with an optional scope. Null or undefined
 * values remove the property from the context.
 *
 * @param {string} scope
 * @param {string} slot
 * @param {string} prop
 * @return function expecting a value.
 *
 * Once a value is passed, the function will act as a context transformer.
 * Such context transformer, given a context to transform, will get the
 * intended slot from the given context, and put the given value under
 * the key prop in that slot.
 */
const writeCtx = ({ scope, slot, prop }) => value => (ctx) => {
  if (!value) {
    return deleteCtx({ scope, slot, prop })(ctx);
  }
  const oldSlot = (scope ? (ctx[scope] || {})[slot] : ctx[slot]) || {};
  const newSlot = prop ? { ...oldSlot, [prop]: value } : value;
  if (scope) {
    const oldScope = ctx[scope];
    const newScope = { ...oldScope, [slot]: newSlot };
    return { ...ctx, [scope]: newScope };
  } else {
    return { ...ctx, [slot]: newSlot };
  }
};

/**
 * Apply a list context mutators from left to right on a given initial context.
 *
 * @param {array} mutators list of mutators to apply
 * @param {object} ctx iniital context
 * @return resulting context after applying all the mutators
 */
const reduceCtx = (mutators, ctx = {}) => mutators.reduce((c, r) => r(c), ctx);

// Convenience functions reading/writing 'robot' context properties
const readRobotProp = ({ ctx, scope, prop, type }) => (
  readCtx({ ctx, scope, prop, slot: CONTEXT_SLOTS.ROBOT, type })
);
const writeRobotProp = ({ scope, prop }) => (
  writeCtx({ scope, prop, slot: CONTEXT_SLOTS.ROBOT })
);
const deleteRobotProp = ({ scope, prop }) => (
  deleteCtx({ scope, prop, slot: CONTEXT_SLOTS.ROBOT })
);

// Convenience functions reading/writing 'fleet' context properties
const readFleetProp = ({ ctx, scope, prop, type }) => (
  readCtx({ ctx, scope, prop, slot: CONTEXT_SLOTS.FLEET, type })
);
const writeFleetProp = ({ scope, prop }) => (
  writeCtx({ scope, prop, slot: CONTEXT_SLOTS.FLEET })
);
const deleteFleetProp = ({ scope, prop }) => (
  deleteCtx({ scope, prop, slot: CONTEXT_SLOTS.FLEET })
);

// Convenience functions reading/writing 'incident' context properties
const readIncidentProp = ({ ctx, scope, prop, type }) => (
  readCtx({ ctx, scope, prop, slot: CONTEXT_SLOTS.INCIDENT, type })
);
const writeIncidentProp = ({ scope, prop }) => (
  writeCtx({ scope, prop, slot: CONTEXT_SLOTS.INCIDENT })
);
const deleteIncidentProp = ({ scope, prop }) => (
  deleteCtx({ scope, prop, slot: CONTEXT_SLOTS.INCIDENT })
);

// Convenience functions reading/writing 'time' context properties
const readTimeProp = ({ ctx, scope, prop, type }) => (
  readCtx({ ctx, scope, prop, slot: CONTEXT_SLOTS.TIME, type })
);
const writeTimeProp = ({ scope, prop }) => (
  writeCtx({ scope, prop, slot: CONTEXT_SLOTS.TIME })
);
const deleteTimeProp = ({ scope, prop }) => (
  deleteCtx({ scope, prop, slot: CONTEXT_SLOTS.TIME })
);

// Convenience functions reading/writing Time Capsule ('tc') context properties
const readTimeCapsuleProp = ({ ctx, scope, prop, type }) => (
  readCtx({ ctx, scope, prop, slot: CONTEXT_SLOTS.TIME_CAPSULE, type })
);
const writeTimeCapsuleProp = ({ scope, prop }) => (
  writeCtx({ scope, prop, slot: CONTEXT_SLOTS.TIME_CAPSULE })
);
const deleteTimeCapsuleProp = ({ scope, prop }) => (
  deleteCtx({ scope, prop, slot: CONTEXT_SLOTS.TIME_CAPSULE })
);

// Convenience functions reading/writing 'navigation' context properties
const readNavigationProp = ({ ctx, scope, prop, type }) => (
  readCtx({ ctx, scope, prop, slot: CONTEXT_SLOTS.NAVIGATION, type })
);
const writeNavigationProp = ({ scope, prop }) => (
  writeCtx({ scope, prop, slot: CONTEXT_SLOTS.NAVIGATION })
);
const deleteNavigationProp = ({ scope, prop }) => (
  deleteCtx({ scope, prop, slot: CONTEXT_SLOTS.NAVIGATION })
);

// Convenience functions reading/writing 'audit log' context properties
const readAuditLogProp = ({ ctx, scope, prop, type }) => (
  readCtx({ ctx, scope, prop, slot: CONTEXT_SLOTS.AUDIT_LOG, type })
);
const writeAuditLogProp = ({ scope, prop }) => (
  writeCtx({ scope, prop, slot: CONTEXT_SLOTS.AUDIT_LOG })
);
const deleteAuditLogProp = ({ scope, prop }) => (
  deleteCtx({ scope, prop, slot: CONTEXT_SLOTS.AUDIT_LOG })
);

// Convenience functions reading/writing 'Mission' context properties
const readMissionProp = ({ ctx, scope, prop, type }) => (
  readCtx({ ctx, scope, prop, slot: CONTEXT_SLOTS.MISSION, type })
);
const writeMissionProp = ({ scope, prop }) => (
  writeCtx({ scope, prop, slot: CONTEXT_SLOTS.MISSION })
);
const deleteMissionProp = ({ scope, prop }) => (
  deleteCtx({ scope, prop, slot: CONTEXT_SLOTS.MISSION })
);

// Convenience functions reading/writing 'MissionKpis' context properties
const readMissionKpisCtx = ({ ctx, scope, prop, type }) => (
  readCtx({ ctx, scope, prop, slot: CONTEXT_SLOTS.MISSION_KPIS, type })
);
const writeMissionKpisCtx = ({ scope, prop }) => (
  writeCtx({ scope, prop, slot: CONTEXT_SLOTS.MISSION_KPIS })
);
const deleteMissionKpisCtx = ({ scope, prop }) => (
  deleteCtx({ scope, prop, slot: CONTEXT_SLOTS.MISSION_KPIS })
);

// Convenience functions reading/writing 'location' context properties
const readLocationProp = ({ ctx, scope, prop, type }) => (
  readCtx({ ctx, scope, prop, slot: CONTEXT_SLOTS.LOCATION, type })
);
const writeLocationProp = ({ scope, prop }) => (
  writeCtx({ scope, prop, slot: CONTEXT_SLOTS.LOCATION })
);
const deleteLocationProp = ({ scope, prop }) => (
  deleteCtx({ scope, prop, slot: CONTEXT_SLOTS.LOCATION })
);

// Convenience functions reading/writing 'order' context properties
const readOrderProp = ({ ctx, scope, prop, type }) => (
  readCtx({ ctx, scope, prop, slot: CONTEXT_SLOTS.ORDER, type })
);
const writeOrderProp = ({ scope, prop }) => (
  writeCtx({ scope, prop, slot: CONTEXT_SLOTS.ORDER })
);
const deleteOrderProp = ({ scope, prop }) => (
  deleteCtx({ scope, prop, slot: CONTEXT_SLOTS.ORDER })
);

// Convenience serialization function URI-encoding a string,
// *including* parenthesis (not handled by encodeURIComponent)
const uriEncodeCtxStr = str => encodeURIComponent(str).replace('(', '%28').replace(')', '%29');

/**
 * Context serialization. Mimics its json representation, but avoiding
 * quotes around values and using only url-safe characters. For example:
 *
 *   { a: { fleet: { sortBy: 'i' } } } serializes to:
 *     (a:(fleet:(sortBy:i)))
 *
 *   { robot: { robotId: '123' }, fleet: { status: ['e', 'o'] } } serializes to:
 *     (robot:(robotId:123),fleet:(status:!(e,o)))
 *
 * @param {object} value value to serialize
 * @return serialized context string
 */
const serializeCtx = (value = {}) => {
  if (isPlainObject(value)) {
    // TODO(Pablo): we might need to sort context entries if Object.entries doesn't guarantee order
    // NOTE(Pablo): as of ES2015+, order seems to be guaranteed:
    // https://stackoverflow.com/questions/5525795/does-javascript-guarantee-object-property-order
    return `(${Object.entries(value).map(([k, v]) => `${uriEncodeCtxStr(k)}:${serializeCtx(v)}`)})`;
  } else if (isArray(value)) {
    return `!(${value.map(serializeCtx)})`;
  } else {
    return uriEncodeCtxStr(value);
  }
};

/**
 * Inverse of serializeCtx function. Basically a json parser.
 *
 * @param {string} str context to deserialize
 * @return deserialized context object
 */
const deserializeCtx = (str = '') => {
  // Object key: anything up to a ':' or a ')'
  const parseKey = pmap(decodeURIComponent, re(/[^:)]+/));
  // Atomic value: anything up to a ',' or a ')'
  const parseAtomicValue = pmap(decodeURIComponent, re(/[^,)]+/));
  // Value: array, object, or atomic.
  // Using (str) arg to allow forward refs to parseArray and parseObject
  // eslint-disable-next-line no-shadow
  const parseValue = str => oneOf(parseArray, parseObject, parseAtomicValue)(str);
  // Key value pair: <key>:<value>
  // pmap function discards middle ':' and returns [key,value]
  const parseKeyValue = pmap(([k, , v]) => [k, v], chain(parseKey, char(':'), parseValue));
  // Array: !(value1,...,value_n)
  // pmap function discards leading '!(' and final ')'
  const parseArray = pmap(
    ([, values,]) => values,
    chain(string('!('), many(parseValue, ','), char(')'))
  );
  // Object: (key_1:value1,...,key_n:value_n)
  // pmap function builds object from list of key-value pairs
  const parseObject = pmap(
    kvs => kvs.reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {}),
    parens(many(parseKeyValue, ','))
  );

  try {
    // Context: either object or empty string turned into {} by a pmap
    const [ctx, rest] = oneOf(parseObject, pmap(() => ({}), empty))(str);
    // If there's unconsumed input, serialized context has trailing garbage.
    // Example: '(a:1)garbage' will result in [{a: '1'}, 'garbage']
    // Warn about the uncosumed input and return the parsed context
    if (rest) {
      console.warn(`Unparsed input following context: ${rest}`);
    }
    return ctx;
  } catch (e) {
    // Recover from a parsing error by returning an empty context
    console.warn(`Invalid context: ${str}: ${e.toString()}`);
    return {};
  }
};

/**
 * Deserialize context from the given location's query params.
 *
 * @param {object} location react-route location object
 * @return Object, context as a deserialized object
 */
const readContext = (location) => {
  if (!location) {
    return {};
  }
  const { ctx } = getUrlParams(location.search);
  return deserializeCtx(ctx);
};

export {
  CTX_PROPS,
  CONTEXT_SLOTS,
  readCtx,
  writeCtx,
  deleteCtx,
  reduceCtx,
  serializeCtx,
  deserializeCtx,
  readContext,
  readRobotProp,
  writeRobotProp,
  deleteRobotProp,
  readFleetProp,
  writeFleetProp,
  deleteFleetProp,
  readIncidentProp,
  writeIncidentProp,
  deleteIncidentProp,
  readTimeProp,
  writeTimeProp,
  deleteTimeProp,
  readTimeCapsuleProp,
  writeTimeCapsuleProp,
  deleteTimeCapsuleProp,
  readNavigationProp,
  writeNavigationProp,
  deleteNavigationProp,
  readAuditLogProp,
  writeAuditLogProp,
  deleteAuditLogProp,
  writeMissionProp,
  readMissionProp,
  deleteMissionProp,
  writeMissionKpisCtx,
  readMissionKpisCtx,
  deleteMissionKpisCtx,
  readLocationProp,
  writeLocationProp,
  deleteLocationProp,
  readOrderProp,
  writeOrderProp,
  deleteOrderProp,
};
