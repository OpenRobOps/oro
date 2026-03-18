/**
 * REST APIs
 *
 * For now this module mixes routing and implementation of REST endpoints.
 */

import { Meteor } from 'meteor/meteor';
import { Accounts } from 'meteor/accounts-base';
import { WebApp } from 'meteor/webapp';
import bodyParser from 'body-parser';
import URL from 'url';
import { isFunction } from 'lodash';
// ORO modules
import { Robot } from './model';
import OroRoles from './roles';
// import locksApiRoutes from './rest/locks_rest_api';
import robotApiRoutes from './rest/robots';
import attributesApiRoutes from './rest/attributes';
// import auditLogsApiRoutes from './rest/auditLogs';
// import incidentsApiRoutes from './rest/incidents';
// import mapsApiRoutes from './rest/maps';
// import acitonsApiRoutes from './rest/actions';
import localizationApiRoutes from './rest/localization';
// import missionTrackingRoutes from './rest/missionTracking';
// import navigationRoutes from './rest/navigation';
import configAPIRoutes from './rest/configAPI';
// import expressionsRoutes from './rest/expressions';
// import cameraImagesRoutes from './rest/cameraImages';
import {
  routePathToRegexp,
  stringToRegexp,
  sendJSONResponse,
  sendRedirectResponse
} from './rest_api_common';
import { getSystemUser, glueId, isSystemUser } from '../shared/roles';

// Constants used in this module
const HTTP_APP_KEY_HEADER = 'x-auth-app-key';
const HTTP_INORBIT_APP_KEY_HEADER = 'x-auth-inorbit-app-key';
// Header to allow services authentication with a DIFFERENT (undocumented) 'peer' api key
const HTTP_PEER_KEY_HEADER = 'x-auth-peer-key';
const HTTP_EFFECTIVE_USER_ID_HEADER = 'x-auth-effective-user-id';
// Peer key value, comes from Meteor settings (if present)
const PEER_KEY = Meteor.settings.peerKey;

const APP_KEY_USER_FIELD = 'services.oro.appKey';

/**
 * Test endpoint that returns 200 when the user is authenticated.
 */
function testEndpoint({ res, user }) {
  res.writeHead(200);
  res.write(JSON.stringify({
    ok: true,
    user: user._id
  }));
  res.end();
}

/**
 * Define our API routes
 *
 * Route paths can contain named groups that are passed to the handler as parameters.
 * For example the following route definition
 *
 * {
 *   path: /\^/robots\/(?<robotId>[0-9a-zA-Z]+)\/status$/,
 *   method: 'GET',
 *   handler: myHandler,
 *   trackingId: 'some string for pendo'
 * }
 *
 * Will match /robots/xxx100/status and xxx100 will be passed to the handler.
 *
 * Each route object has:
 *
 * @typedef {Object} route
 * @property {RegExp} path URL path (a String is also allowed, and converted)
 *   to a Regexp by routePathToRegexp()
 * @property {String} method HTTP method
 * @property {Function} handler Function that handles HTTP request that match path and method.
 * @property {String} trackingId optional id used to track API calls in Pendo.
 */
const routes = [
  { path: /^\/test$/, method: 'GET', handler: testEndpoint, trackingId: 'test' },
].concat(
  // Routes imported from other modules
  // locksApiRoutes,
  robotApiRoutes,
  attributesApiRoutes,
  // incidentsApiRoutes,
  // mapsApiRoutes,
  // acitonsApiRoutes,
  localizationApiRoutes,
  // missionTrackingRoutes,
  // navigationRoutes,
  // auditLogsApiRoutes,
  configAPIRoutes,
  // expressionsRoutes,
  // cameraImagesRoutes,
);

/**
 * Make regexps for all the routes (both `path` and the optional `accept` field),
 * if they are given in string form
 */
const sanitizeRoute = (route) => {
  if (typeof route.path == 'string') {
    route.path = routePathToRegexp(route.path);
  }
  if (typeof route.accept == 'string') {
    route.accept = stringToRegexp(route.accept);
  }
};
routes.forEach(sanitizeRoute);

/**
 * Helper function used for logging enabled routes.
 * Given a route { method, path, handler, accept, ... } it returns a string used to log this
 * API path.
 */
const formatRoute = r => (
  (r.method || 'GET').substr(0, 3) + ' ' + r.path + (r.accept ? ` [${r.accept}]` : '')
);

/**
 * Adds a new route handler to the HTTP APIs, after regular initialization.
 * This is used to add a health probe, and only after the app has fully initialized.
 */
const addApiRoute = (route) => {
  if (!route.path || !route.method || !isFunction(route.handler)) {
    throw new Error('Each API route must have { path, method, handler }');
  }
  sanitizeRoute(route);
  routes.push(route);
  console.info('Added API path:', formatRoute(route));
};

