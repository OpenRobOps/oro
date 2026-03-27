/**
 * Meteor-agnostic Attributes Manager library
 */

import { isBoolean, isString } from 'lodash';
import yaml from 'js-yaml';

const VITAL_CPU_LOAD_PERCENTAGE = 'cpuLoadPercentage';
const VITAL_RAM_USAGE_PERCENTAGE = 'ramUsagePercentage';
const VITAL_DISK_USAGE_PERCENTAGE = 'diskUsagePercentage';
const VITAL_AGENT_DISK_USAGE_PERCENTAGE = 'diskOroUsagePercentage';
const VITAL_AGENT_DISK_USAGE_MB = 'diskOroUsageMb';
const VITAL_NET_TOTAL_TX_RATE = 'networkTotalTxRate';
const VITAL_NET_TOTAL_RX_RATE = 'networkTotalRxRate';
const VITAL_NET_TOTAL_RATE = 'networkTotalRate';
const VITAL_NET_AGENT_TX_RATE = 'networkOroTxRate';
const VITAL_NET_AGENT_RX_RATE = 'networkOroRxRate';
const VITAL_NET_AGENT_RATE = 'networkOroRate';
const VITAL_NET_TOTAL_TX_BYTES = 'networkTotalTxBytes';
const VITAL_NET_TOTAL_RX_BYTES = 'networkTotalRxBytes';
const VITAL_NET_AGENT_TX_BYTES = 'networkOroTxBytes';
const VITAL_NET_AGENT_RX_BYTES = 'networkOroRxBytes';
const VITAL_SPEED_LINEAR = 'speedLinear';
const VITAL_SPEED_ANGULAR = 'speedAngular';
const VITAL_DISTANCE_LINEAR_SINCE = 'distanceLinearSince';
const VITAL_DISTANCE_ANGULAR_SINCE = 'distanceAngularSince';
const VITAL_DISTANCE_LINEAR = 'distanceLinear';
const VITAL_DISTANCE_ANGULAR = 'distanceAngular';
const VITAL_BATTERY_PERCENTAGE = 'batteryPercentage';
const VITAL_BATTERY_VOLTAGE = 'batteryVoltage';
const VITAL_BATTERY_IS_CHARGING = 'batteryIsCharging';
const VITAL_ROS_MASTER_STATUS  = 'rosMasterStatus';
const VITAL_ONLINE = 'agentOnline';
const VITAL_PING_RTT_MAX = 'pingMax';
const VITAL_PING_RTT_MIN = 'pingMin';
const VITAL_PING_RTT_AVG = 'pingAvg';
const VITAL_PING_RTT_LAST = 'pingLast';
const VITAL_AGENT_TIME_DIFF = 'agentTimeDiff';
const TMP_VITAL_ROS_DIAGNOSTICS  = 'tmpAgentStatus';
const VITAL_ROS_DIAGNOSTICS_STATUS  = 'rosDiagnosticsStatus';
const VITAL_AGENT_VERSION = 'agentVersion';
// VITAL_POSE is introduced as an attribute on Sept'20
// See https://docs.google.com/document/d/1_XXfHQi9O82HijkGWTxFgLqs2G5S23LJghFDjyitQgo/edit#heading=h.qqr9dqrombn
const VITAL_POSE = 'pose';
const VITAL_GPSFIX = 'gpsFix';

const SOURCE_DERIVED_ID = 'derived';

const SOURCES = {
  BUILTIN: { value: 'builtin', label: 'Built-in' },
  SYSTEM_HDD: { value: 'system-hdd', label: 'HDD' },
  SYSTEM_NET: { value: 'system-network', label: 'Network' },
  KEY_VALUE: { value: 'key-value', label: 'ROS topic' },
  ROS_DIAGNOSTICS: { value: 'ros-diagnostics', label: 'ROS Diagnostics' },
  FILE_IMAGE: { value: 'file-image', label: 'Image File' },
  FILE_TEXT: { value: 'file-text', label: 'Text File' },
  DERIVED: { value: SOURCE_DERIVED_ID, label: 'Derived', hideFromConfigUI: true },
  ROS_MONITOR: { value: 'ros-monitor', label: 'ROS monitor', hideFromConfigUI: true }
};
// Convenience high-speed accessor for textual values and for the entire objects
const labels = {};
const fromValue = {};
const fromLabel = {};
// eslint-disable-next-line guard-for-in
for (const label in SOURCES) {
  const st = SOURCES[label];
  labels[st.value] = st.label;
  fromValue[st.value] = st;
  fromLabel[st.label] = st;
}
SOURCES.LABEL = labels;
SOURCES.FROM_VALUE = fromValue;
SOURCES.FROM_LABEL = fromLabel;

