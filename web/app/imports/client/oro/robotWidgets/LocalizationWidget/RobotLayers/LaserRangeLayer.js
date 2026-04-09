/**
 * Laser Range Layer
 *
 * What this layer does is to represent one particular laser range.
 * This is done by creating a huge layer that covers the whole map except for the laser range,
 * the layer is then styled with a gray shadow color so that the only thing that remains without color is the laser range
 *
 * The code on how to create the shadowed layer was based on
 *  - https://docs.google.com/presentation/d/1l3cs1PF429SCbAfF5UGwjCgA_Ag2faMZQm-sCOpoMxQ
 */
import React, { useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Polygon from 'ol/geom/Polygon';
import { Fill, Stroke, Style } from 'ol/style';
// Modules
import ReactVectorLayer from './ReactVectorLayer';
import theme from '../../../../Styles';
import { transformFeatures } from '../utils/geometry';

// Big enough number to cover the whole map, this is going to be the radius of the outer
// border of the visibility range
const FARAWAY_BOUNDS_RANGE = 100;

/**
 * Precision on which the "circles" are going be to drawn,
 * Since the OpenLayers library does not provide a way to draw circle sections or arches.
 * The code needs to do it manually by drawing a Polygon of CIRCLE_POLYGON_SIDES edges to
 * simulate a circle
 */
const CIRCLE_POLYGON_SIDES = 128;

/**
 * A full circle in radians
 */
const FULL_CIRCLE = 2 * Math.PI;

/**
 * Angle increment expressed in radians
 */
const ANGLE_INCREMENT = FULL_CIRCLE / CIRCLE_POLYGON_SIDES;

/**
 * Receives a laserConfig with its range and angle, it then returns the polygon to be cloned when
 * the robot moves.
 * This Polygon has the shape of an arch,
 *   - its inner circle is the max range the laser config has set
 *   - its outer circle is a constant simulating infinity (FARAWAY_BOUNDS_RANGE) it should cover
 *     the whole map
 *   - its lateral limits are determined by the min and max angles
 * The Polygon is then going to be shaded, so this area is out of range for this laser config
 * @param {object} laserConfig - Robots laser configuration
 *
 */
const getLaserRangesArch = (laserConfig) => {
  const { range, angle } = laserConfig;
  const points = [];

  // minAngleStartI and maxAngleEndI are integer variables that represent the amount of iterations
  // the arc has depending on the angle
  // the arc will be drawn from the min angle to the max angle
  const minAngleStartI = Math.round(angle.min * CIRCLE_POLYGON_SIDES / FULL_CIRCLE);
  const maxAngleEndI = Math.round(angle.max * CIRCLE_POLYGON_SIDES / FULL_CIRCLE);

  let i = minAngleStartI;
  // Draws the outer circle, this should be as big as the map size, this layer should cover the
  // whole map it starts from the min angle iteration and stops in the max angle
  for (; i <= maxAngleEndI; i++) {
    points.push([Math.cos(ANGLE_INCREMENT * i) * FARAWAY_BOUNDS_RANGE, Math.sin(ANGLE_INCREMENT * i) * FARAWAY_BOUNDS_RANGE])
  }

  // Draws the inner circle section, this is the arc closest to the robot and it is the outer limit of the visibility area
  for (i--; i >= minAngleStartI; i--) {
    points.push([Math.cos(ANGLE_INCREMENT * i) * range.max, Math.sin(ANGLE_INCREMENT * i) * range.max])
  }
  return new Polygon([points]);
};

/**
 * Draws the cone containing the points that are out of range of the laser due to the angle and not because of range
 * @param {object} laserConfig - Robots laser configuration
 */
const getOutOfAngleRangeCone = (laserConfig) => {
  let { angle } = laserConfig;

  // First point is on the robot because it should be a cone
  const points = [[0, 0]];
  // calculate the hidden angle, this is the section angle that's outside the laser config min, max angles
  const hiddenAngle = FULL_CIRCLE - (angle.max - angle.min);
  const maxAngleEndI = Math.round(angle.max * CIRCLE_POLYGON_SIDES / FULL_CIRCLE);

  // calculate how many iterations are needed to cover the whole hiddenAngle
  const hiddenAngleIterations = Math.abs(Math.round(hiddenAngle * CIRCLE_POLYGON_SIDES / FULL_CIRCLE));

  // Draws the outer section of the cone, starting from the maxAngle and doing hiddenAngleIterations to close the cone
  for (let i = maxAngleEndI; i <= maxAngleEndI + hiddenAngleIterations; i++) {
    points.push([Math.cos(ANGLE_INCREMENT * i) * FARAWAY_BOUNDS_RANGE, Math.sin(ANGLE_INCREMENT * i) * FARAWAY_BOUNDS_RANGE])
  }

  return new Polygon([points]);
};

const createShadowStyle = (zIndex = 0) => (
  new Style({
    stroke: new Stroke({
      color: 'transparent'
    }),
    fill: new Fill({
      color: theme.palette.shadowColor.darkGrayWithOpacity
    }),
    zIndex
  })
);

/**
 * Creates the features to draw the laser range cone
 */
const createFeatures = ({ laserConfig, zIndex, laserPreferences = {} }) => {
  const { transform = {} } = laserConfig;
  const features = [];
  const style = createShadowStyle(zIndex);

  const laserRangesArch = new Feature(getLaserRangesArch(laserConfig));
  laserRangesArch.setStyle(style);
  features.push(laserRangesArch);

  const outOfAngleRangeCone = new Feature(getOutOfAngleRangeCone(laserConfig));
  outOfAngleRangeCone.setStyle(style);
  features.push(outOfAngleRangeCone);

  transformFeatures(features, transform);

  return features;
};

/**
 * Returns a VectorLayer with the LaserRanges
 */
const LaserRangesLayer = (
  { robotPose = {}, laserConfig = {}, zIndex = 0, laserPreferences = {} }
) => {
  // Create the vector source and layer only the first time, when we mount
  const vectorSource = useMemo(() => (
    new VectorSource()
  ), []);

  // laserConfig changes rarely if ever so calculate features on a memo that only
  // depends on laserConfig
  const featuresAtOrigin = useMemo(() => (
    createFeatures({ laserConfig, zIndex, laserPreferences })
  ), [laserConfig, zIndex]);

  // Redraw cone every time the robotPose changes
  useEffect(() => {
    const clones = featuresAtOrigin.map(f => f.clone());
    const featuresAtMap = transformFeatures(clones, robotPose);
    vectorSource.clear();
    vectorSource.addFeatures(featuresAtMap);
    return () => {
      vectorSource && vectorSource.clear();
    };
  }, [robotPose, laserConfig]);

  return (
    <ReactVectorLayer
      name="laserRanges"
      source={vectorSource}
      zIndex={zIndex}
    />
  );
};

LaserRangesLayer.propTypes = {
  // Data Props
  robotPose: PropTypes.object, // {x,y,theta} of the robot
  laserConfig: PropTypes.object, // metadata such as laser transform, max/min angle, range, etc
  zIndex: PropTypes.number
};

export default LaserRangesLayer;