// Leave this logging on, it's helpful and only printed on startup
(() => {
  // Build and execute a closure just for the local array copy so it does not stay in memory
  const routesCopy = [...routes];
  routesCopy.sort((a, b) => String(a.path).localeCompare(String(b.path)));
  console.info('Enabled API paths:', routesCopy.map(formatRoute));
})();

/**
 * Validates that the request headers contain a valid appKey.
 * If the key is valid, the associated user document is returned, else false is returned.
 *
 * Two forms of authentication are implemented:
 *  - with an appKey header 'x-auth-app-key': For external calls. The user is normally
 *    a service user
 *  - with a peerKey header 'x-auth-peer-key': For internal calls from peer services.
 *    In this case, there CAN be another header 'x-auth-effective-user-id' that identifies
 *    the original user making the request.
 *
 * @param {Object} req Web request object
 * @param {Object} res Web response object
 * @returns {Object} Object with { user, peerApi }
 */
async function validateAppKey(req, res) {
  // For compatibility with InOrbit tools, accept both headers for an app key
  // This can be removed in the future.
  const appKey = req.headers[HTTP_APP_KEY_HEADER] || req.headers[HTTP_INORBIT_APP_KEY_HEADER] ;
  const peerKey = req.headers[HTTP_PEER_KEY_HEADER];
  const effectiveUserId = req.headers[HTTP_EFFECTIVE_USER_ID_HEADER];
  let user;
  let peerApi = false;
  if (peerKey) {
    // peer key authentication indicates this is an internal call between
    // microservices (from svc-mission-tracking)
    if (peerKey != PEER_KEY) {
      // Invalid peer key
      sendJSONResponse(res, 403, { error: 'AUTHENTICATION_ERROR: bad peerKey' });
      return false;
    }
    if (effectiveUserId) { // request on behalf of a user
      user = await Accounts.users.findOneAsync({ _id: effectiveUserId });
    } else {
      // Valid peer api call. Create a synthetic user ("InOrbit") to pass to route handlers
      peerApi = true;
      user = getSystemUser();
    }
  } else if (!appKey) {
    // No appKey provided
    sendJSONResponse(res, 401, { error: `AUTHENTICATION_ERROR: no appKey provided in ${HTTP_APP_KEY_HEADER} HTTP header` });
    return false;
  } else {
    // Find the user associated with the appKey
    user = await Accounts.users.findOneAsync(
      { [APP_KEY_USER_FIELD]: appKey }
    );
  }

  if (!user && !peerApi) {
    // the provided appKey is not associated with any user
    sendJSONResponse(res, 403, { error: 'AUTHENTICATION_ERROR: wrong credentials' });
    return false;
  }

  // if authenticated, return a user object or the peerApi flag (on of them is true-ish)
  return { user, peerApi };
}

/**
 * Returns the first route that matches the request.
 * The request matches if the `path` element (a regular expression) matches; and
 * optionally, if the `accepts` matches the "Accept" http header (if defined in the route).
 *
 * @param {http.IncomingMessage} req
 * @returns {Object} Route and params or false if no route matches
 *   @typedef {Object.<String>} r.route  Route object from `routes`
 *   @typedef {Object.<String>} r.params Object with params matched from the URL
 *   @typedef {Object.<String>} r.acceptParams The "Accepts" header value, if received (or "*\/*")
 *   @typedef {Object.<URLSearchParams>} r.queryParams  URLSearchParams object, already parsed
 *      from the URL search string "?..." for convenience
 */
function routeRequest(req) {
  const url = URL.parse(req.url);
  const queryParams = new URLSearchParams(url.query);
  for (const route of routes) {
    const { method, path, accept } = route;
    if (method == req.method) {
      const matched = url.pathname.match(path); // match path only, not including query "?..."
      if (matched) {
        // Check "Accept" header, if a specific one is required by the route handler
        if (accept) {
          const acceptHeaderValue = (req.headers && req.headers.accept) || '*/*';
          const acceptMatched = acceptHeaderValue.match(accept);
          if (acceptMatched) {
            return {
              route,
              params: matched.groups,
              acceptParams: acceptMatched.groups,
              queryParams
            };
          } // else: The path matches, but the 'Accept' header does not; ignore this request
        } else {
          // No 'Accept' header is required and the path has matched; accept the request
          return {
            route,
            params:
            matched.groups,
            queryParams
          };
        }
      }
    }
  }
  return false;
}

/**
 * Main entry point for api calls.
 * Takes care of appKey validation and request routing depending on URL and
 * METHOD.
 */