const ATTRIBUTE_TYPES = {
  JSON: 'json',
  YAML: 'yaml'
};

/**
 * Simply tells if a given string starts and ends with quotes.
 * (Single- or double-quoted).
 */
const isQuotedString = (value) => {
  return isString(value) && value.length >= 2 &&
    ((value[0] == "\"" && value[value.length - 1] == '"')
    || (value[0] == "'" && value[value.length - 1] == '\''));
};

/**
 * Parses a string into a number, if it comes in a decimal notation (with optional
 * decimal point and decimal positions. If the number cannot be parsed ir returns NaN.
 * NOTE: It is quite strict, not parsing ".1" or "1.".
 * NOTE: No support for i18n.
 *
 * Code from MDN example at https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/parseFloat
 */
const strictParseNumber = (value) => {
  if (/^(\-|\+)?([0-9]+(\.[0-9]+)?|Infinity)$/
    .test(value)) {
    return Number(value);
  }
  return NaN;
};

/**
 * Given an optional attribute definition (from AttributesManager schema) returns
 * a function capable of parsing values coming from robots or APIs.
 *
 * For numbers, it wraps a stricter version of parseFloat() function with
 * ability to strip away a suffix (the unit), and converts percentages from
 * a readable value by dividing by 100 (converting to range 0..1, normally).
 *
 * If the value is 'false' or 'true' (case-insensitive), it parses as a boolean.
 *
 * In all other cases it returns the original string -- as an unparsed value.
 * Optionally, strings can be forced to be kept as string type by enclosing the
 * value in single or double quotes.
 *
 * NOTE Do not use this function for *user* input. This function scales values if
 * appropriate (defined in attrDef.scale) as part of ingest processing and before storing data.
 * We humans type values differently than data coming from robots: For percentages, we will
 * always want to type "100" meaning 100% (value: 1.0), irrespective of any scaling done by ingest.
 *
 * TODO Change this to return a different function depending on attrDef
 *
 * Example:
 * AttributeValueParser(null)('foo') ==> "foo"
 * AttributeValueParser(null)('FaLsE') ==> false
 * AttributeValueParser({ unit: '%' })('74%') ==> 74 // no "scale"
 * AttributeValueParser({ unit: '%', scale: 0.01 })('74%') ==> 0.74
 * AttributeValueParser({ type: 'json' })('[1,2,3]') ==> [1,2,3]
 * AttributeValueParser()('74%') ==> "74%" // becase no `unit` arg was in attrDef
 * AttributeValueParser(null)('1e4') ==> "1e4" // no exponent notation supported
 */
const AttributeValueParser = attrDef => (arg) => {
  if (!isString(arg)) {
    return undefined;
  }
  if (attrDef && attrDef.type == ATTRIBUTE_TYPES.YAML) {
    try {
      return yaml.safeLoad(arg);
    } catch (e) {
      return undefined;
    }
  }
  if (attrDef && attrDef.type == ATTRIBUTE_TYPES.JSON) {
    try {
      return JSON.parse(arg);
    } catch (e) {
      return undefined;
    }
  }
  let str = arg.trim();
  // Parse strings (anything in quotes)
  if (isQuotedString(str)) {
    // If the string is enclosed in quotes, just treat it... as a string (remove quotes)
    return str.substring(1, str.length - 1);
  }
  // Parse booleans
  const lower = str.toLowerCase();
  if (lower === 'false') {
    return false;
  } else if (lower === 'true') {
    return true;
  }
  // Attempt to remove suffix (unit, e.g. "%")
  if (attrDef && attrDef.unit) {
    if (str.endsWith(attrDef.unit)) {
      str = str.substring(0, str.length - attrDef.unit.length);
    }
  }
  // Try to parse number now
  let value = strictParseNumber(str);
  if (Number.isNaN(value)) {
    return arg; // unable to parse it - return original string (not even trimmed)
  }
  // If a `scale` is defined in the attrDef, scale the value with it.
  // For example, when type=='%' use scale=0.01 to _receive_ values in [0..100] and store [0..1]
  if (attrDef && Number.isFinite(attrDef.scale)) {
    value *= attrDef.scale;
  }
  return value;
};

/**
 * Given an optional attribute definition (from AttributesManager schema) returns
 * a function capable of parsing user input into values.
 *
 * It works similarly to AttirbuteValueParser. However, it does not do any scaling. And for
 * percentages, it always assumes our internal representation, ie. values [0..1]. Use this
 * function only to parse user input.
 *
 * Example (note: ignores scale). Other examples are found in AttributeValueParser.
 * AttributeValueParser({ unit: '%' })('74%') ==> 0.74
 * AttributeValueParser({ unit: '%', scale: 0.01 })('74%') ==> 0.74
 *
 * @see AttributeValueParser
 */
