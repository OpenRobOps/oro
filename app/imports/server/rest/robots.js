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
 * Robots REST API
 *
 * NOTE: This is _part_ of Robots API, other parts are in locks.js, attributes.js
 */
import Validator from 'fastest-validator';
import { isString } from 'lodash';
import OroRoles, { ACCESS_LEVEL_VIEW } from '../roles';
import { Robots } from '../../lib/collections';
import { ROLE_VIEWER } from '../../shared/roles';
import { badRequestApiError, unauthorizedApiError } from '../rest_api_common';
import { resolvedFootprintFor } from '../footprints';

// Query filters for getRobots API
const QUERY_ARG_IS_ONLINE = 'isOnline'; // Filter robots by online status
const QUERY_ARG_INCLUDE_LOCALIZATION = 'withLocalization'; // Include localization data in response

/**
 * Parse a (string) argument value as a boolean.
 *
 * Considers an empty string to be true, as a presence-only argument.
 *
 * @param {String} arg The argument value to parse
 * @param {Boolean} defaultValue The default value to return if the argument is null or undefined.
 *    If not provided, the default value is false.
 * @returns {Object} A {data, error} object, where data is the parsed value if it is a valid
 *    boolean string, and error is not null if the argument is not a valid boolean string.
 */
const parseBooleanQueryArg = (arg, defaultValue = false) => {
  if (arg === null || arg === undefined) {
    return { data: defaultValue, error: null };
  } else if (isString(arg)) {
    if (arg === '' || ['true', '1'].includes(arg.toLowerCase())) {
      return { data: true, error: null };
    } else if (['false', '0'].includes(arg.toLowerCase())) {
      return { data: false, error: null };
    } else {
      return { error: `Expected ${arg} to be a boolean, got '${arg}' instead.` };
    }
  } else {
    return { error: `Expected ${arg} to be a boolean, got '${arg}' instead.` };
  }
};

/**
 * Parses a list of boolean query arguments, returning an object with the parsed values if
 * all of them are valid boolean strings, or a legible error message if any of them are not.
 *
 * @param {Object} queryParams The query parameters object
 * @param {Array} args List of [argName, defaultValue] pairs
 * @returns {Object} A {data, error} object, where data is the list of parsed values if all
 *     are valid boolean strings, or null if any of them are not.
 */
const parseBooleanQueryArgs = (queryParams, args) => {
  const invalidArgs = [];
  const invalidValues = [];
  const values = [];
  args.forEach(([argName, defaultValue]) => {
    const value = queryParams.get(argName);
    const { data: parsed, error } = parseBooleanQueryArg(value, defaultValue);
    if (error !== null) {
      invalidArgs.push(argName);
      invalidValues.push(String(value));
    } else {
      values.push(parsed);
    }
  });
  if (invalidArgs.length > 0) {
    const argList = invalidArgs.join(', ');
    const valueList = invalidValues.map(v => `'${v}'`).join(', ');
    return { error: `Expected ${argList} to be boolean, got ${valueList} instead.`, data: null };
  } else {
    return { data: values, error: null };
  }
};

/**
 * Aux function to build a (external) Robot object from a mongo robot doc.
 * See YAMLs specs for fields that should appear -- any other field should not be in the output.
 */
const formatRobotDocument = (robotDoc) => {
  const robot = {
    id: robotDoc._id,
    name: robotDoc.name,
    agentVersion: robotDoc.version,
    agentOnline: robotDoc.status && robotDoc.status.agentOnline,
    updatedTs: robotDoc.updateStamp,
  };
  if (robotDoc.localization) {
    robot.localization = robotDoc.localization;
  }
  return robot;
};

/**
 * Handle REST API to get a robot document.
 *
 * @param {Object} res Web response
 * @param {Object} user The user querying the lock status
 * @param {String} robotId
 */
async function apiGetRobot({ robot, user }) {
  // NOTE: Access has already been checked in checkUserCanRobot
  const robotDoc = await Robots.findOneAsync(robot.getId());
  if (!robotDoc) {
    return ['Not found', 404];
  }
  return [formatRobotDocument(robotDoc)];
}

/**
 * GET /robots/{robotId}/footprint — the resolved footprint geometry (configured over
 * ISO-reported), as [x, y] pairs in the robot frame. Colors are UI-only and omitted.
 */
