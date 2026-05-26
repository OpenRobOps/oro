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
 * Camera View widget
 * Displays images from the selected robot's camera on the client
 */
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
import { isObject } from 'lodash';
import { applyDefaults } from '../../../../lib/util';
import { RobotModuleState, Robots } from '../../../../lib/collections';
import { ID_TYPE_CLIENT, ID_TYPE_ROBOT, MODULE_NAMES } from '../../../../shared/constants';
import { useDirectClient } from '../../util/DirectClient';
import CameraViewComponent from './CameraViewComponent';
import { setCameraCropped, setCameraIsOn } from './meteor';

const CameraView = props => (
  <CameraViewComponent
    {...props}
    onSetCameraIsOn={setCameraIsOn}
    onSetCameraCropped={setCameraCropped}
  />
);

const CameraViewClient = (props) => {
  const { robotId, cameraId } = props;
  const imageData = useDirectClient({
    robotId,
    subtopic: 'ros/camera2',
    typeString: 'CameraMessage',
    decodeFunc: (msg) => {
      if (cameraId != msg.cameraId) {
        // Ignore camera updates that don't correspond to the configured cameraId.
        // TODO: Update camera protocol so that each camera is published on a separate
        // topic and can be subscribed to independently.
        return null;
      }
      return { image: msg };
    }
  });
  return <CameraView {...props} {...imageData} />;
};

const CameraViewContainer = (props) => {
  const { robotId, config } = props;
  const cameraNumber = (config?.cameraId) || '0';
  const trackerData = useTracker(() => {
    if (robotId) {
      const moduleStateHandle = Meteor.subscribe('robot.module_states',
        { robotId, moduleName: MODULE_NAMES.ROS_IMAGE_AGENTLET });
      const agentModuleStateHandle = Meteor.subscribe('robot.agent_module_states',
        { robotId, moduleName: MODULE_NAMES.ROS_IMAGE_AGENTLET });
      const robotHandle = Meteor.subscribe('robot.details', { robotId });

      const isLoading = (moduleStateHandle && !moduleStateHandle.ready())
        || (agentModuleStateHandle && !agentModuleStateHandle.ready())
        || (robotHandle && !robotHandle.ready());

      const robot = Robots.findOne({ _id: robotId });
      const { status } = robot || {};
      const offline = !(status && status.agentOnline);

      // TODO: Review entity mapping for ORO context
      const robotState = RobotModuleState.findOne({ entityId: robotId, entityType: ID_TYPE_ROBOT })?.[MODULE_NAMES.ROS_IMAGE_AGENTLET] || {};
      const agentImageState = RobotModuleState.findOne({ entityId: robotId, entityType: 'agent' })?.[MODULE_NAMES.ROS_IMAGE_AGENTLET] || {};
      const clientImageState = RobotModuleState.findOne({ entityId: robotId, entityType: ID_TYPE_CLIENT })?.[MODULE_NAMES.ROS_IMAGE_AGENTLET] || {};
      const userImageState = robotState || { cameraViewOn: false, highSpeed: false };
      const { highSpeed } = userImageState;
      const cameraModuleOn = userImageState.cameraViewOn;

      const userCamerasConfig = (userImageState?.cameras_config) || {};
      const agentCamerasConfig = (agentImageState?.cameras_config) || {};
      const camerasConfig = applyDefaults(applyDefaults({}, userCamerasConfig), agentCamerasConfig);

      const cameraId = agentImageState?.camera_topics?.[cameraNumber] || robotState?.camera_topics?.[cameraNumber];
      const cameraEnabledSetting = camerasConfig?.[cameraNumber]?.is_on;
      const cameraEnabled = cameraEnabledSetting === undefined ? true : cameraEnabledSetting;

      const cameraHiRes = clientImageState && isObject(clientImageState.clientOverrides)
        && clientImageState.clientOverrides[cameraNumber] == 'focus';

      if (!isLoading && cameraModuleOn) {
        // Create a subscription to track usage of camera. This does not publish/retrieve docs, it only 
        // activates the requestMore() mechanism for agentlets
        Meteor.subscribe('camera_images', { robotId, highSpeed });
      }

      return {
        robotId,
        cameraModuleOn,
        disableMqtt: !cameraModuleOn,
        isLoading,
        cameraId,
        camerasConfig,
        cameraEnabled,
        cameraHiRes,
        offline,
        cameraNumber,
      };
    }
    return {};
  }, [robotId, cameraNumber]);
  return <CameraViewClient {...props} {...trackerData} />;
};

export default CameraViewContainer;
