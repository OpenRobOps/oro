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
 * Waypoint navigation interaction
 *
 * Interactive layer that allows users to create waypoints along the map,
 * relocate them, rotate them and delete them.
 *
 * Does not require Robot data, just reference to the map.
 */
import React, { useState } from 'react';
import Point from 'ol/geom/Point';
// ORO Modules
import theme from '../../../../Styles';
import { useActiveInteraction } from '../../../contexts/ActiveInteractionContext';
import { createFeature } from '../utils/utils';
import { noStyle, pinIconStyle } from '../Map/Styles';
import { TranslateRotateComponent, ClickComponent } from './ReactInteractions';
import { createArrowFeature, createRotateIndicatorFeatures } from '../RobotLayers/RobotPoseLayer';
import PathLayer from '../RobotLayers/PathLayer';

/**
 * Creates WaypointNav interaction features.
 *
 * Besides the virtual center point, it consists of a rendering of the robot avatar, which can
 * be rotated, and a waypoint 'pin' marker.
 */
const createPoseFeatures = ({ posePreferences = {} }) => {
  const translateFeatures = [];
  const { radius, scale } = posePreferences;
  const features = [
    createArrowFeature({
      color: theme.palette.teleop.waypointAvatar,
      radius,
      selected: true,
      zIndex: 100
    }),
    ...createRotateIndicatorFeatures({
      color: theme.palette.teleop.waypointAvatar,
      radius,
      selected: true,
      width: 6,
      zIndex: 100
    })
  ];
  const feature = createFeature(new Point([0, 0]), 'waypointPin', 0);
  feature.setId('translateFeature');
  feature.setStyle(pinIconStyle(theme.palette.teleop.waypointAvatar, scale ? 32 * scale : 32));
  translateFeatures.push(feature);

  const center = createFeature(new Point([0, 0]), 'center', 0);
  center.setId('centerFeature');
  center.setStyle(noStyle);
  translateFeatures.push(center);

  return { features, translateFeatures, centerFeature: center };
};

/**
 * Waypoint Navigation interaction
 *
 * It lets the user set a list of one or many waypoints for the robot to navigate to
 * in sequence.
 *
 * If the isMultiWaypoint parameter is omitted or set to false, the behavior is a
 * a 'navigate to goal' experience. The user can set and then adjust a single waypoint.
 * When the interaction is submitted, the selected pose is provided as interaction data.
 *
 * If isMultiWaypoint is provided and true, it is possible to add a sequence of waypoints
 * which are connected by dotted lines.
 * When the interaction is submitted, the list of poses is provided as the interaction data.
 */
const WaypointNav = ({
  robotLocalizationData = {},
  uiPreferences = {},
  isMultiWaypoint = false
}) => {
  const { robotPose = {} } = robotLocalizationData;
  const { setInteractionData } = useActiveInteraction();
  const posePreferences = uiPreferences.map && uiPreferences.map.pose;

  const [waypoints, setWaypoints] = useState([]);

  // When clicking in any place in the map, only add a new waypoint to the list
  // if:
  // - it's the first waypoint; or
  // - isMultiWaypoint is true
  // As a result, if isMultiWaypoint is false, click only adds a waypoint the
  // first time
  const clickFn = ([x, y]) => {
    setWaypoints(w => (isMultiWaypoint || w.length == 0 ? [...w, { x, y }] : w));
  };

  // NOTE: This is updating a state element directly without re-setting
  // the state, but things work fine because setInteractionData triggers a
  // re-render through useActiveInteraction anyway
  const updatePose = index => (pose) => {
    waypoints[index] = pose;
    setInteractionData(isMultiWaypoint ? { waypoints } : { pose: waypoints[0] });
  };

  const components = [
    <ClickComponent key="click" onClick={clickFn} />
  ];

  waypoints.forEach((waypoint, ix) => {
    const { features, translateFeatures, centerFeature } = createPoseFeatures({ posePreferences });
    const theta = ix == 0 ? robotPose.theta : waypoints[ix - 1].theta;
    components.push(
      <TranslateRotateComponent
        // NOTE: For waypoint deletion to work, we should not disable this eslint rule
        // and instead create and use a proper random ID for each created waypoint as a key
        // eslint-disable-next-line react/no-array-index-key
        key={`waypoint-${ix}`}
        features={features}
        translateFeatures={translateFeatures}
        centerFeature={centerFeature}
        onPoseUpdate={updatePose(ix)}
        initialPose={{ theta, ...waypoint }}
        translateHandleFilter={feature => feature.getId() == 'translateFeature'}
      />
    );
  });
  isMultiWaypoint && components.push(
    <PathLayer
      key="path"
      path={{ points: [robotPose].concat(waypoints) }}
      pathPreferences={{ shouldPersist: true }}
    />
  );

  return components;
};

export default WaypointNav;
export {
  createPoseFeatures
};