export async function apiGetRobotFootprint({ robot }) {
  const { footprint, bufferFootprint, radius } = await resolvedFootprintFor(robot.getId());
  const out = {};
  if (footprint) out.footprint = footprint;
  if (bufferFootprint) out.bufferFootprint = bufferFootprint;
  if (radius !== undefined) out.radius = radius;
  return [out];
}

/**
 * Builds an aggregation pipeline to find all robots matching a set of collection filters.
 *
 * @param {Boolean} withLocalization Whether to include partial localization data available in the
 *   localization collection
 * @returns {Array} MongoDB aggregation pipeline
 * 
 * TODO move to another file (this could be used for robots publications)
 */
const makeRobotsQueryPipeline = ({
  withLocalization = false
}) => {
  const pipeline = [];

  // Stage 1: Match all robots
  const matchStage = {};
  pipeline.push({ $match: matchStage });

  // Stage 2: Conditionally add left join with localization collection
  if (withLocalization) {
    pipeline.push({
      $lookup: {
        from: 'localization',
        localField: '_id',
        foreignField: '_id',
        as: 'localizationTmp'
      }
    });

    // Stage 3: Add localization fields to the robot document
    pipeline.push({
      $addFields: {
        // Add localization fields to the robot document
        // TODO: For now, only include pose data. If required, the following fields can be
        // added in the future (check for possible renamings to keep consistency with
        // localization.js):
        'localization.pose': { $arrayElemAt: ['$localizationTmp.robotPose', 0] },
      }
    });

    // Stage 4: Remove the temporary localization array
    pipeline.push({
      $unset: 'localizationTmp'
    });
  }

  return pipeline;
};

/**
 * Handle REST API to list robots
 *
 * Query Parameters:
 * - withLocalization (boolean): Include localization data in response. If frameId is provided,
 *   this will be true
 * - isOnline (boolean): Filter robots by online status.
 */
export async function apiGetRobots({ user, queryParams }) {
  if (!await new OroRoles().hasRole(user._id, ROLE_VIEWER)) {
    return unauthorizedApiError('User not authorized to access robots');
  }
  // Parse boolean query args
  const booleanQueryArgs = parseBooleanQueryArgs(queryParams, [
    [QUERY_ARG_IS_ONLINE, null],
    [QUERY_ARG_INCLUDE_LOCALIZATION, false]
  ]);
  if (booleanQueryArgs.error) {
    return badRequestApiError(booleanQueryArgs.error);
  }
  const { data: [isOnline, withLocalization] } = booleanQueryArgs;
  // Fetch the robots
  let robots;
  if (withLocalization) {
    // Instead of using it as a query argument, we need to run a pipeline as JOIN of two collections
    const queryPipeline = makeRobotsQueryPipeline({ withLocalization: true });
    robots = await Robots.rawCollection().aggregate(queryPipeline).toArray();
  } else {
    robots = await Robots.find({}).fetchAsync(); 
  }
  // Keep only robots this user can view (fleet-wide or per-robot grants)
  const accessibleIds = await new OroRoles().getAccessibleRobotIds(
    user._id,
    robots.map(robotDoc => robotDoc._id),
    ACCESS_LEVEL_VIEW
  );
  robots = robots.filter(robotDoc => accessibleIds.includes(robotDoc._id));
  robots = robots.map(formatRobotDocument);
  // Apply after-fetch filters
  if (isOnline !== null) {
    robots = robots.filter(robot => (isOnline === null || robot.agentOnline === isOnline));
  }
  return [robots];
}

// Map URLs to functions
const routes = [
  /*
   * Map /robots/${robotId} to apiGetRobot
   *
   * Using checkUserCanRobot: ACCESS_LEVEL_VIEW and loadRobot: true we can
   * verify that the user has enough permissions and also get the robot object
   * as a parameter in the handler
   */
  {
    path: 'robots',
    method: 'GET',
    handler: apiGetRobots,
    trackingId: 'getRobots',
    // NOTE: no checkUserCanRobot here (there is no single robot); the handler
    // filters the list down to robots the user can view
  },
  {
    path: 'robots/{robotId:id}',
    method: 'GET',
    handler: apiGetRobot,
    trackingId: 'getRobot',
    loadRobot: true,
    checkUserCanRobot: ACCESS_LEVEL_VIEW,
  },
  {
    path: '/robots/{robotId:id}/footprint',
    method: 'GET',
    handler: apiGetRobotFootprint,
    trackingId: 'getRobotFootprint',
    checkUserCanRobot: ACCESS_LEVEL_VIEW,
    loadRobot: true
  },
];

export default routes;
