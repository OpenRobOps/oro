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

export {
  anonymizeUri,
  toDotNotation
};
