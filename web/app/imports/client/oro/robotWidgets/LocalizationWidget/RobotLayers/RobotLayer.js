/**
 * Robot Layer
 *
 * Groups layers that reference a single robot and display the data regarding
 * that single robot.
 *
 * Allows keeping the latest reference to a robot's localization data for quick
 * access by the different layers that require subscribing/accessing it.
 *
 */
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { isString } from 'lodash';
// Modules
import RobotPoseLayer from './RobotPoseLayer';
import RobotBufferFootprintLayer from './RobotBufferFootprintLayer';
import LasersPointsLayer, { createFeatures as createLaserPointsFeatures } from './LasersPointsLayer';
import LaserRangeLayer from './LaserRangeLayer';
import PathLayer from './PathLayer';
import { PALETTE } from '../utils/utils';
import CostmapLayer from './CostmapLayer';

// Robot layers. They are rendered in the order DEFAULT_ROBOT_LAYERS_ORDER (top to bottom),
// unless a uiPreference `map.topmostLayers` pushes any of them to the top (first in list).
const LAYER_AVATAR = 'avatar';
const LAYER_PATH = 'path';
const LAYER_LASER = 'laser'; // laser includes the lidar points and range
const LAYER_COSTMAP = 'costmap';
const LAYER_BUFFER = 'bufferFootprint';
const DEFAULT_ROBOT_LAYERS_ORDER = [
  LAYER_AVATAR,
  LAYER_BUFFER,
  LAYER_PATH,
  LAYER_LASER,
  LAYER_COSTMAP
];
const DEFAULT_LAYERS_THICKNESS = 3;
const LAYERS_THICKNESS = {
  [LAYER_AVATAR]: 4,
  [LAYER_LASER]: 6, // this layer name represents lidar points and range; each with 3 zIndexes
  [LAYER_BUFFER]: 3,
};

/**
 * Updates laserConfig in case it is missing angle.incr and/or
 * if min and max are reversed.
 * This happens for agents lower than 3.0.0 when the lidar is mounted
 * upside-down, indicated by a 180 degree rotation over X.
 */
function patchLaserConfig(config) {
  const { angle } = config;
  if (!angle.incr) {
    angle.incr = (angle.max - angle.min) / config.numRanges;
  }
  if (angle.min > angle.max) {
    angle.min *= -1;
    angle.max *= -1;
  }
  return config;
}

// TODO: Move this and other laser-related functions to a lasers-specific utility module
// TODO: Further consider refactoring Laser layers into a single layer object that
// renders all the laser instances, since it will greatly simplify the logic and re-use
const createMultipleLaserPointsFeatures = ({
  laserConfig = {}, laserRanges = {}, uiPreferences = {}
}) => {
  const laserPointsFeatures = [];
  const laserPreferences = (uiPreferences && uiPreferences.map && uiPreferences.map.lasers
    && uiPreferences.map.lasers.elementValues) || {};
  Object.keys(laserConfig).filter(laserId => laserId in laserRanges).forEach((laserId) => {
    const patchedLaserConfig = patchLaserConfig(laserConfig[laserId]);
    const features = createLaserPointsFeatures({
      laserConfig: patchedLaserConfig,
      laserRanges: laserRanges[laserId],
      laserId,
      laserPreferences: laserPreferences[laserId]
    });
    laserPointsFeatures.push(...features);
  });
  return laserPointsFeatures;
};

/**
 * Returns a dictionary with keys from DEFAULT_ROBOT_LAYERS_ORDER, whose value are the zIndex
 * where each layer should be drawn. By default, this depends on the individual layer "thickness",
 * normally 3 zIndexes reserved for each layer (see DEFAULT_LAYERS_THICKNESS). This order can be
 * changed by passing layer names in topmostLayersPref argument, and those layers are pushed
 * to the top.
 *
 * Examples:
 *  - With no arguments, it returns:
 *    `{ costmap: 0, laser: 3, path: 9, avatar: 12 }`
 *  - If topmostLayersPref = ["laser"], then it returns:
 *    `{ costmap: 0, path: 3, avatar: 6, laser: 10 }`
 *    (Note that most layers are 3 zIndexes thick, but the robot avatar uses 4 zIndexes)
 */
const computeLayersZIndex = (topmostLayersPref) => {
  const layersOrder = DEFAULT_ROBOT_LAYERS_ORDER;
  if (isString(topmostLayersPref)) {
    // allow layer name "x" as input, interpret it as a single element to push to top: ["x"]
    topmostLayersPref = [topmostLayersPref];
  }
  // Push each of the layers in topmostLayersPref (normally at most one) to top
  Array.isArray(topmostLayersPref) && topmostLayersPref.forEach((layerToTop, ix) => {
    const currentLayerIx = layersOrder.indexOf(layerToTop, ix);
    if (currentLayerIx >= 0) { // if layer name exists, and was not pushed already to top
      layersOrder.splice(currentLayerIx, 1); // remove this layer, and then...
      layersOrder.splice(ix, 0, layerToTop); // insert it first (after all inserted layers)
    }
  });
  // Use the `layersOrder` array to create a `layers` map with key per
  // element and its z-index as value (e.g.:  { laser: 0, path: 3, ... }
  const { layers } = layersOrder.reduceRight((acc, layer) => {
    // assign this layer to current zIndex (starts from 0)
    acc.layers[layer] = acc.zIndex;
    // add the layer "thickness" for the next layers to be higher
    const thickness = LAYERS_THICKNESS[layer] || DEFAULT_LAYERS_THICKNESS;
    acc.zIndex += thickness;
    return acc;
  }, { layers: {}, zIndex: 0 });
  return layers;
};

