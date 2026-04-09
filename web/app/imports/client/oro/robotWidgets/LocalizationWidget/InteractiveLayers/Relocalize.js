/**
 * Relocalize
 *
 * Interactive layer to allow translating and rotating a copy of the Robot Pose
 * and Laser Layers.
 *
 * Requires a one time copy of Robot Pose and Laser data.
 */
import React, { useMemo } from 'react';
import Polygon from 'ol/geom/Polygon';
import Point from 'ol/geom/Point';
// ORO Modules
import { useActiveInteraction } from '../../../contexts/ActiveInteractionContext';
import { createFeature, PALETTE } from '../utils/utils';
import { noStyle, markerStyle } from '../Map/Styles';
import { createFeatures as createRobotPoseFeatures } from '../RobotLayers/RobotPoseLayer';
import { createSquarePolygon, THREE_QUARTER_CIRCLE, CIRCLE_POLYGON_SIDES, ANGLE_INCREMENT } from '../Map/CustomShapes';
import { transformFeatures } from '../utils/geometry';
import { createMultipleLaserPointsFeatures } from '../RobotLayers/RobotLayer';
import { TranslateRotateComponent } from './ReactInteractions';

// Width of the body for the relocalize rotate marker
const RELOCALIZE_ROTATE_WIDTH = 0.03;

// Base point for the relocalize rotate marker
const RELOCALIZE_ROTATE_BASE = 0.95;

// Height of the body for the relocalize rotate marker
const RELOCALIZE_ROTATE_HEIGHT = 1.3;

// Radius of the head for the relocalize rotate maker
const RELOCALIZE_ROTATE_RADIUS = 0.2;

// Size of the inner square which is associated with the rotation feature
const RELOCALIZE_ROTATE_POLYGON_SIZE = 0.95;

// Size of the outer square which is associated with the translation feature
const RELOCALIZE_DRAG_POLYGON_SIZE = 1;

/**
 * Creates a custom shape used to mark translating in relocalize component
 */
const relocalizeDragPolygon = createSquarePolygon(RELOCALIZE_DRAG_POLYGON_SIZE);

/**
 * Creates a custom shape used to mark rotating in relocalize component
 * (non-interactive)
 */
const relocalizeRotateOffset = createSquarePolygon(RELOCALIZE_ROTATE_POLYGON_SIZE);

/**
 * Creates the relocalize marker point composed of a circle with a large base
 */
const relocalizeRotatePolygon = () => {
  // Draws the first line from the origin to the the top left
  const points = [
    [-RELOCALIZE_ROTATE_WIDTH, RELOCALIZE_ROTATE_BASE],
    [-RELOCALIZE_ROTATE_WIDTH, RELOCALIZE_ROTATE_HEIGHT]
  ];

  // Draws the head of the rotate marker for the relocalize component
  // It starts drawing from the 3/4 circle because the last point is in the top left
  // to complete the circle it should start from there
  let i = THREE_QUARTER_CIRCLE;
  for (; i <= CIRCLE_POLYGON_SIDES + THREE_QUARTER_CIRCLE; i++) {
    points.push([
      Math.cos(ANGLE_INCREMENT * i) * RELOCALIZE_ROTATE_RADIUS,
      (RELOCALIZE_ROTATE_RADIUS + RELOCALIZE_ROTATE_HEIGHT)
        + (Math.sin(ANGLE_INCREMENT * i) * RELOCALIZE_ROTATE_RADIUS)]);
  }
  i--;
  points.push(
    [RELOCALIZE_ROTATE_WIDTH, RELOCALIZE_ROTATE_HEIGHT],
    [RELOCALIZE_ROTATE_WIDTH, RELOCALIZE_ROTATE_BASE]
  );
  return new Polygon([points]);
};

const [dragStyle, rotateStyle, arrowColor, arrowBkg] = [
  PALETTE.relocalizeDrag,
  PALETTE.relocalizeRotate,
  PALETTE.robotPoseNormalPrimary,
  PALETTE.robotPoseNormalSecondary
];

