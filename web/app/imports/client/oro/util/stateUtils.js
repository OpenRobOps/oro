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
 * Utility functions for module states -- client code.
 */
import { RobotModuleState } from '../../../lib/collections';

/**
 * Implements getCalculatedState to retrieve module state configuration from MongoDB.
 *
 * TODO: This is a simplified synchronous implementation that queries the local Minimongo
 * collection. For full support of nested key extraction and multi-entity queries,
 * consider using the async version in lib/states.js (getCalculatedStateAsync).
 *
 * @param {Object} params
 * @param {string} params.robotId - The robot ID to query
 * @param {string} [params.moduleName] - Optional: filter to a single module by name
 * @param {Array} [params.keys] - Optional: specific keys to retrieve
 * @returns {Object|null} Module state map keyed by moduleName, or a single module state
 */
const getCalculatedState = ({ robotId, moduleName, keys }) => {
  // TODO: Implement full MongoDB data fetch using configManagerAsync
  const query = { entityId: robotId };
  if (moduleName) {
    query.moduleName = moduleName;
  }

  const projection = {};
  if (keys) {
    keys.forEach((key) => {
      projection[key.split('.')[0]] = 1;
    });
    projection.moduleName = 1;
  }

  const docs = RobotModuleState.find(query, { fields: projection }).fetch();

  if (!docs || docs.length === 0) {
    return moduleName !== undefined ? null : {};
  }

  // Build a map keyed by moduleName
  const stateMap = {};
  docs.forEach((doc) => {
    if (doc.moduleName) {
      stateMap[doc.moduleName] = doc;
    }
  });

  if (moduleName !== undefined) {
    return stateMap[moduleName] || null;
  }

  return stateMap;
};

export {
  // eslint-disable-next-line import/prefer-default-export
  getCalculatedState
};
