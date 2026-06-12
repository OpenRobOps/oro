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
 * Position layer Component for the map.
 * It will get mounted only when the map exists.
 */
import React, { useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import { Fill, Stroke, Style } from 'ol/style';
import { getBottomLeft, getTopRight } from 'ol/extent';
import Circle from 'ol/geom/Circle';
import MultiPoint from 'ol/geom/MultiPoint';
import Polygon from 'ol/geom/Polygon';
// Modules
import ReactVectorLayer from './ReactVectorLayer';
import {
  AVATAR_BORDER_RADIUS,
  createAvatarArrowPolygon, createAvatarBorderRing, createRotationIndicatorPolygons
} from '../Map/CustomShapes';
import { transformFeatures, getDistanceBetweenPoints } from '../utils/geometry';
import theme from '../../../../Styles';
import { PALETTE } from '../utils/utils';

// Default styles
const ARROW_COLOR = theme.palette.text.robotAvatar;
const ARROW_RADIUS_RATIO = 0.6;

/**
 * Creates a feature with the shape of an arrow representing a generic robot avatar
 */
const createArrowFeature = (params = {}) => {
  const {
    color = ARROW_COLOR, strokeColor = ARROW_COLOR, width = 3, zIndex, radius, selected
  } = params;
  const feature = new Feature(createAvatarArrowPolygon(radius));
  feature.setStyle(new Style({
    fill: new Fill({ color }),
    stroke: new Stroke({
      color: selected ? strokeColor : theme.palette.text.title,
      width,
      lineJoin: 'miter',
      lineCap: 'square'
    }),
    zIndex: zIndex + 2
  }));
  return feature;
};

/**
 * Creates features to draw some arc arrows around an object that can be rotated.
 *
 * @returns An array with 2 features.
 */
const createRotateIndicatorFeatures = (params = {}) => {
  const {
    strokeColor = ARROW_COLOR, width = 2, zIndex, radius, selected
  } = params;
  const [arcs, heads] = createRotationIndicatorPolygons(radius);
  const arcFeature = new Feature(arcs);
  arcFeature.setStyle(new Style({
    stroke: new Stroke({
      color: selected ? strokeColor : theme.palette.text.title,
      width,
      lineDash: [1, 4]
    }),
    zIndex: zIndex + 2
  }));
  const arrowHeadFeature = new Feature(heads);
  arrowHeadFeature.setStyle(new Style({
    stroke: new Stroke({
      color: selected ? strokeColor : theme.palette.text.title,
      width
    }),
    zIndex: zIndex + 2
  }));
  return [arcFeature, arrowHeadFeature];
};

/**
 * Compute and return a circumscribed circle around the given Polygon.
 */
const createCircumscribedCircle = (polygon) => {
  // Create a multipoint geometry from the coordinates of the polygon
  const coordinates = polygon.getCoordinates()[0];
  const multiPoint = new MultiPoint(coordinates);

  // Calculate the extent and center of the polygon
  const extent = multiPoint.getExtent();
  const center = [(extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2];

  // Calculate the diagonals
  const bottomLeft = getBottomLeft(extent);
  const topRight = getTopRight(extent);
  const distanceToBottomLeft = getDistanceBetweenPoints(bottomLeft, center);
  const distanceToTopRight = getDistanceBetweenPoints(topRight, center);

  // Create the circle based on the longest diagonal
  const radius = Math.max(distanceToBottomLeft, distanceToTopRight);
  return new Circle(center, radius);
};

/**
 * Create RobotPose features
 */
const createFeatures = ({
  primaryColor, // color for selection
  secondaryColor, // color for fill
  outlineColor, // color for the outline (visible when not selected)
  arrowColor, // override for arrow fill; falls back to selected ? primaryColor : outlineColor
  zIndex,
  showPoseOutline = true,
  posePreferences = {},
  robotId,
  selected,
  oriented = true
}) => {
  const { footprint, radius } = posePreferences;

  // Non-oriented footprints get a circumscribed circle
  let borderGeometry;
  if (oriented) {
    borderGeometry = footprint ? new Polygon([footprint]) : createAvatarBorderRing(radius);
  } else {
    borderGeometry = footprint
      ? createCircumscribedCircle(new Polygon([footprint]))
      : createAvatarBorderRing(radius);
  }

  // Add style to the inner circle (background) feature, takes the color
  // from the secondaryColor prop
  const innerBorderFeature = new Feature(borderGeometry.clone());
  innerBorderFeature.setStyle(new Style({
    fill: new Fill({ color: secondaryColor }),
    stroke: new Stroke({
      color: selected ? primaryColor : outlineColor,
      width: 1
    }),
    zIndex
  }));

  // If oriented, add style to arrow feature, takes the color from the prop primaryColor
  const arrowFillColor = arrowColor || (selected ? primaryColor : outlineColor);
  const arrowRadius = (radius || AVATAR_BORDER_RADIUS) * ARROW_RADIUS_RATIO;
  const features = oriented
    ? [createArrowFeature({
      color: arrowFillColor, strokeColor: arrowFillColor, radius: arrowRadius, selected
    }), innerBorderFeature] : [innerBorderFeature];

  // Add style to the outer circle (ring) feature, takes the color from the prop primaryColor
  if (showPoseOutline) {
    const outerCircleFeature = new Feature(borderGeometry.clone());
    outerCircleFeature.setStyle(new Style({
      fill: new Fill({ color: 'transparent' }),
      stroke: new Stroke({
        color: selected ? primaryColor : outlineColor,
        width: 3
      }),
      zIndex: zIndex + 1
    }));
    features.push(outerCircleFeature);
  }

  if (robotId) {
    // add a property to each clickable feature to track down which robot was clicked
    features.forEach(f => f.setProperties({ robotId }));
  }

  // turn this into a collection
  return features;
};

const RobotPoseLayer = ({
  robotPose = {},
  primaryColor, // border color
  secondaryColor, // fill color
  opacity = 1, // default opacity (unless selected, when it's always 1)
  zIndex = 0,
  showPoseOutline = true,
  posePreferences = {},
  robotId,
  selected
}) => {
  // Check if we have an orientation
  const localPose = { ...robotPose };
  const oriented = Number.isFinite(localPose.theta);
  if (!oriented) {
    // If we are not oriented, set theta to 0 for transforms to work properly but leave the original
    localPose.theta = 0;
  }

  // Create the vector source only the first time, when we mount
  const {
    featuresAtOrigin, vectorSource
  } = useMemo(() => {
    const features = createFeatures({
      primaryColor: selected ? PALETTE.robotPoseSelectedPrimary : primaryColor,
      outlineColor: selected ? PALETTE.robotPoseSelectedPrimary : primaryColor,
      secondaryColor: selected ? PALETTE.robotPoseSelectedSecondary : secondaryColor,
      arrowColor: selected ? PALETTE.robotPoseSelectedArrow : undefined,
      zIndex,
      showPoseOutline,
      posePreferences,
      robotId,
      selected,
      oriented
    });
    const source = new VectorSource();
    return {
      featuresAtOrigin: features, vectorSource: source
    };
  }, [
    showPoseOutline,
    posePreferences.radius,
    posePreferences.footprint,
    posePreferences.primaryColor,
    posePreferences.secondaryColor,
    selected
  ]);

  // Update the features on the source each time the robotPose changes
  useEffect(() => {
    const clones = featuresAtOrigin.map(f => f.clone());
    const featuresAtMap = transformFeatures(clones, localPose);
    vectorSource.clear();
    vectorSource.addFeatures(featuresAtMap);
    return () => {
      vectorSource && vectorSource.clear();
    };
  }, [robotPose, featuresAtOrigin]);

  // The vector layer doesn't need to be memoized because it's doing proper handling
  // of deps in its implementation.
  return (
    <ReactVectorLayer
      name="position"
      source={vectorSource}
      zIndex={zIndex}
      opacity={selected ? 1 : opacity}
    />
  );
};

RobotPoseLayer.propTypes = {
  // Controlling layers to be shown for this robot
  showPoseOutline: PropTypes.bool,
  // UI preferences that apply to pose layer: footprint
  posePreferences: PropTypes.object,
  // Data Props
  robotPose: PropTypes.object, // {x,y,theta} of the robot
  robotId: PropTypes.string,
  primaryColor: PropTypes.string, // robot nav icon primary color
  secondaryColor: PropTypes.string, // robot nav icon secondary color
  opacity: PropTypes.number, // Sets the opacity of this layer
  zIndex: PropTypes.number, // This layer uses values from zIndex to zIndex+3
  selected: PropTypes.bool
};

export default RobotPoseLayer;
export { createFeatures, createArrowFeature, createRotateIndicatorFeatures };
