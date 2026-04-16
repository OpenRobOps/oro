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
 * This module provides hooks to use SpatialTransformations to transform data from robots' world
 * frames to sublocations' world frames.
 *
 * @see https://docs.google.com/document/d/1l1LRlNc4M-QS6n66O3Crdga9wZychVFve2LdI41EUHk/edit
 */
import { Meteor } from 'meteor/meteor';
import { useEffect, useState, useMemo } from 'react';
import { isEmpty, get } from 'lodash';
import { transformPose } from '../../../../shared/geometry';

/**
 * Builds a function that transforms localization data from the robot world frame to the
 * corresponding sublocation's world frame.
 *
 * @param {object} spatialTransformations map of spatial transformations for a set of robots
 * @returns {function}
 */
export function useLocalizationDataToSublocationTransformation(spatialTransformations) {
  const transform = useMemo(() => {
    if (!spatialTransformations || isEmpty(spatialTransformations)) {
      return data => data;
    }

    return (data) => {
      const robotId = data && Object.keys(data)[0]; // messages contain only one robot
      if (!robotId) {
        return data;
      }
      const robotWorldFrameId = get(data, `${robotId}.robotPose.frameId`);
      const t = get(spatialTransformations, `${robotId}.${robotWorldFrameId}`);
      const localizationDataB = {
        [robotId]: {
          ...data[robotId],
          robotPose: data[robotId].robotPose && transformPose(data[robotId].robotPose, t)
        }
      };
      return localizationDataB;
    };
  }, [spatialTransformations]);

  return transform;
}

/**
 * Builds a function that transforms path data from the robot world frame to the
 * corresponding sublocation's world frame.
 *
 * @param {object} spatialTransformations map of spatial transformations for a set of robots
 * @returns {function}
 */
export function usePathsToSublocationTransformation(spatialTransformations) {
  const transform = useMemo(() => {
    if (!spatialTransformations || isEmpty(spatialTransformations)) {
      return data => data;
    }

    return (data) => {
      const robotId = data && Object.keys(data)[0]; // messages contain only one robot
      if (!robotId || !data[robotId].paths) {
        return data;
      }
      // transform all path points
      const { paths } = data[robotId];
      Object.values(paths).forEach((path) => {
        if (!path.points || !path.frameId) {
          // Don't process paths with enough data required for transformations to take place
          return;
        }
        const t = get(spatialTransformations, `${robotId}.${path.frameId}`);
        path.points = path.points.map(point => transformPose(point, t));
      });
      return data;
    };
  }, [spatialTransformations]);

  return transform;
}

/**
 * Return all the spatial transformations configured for a list of robots
 * @param {array} robotIds
 * @returns
 */
// TODO: 'spatialTransformations.getForManyRobots' Meteor method is not yet implemented in oro server.
export function useSpatialTransformations(robotIds) {
  const [spatialTransformations, setSpatialTransformations] = useState(false);
  useEffect(() => {
    if (!robotIds) { return; }
    Meteor.call('spatialTransformations.getForManyRobots', { robotIds }, (err, result) => {
      if (err) {
        console.error(err);
      } else {
        setSpatialTransformations(result);
      }
    });
  }, [(robotIds || []).join(' ')]);
  return spatialTransformations;
}
