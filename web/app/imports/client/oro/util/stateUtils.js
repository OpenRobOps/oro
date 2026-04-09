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
 * @param {string} params.robotId - The robot ID to query (replaces entityId/entityType)
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
