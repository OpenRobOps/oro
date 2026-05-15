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
 * This modules handles proxying between different users or sessions requesting agent module
 * runlevels against actual requests to agents.
 * For example, if more than one user is requesting the same robot module to produce data,
 * a single request to load the module on the agent will be triggered. Likewise, only after
 * the last user requesting the data is disconnected, the agent will be requested to unload
 * the given module.
 * The same thing is true for different runlevel requests. The most verbose requested runlevel
 * will always be requested to the robot, and as soon as this runlevel is not requested by
 * any user, then the request to unload the module will be sent to the agent.
 *
 * This is implemented using a server-only collection: AgentModuleRequests.
 * This collection keeps a record for each robotId, module and runlevel combination, counting
 * how many active requests for that combination is currently active.
 * The number of active requests for a given combination is kept in the 'value' field.
 *
 * TODO Periodically clean-up documents with value = 0 (no pending requests)
 * TODO Checks that value doesn't go under 0.
 */
import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { CronJob } from 'cron';
import moment from 'moment';
import { isEmpty } from 'lodash';
// ORO modules
import { RobotModuleState } from '../lib/collections';
import { getCalculatedStateAsync } from '../lib/states';
import ConfigManager, { assertUniqueIdFields } from '../lib/configManagerAsync';
import OroMqtt from './mqtt';
import { COLLECTIONS, ID_TYPE_ROBOT, ID_TYPE_CLIENT, ID_TYPE_AGENT, MODULE_NAMES, ID_DEFAULT, ID_TYPE_SYSTEM_WIDE } from '../shared/constants';

/**
 * Mongo collection to keep track of requests
 *
 * Schema:
 *
 * serverId: String
 * robotId: String
 * moduleName: String
 * runlevel: number
 * value: number        // Number of requests pending for this combination of
 *                      //   server, robot, module and runlevel
 * ts: number           // Last time this document was updated
 *
 */
const AgentModuleRequests = new Mongo.Collection(COLLECTIONS.AGENT_MODULE_REQUEST);
AgentModuleRequests.rawCollection().createIndex({ serverId: 1, robotId: 1, moduleName: 1 });
// Index provided in migration version 1.18 (serverId, robotId, moduleName, runlevel)
export { AgentModuleRequests }; // Exported only for test cases; collection is private to this file

// List of modules that can be unloaded when a robot
const ALLOWED_MODULES_UNLOAD = [
  MODULE_NAMES.ROS_IMAGE_AGENTLET
];

let instance;
/**
 * @class AgentManager
 */
export default class AgentManager {
  constructor() {
    // Only construct an instance if it hasn't been done yet
    if (instance === undefined) {
      instance = this;
    }
    // eslint-disable-next-line no-constructor-return
    return instance;
  }

  init = async ({
    cleanupTimerSpec = '0 */10 * * * *', // every 10 minutes
    staleTimeDifference = { hours: 2 }, // should be a moment.subtract parameter
    serverId
  }) => {
    this.moduleConfig = new ConfigManager(RobotModuleState);
    if (!serverId) {
      console.warn('AgentManager started with null serverId (config problem)');
    }
    this.staleTimeDifference = staleTimeDifference;
    this.cleanupTimerSpec = cleanupTimerSpec;
    this.runlevelChangeCallbacks = {};
    this.moduleStateOverrides = {};
    this.serverId = serverId;

    // Set-up a cron job to refresh our documents and clean-up stale ones
    this.cronJob = new CronJob(this.cleanupTimerSpec, Meteor.bindEnvironment(async () => {
      try {
        await this.refreshDefaultsAndCleanup();
      } catch (e) {
        console.error('Exception running clean-up thread', e);
      }
    }));
    this.cronJob.start();
    await this.setDefaults();
  };

  /**
   * This method, intended to be run periodically on each running instance, does two
   * related things:
   * 1) It refreshes the timestamps of default documents inserted by this instance ID
   *    as a way to signal that this instance is still alive and other instances shouldn't
   *    delete stale documents from this instance.
   * 2) It checks for stale default documents and deletes all documents from instances IDs
   *    which haven't refreshed defaults - which means those instances are no longer live.
   *
   * Recommended parameters are:
   *  - Run every 30 minutes
   *  - Defaults are considered stale if they are more than 2 hours old
   *
   *  NOTE This approach is based on the current use of 'default' documents, but
   *  that approach is pending migration (@see setDefaults). This will need to be updated when
   *  setDefaults is updated.
   */
  refreshDefaultsAndCleanup = async () => {
    console.log('Module levels clean-up job for serverId=' + this.serverId);
    if (!this.serverId) {
      console.warn('refreshDefaultsAndCleanup called with falsey this.serverId');
      return;
    }

    // Refresh default timestamps for this serverId
    const nowTs = Date.now();
    await AgentModuleRequests.updateAsync({
      serverId: this.serverId,
      robotId: 'default'
    }, { $set: { ts: nowTs } }, { multi: true });

    // Remove all documents from stale serverIds
    const staleServerIds = await AgentManager.getStaleServerIds(this.staleTimeDifference);
    if (staleServerIds.length > 0) {
      console.log('Removing stale documents for serverIds:', staleServerIds);
      await AgentModuleRequests.removeAsync({ serverId: { $in: staleServerIds } });
    }
  };

