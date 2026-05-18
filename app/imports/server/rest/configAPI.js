/**
 * Copyright 2026 InOrbit, Inc.
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

/**
 * Configuration as Code API.
 */
// ORO modules
import ConfigAPI from '../configAPI/configAPI';
import { ValidationError, SchemaError, AuthorizationError, LIST_FORMAT_SHORT } from '../../shared/configAPI';

/**
 * API handler for POST configuration/apply
 *
 * Applies a configuration object
 */
const apiApply = async ({ user, body: configObject }) => {
  let result;
  try {
    console.log("configAPI.apply",configObject);
    result = await new ConfigAPI().apply({ configObject, user });
  } catch (e) {
    if (e instanceof ValidationError || e instanceof SchemaError) {
      return [e.message, 400];
    }
    if (e instanceof AuthorizationError) {
      return [e.message, 401];
    }
    // Unknown error. Can be anything wrong in our code. Log it con console, but do not return
    // error details as API response to users, revealing details of our code.
    console.error(`Error evaluating config apply(): ${e.message}`, e);
    return ['Internal error', 500];
  }
  // Merge the ConfigAPI return value which could include messages or other results with a "SUCCESS"
  const response = { ...result, operationStatus: 'SUCCESS' };
  return [response, 200];
};

/**
 * API handler for POST configuration/clear
 *
 * Clears a configuration object
 */
const apiClear = async ({ user, body: configObject }) => {
  try {
    await new ConfigAPI().clear({ configObject, user });
  } catch (e) {
    if (e instanceof ValidationError || e instanceof SchemaError) {
      return [e.message, 400];
    }
    if (e instanceof AuthorizationError) {
      return [e.message, 401];
    }
    // Unknown error. Can be anything wrong in our code. Log it con console, but do not return
    // error details as API response to users, revealing details of our code.
    console.error(`Error evaluating config clear(): ${e.message}`, e);
    return ['Internal error', 500];
  }
  return [{ operationStatus: 'SUCCESS' }, 200];
};

/**
 * API handler for GET configuration/list
 *
 * Lists configuration objects
 */
const apiList = async ({ user, queryParams }) => {
  const kind = queryParams.get('kind');
  const id = queryParams.get('id');
  const format = queryParams.get('format') || LIST_FORMAT_SHORT;
  const includeAll = queryParams.has('all') && queryParams.get('all').toLowerCase() == 'true';
  try {
    const results = await new ConfigAPI().list({ user, kind, id, format, includeAll });
    return [{ items: results }, 200];
  } catch (e) {
    if (e instanceof ValidationError || e instanceof SchemaError) {
      return [e.message, 400];
    }
    if (e instanceof AuthorizationError) {
      return [e.message, 401];
    }
    // Unknown error. Can be anything wrong in our code. Log it con console, but do not return
    // error details as API response to users, revealing details of our code.
    console.error(`Error evaluating ${kind} config list(): ${e.message}`, e);
    return ['Internal error', 500];
  }
};

/**
 * API handler for GET configuration/listKinds
 *
 * Lists kinds available for the authenticated user
 */

const listKinds = () => {
  try {
    const results = new ConfigAPI().getKinds();
    return [{ items: results }, 200];
  } catch (e) {
    console.error(`Error evaluating list kinds: ${e.message}`, e);
    return ['Internal error', 500];
  }
};

// Actions URLs to functions
const routes = [{
  path: 'configuration/apply',
  method: 'POST',
  handler: apiApply,
  trackingId: 'configApply',
}, {
  path: 'configuration/list',
  method: 'GET',
  handler: apiList,
  trackingId: 'configList',
}, {
  path: 'configuration/clear',
  method: 'POST',
  handler: apiClear,
  trackingId: 'configClear',
}, {
  path: 'configuration/kinds',
  method: 'GET',
  handler: listKinds,
  trackingId: 'configListKinds',
}];

export default routes;