const UserInputAttributeValueParser = (attrDef) => {
  const { scale, ...newAttrDef } = attrDef || {};
  newAttrDef.scale = newAttrDef.unit == '%' ? 0.01 : 1;
  return AttributeValueParser(newAttrDef);
};

/**
 * Formats values belonging to a given attribute definition (according
 * to Attributes schema) to a string.
 * If null, or attrDef has no 'unit' or 'precision' fields,
 * the value is just converted to string with default formatting.
 */
const AttributeValueFormatter = attrDef => (val) => {
  // Special cases for non-numeric types
  if (isString(val)) {
    return val;
  } else if (isBoolean(val)) {
    return '' + val;
  }
  // The rest of formatting code assumes `val` is a number

  // val cannot be null/undefined, so "cast" to Number
  val = val || 0;
  if (!attrDef || (!attrDef.precision && !attrDef.unit)) {
    // No format. System will be wise and choose something sensible
    return val.toLocaleString();
  }
  // get the default number of decimal digits (precision)
  let { precision } = attrDef;
  if (precision === null) {
    // toLocaleString treats 'null' as 'no digits', and for
    // us both undefined and null mean 'use defaults'
    precision = undefined;
  }
  // First, if unit is "%", values are assumed to be in range [0,1]
  if (attrDef.unit == '%') {
    val *= 100;
    if (precision === null || precision === undefined) {
      precision = 1; // One decimal for percentages
    }
  }
  // Let toLocaleString format the result, passing
  // maximumFractionDigits. Note that if precision is null/undefined, the
  // function toLocaleString will assume no options and just use defaults.
  // TODO(herchu) consider also using maximumSignificantDigits.
  // TODO(herchu) use current locale, not always English
  return val.toLocaleString('en-US', {
    maximumFractionDigits: precision
  }) + (attrDef.unit || '');
};

// Mapping types from ROS monitoring "tasks" to attributes.
// These are the possible values of `type` field of an AttributeMapping.
// See https://docs.google.com/document/d/1NF_56a5CYkrDLqIeZ4oOnxzOyorkiTrYtO1pI2KuiLQ/edit#heading=h.49wzx3x6esei
const ROS_MONITORING_TYPES = {
  TOPIC_RATE: 'topic/rate',
  PARAM_VALUE: 'param/value',
  NODE_PING: 'node/ping'
};

export {
  // Attribute name constants
  VITAL_CPU_LOAD_PERCENTAGE,
  VITAL_RAM_USAGE_PERCENTAGE,
  VITAL_DISK_USAGE_PERCENTAGE,
  VITAL_AGENT_DISK_USAGE_PERCENTAGE,
  VITAL_AGENT_DISK_USAGE_MB,
  VITAL_NET_TOTAL_TX_RATE,
  VITAL_NET_TOTAL_RX_RATE,
  VITAL_NET_TOTAL_RATE,
  VITAL_NET_AGENT_TX_RATE,
  VITAL_NET_AGENT_RX_RATE,
  VITAL_NET_AGENT_RATE,
  VITAL_NET_TOTAL_TX_BYTES,
  VITAL_NET_TOTAL_RX_BYTES,
  VITAL_NET_AGENT_TX_BYTES,
  VITAL_NET_AGENT_RX_BYTES,
  VITAL_SPEED_LINEAR,
  VITAL_SPEED_ANGULAR,
  VITAL_DISTANCE_LINEAR_SINCE,
  VITAL_DISTANCE_ANGULAR_SINCE,
  VITAL_DISTANCE_LINEAR,
  VITAL_DISTANCE_ANGULAR,
  VITAL_BATTERY_PERCENTAGE,
  VITAL_BATTERY_VOLTAGE,
  VITAL_BATTERY_IS_CHARGING,
  VITAL_ROS_MASTER_STATUS,
  VITAL_PING_RTT_MAX,
  VITAL_PING_RTT_MIN,
  VITAL_PING_RTT_AVG,
  VITAL_PING_RTT_LAST,
  VITAL_AGENT_TIME_DIFF,
  VITAL_ONLINE,
  TMP_VITAL_ROS_DIAGNOSTICS,
  VITAL_ROS_DIAGNOSTICS_STATUS,
  VITAL_POSE,
  VITAL_GPSFIX,
  VITAL_AGENT_VERSION,

  // Source types id
  SOURCE_DERIVED_ID,

  // Source types
  SOURCES,
  // ROS monitoring attribute types
  ROS_MONITORING_TYPES,

  // Attribute types
  ATTRIBUTE_TYPES,

  // Attribute processing helper functions
  AttributeValueParser,
  AttributeValueFormatter,
  UserInputAttributeValueParser,
};