  /**
   * Updates module states when a collection changes.
   *
   * This method gets called when a robot is added to a collection (from the UI
   * or dynamic collections). It does three things:
   *   1. Sends the configuration for each module to the agent
   *   2. Loads the modules that should be loaded
   *   3. Unloads modules that shouldn't be loaded
   *
   * @param {String} robotId
   */
  updateModuleStates = async (robotId) => {
    // Get states for all modules for this robot
    const mqtt = new OroMqtt();
    const states = await this.getModuleStates(robotId);

    // Send the module configuration to the robot, one request per module.
    await Promise.all(
      Object.keys(states).map((moduleName) =>
        mqtt.setModuleState({ robotId, moduleName, newState: states[moduleName] })
      )
    );

    // Get loaded modules for this robot
    const moduleLevels = await this.getModuleLevels(robotId);

    // Load them
    await Promise.all(Object.keys(moduleLevels).map((module) => (
      mqtt.loadModule({
        robotId, moduleName: module, runlevel: moduleLevels[module]
      })
    )));

    // Get agent module states
    const agentModulesStates = await this.moduleConfig.getEntityConfig({
      entityId: robotId,
      entityType: ID_TYPE_AGENT,
      groupingKey: 'moduleName',
      conditions: {
        moduleName: { $in: ALLOWED_MODULES_UNLOAD },
        loaded: true
      }
    });

    // Unload modules that are allowed to do so
    await Promise.all(Object.keys(agentModulesStates).map(async (moduleName) => {
      if (!Object.keys(moduleLevels).includes(moduleName)) {
        console.log(`updateModuleStates: unloading module ${moduleName} robotId=${robotId}`);
        await mqtt.unloadModule({ robotId, moduleName });
      }
    }));
  };

  /**
   * Notifies the agent that all modules need to be loaded.
   *
   * This method gets called when an agent starts so the server can determine and send:
   *   1. What modules need to be loaded
   *   2. Which is the configuration for each module
   *
   * @param {String} robotId
   */
  resendModules = async (robotId) => {
    // Get states for all modules for this robot
    const mqtt = new OroMqtt();
    const states = await this.getModuleStates(robotId);
    // Send the module configuration to the robot, one request by module.
    // TODO Identify and remove client-only (non-agent) settings.
    await Promise.all(Object.keys(states).map((moduleName) =>
      mqtt.setModuleState({ robotId, moduleName, newState: states[moduleName] })
    ));

    // Get loaded modules for this robot
    const modulesToLoad = await this.getModuleLevels(robotId);
    await Promise.all(Object.keys(modulesToLoad).map(async module => (
      mqtt.loadModule({
        robotId, moduleName: module, runlevel: modulesToLoad[module]
      })
    )));
  };

  /**
   * Returns a list of serverIds for which their default documents
   * haven't been updated in more than two hours.
   */
  static getStaleServerIds = async (staleTimeDifference) => {
    // Find stale robotIds (older than two hours ago)
    const staleTs = moment().subtract(staleTimeDifference).valueOf();
    const staleIds = await AgentModuleRequests.rawCollection().distinct('serverId', {
      robotId: 'default',
      ts: { $lt: staleTs }
    });
    return staleIds;
  };