/**
 * Creates the relocalize control features.
 *
 * They consists of the robot pose and laser, and a control square plus handle
 * around it.
 *
 * The control square and handle is rotated opposite to the direction of the
 * robot so that when the robot is placed on its initial rotation, the square
 * and handle appears vertically aligned with the screen.
 */
const createFeatures = ({
  primaryColor,
  secondaryColor,
  robotRotation,
  laserConfig,
  laserRanges,
  uiPreferences = {}
}) => {
  const features = [];

  // Feature: main green background square
  let feature = createFeature(relocalizeDragPolygon.clone(), 'translate', 0);
  feature.setStyle(markerStyle(dragStyle.color, dragStyle.stroke, dragStyle.strokeWidth));
  feature.setId('translateFeature');
  features.push(feature);

  // Feature: blue frame around green square
  feature = createFeature(relocalizeRotateOffset.clone(), 'translateOffset', 0);
  feature.setStyle(markerStyle('transparent', rotateStyle.stroke, rotateStyle.strokeWidth));
  feature.setId('translateFeatureOffset');
  features.push(feature);

  // Feature: grab handle on the top
  feature = createFeature(relocalizeRotatePolygon(), 'rotate', 0);
  feature.setId('rotateFeature');
  feature.setStyle(markerStyle(rotateStyle.color, rotateStyle.stroke));
  features.push(feature);

  // Feature: virtual, invisible center used to keep track of the translated robot center
  const center = createFeature(new Point([0, 0]), 'center', 0);
  center.setId('centerFeature');
  center.setStyle(noStyle);
  features.push(center);

  // Rotate the control inversely to the robot avatar rotation so that as a
  // result, it will be aligned vertically with the map
  transformFeatures(features, { theta: -robotRotation });

  // Create robot avatar and laser features
  const posePreferences = uiPreferences.map && uiPreferences.map.pose;
  // TODO: If robot has no orientation or orientation is a non finite number
  // relocalization won't work, the logic needs to be re-thought
  const robotPoseFeatures = createRobotPoseFeatures({
    primaryColor, secondaryColor, posePreferences, oriented: true
  });
  const laserFeatures = createMultipleLaserPointsFeatures({
    laserConfig, laserRanges, uiPreferences
  });

  features.push(...robotPoseFeatures, ...laserFeatures);

  return {
    centerFeature: center,
    features
  };
};

/**
 * Relocalize interaction component.
 *
 * It takes an initial, individual robotLocalizationData and publishes
 * the delta position and rotation with respect to the initial robot pose
 * in the interaction context.
 */
const Relocalize = ({ robotLocalizationData = {}, uiPreferences = {} }) => {
  const { laserConfig = {}, laserRanges = {}, robotPose = {} } = robotLocalizationData;
  const { setInteractionData } = useActiveInteraction();

  const relocalizeInteraction = useMemo(() => {
    // Get a copy of the robotPose as initial pose
    const initialPose = { ...robotPose };

    // Convert the translate + rotate interaction into a relocalize
    // interaction and dispatch through the interaction context.
    const dispatchPose = ({ x, y, theta }) => {
      // The Relocalize message is the delta in movement and rotation
      setInteractionData({
        pose: {
          x: x - initialPose.x || 0,
          y: y - initialPose.y || 0,
          theta: theta - initialPose.theta || 0
        }
      });
    };

    // Create control features.
    const {
      centerFeature,
      features
    } = createFeatures({
      primaryColor: arrowColor,
      secondaryColor: arrowBkg,
      robotRotation: initialPose.theta,
      laserConfig,
      laserRanges,
      uiPreferences
    });

    return (
      <TranslateRotateComponent
        features={features}
        centerFeature={centerFeature}
        onPoseUpdate={dispatchPose}
        initialPose={initialPose}
        translateHandleFilter={feature => feature.getId() == 'translateFeature'}
      />
    );
  }, []);

  return relocalizeInteraction;
};

export default Relocalize;
