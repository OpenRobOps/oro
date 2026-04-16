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
import { cameraStateToArray } from '../../../../lib/states';
import { getCalculatedState } from '../../util/stateUtils';

const CAMERAS_PREFERENCES = 'cameras';

/**
 * Get module configuration for customizations
 */
const CameraGridContainer = (ownProps) => {
  const { robotId, isMainCamera, mainCameraId } = ownProps;

  const trackerData = useTracker(() => {
    if (!robotId) return {};
    // Fetch module states to know how many cameras are available
    const moduleStateHandle = Meteor.subscribe('robot.module_states', {
      robotId, moduleName: 'RosImageAgentlet'
    });

    const isLoading = !moduleStateHandle.ready();

    // Determine camera topic and arguments
    const states = getCalculatedState({ entityId: robotId });
    const userImageState = (states.RosImageAgentlet || { cameraViewOn: false, highSpeed: false });
    // Collect all cameras (by topic) in a sorted array
    const camerasConfig = userImageState.cameras_config || {};
    const cameras = cameraStateToArray(camerasConfig);

    const camerasFiltered = cameras.filter((cam, ix) => {
      // if the container is not called as a main camera widget
      // then it should remove the main camera, because the main camera is being
      // displayed somewhere else
      if (!isMainCamera) return cam.id !== mainCameraId;
      // if the widget is main camera it should return the camera from
      // the mainCameraId or the first one
      return mainCameraId ? cam.id == mainCameraId : ix === 0;
    });

    return {
      isLoading,
      cameras: camerasFiltered
    };
  }, [robotId, isMainCamera, mainCameraId]);

  return <CameraGridComponent {...ownProps} {...trackerData} />;
};

export default CameraGridContainer;