  /**
   * Removes all connections stored on the server and then inserts default run levels
   */
  setDefaults = async () => {
    if (!this.serverId) {
      console.warn('setDefaults called without a serverId');
      return;
    }
    const { serverId } = this;
    await AgentModuleRequests.removeAsync({ serverId });

    // TODO Replace the use of "default" in AgentModuleRequests by
    // entries with minRunlevel in RobotAgentState for the system default entity
    // using ConfigManager.
    // Currently state defaults are on server/attributs.js#_addDefaults, although they
    // should be moved out from there.
    // NOTE When this is changed, remember to also update the clean-up
    // job as well (@see refreshDefaultsAndCleanup).
    // NOTE When this is changed, also remember to move current defaults in
    // server/attributes.js#_addDefaults to here.
    const defaultModuleStates = [{
      moduleName: 'RosDiagnosticsAgentlet',
      runlevel: 0,
    },
    {
      moduleName: 'RosOdometryAgentlet',
      runlevel: 1,
    },
    {
      moduleName: 'CustomDataAgentlet',
      runlevel: 5,
    },
    {
      moduleName: 'CustomCommandsAgentlet',
      runlevel: 5,
    },
    {
      moduleName: 'AlertManagerAgentlet',
      runlevel: 1,
    },
    {
      moduleName: 'RobotEventsAgentlet',
      runlevel: 1,
    },
    {
      moduleName: 'RosMonitoringAgentlet',
      runlevel: 1,
    }];
    const robotId = 'default';
    for (const { moduleName, runlevel } of defaultModuleStates) {
      // eslint-disable-next-line no-await-in-loop
      await AgentModuleRequests.insertAsync({
        serverId,
        robotId,
        moduleName,
        runlevel,
        value: 1,
        ts: Date.now()
      });
    }

    // Create module state defaults
    const entityId = ID_DEFAULT;
    const entityType = ID_TYPE_SYSTEM_WIDE;
    // Reset custom data module defaults
    await RobotModuleState.removeAsync({ entityId, entityType });
    // Add a hardcoded, hidden key/value source as ID 0
    await RobotModuleState.insertAsync({
      entityId,
      entityType,
      moduleName: 'CustomDataAgentlet',
      custom_data_sources: [{ type: 'key_value', id: '0', name: 'Key Values' }]
    });
    // Make camera module enabled by default
    await RobotModuleState.insertAsync({
      entityId,
      entityType,
      moduleName: 'RosImageAgentlet',
      cameraViewOn: true,
      cameras_config: {
        // higher frequency preset, found in CameraSettings.js
        0: {
          output_encoding: 'mono8',
          quality: 10,
          rate: 2,
          img_width: 380,
          img_height: 240,
          is_on: true,
        }
      }
    });
    // Make RosMapAgentlet loaded by default
    await RobotModuleState.insertAsync({
      entityId,
      entityType,
      moduleName: 'RosMapAgentlet',
      minRunlevel: 5
    });
    // Make RosPoseAgentlet loaded by default (new method)
    // TODO Move to AgentManager when migrating from old AgentModuleRequests
    // based method
    await RobotModuleState.insertAsync({
      entityId,
      entityType,
      moduleName: 'RosPoseAgentlet',
      minRunlevel: 5
    });
    // Make RosLocalizationAgentlet loaded by default (new method)
    // TODO Move to AgentManager when migrating from old AgentModuleRequests
    // based method
    await RobotModuleState.insertAsync({
      entityId,
      entityType,
      moduleName: 'RosLocalizationAgentlet',
      minRunlevel: 5
    });
    // Make GPSAgentlet loaded by default (new method)
    // TODO Move to AgentManager when migrating from old AgentModuleRequests
    // based method
    // await RobotModuleState.insertAsync({
    //   entityId,
    //   entityType,
    //   moduleName: 'GPSAgentlet',
    //   minRunlevel: 5
    // });
    await RobotModuleState.insertAsync({
      entityId,
      entityType,
      moduleName: 'RosTeleopAgentlet',
      publish_zero_vel: true
    });

    // Run clean-up for the first time on start-up
    this.refreshDefaultsAndCleanup();
  };

  /**
   * Triggers an agent module update to the new expected runlevel.
   */
  // eslint-disable-next-line class-methods-use-this
  _changeModule = async (robotId, moduleName, runlevel) => {
    const mqtt = new OroMqtt();
    if (runlevel === null) {
      await mqtt.unloadModule({ robotId, moduleName });
    } else {
      await mqtt.loadModule({ robotId, moduleName, runlevel });
    }
  };

