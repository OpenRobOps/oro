/**
 * Utility functions for REST apis.
 */
import { isObject } from 'lodash';
import { VALID_ID_CAPTURE_PATTERN } from '../shared/constants';

// HTTP header to receive the etag for conditional updates (used initially for Mission Tracking
// conditional writes, ./missions ands its design doc)
const HEADER_IF_MATCH = 'if-match';

/**
 * Helper function to convert a string to a regexp, forcing to match the entire input.
 */
const stringToRegexp = str => new RegExp(`^${str}$`);

/**
 * Converts an API path to a regular expression, so that we can guarantee
 *  - regexp start and end match ("$"" and "^")
 *  - uniform IDs treatment (always same characters)
 *  - always a leading slash, no trailing slashes
 *
 * For example, it turns the string
 *    "/robots/{robotId:id}/lock"
 * into the regexp:
 *    /^\/robots\/(?<robotId>[-0-9a-zA-Z_]+)\/lock$/
 */
const routePathToRegexp = (path) => {
  // split into path components, remove empty elements (given by trailing and
  // leading slashes)
  const components = path.split('/').filter(elem => elem).map((comp) => {
    if (comp[0] == '{') {
      // This is a capture expression
      if (comp[comp.length - 1] != '}') {
        throw new Error('malformed path component, no matching "}": ' + comp);
      }
      const [name, type] = comp.substr(1, comp.length - 2).split(':');
      if (!name || !type) {
        throw new Error('malformed path component, missing name or type: ' + comp);
      }
      if (type == 'id') {
        // an id allows only a subset of all chars, see VALID_ID_CAPTURE_PATTERN
        return `(?<${name}>${VALID_ID_CAPTURE_PATTERN})`;
      } else {
        // TODO(herchu) support other types, e.g. numeric
        throw Error('malformed path component, unsupported type: ' + comp);
      }
    } else {
      return comp;
    }
  });
  return stringToRegexp('/' + components.join('\\/'));
};

/**
 * Writes a JSON response with appropriate headers, and sends response back with
 * a given status code.
 */
function sendJSONResponse(res, statusCode, result) {
  // Global response headers
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', '*');
  res.writeHead(statusCode);
  res.write(JSON.stringify(result));
  res.end();
}

/**
 * Sends a redirect to the response object (assuming `statusCode` is a 3xx value)
 * and the "Location:" header with the given `url` value.
 */
function sendRedirectResponse(res, statusCode, url) {
  res.setHeader('Location', url);
  res.writeHead(statusCode);
  res.end();
}

/**
 * Simple wrapper to return an error message with a 404 "Not Found" HTTP status;
 * in the 2-element array format expected by our REST API framework.
 */
const notFoundApiError = msg => [{ error: msg }, 404];

/**
 * Simple wrapper to return an error message with a 400 "Bad request" HTTP status;
 * in the 2-element array format expected by our REST API framework.
 */
const badRequestApiError = msg => [{ error: msg }, 400];

/**
 * Simple wrapper to return an error message with a 403 "Unauthorized" HTTP status;
 * in the 2-element array format expected by our REST API framework.
 */
const unauthorizedApiError = msg => [{ error: msg }, 403];

/**
 * Simple wrapper to return an error message with a 412 (Predconditional failed) which we use
 * to represent "Write Conflict" errors.
 * It returns a 2-element array format expected by our REST API framework.
 */
const writeConflictError = (msg = 'Write conflict') => [{ error: msg }, 412];

/**
 * Simple wrapper to return an error message with a 500 "Internal Server Error" HTTP status;
 * in the 2-element array format expected by our REST API framework.
 */
const internalServerError = (msg = 'Internal server error') => [{ error: msg }, 500];

/**
 * Function to validate headers and document values before an update. Used to implement
 * conditional updates (see Missions Tracking doc linked from ./missionTracking). It implements
 * a mechanism like this: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/If-Match
 *
 * This function checks if a "If-Match" header is present. If it is, it assumes its value
 * (the "etag" in HTTP terms) is greater than or equal to the value in `highWaterMark`, a field
 * in the document to update -- both assumed to be numeric. Attempts to write with a lower
 * header value get rejected, assuming a newer update was performed.
 *
 * @param {number} highWaterMark Optional, the current, last-saved highWaterMark value in the db doc
 * @param {object} headers The HTTP headers as received in the request
 * @returns {boolean} True if the write can be performed, according to the highWaterMark
 */
const validateHighWaterMark = ({ highWaterMark, headers }) => {
  if (!isObject(headers)) {
    throw new Error('(HTTP) headers must be an object');
  }
  if (!(HEADER_IF_MATCH in headers)) { // No highWaterMark given, not a conditional write
    return true;
  }
  if (!highWaterMark) { // If there is no previous highWaterMark, the update is always valid too
    return true;
  }
  // Note: Only numeric values are allowed as the "etag". Also there is no "weak" comparison
  // as defined by HTTP standards (W/"value").
  const updateMark = Number.parseInt(headers[HEADER_IF_MATCH], 10);
  highWaterMark = Number.parseInt(highWaterMark, 10);
  return updateMark >= highWaterMark;
};

export {
  routePathToRegexp,
  stringToRegexp,
  notFoundApiError,
  badRequestApiError,
  unauthorizedApiError,
  writeConflictError,
  sendJSONResponse,
  sendRedirectResponse,
  validateHighWaterMark,
  internalServerError
};
