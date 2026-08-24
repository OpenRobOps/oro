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
 * Camera Grid Component
 *
 * Meteor component in charge of subscribing to robot cameras and rendering them as a grid.
 */
import React from 'react';
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
// ORO modules
import CameraGridComponent from './CameraGridComponent';
import { RobotModuleState } from '../../../../lib/collections';
import { ID_TYPE_ROBOT, MODULE_NAMES } from '../../../../shared/constants';

const CAMERAS_PREFERENCES = 'cameras';

/**
 * Get module configuration for customizations
 */
const CameraGridContainer = (ownProps) => {
  const { robotId, isMainCamera, mainCameraId } = ownProps;

  const trackerData = useTracker(() => {
    if (!robotId) return {};
    // Fetch module states to know how many cameras are available
    const moduleStateHandle = Meteor.subscribe('robot.module_states', { robotId, moduleName: MODULE_NAMES.ROS_IMAGE_AGENTLET });

    const isLoading = !moduleStateHandle.ready();

    // Determine camera topic and arguments
    const robotState = RobotModuleState.findOne({ entityId: robotId, entityType: ID_TYPE_ROBOT })?.[MODULE_NAMES.ROS_IMAGE_AGENTLET] || {};

    // Collect all cameras in a sorted array
    const camerasConfig = robotState.cameras_config || {};

    const cameras = Object.keys(camerasConfig).map(id => ({ id }));

    return {
      isLoading,
      cameras
    };
  }, [robotId, isMainCamera, mainCameraId]);

  return <CameraGridComponent {...ownProps} {...trackerData} />;
};

export default CameraGridContainer;
