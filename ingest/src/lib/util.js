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

export {
  anonymizeUri
};
