/**
 * Util functions
 */
import { isObject, isArray, isString, isBoolean, isNumber, isEqual, isEmpty } from 'lodash';
import moment from 'moment';
import convert from 'convert-units';

/**
 * Replaces the password part of an URI by '...' for safer printing.
 * It attempts to parse the URI format -- it it fails, it simply returns a constant string
 * so we don't accidentally print passwords to logs.
 *
 * Example:
 * > anonymizeUri('mqtt://user:passw0rd@host.mqtt.com/myqueue')
 * 'mqtt://user:...@host.mqtt.com/myqueue'
 */
const anonymizeUri = (uri) => {
  const match = (uri || '').match('([a-z]+://[^:]*:).*(@.*)');
  return match ? match[1] + '...' + match[2] : '(anonymized url)';
};


/**
 * Flattens a given source object into dot notation, for key-by-key
 * insertion or modification in Mongo
 */
const toDotNotation = (source, prefix, target = {}) => {
  for (const key in source) {
    const targetKey = prefix === undefined ? key : prefix + "." + key;
    if (isObject(source[key]) && !isArray(source[key])) {
      toDotNotation(source[key], targetKey, target);
    } else {
      target[targetKey] = source[key];
    }
  }
  return target;
};

/**
 * Converts an primitive value (string, number, object or boolean) into an object in one of the following
 * forms:
 *   `{ stringValue: <the string value> }`, or
 *   `{ doubleValue: <the number value> }`, or
 *   `{ jsonStringValue: <the object> }`, or
 *   `{ boolValue: <the boolean value> }`.
 * This is used for protobuf encoding, to encode a value of variable type into a VariantValue
 * message from system.proto definitions.
*/
const toVariant = (value) => {
  if (isString(value)) {
    return { stringValue: value };
  } else if (isNumber(value)) {
    return { doubleValue: value };
  } else if (isBoolean(value)) {
    return { boolValue: value };
    // If it's a generic object, attempt to encode in json to recover on the other side
  } else if (isObject(value)) {
    return { jsonStringValue: JSON.stringify(value) };
  } else {
    // Don't know how to encode that type. Can be added more types when we support them.
    return {};
  }
};

/**
 * Converts an object with ONE of the following fields:
 *   { stringValue, doubleValue, boolValue, jsonStringValue }
 * into the ... value that field contains. This is the converse of toVariant().
 */
const fromVariant = (obj) => {
  if (!isObject(obj)) {
    return null;
  } else if ('stringValue' in obj) {
    return obj.stringValue;
  } else if ('doubleValue' in obj) {
    return obj.doubleValue;
  } else if ('boolValue' in obj) {
    return obj.boolValue;
  } else if ('jsonStringValue' in obj) {
    try {
      return JSON.parse(obj.jsonStringValue);
    } catch (e) {
      return null;
    }
  } else {
    return null;
  }
}


/**
 * Converts an object with one distinguished field (by default: 'value'), whose value is
 * of a variant type (string, number or bool) into a new object identical to the original,
 * replacing that value by one of three objects:
 *   `{ stringValue: <the string value> }`, or
 *   `{ doubleValue: <the number value> }`, or
 *   `{ boolValue: <the boolean value> }`.
 * This is used for protobuf encoding, to map the inner object to a VariantValue message from
 * our system.proto definition.
 */
const replaceVariant = (obj, field = 'value') => {
  const { [field]: value, ...other } = obj;
  return Object.assign(other, { value: toVariant(value) });
};

/**
 * Converts a dictionary of objects: `{ key1: object1, key2: object2 ... }`
 * where each object is of the form `{ value, ..others }` and `value` can be a variant type
 * (string, double, bool) into a similar map where values are explicitly typed within
 * an object:
 *   `{ value: { stringValue: 'a' }, ...other }`
 * This function is simply a wrapper to iterate `toVariant()` on an object. See toVariant() for
 * more information.
 */
const valuesMapToVariant = (values, field = 'value') => (
  Object.entries(values).reduce((acc, [key, value]) => (
    acc[key] = replaceVariant(value, field), acc // it's correct: a comma expression to avoid return
  ), {})
);


export {
  anonymizeUri,
  toDotNotation,
  toVariant,
  fromVariant,
  replaceVariant,
  valuesMapToVariant,
};
