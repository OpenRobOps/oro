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
 * Localization REST API
 */

import { ACCESS_LEVEL_VIEW } from '../roles';
import { notFoundApiError } from '../rest_api_common';
// import { fetchRobotSpatialAnnotationAsync } from '../../lib/annotations';
import { RobotLocalization } from '../../lib/collections';

// Constants for fields in localization data
const API_LOCALIZATION_FIELD_COSTMAP = 'costmap';
const API_LOCALIZATION_FIELD_LASERS = 'lasers';
const API_LOCALIZATION_FIELD_PATHS = 'paths';
const API_LOCALIZATION_FIELD_POSE = 'pose';

const API_LOCALIZATION_FIELDS_ALL = [
  API_LOCALIZATION_FIELD_COSTMAP,
  API_LOCALIZATION_FIELD_LASERS,
  API_LOCALIZATION_FIELD_PATHS,
  API_LOCALIZATION_FIELD_POSE,
];

/**
 * Gets the current map's label for the given robotId.
 *
 * NOTE: Should be part of some lib/localization
 * @param {*} robotId
 */
async function getCurrentMapLabelAsync(robotId) {
  const robotLocalization = await RobotLocalization.findOneAsync({ _id: robotId }) || {};
  if (robotLocalization.defaultMap) {
    return robotLocalization.defaultMap;
  }
  return null;
}


/**
 * Formats a paths from the DB to the structure used by the API
 */
const formatPaths = paths => paths && Object.keys(paths).map(k => paths[k] && ({
  points: paths[k].points,
  id: k,
  ts: paths[k].ts
}));

/**
 * Formats lasers from the DB to the structure used by the API
 */
const formatLasers = (lasers, ts) => lasers && Object.keys(lasers).map(k => lasers[k] && ({
  runs: lasers[k].runs,
  values: lasers[k].values,
  id: k,
  ts
}));

/**
 * Fetches robot's localization data and return it in the format used by the API
 *
 * @param {Object} robot
 * @param {Array} include List of fields to include. See API_LOCALIZATION_FIELDS_ALL
 */
const fetchLocalizationData = async ({ robot, include = [] }) => {
  let localizationData = {};
  const queryFields = {};
  if (include.includes(API_LOCALIZATION_FIELD_COSTMAP)) {
    queryFields.costmap = true;
  }
  if (include.includes(API_LOCALIZATION_FIELD_LASERS)) {
    queryFields.laserRanges = true;
    queryFields.laserRangesUpdatedTs = true;
  }
  if (include.includes(API_LOCALIZATION_FIELD_PATHS)) {
    queryFields.paths = true;
  }
  if (include.includes(API_LOCALIZATION_FIELD_POSE)) {
    queryFields.robotPose = true;
    queryFields.robotPoseUpdatedTs = true;
    queryFields.map = true;
    queryFields.defaultMap = true;
  }

  if (Object.keys(queryFields).length > 0) {
    localizationData = await RobotLocalization.findOneAsync({ _id: robot.getId() },
      { fields: queryFields }) || {};
  }

  const {
    robotPose: pose,
    robotPoseUpdatedTs: poseTs,
    costmap,
    laserRanges: lasers,
    laserRangesUpdatedTs: lasersTs,
    paths,
    map
  } = localizationData;

  if (pose) {
    // Complete pose data
    pose.ts = poseTs;
    const mapId = await getCurrentMapLabelAsync(robot.getId());
    pose.mapId = mapId;
    if (mapId && map?.mapId == mapId) {
      pose.xPixels = (pose.x - map.x) / map.resolution;
      pose.yPixels = (pose.y - map.y) / map.resolution;
      pose.mapDataHash = map.dataHash;
    }
  }
  // Build result object
  const result = {
    pose,
    costmap,
    paths: formatPaths(paths),
    lasers: formatLasers(lasers, lasersTs)
  };

  return result;
};


/**
 * Handle REST API to get a robot pose.
 *
 * @param {Object} res Web response
 * @param {Object} robot
 */
const apiGetRobotPose = async ({ robot }) => {
  const { pose } = await fetchLocalizationData({
    robot,
    include: [API_LOCALIZATION_FIELD_POSE]
  });
  if (!pose) {
    return notFoundApiError('Pose data does no exist for this robot');
  }
  return [pose];
}

/**
 * Handle REST API to get a robot's localization data.
 *
 * @param {Object} res Web response
 * @param {Object} robot
 */
const apiGetRobotLocalization = async ({ robot, queryParams }) => {
  // Localization data to include in the request can be limited by the caller by specifying only
  // certain fields
  let include = queryParams.getAll('include');
  if (include.length == 0) {
    include = API_LOCALIZATION_FIELDS_ALL;
  }
  if (include.some(i => !API_LOCALIZATION_FIELDS_ALL.includes(i))) {
    return ['Invalid field in the "include" list', 400];
  }

  const result = await fetchLocalizationData({ robot, include });
  return [result];
}

// Localization URLs to functions
const routes = [
  {
    path: 'robots/{robotId:id}/localization/pose',
    method: 'GET',
    handler: apiGetRobotPose,
    trackingId: 'getRobotPose',
    checkUserCanRobot: ACCESS_LEVEL_VIEW,
    loadRobot: true
  },
  {
    path: 'robots/{robotId:id}/localization/full',
    method: 'GET',
    handler: apiGetRobotLocalization,
    trackingId: 'getRobotLocalization',
    checkUserCanRobot: ACCESS_LEVEL_VIEW,
    loadRobot: true
  },
];

export default routes;
