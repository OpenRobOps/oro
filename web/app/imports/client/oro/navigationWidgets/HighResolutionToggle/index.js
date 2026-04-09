/**
 * High Resolution Toggle
 *
 * Meteor component in charge of subscribing to robot image agentlet
 * and handling the toggle of high resolution.
 * The HIGH_RES_SCREENSHOT feature flag has been removed — feature is assumed enabled.
 */
import React from 'react';
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
import { isObject } from 'lodash';
// ORO modules
import HighResolutionToggleComponent from './HighResolutionToggleComponent';
import { RobotModuleState } from '../../../../lib/collections';
import { ID_TYPE_CLIENT, ID_TYPE_ROBOT, MODULE_NAMES } from '../../../../shared/constants';
import { cameraStateToArray } from '../../../../lib/states';
import { getCalculatedState } from '../../util/stateUtils';

const toggleHighResMeteorCall = (params, cb) => Meteor.call('actions.execute', params, cb);

/**
 * Get module configuration for customizations.
 */
const HighResolutionToggleContainer = (ownProps) => {
  const { robotId, cameraNumber: cameraNumberProp } = ownProps;

  const trackerData = useTracker(() => {
    if (!robotId) return {};
    const moduleStateHandle = Meteor.subscribe('robot.module_states', {
      robotId, moduleName: MODULE_NAMES.ROS_IMAGE_AGENTLET
    });

    if (!moduleStateHandle.ready()) return { isLoading: true };

    const clientImageState = RobotModuleState.findOne({
      entityId: robotId,
      entityType: ID_TYPE_CLIENT,
      moduleName: MODULE_NAMES.ROS_IMAGE_AGENTLET
    }) || {};

    // If cameraNumber is undefined for whatever reason, we must find the first camera
    // and utilize that one as the main camera
    const states = getCalculatedState({ entityId: robotId, entityType: ID_TYPE_ROBOT });
    const userImageState = states.RosImageAgentlet || { cameraViewOn: false, highSpeed: false };
    const camerasConfig = userImageState.cameras_config || {};
    const cameras = cameraStateToArray(camerasConfig) || [];
    const cameraNumber = cameraNumberProp || cameras[0]?.id;

    // Check if the client overrides indicates this camera is in hi-res mode
    const cameraIsInHighRes = isObject(clientImageState?.clientOverrides)
      && clientImageState.clientOverrides[cameraNumber] === 'focus';

    return { cameraIsInHighRes, cameraNumber };
  }, [robotId, cameraNumberProp]);

  return (
    <HighResolutionToggleComponent
      toggleHighResMeteorCall={toggleHighResMeteorCall}
      {...ownProps}
      {...trackerData}
    />
  );
};

export default HighResolutionToggleContainer;