  /**
   * For a given robot, returns an object with all the modules that
   * are requested, with their respective runlevel, like so:
   *
   * {
   *   aModule: 3,
   *   anotherOne: 1,
   * }
   *
   * Modules with 0 value are omitted.
   * The logic also checks if there is a minimal runlevel for that module, if so
   * it sets the runlevel to that number
   *
   * If moduleName is passed, it only calculates and returns the module level for that
   * module as a scalar value (or null if none is present)
   */
  getModuleLevels = async (robotId, moduleName) => {
    // Get the minRunlevel per module from RobotModuleStates using ConfigManager
    const robotModules = await this.moduleConfig.getEntityConfig({
      entityId: robotId,
      entityType: ID_TYPE_ROBOT,
      groupingKey: 'moduleName',
      fields: ['moduleName', 'minRunlevel'],
      conditions: {
        minRunlevel: { $exists: true },
        moduleName
      }
    });

    // Turn the config into an array with one module per entry and filter out
    // entries with suppressed minRunlevel (set to null)
    const minRunlevels = Object.keys(robotModules).map((moduleName) => ({
      moduleName,
      minRunlevel: robotModules[moduleName].minRunlevel
    })).filter(module => module.minRunlevel !== null);

    // Get all the module / runlevel entries, ascending by runlevel
    const reqsByModule = await AgentModuleRequests.find(
      { robotId: { $in: [robotId, 'default'] }, moduleName, value: { $ne: 0 } },
      { fields: { moduleName: 1, runlevel: 1 }, sort: { runlevel: 1 } }
    ).fetchAsync();

    // Then squash them by module, keeping only the last (higher) runlevel
    const reqLevelsByModule = reqsByModule.reduce((acc, module) => {
      acc[module.moduleName] = module.runlevel;
      return acc;
    }, {});

    // now go through minRunlevels to make sure they are enforced
    const levelsByModule = minRunlevels.reduce((acc, module) => {
      // if no runlevel except minRunlevel, use minrunlevel as the runlevel
      if (acc[module.moduleName] === undefined) {
        acc[module.moduleName] = module.minRunlevel;
      // make sure any runlevel below the minRunlevel is set to use the minRunlevel
      } else if (acc[module.moduleName] < module.minRunlevel) {
        acc[module.moduleName] = module.minRunlevel;
      }
      return acc;
    }, reqLevelsByModule);

    if (moduleName) {
      // Enforce null since _changeModule expects it
      return Number.isInteger(levelsByModule[moduleName])
        ? levelsByModule[moduleName]
        : null;
    }

    return levelsByModule;
  }

  /**
   * Returns the full module configuration for a given robot, taking into system defaults.
   *
   * TODO Replace users of this with getCalculatedState
   */
  getModuleStates = async (robotId, moduleName, key) => {
    const keys = key === undefined ? undefined : [key];

    const state = await getCalculatedStateAsync({
      robotId,
      moduleName,
      keys
    });

    // Execute the callback for every configured override.
    // This gives each module the ability to override its state with custom logic
    for (const module in this.moduleStateOverrides) {
      try {
        // The state for the module will be the override, if it exists, or the existing state
        state[module] = await this.moduleStateOverrides[module](robotId, state[module]) || state[module];
      } catch (error) {
        console.error(`Could not override state for ${module}`, error);
      }
    }

    return state;
  }

  /**
   * New method intended to replace setModuleState and setModuleStateDefault.
   *
   * Uses entityId / entityType API.
   *
   * If update is not specifically set to false, agents are immediately updated
   * with the new state.
   *
   * Note that the id/type can be ambiguous in case objects have the chance to be shared across
   * companies, for example with collections (this is a long debt or design problem). So to
   * make this search work in all cases, 
    */
  setModuleState2 = async (
    entityId, entityType, moduleName, newState, update = true
  ) => {
    throw new Error('setModuleState2 - NOT YET TESTED')
    // Update state configuration DB
    // TODO Switch to use ConfigManager.setConfig
    await this._doSetModuleState(entityId, entityType, moduleName, newState);

    // Update affected agents with the new state
    const updatedKeys = Object.keys(newState);

    const mqtt = new OroMqtt();
    if (update) {
      const robotIds = await ConfigManager.getRobotIds({ entityId, entityType });
      await Promise.all(robotIds.map(async (robotId) => {
        // Re-fetch the configuration for each robot
        const state = await getCalculatedStateAsync({ robotId, moduleName, keys: updatedKeys });
        // TODO Only do this for online robots for which the
        // configuration was actually affected by the update
        if (state !== null) {
          await mqtt.setModuleState({ robotId, moduleName, newState: state });
        }
      }));
    }
  }

  /**
   * Sets the given state (key, value pair) as a particular robot
   */
  setModuleState = async (robotId, moduleName, newState) => {
    await this._doSetModuleState(robotId, ID_TYPE_ROBOT, moduleName, newState);
  }

  /**
   * Sets the given state (key, value pair) for the "client facing view" of
   * a robot `robotId`. These values are NOT to be sent to the agents, but
   * instead they are features that clients can "annotate" and view about
   * different modules on agents.
   */
  setModuleStateClient = async (robotId, moduleName, newState) => {
    await this._doSetModuleState(robotId, ID_TYPE_CLIENT, moduleName, newState);
  }

