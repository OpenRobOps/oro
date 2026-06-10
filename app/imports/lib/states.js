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
 * Shared library with common code to handle extraction of
 * module state configuration from database collections
 */
import { RobotModuleState, Robots } from './collections';
import ConfigManager  from './configManagerAsync';
import {
  ID_TYPE_AGENT,
  MODULE_NAMES,
  MODULE_AVAILABLE_KEYS
} from '../shared/constants';

const MODULES_CONFIGURATION = {
  [MODULE_NAMES.CUSTOM_COMMANDS_AGENTLET]: {
    availableKeys: [MODULE_AVAILABLE_KEYS.CUSTOM_SCRIPTS],
  },
  [MODULE_NAMES.CUSTOM_DATA_AGENTLET]: {
    availableKeys: []
  },
  [MODULE_NAMES.ROS_DIAGNOSTICS_AGENTLET]: {
    availableKeys: [MODULE_AVAILABLE_KEYS.DIAGNOSTICS_KEYS, MODULE_AVAILABLE_KEYS.DIAGNOSTICS_TOPICS]
  },
  [MODULE_NAMES.ROS_IMAGE_AGENTLET]: {
    availableKeys: [MODULE_AVAILABLE_KEYS.CAMERA_TOPICS]
  },
  [MODULE_NAMES.ROS_LOCALIZATION_AGENTLET]: {
    availableKeys: [MODULE_AVAILABLE_KEYS.COSTMAP_TOPICS, MODULE_AVAILABLE_KEYS.LASER_TOPICS,
      MODULE_AVAILABLE_KEYS.MAP_TOPICS, MODULE_AVAILABLE_KEYS.NAV_GOAL_TOPICS, MODULE_AVAILABLE_KEYS.PATH_TOPICS,
      MODULE_AVAILABLE_KEYS.SET_POSE_TOPICS],
  },
  [MODULE_NAMES.ROS_MONITORING_AGENTLET]: {
    availableKeys: [MODULE_AVAILABLE_KEYS.ROS_NODES, MODULE_AVAILABLE_KEYS.ROS_PARAMS, MODULE_AVAILABLE_KEYS.ROS_TOPICS]
  },
  [MODULE_NAMES.ROS_ODOMETRY_AGENTLET]: {
    availableKeys: []
  },
  [MODULE_NAMES.ROS_TELEOP_AGENTLET]: {
    availableKeys: [MODULE_AVAILABLE_KEYS.CMD_VEL_TOPICS]
  },
  [MODULE_NAMES.SYSTEM_AGENTLET]: {
    availableKeys: [MODULE_AVAILABLE_KEYS.HDD_PARTITIONS, MODULE_AVAILABLE_KEYS.NETWORK_INTERFACES]
  }
};

const ALL_MODULE_NAMES = Object.values(MODULE_NAMES);

// Function to check if a given state is empty
const isEmpty = state => {
  for (let prop in state) {
    return false
  }
  return true
}

/**
 * Implements getting the 'calculated' state for a robot (merging robot and system states).
 */
const getCalculatedStateAsync = async ({ robotId, moduleName, keys }) => {
  const moduleConfig = new ConfigManager(RobotModuleState);
  const configParams = { groupingKey: 'moduleName' };
  if (moduleName) {
    configParams.conditions = { moduleName };
  }
  if (keys) {
    // For nested properties (e.g. key "optional_network_interfaces.i1"), the entire object needs
    // to be requested in getConfig
    configParams.fields = (keys.map(key => key.split('.')[0])).concat('moduleName');
  }
  let states = await moduleConfig.getEntityConfig({ entityId: robotId, entityType: 'robot', ...configParams });
  // If we were only requested a single module, return the state for that module directly,
  // instead of a dictionary with a single entry for it.
  if (moduleName !== undefined) {
    if (moduleName in states) {
      states = states[moduleName];
    } else {
      // If a single module was requested and there is no configuration for it, return null.
      states = null;
    }
  }
  return states;
};

/**
 * Returns the last agent state reported by the robot
 */
const getAgentState = (robotId, moduleName = undefined, key = undefined) => {
  if (!robotId) {
    throw new Error('robotId must be a string');
  }
  let queryTargetAgent = { entityId: robotId, entityType: 'agent' };
  let queryprojection = { entityId: 0, entityType: 0 };

  if (moduleName !== undefined) {
    queryTargetAgent.moduleName = moduleName;
  }

  if (key !== undefined) {
    queryprojection = { moduleName: 1, [key]:1 }
  }

  // Get the states for this particular robot, if a robotId was provided
  const robotStates = robotId ? RobotModuleState.find(queryTargetAgent,
     { fields: queryprojection }).fetch() : [];

  let states = robotStates.reduce((acc, state) => {
    if (acc[state.moduleName] === undefined) {
      acc[state.moduleName] = state;
    } else {
      Object.assign(acc[state.moduleName], state);
    }
    return acc;
  }, {});

  // Remove unnecessary moduleName (used in reduces above) and _id
  // And clean up any states that are empty
  for (let moduleName in states) {
    delete states[moduleName].moduleName;
    delete states[moduleName]._id;
    if (isEmpty(states[moduleName])) {
      delete states[moduleName];
    }
  }

  // If we were only requested a single module, return the state for that module directly,
  // instead of a dictionary with a single entry for it.
  if (moduleName !== undefined) {
    if (moduleName in states) {
      states = states[moduleName];
    } else {
      // If a single module was requested and there is no configuration for it, return null.
      states = null;
    }
  }
  return states;
}

/**
 * Given a camera topics state, which looks like
 * ```
 * {
 *   '0': "topic1",
 *   '1': "topic2"
 *   '4': "topic4"
 * }
 * ```
 *
 * It will parse the structure and return an array of objects:
 * ```
 * {
 *   id: cameraId,
 *   topic: topicString,
 *   enabled: true,
 *   label: <the same camera id>
 * }
 * ```
 *
 * The returned array is sorted by camera id (numeric sorting, even if these are
 * strings).
 *
 * Note that the input object does not guarantee the list of cameras is sequential,
 * any id could be missing.
 */
const cameraStateToArray = state => (
  Object.keys(state).reduce((acc, id) => {
    if (!state[id]) {
      return acc; // empty camera, no topic, etc
    }
    acc.push({
      id,
      topic: state[id]
    });
    return acc;
  }, []).sort((a, b) => Number(a.id) - Number(b.id))
);

export {
  getCalculatedStateAsync,
  getAgentState,
  cameraStateToArray,
  MODULES_CONFIGURATION,
  ALL_MODULE_NAMES,
  ID_TYPE_AGENT
};

