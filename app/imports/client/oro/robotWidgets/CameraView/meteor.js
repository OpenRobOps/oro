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
 * Meteor-specific code for CameraViewComponent.
 */
import { Meteor } from 'meteor/meteor';
import { CAMERA_TOGGLE_ID } from '../../../../shared/actions';

/**
 * Implements server call to enable/disable a camera, through a predefined action execution.
 */
const setCameraIsOn = ({ robotId, cameraId, isOn }, cb) => {
  Meteor.call('actions.execute', {
    robotId,
    actionId: CAMERA_TOGGLE_ID,
    args: {
      cameraId,
      enabled: isOn ? 1 : 0
    }
  }, cb);
};

/**
 * Implements server call to enable/disable the 'cropped' property of a camera, through a
 * specific meteor call.
 */
const setCameraCropped = ({ robotId, cameraId, cropped }, cb) => (
  Meteor.call('ui.updateCameraCropped', {
    robotId,
    cameraId,
    cropped
  }, cb)
);

export {
  setCameraCropped,
  setCameraIsOn
};