  // eslint-disable-next-line class-methods-use-this
  _doSetModuleState = async (entityId, entityType, moduleName, newState) => {
    const unset = {}
    const newStateCopy = Object.assign({}, newState);
    for (const k in newStateCopy) {
      if (newStateCopy[k] === undefined) {
        unset[k] = true;
        delete newStateCopy[k];
      }
    }
    const operation = {};
    if (!isEmpty(newStateCopy)) {
      operation.$set = newStateCopy;
    }
    if (!isEmpty(unset)) {
      operation.$unset = unset;
    }
    if (!isEmpty(operation)) {
      // TODO: Switch this call to configManager.setConfig
      await RobotModuleState.upsertAsync({ entityId, moduleName, entityType }, operation);
    }
  }

  /**
   * Saves user min runlevel configurations to RobotModuleStates
   * and enforces it on the agent.
   */
  setUserRunlevel = async (robotId, moduleName, minRunlevel) => {
    // save user set runlevel to DB
    await this._runlevelComparator(robotId, moduleName, minRunlevel,
      async () => {
        // TODO: Switch this call to configManager.setConfig
        await RobotModuleState.upsertAsync({ entityId: robotId, moduleName, entityType: 'robot' }, { $set: { minRunlevel }});
      }
    );
  }

  /**
   * Removes the minRunlevel from the user module state configuration
   * then unloads the agentlet
   */
  clearUserRunlevel = async (robotId, moduleName) => {
    // removes min runlevel set by user
    await this._runlevelComparator(
      robotId, moduleName, null,
      async () => {
        // TODO: Switch this call to configManager.setConfig
        await RobotModuleState.updateAsync({
          entityId: robotId,
          moduleName,
          entityType: ID_TYPE_ROBOT
        }, { $unset: { minRunlevel: true } });
      }
    );
  }

  /**
   * Registers a request for a given module on a given robot at a given minimum runlevel.
   */
  requestMore = async (robotId, moduleName, runlevel) => (
    this._doRequestMore(robotId, moduleName, runlevel)
  );

  /**
   * Registers a request for a given module on a given robot at a minimum runlevel.
   * (irrespective of robotId being a proxy or not)
   */
  _doRequestMore = async (robotId, moduleName, runlevel) => {
    // Record new number of watchers
    await this._runlevelComparator(
      robotId,
      moduleName,
      runlevel,
      async () => await AgentModuleRequests.upsertAsync(
        { robotId, moduleName, runlevel, serverId: this.serverId },
        { $inc: { value: 1 }, $set: { ts: Date.now() } },
      )
    );
  }

  /**
   * Removes a request for a given module on a given robot at a given runlevel.
   */
  requestLess = async (robotId, moduleName, runlevel) => (
    this._doRequestLess(realRobotId || robotId, moduleName, runlevel)
  );

  /**
   * Implementation for requestLess. Removes a request for a given module
   * (irrespective of robotId being a proxy or not)
   */
  _doRequestLess = async (robotId, moduleName, runlevel) => {
    // Record new number of watchers
    await this._runlevelComparator(
      robotId,
      moduleName,
      runlevel,
      async () => await AgentModuleRequests.updateAsync(
        { robotId, moduleName, runlevel, serverId: this.serverId },
        { $inc: { value: -1 }, $set: { ts: Date.now() } }
      )
    );
  };

  /**
   * Compares a given runlevel to the one that is expected in AgentModuleRequests
   * Then decides whether to send a load or unload command to the agent
   */
  _runlevelComparator = async (robotId, moduleName, newRunlevel, dbUpdateFunc) => {
    const beforeRunlevel = await this.getModuleLevels(robotId, moduleName);

    await dbUpdateFunc();

    // Query for the maximum requested runlevel now (new necessary update)
    const expectedRunlevel = await this.getModuleLevels(robotId, moduleName);

    if (expectedRunlevel != beforeRunlevel) {
      try {
        // When the runlevel changes, we execute the callback for the module, if it exists
        const runlevelChangedCallback = this.runlevelChangeCallbacks[moduleName];
        runlevelChangedCallback && runlevelChangedCallback(robotId, expectedRunlevel);
      } catch (error) {
        console.error(`Failed executing runlevel callback for ${robotId}-${moduleName}`, error);
      }

      // Load or unload the module in the agent
      await this._changeModule(robotId, moduleName, expectedRunlevel);
    }
  };
}
