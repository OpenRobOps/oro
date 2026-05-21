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
 * app-server camera images module
 *
 * Design details originally part of High Resolution Snapshots
 * @see https://docs.google.com/document/d/1dnQyzAw7rmPTJArLjOMkE_AWrUFmTz0izef055-jvF4/edit#heading=h.6m9wzxd5wmy2
 *
 * This works together with a configuration in UIPreferences in the 'cameras' section, like so:
 *
 * cameras: {
 *   _all_: {
 *     ...
 *     config_overrides: {
 *       focus: {
 *         img_width: 1920,
 *         img_height: 1280
 *       },
 *       hide: {
 *         is_on: false
 *       }
 *     }
 *   }
 * }
 *
 * This module is aware of proxy robots (See [Experiment: Proxy Robots](https://docs.google.com/document/d/1Z9VsaLrveSSiCf_f9L7Cpoj3Vua7-nGq5nnMDV29Zvk/edit#))
 * meaning that its functionality can be used on either real or proxy robots and the effect will be
 * propagated to other robots that share the same underlying real robot.
 *
 * It allows real and proxy robots to share control of:
 *  - Toggling cameras on/off
 *  - Toggling High Resolution mode
 */
import { Meteor } from 'meteor/meteor';
import { isString, isObject } from 'lodash';
// ORO modules
import { propGet, applyDefaults } from '../../lib/util';
import Mqtt from '../mqtt';
import ConfigManager, { ID_TYPE_ROBOT } from '../../lib/configManagerAsync';
import { MODULE_NAMES } from '../../shared/constants';
import { getCalculatedStateAsync } from '../../lib/states';
import AgentManager from '../agentManager';
import { UIPreferences } from '../../lib/collections';
import OroRoles from '../roles';
import { ACCESS_LEVEL_VIEW } from '../../shared/roles';
import { HIGH_RES_DURATION } from '../../shared/uiPreferences';

/**
 * Specifies at which runlevel the background job should run.
 * Whenever the agentlet is at background runlevel, it will report images even if not selected
 */
const BACKGROUND_RUNLEVEL = 1;

class ImagesModule {
  constructor() {
    this.mqtt = new Mqtt();
    this.uiPreferences = new ConfigManager(UIPreferences);
    // Timers for resetting configuration to original value, keyed by robotId
    this.resetTimers = {};

    // Configure the callback when the runlevel for RosImageAgentlet changes
    new AgentManager().registerRunlevelChangeCallback(MODULE_NAMES.ROS_IMAGE_AGENTLET,
      this.handleBackgroundOverride);
    // Configure the callback for the module state override
    new AgentManager().registerModuleStateOverride(MODULE_NAMES.ROS_IMAGE_AGENTLET,
      this.handleModuleStateOverride);

    // Registers the cameraImagesPublisher Meteor publication
    const that = this;
    Meteor.publish('camera_images', async function (params) {
      return that.cameraImagesPublisher(this, params);
    });
  }

  /**
   * Temporarily overrides the cameras_config for a given robot.
   * This API is meant to be generic enough to allow for various use cases on different parts
   * of our application, including having different types of overrides for multiple
   * cameras at the same time with different customizable profiles.
   *
   * @param robotId to override
   * @param overrides. Map of override profiles   { "0": "focus", "1": "hide" }
   * @param resetTimeSec  Time in seconds that the override will last. 0 to make it indefinite.
   */
  configOverride = async ({ robotId, overrides, resetTimeSec = 60 }) => {
    // Sanity checks
    if (!isString(robotId)) {
      throw new Error('robotId must be provided');
    }
    if (!isObject(overrides)) {
      throw new Error('overrides must be an object');
    }

    const updatedConfig = await this._getStateWithOverrides(robotId, overrides);

    // NOTE: We send the override configuration directly to the agent without saving it
    // in the database, because we want to keep the actual configuration as a state and avoid making
    // this configuration any more permanent than it has to be.
    // We'll use the configuration from the database to reset the configuration to the
    // original state after the override expires.
    this.mqtt.setModuleState({
      robotId,
      moduleName: MODULE_NAMES.ROS_IMAGE_AGENTLET,
      newState: updatedConfig
    });

    // Schedule reset unless resetTimeSec is explicitly set to 0
    if (robotId in this.resetTimers && this.resetTimers[robotId]) {
      clearTimeout(this.resetTimers[robotId]);
    }
    if (resetTimeSec > 0) {
      this.resetTimers[robotId] = setTimeout(Meteor.bindEnvironment(() => {
        this.configOverrideReset({ robotId });
        this.resetTimers[robotId] = null;
      }), resetTimeSec * 1000);
    }
  };

  /**
   * Resets any override set to the give robotId
   * This method is proxy-robot-aware.
   */
  configOverrideReset = async ({ robotId }) => {
    // Get cameras config, with possible overrides (this is handled in `getModuleStates`)
    const camerasConfig = await new AgentManager().getModuleStates(robotId, MODULE_NAMES.ROS_IMAGE_AGENTLET, 'cameras_config');
    // Clear the client-related config
    await new AgentManager().setModuleStateClient(
      robotId,
      MODULE_NAMES.ROS_IMAGE_AGENTLET,
      { clientOverrides: undefined }
    );

    this.mqtt.setModuleState({
      robotId, moduleName: MODULE_NAMES.ROS_IMAGE_AGENTLET, newState: camerasConfig
    });
  };

  /**
   * Higher-level API to allow overriding one particular camera to a higher resolution
   * profile and all the rest to a lower resolution one at the same time.
   * This method is proxy-robot-aware.
   *
   * Used by gc/widgets/CameraView.js
   *
   * @param robotId to override
   * @param cameraNumber for the camera that needs to be set to a higher resolution
   */
  startHighResOverride = async ({ robotId, cameraNumber }) => {
    const realRobotId = await new Robot(robotId).getProxiedRobotIdAsync() || robotId;
    // Start by setting an override of 'focus' profile for the provided camera
    const overrides = { [cameraNumber]: 'focus' };

    // Save a config in the client module state state, with the current camera overrides
    await new AgentManager().setModuleStateClient(
      robotId,
      MODULE_NAMES.ROS_IMAGE_AGENTLET,
      { clientOverrides: overrides }
    );

    // Search for which other cameras the robot has configured and add them to overrides
    // with the 'hide' profile
    const camerasConfig = await getCalculatedStateAsync({
      entityId: robotId,
      entityType: ID_TYPE_ROBOT,
      moduleName: MODULE_NAMES.ROS_IMAGE_AGENTLET,
      fields: ['cameras_config']
    });
    Object.keys(camerasConfig.cameras_config || {}).forEach((camNum) => {
      if (!(camNum in overrides)) {
        overrides[camNum] = 'hide';
      }
    });

    // Apply overrides configuration
    await this.configOverride({ robotId, overrides, resetTimeSec: HIGH_RES_DURATION });
  };

  /**
   * Callback that handles overrides in cameras configuation for the specified runlevel.
   *
   * It resends the module state to the agent with the configuration override
   * when the runlevel is `BACKGROUND_RUNLEVEL` or the calculated state otherwise.
   *
   * Used as a callback in agentManager, whenever the runlevel changes
   *
   * @param {*} robotId
   * @param {*} runlevel
   * @return {*}
   * @memberof ImagesModule
   */
  handleBackgroundOverride = async (robotId, runlevel) => {
    // If the runlevel is not background, send the state without overrides
    if (!runlevel || runlevel !== BACKGROUND_RUNLEVEL) {
      return this.configOverride({ robotId, overrides: {}, resetTimeSec: 0 });
    }

    // Otherwise, get state with overrides

    // Search which cameras the robot has configured
    const camerasConfig = await getCalculatedStateAsync({
      entityId: robotId,
      entityType: ID_TYPE_ROBOT,
      moduleName: MODULE_NAMES.ROS_IMAGE_AGENTLET,
      keys: ['cameras_config']
    });

    const overrides = Object.keys(camerasConfig.cameras_config || {})
      .reduce((currentOverrides, camNum) => {
        currentOverrides[camNum] = 'background';
        return currentOverrides;
      }, {});

    // Apply overrides configuration indefinetly.
    // It will change every time the runlevel changes
    await this.configOverride({ robotId, overrides, resetTimeSec: 0 });
  };

  /**
   * Callback that handles module state overriding for the RosImageAgentlet.
   *
   * It will return the background override when the runlevel is `BACKGROUND_LEVEL`
   * or the current state otherwise
   *
   * It's used whenever getModuleStates is called and it overrides the current
   * state with custom logic
   * @see agentManager.getModuleStates
   *
   * @param {*} robotId
   * @param {*} currentState
   * @memberof ImagesModule
   */
  handleModuleStateOverride = async (robotId, currentState = {}) => {
    // Get the current runlevel
    const runlevel = await new AgentManager().getModuleLevels(robotId, MODULE_NAMES.ROS_IMAGE_AGENTLET);

    // If the current runlevel is not background, we don't need to override
    if (!runlevel || runlevel !== BACKGROUND_RUNLEVEL) {
      return currentState;
    }

    // When the runlevel is background, return the state with override values
    const overrides = Object.keys(currentState.cameras_config || {})
      .reduce((currentOverrides, camNum) => {
        currentOverrides[camNum] = 'background';
        return currentOverrides;
      }, {});

    const state = await this._getStateWithOverrides(robotId, overrides);

    return state;
  };

  /**
   * ----------------------------------------------------------------------------
   * Internal methods below
   * ----------------------------------------------------------------------------
   */

  /**
   * Gets the current module state, applying the overrides from ui-preferences
   *
   * @param {*} robotId
   * @param {*} overrides
   * @return {*}
   * @memberof ImagesModule
   */
  _getStateWithOverrides = async (robotId, overrides) => {
    // Calculate overrides for each camera
    const camerasPrefs = await this.uiPreferences.getEntityConfig({
      entityId: robotId,
      entityType: ID_TYPE_ROBOT,
      fields: ['cameras'],
    });
    const configOverrides = ImagesModule.calculateOverrides(camerasPrefs.cameras, overrides);

    // Get cameras_config according to agentManager
    const camerasConfig = await getCalculatedStateAsync({
      entityId: robotId,
      entityType: ID_TYPE_ROBOT,
      moduleName: MODULE_NAMES.ROS_IMAGE_AGENTLET,
      keys: ['cameras_config'],
    });

    // Apply overrides to config
    const updatedConfig = applyDefaults({ cameras_config: configOverrides }, camerasConfig);

    return updatedConfig;
  }

  /**
   * Calculates a configuration override based on a given cameras
   * UIPreference entry and a set of override labels for each
   * camera.
   *
   * Returns a cameras_config object keyed by camera ID with only the
   * values that need to be changed.
   *
   * @see the robot schema for RobotModuleStates in lib/collections.js
   * for details on the format for cameras_config.
   */
  static calculateOverrides = (camerasPreferences, overrides) => {
    const configOverrides = {};
    // Do this for each camera to override
    Object.entries(overrides).forEach(([cameraId, override]) => {
      // Start with the values specific for this camera ID
      configOverrides[cameraId] = propGet(camerasPreferences,
        `${cameraId}.config_overrides.${override}`) || {};
      // Apply defaults from the special _all_ entry
      applyDefaults(configOverrides[cameraId],
        propGet(camerasPreferences, `_all_.config_overrides.${override}`) || {});
    });

    return configOverrides;
  };

  /**
   * Camera images publication.
   *
   * Used by the client to signal load / unload of camera images agentlet
   */
  cameraImagesPublisher = async (sub, { robotId }) => {
    if (!isString(robotId)) {
      return sub.error('robotId must be a string');
    }
    if (!sub.userId) { // User must be logged in
      return sub.error('User is not logged in');
    }
    // Verify the logged-in user has access to this robot
    if (!await new OroRoles().canAccessRobot(sub.userId, robotId, ACCESS_LEVEL_VIEW)) {
      console.warn(`Unauthorized (camera_images): userId: ${sub.userId}, robotId: ${robotId}`);
      return sub.error('Unauthorized');
    }

    // Trigger agentlet runlevel change accordingly
    const requestedRunlevel = 5;
    await new AgentManager().requestMore(
      robotId,
      MODULE_NAMES.ROS_IMAGE_AGENTLET,
      requestedRunlevel
    );
    sub.onStop(async () => {
      await new AgentManager().requestLess(
        robotId,
        MODULE_NAMES.ROS_IMAGE_AGENTLET,
        requestedRunlevel
      );
    });

    return sub.ready();
  };

  /**
   * Enable or disable a robot camera, persisting the module state and sending the module state
   * update to the agent.
   * This method is proxy-robot-aware.
   */
  // eslint-disable-next-line class-methods-use-this
  setCameraIsOn = async ({ robotId, cameraId, isOn }) => {
    await new AgentManager().setModuleState2(
      robotId,
      ID_TYPE_ROBOT,
      MODULE_NAMES.ROS_IMAGE_AGENTLET,
      {
        [`cameras_config.${cameraId}.is_on`]: Boolean(isOn)
      }
    )
  };
}

export default ImagesModule;