WebApp.connectHandlers.use(bodyParser.json({ extended: true }));
WebApp.connectHandlers.use('/api', async (req, res) => {
  if (req.method == 'OPTIONS') {
    // Pretty basic CORS support
    // NOTE: This is very permissive and allow invocations from any web site.
    // In the future we may consider limiting/blocking this.
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', '*');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'x-auth-app-key, content-type'
    );
    res.writeHead(200);
    res.end();
    return;
  }
  const { route, params = {}, queryParams } = routeRequest(req);
  if (!route) {
    // If no route matched, return 404
    sendJSONResponse(res, 404, { error: 'NOT_FOUND' });
    return;
  }

  let user;
  let peerApi;
  if (!route.allowPublic) {
    const authentication = await validateAppKey(req, res);
    if (!authentication) {
      return;
    }
    ({ user = {}, peerApi } = authentication);
  }

  // Decide if the robotId (used optionally in various places) comes from the path
  // or in the POST body
  if (!route.loadRobot && route.checkUserCanRobot) {
    console.warn('WARNING: checkUserCanRobot declared without loadRobot in route!', route);
    route.loadRobot = true;
  }
  let robotId;
  if (route.loadRobot === true) {
    // if loadRobot is simply a boolean, it uses `robotId` path parameter
    ({ robotId } = params);
  } else if (route.loadRobot) {
    // otherwise (string), use a field from within the JSON body as robot id
    robotId = String(req.body && req.body[route.loadRobot]);
  }

  if (route.internalOnly && !isSystemUser(user)) {
    sendJSONResponse(res, 404, { error: 'NOT_FOUND' });
  }

  if (route.checkUserCanRobot && !isSystemUser(user)) {
    // Route specifies some access validation
    if (!await new OroRoles().canAccessRobot(user._id, robotId, route.checkUserCanRobot)) {
      sendJSONResponse(res, 403, { error: `User not authorized for robot ${robotId}` });
      return;
    }
  }

  if (route.checkCanAccessSystemElement && !isSystemUser(user)) {
    const { singletonId, permissionLevel } = route.checkCanAccessSystemElement;
    // Route specifies some access validation
    if (!await new OroRoles().canAccessSystemElement(user._id, singletonId, permissionLevel)) {
      sendJSONResponse(res, 403, { error: 'User not authorized to access the resource' });
      return;
    }
  }

  // Check if a user can access multiple resources. checkCanAccessResources is an array of objects
  // with the following properties:
  // - resourceType (string): the type of the resource to check access to, one of RESOURCE_TYPES in
  //   web/imports/shared/roles.js
  // - extractResourceId(Object) => string: a function that returns a resourceId, allowing the route
  //   handler to extract the resource id from the params object, or just use a hardcoded value
  // - permissionLevel (string): the permission level required to access the resource, one of
  //   ACCESS_LEVEL_xx in web/imports/shared/roles.js
  // The function will check if the user has the required permission level to access each resource
  // in the array.
  if (route.checkCanAccessResources && !isSystemUser(user)) {
    for (
      const { resourceType, extractResourceId, permissionLevel } of route.checkCanAccessResources
    ) {
      const resourceId = extractResourceId(params);
      if (!await new OroRoles().canAccess(
        user._id,
        glueId(resourceType, resourceId),
        permissionLevel
      )) {
        sendJSONResponse(res, 403, { error: 'User not authorized to access the resource' });
        return;
      }
    }
  }

  if (!isSystemUser(user) && !await new OroRoles().hasRole(user._id)) {
    sendJSONResponse(res, 403, { error: `User not authorized` });
    return;
  }

  if (route.loadRobot) {
    // Route specifies that the robot must be loaded from the database
    const robot = new Robot(robotId);
    if (!robot) {
      sendJSONResponse(res, 404, { error: `Robot not found ${robotId}` });
      return;
    }
    params.robot = robot;
  }

  try {
    const routeResponse = await route.handler({
      req,
      res,
      body: req.body,
      user,
      queryParams,
      headers: req.headers,
      ...params
    });
    if (!Array.isArray(routeResponse)) {
      throw new Error('route response was not an array with [result, status]');
    }
    // eslint-disable-next-line prefer-const
    let [result, statusCode, options] = routeResponse;
    statusCode = statusCode || 200;
    if (options?.skipSendResponse !== true) {
      if (Math.floor(statusCode / 100) == 3) {
        // If the response is a redirect (used in Maps API), do not send JSON headers or response.
        // Just set status code as a redirect. The `result` return by the route is the URL.
        sendRedirectResponse(res, statusCode, result);
      } else {
        sendJSONResponse(res, statusCode, result);
      }
    }
    // When skipSendResponse is true, handler already wrote to res (e.g. streamed CSV/JSONL)
  } catch (e) {
    console.error('Internal error', e);
    // NOTE(herchu) Do NOT expose details on the exception in the error msg!
    sendJSONResponse(res, 500, { error: 'Internal error' });
  }
});

export {
  // eslint-disable-next-line import/prefer-default-export
  addApiRoute
};
