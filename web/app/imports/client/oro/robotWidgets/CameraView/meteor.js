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