function RobotLayer({
  localizationData,
  uiPreferences = {},
  dimmed = false,
  showCostmap = true,
  showLaserRanges = true,
  showPoseOutline = true,
  showLaserPoints = true,
  showPaths = true,
  showBufferFootprint = false,
  robotId,
  robotDetails,
  selected
}) {
  const {
    robotPose = {},
    laserConfig = {},
    laserRanges = {},
    paths = {},
    costmap = {},
    zIndex = 0
  } = localizationData;
  const { map = {} } = uiPreferences;
  const pathPreferences = (map.robotPath && map.robotPath.elementValues) || {};
  const laserPreferences = (map.lasers && map.lasers.elementValues) || {};
  const posePreferences = map.pose || {};

  const layersZIndex = useMemo(() => (
    computeLayersZIndex(map && map.topmostLayers)
  ), [map && map.topmostLayers]);

  // NOTE on zIndexes below: Some layers use multiple zIndex (consecutive) if rendering more than
  // one element. We assume here each takes no more than 3 zIndexes, and this makes this RobotLayer
  // limited to <20 zIndexes in all cases. So by default it renders from zIndex=20 to less than 40,
  // which can be changed via props.
  // If any of RobotPoseLayer, LasersPointsLayer etc need to use more zIndexes, adjust values here.
  return (
    <>
      {showBufferFootprint && (
        <RobotBufferFootprintLayer
          robotPose={robotPose}
          posePreferences={posePreferences}
          zIndex={zIndex + layersZIndex[LAYER_BUFFER]}
          selected={selected}
        />
      )}
      {showCostmap && (
        <CostmapLayer costmapMetadata={costmap} zIndex={zIndex + layersZIndex[LAYER_COSTMAP]} />
      )}
      <RobotPoseLayer
        showPoseOutline={showPoseOutline}
        robotPose={robotPose}
        primaryColor={posePreferences.primaryColor || PALETTE.robotPoseNormalPrimary}
        secondaryColor={posePreferences.secondaryColor || PALETTE.robotPoseNormalSecondary}
        opacity={dimmed ? 0.5 : posePreferences.opacity}
        zIndex={zIndex + layersZIndex[LAYER_AVATAR] /* Uses up to 4 zIndex; see LAYERS_THICKNESS */}
        posePreferences={posePreferences}
        robotId={robotId}
        selected={selected}
      />
      {Object.keys(laserConfig).filter(laserId => laserId in laserRanges).map((laserId) => {
        const patchedLaserConfig = patchLaserConfig(laserConfig[laserId]);
        return [
          showLaserPoints && (
            <LasersPointsLayer
              color={PALETTE}
              laserConfig={patchedLaserConfig}
              laserRanges={laserRanges[laserId]}
              robotPose={robotPose}
              key={`laser-points-layer-${laserId}`}
              dimmed={dimmed}
              zIndex={zIndex + layersZIndex[LAYER_LASER] + DEFAULT_LAYERS_THICKNESS}
              laserPreferences={laserPreferences[laserId]}
              laserId={laserId}
            />
          ),
          showLaserRanges && (
            <LaserRangeLayer
              color={PALETTE}
              laserConfig={patchedLaserConfig}
              laserRanges={laserRanges[laserId]}
              robotPose={robotPose}
              key={`laser-range-layer-${laserId}`}
              dimmed={dimmed}
              zIndex={zIndex + layersZIndex[LAYER_LASER]}
              laserPreferences={laserPreferences[laserId]}
            />
          )
        ];
      })}
      {Object.keys(paths).map(pathId => (
        showPaths && (
          <PathLayer
            key={pathId}
            name={'path.' + pathId}
            path={paths[pathId]}
            pathPreferences={pathPreferences[pathId]}
            dimmed={dimmed}
            zIndex={zIndex + layersZIndex[LAYER_PATH]}
          />
        )
      ))}
    </>
  );
}

RobotLayer.propTypes = {
  // Controlling layers to be shown for this robot
  // TODO: Add support for all layers
  showCostmap: PropTypes.bool,
  showPoseOutline: PropTypes.bool,
  showLaserRanges: PropTypes.bool,
  showLaserPoints: PropTypes.bool,
  showPaths: PropTypes.bool,
  showBufferFootprint: PropTypes.bool,
  // Data Props
  localizationData: PropTypes.object, // contains data to be rendered for the robot
  robotDetails: PropTypes.object,
  // Includes: Robot Pose, Laser Config + Ranges, Costmap, Paths
  // Styling and config props
  uiPreferences: PropTypes.object, // object containing all 'map' ui preferences
  dimmed: PropTypes.bool, // Whether the robot layer should be dimmed (de-emphasized)
  robotId: PropTypes.string, // used for tracking which robot is clicked
  selected: PropTypes.bool
};

export default RobotLayer;
export { createMultipleLaserPointsFeatures };
