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

import React, { useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import { Fill, Stroke, Style } from 'ol/style';
import Polygon from 'ol/geom/Polygon';
// Modules
import ReactVectorLayer from './ReactVectorLayer';
import { transformFeatures } from '../utils/geometry';
import { PALETTE, makeTransparentColor } from '../utils/utils';
import theme from '../../../../Styles';

// Colors for selected / unselected robots
const SELECTED_COLOR = PALETTE.robotPoseNormalPrimary; // blue
const UNSELECTED_COLOR = theme.palette.text.title; // gray

const createGeometry = ({ bufferFootprint }) => {
  // Only create geometry if bufferFootprint is explicitly defined
  if (bufferFootprint && bufferFootprint.length >= 3) {
    return new Polygon([bufferFootprint]);
  }
  // Don't fallback to radius
  return null;
};

const createFeature = ({ bufferFootprint, zIndex, selected }) => {
  const geometry = createGeometry({ bufferFootprint });
  // Don't create a feature if there's no valid geometry (no bufferFootprint defined)
  if (!geometry) {
    return null;
  }

  const baseColor = selected ? SELECTED_COLOR : UNSELECTED_COLOR;
  const fillColor = makeTransparentColor(baseColor, 0.2); // 20% opacity fill
  const strokeColor = makeTransparentColor(baseColor, 0.2);
  const feature = new Feature(geometry);
  feature.setStyle(new Style({
    fill: new Fill({ color: fillColor }),
    stroke: new Stroke({ color: strokeColor, width: 2 }),
    zIndex
  }));
  return feature;
};

const RobotBufferFootprintLayer = ({
  robotPose = {},
  posePreferences = {},
  zIndex = 0,
  selected = false
}) => {
  const { bufferFootprint } = posePreferences;

  const { featureAtOrigin, vectorSource } = useMemo(() => {
    const feature = createFeature({ bufferFootprint, zIndex, selected });
    const source = new VectorSource();
    return { featureAtOrigin: feature, vectorSource: source };
  }, [bufferFootprint, zIndex, selected]);

  useEffect(() => {
    // Only add feature if it exists (bufferFootprint is defined)
    if (featureAtOrigin) {
      const clone = featureAtOrigin.clone();
      transformFeatures([clone], robotPose);
      vectorSource.clear();
      vectorSource.addFeature(clone);
    } else {
      // Clear source if no bufferFootprint is defined
      vectorSource.clear();
    }
    return () => vectorSource.clear();
  }, [robotPose, featureAtOrigin, vectorSource]);

  return (
    <ReactVectorLayer
      name="bufferFootprint"
      source={vectorSource}
      zIndex={zIndex}
      opacity={1}
    />
  );
};

RobotBufferFootprintLayer.propTypes = {
  posePreferences: PropTypes.object,
  robotPose: PropTypes.object,
  zIndex: PropTypes.number,
  selected: PropTypes.bool
};

export default RobotBufferFootprintLayer;
