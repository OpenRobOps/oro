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
 * Path Layer
 * Displays a set of line segments relative to the map
 * Does NOT require robot pose subscription,
 * as the coordinates come relative to the map.
 */
import React, { useMemo, useEffect, useCallback } from 'react';
import { isArray } from 'lodash';
import PropTypes from 'prop-types';
import LineString from 'ol/geom/LineString';
import Point from 'ol/geom/Point';
import VectorSource from 'ol/source/Vector';
// Modules
import theme from '../../../../Styles';
import ReactVectorLayer from './ReactVectorLayer';
import { pathStyle, pointStyle } from '../Map/Styles';
import {
  createFeature, calculateDataAge,
  CURRENT_DATA_MS,
  RECENT_DATA_MS,
  STALE_DATA_MS
} from '../utils/utils';

// path palette by default if there is no UIPreferences
// it has the grey default color
// and the last one is for dashed path
const DEFAULT_PALLETE = {
  POINT_COLOR: theme.palette.teleop.completedPath,
  LINE_COLOR: theme.palette.teleop.completedPath,
  LINE_WIDTH: 0.02,
  POINT_WIDTH: 0.04
};

/**
  * getColorByAge
  * Returns the feature color based on the age
  * @param {Number} age numeric time interval from live path
  * @param {Array} defaultColor color set as default
  * @param {String} customColor color set for the selected path
  * @param {Boolean} shouldPersist flag for persisting the first color
  */
const getColorByAge = (age, defaultColor, customColor = [], shouldPersist = false) => {
  if (age === CURRENT_DATA_MS || shouldPersist) {
    return customColor[0] || defaultColor;
  } else if (age === RECENT_DATA_MS) {
    return customColor[1] || defaultColor;
  } else if (age === STALE_DATA_MS) {
    return customColor[2] || defaultColor;
  }
  return 'transparent';
};

/**
  * getFeatureWidth
  * Returns a numeric value with the feature thickness
  * @param {Number} customWidth width number from uiPreferences
  * @param {Number} defaultWidth numeric width set as default
  * @param {Number} scaleFactor conversion unit see description below
  * we are receiving a width of 0.02 from the database
  * to do the conversion we did this calc 0.5 / 0.02 = 25
  * then 0.02 * 25 = 0.5
  */
const getFeatureWidth = (customWidth, defaultWidth, scaleFactor = 1) => {
  const strokeMetric = 25;
  const width = customWidth || defaultWidth;
  return width * scaleFactor * strokeMetric;
};

/**
  * getLineStyle
  * Returns the OL style for the line feature
  * @param {Array} color color set for feature coloring
  * @param {Number} customWidth numeric width already converted
  * @param {Boolean} isDashed boolean used to set dash line pattern
  */
const getLineStyle = (color, customWidth, isDashed) => {
  const { LINE_WIDTH } = DEFAULT_PALLETE;
  const lineWidth = getFeatureWidth(customWidth,
    LINE_WIDTH,
    isDashed && 5);
  return pathStyle(color, lineWidth, isDashed);
};

/**
  * getPointStyle
  * Returns the OL style for the point feature
  * @param {Array} color color set for feature coloring
  * @param {Number} customWidth numeric width already converted
  */
const getPointStyle = (color, customWidth) => {
  const { POINT_WIDTH } = DEFAULT_PALLETE;
  const pointWidth = getFeatureWidth(customWidth,
    POINT_WIDTH, 2);
  return pointStyle(color, pointWidth);
};

/**
  * handleStyling
  * Returns an OL style depending on the feature's geom (line or point)
  * @param {Object} f OpenLayer feature to apply the style
  * @param {Object} pathPreferences preferences taken from uiPreferences for a
  * selected robot
  */
const handleStyling = (f, pathPreferences) => {
  const age = calculateDataAge(+f.getProperties().time);
  const { POINT_COLOR, LINE_COLOR } = DEFAULT_PALLETE;
  const {
    isDashed = true,
    shouldPersist = false,
    lineColor: sourceLineColor,
    pointColor: sourcePointColor,
    lineWidth,
    pointWidth
  } = pathPreferences;
  const pointColor = isArray(sourcePointColor) ? sourcePointColor : [];
  const lineColor = isArray(sourceLineColor) ? sourceLineColor : [];

  if (f.getGeometry().getType() === 'LineString') {
    const uiLineColor = getColorByAge(age, LINE_COLOR, lineColor, shouldPersist);
    return getLineStyle(uiLineColor, lineWidth, isDashed);
  }
  const uiPointColor = getColorByAge(age, POINT_COLOR, pointColor, shouldPersist);
  return getPointStyle(uiPointColor, pointWidth);
};

const PathLayer = ({ pathPreferences = {}, path = {}, zIndex = 0, name = 'path' }) => {
  // Create VectorSources only the first time, and reuse then. We are using two
  // vectorSources to avoid doing something like:
  //    vectorSource.addFeatures([...featurePoints, ...featureLines]);
  // which requires copying long arrays
  const { vectorSourcePoints, vectorSourceSegments } = useMemo(() => ({
    vectorSourcePoints: new VectorSource(),
    vectorSourceSegments: new VectorSource()
  }), []);

  // NOTE: This styler function definitely needs to be memoized. However,
  // there is also a big performance improvement to be done as we inside we are building
  // a `new Style()` for every point and segment even if they are all normally equal.
  const stylerFn = useCallback(f => handleStyling(f, pathPreferences), [pathPreferences]);

  // Redraw path segments when data changes
  useEffect(() => {
    if (!path.points || !path.points.length) {
      vectorSourceSegments.clear();
      return;
    }
    const segments = path.points.map((currentPose, i, all) => {
      const nextPose = i === all.length - 1 ? currentPose : all[i + 1];
      return {
        coords: [[currentPose.x, currentPose.y], [nextPose.x, nextPose.y]],
        index: i,
        time: path.ts
      };
    });
    const featureLines = segments.map(
      segment => createFeature(new LineString(segment.coords),
        segment.index,
        segment.time)
    );
    vectorSourceSegments.clear();
    vectorSourceSegments.addFeatures(featureLines);
  }, [path.points, path.ts]);

  // Redraw path points when data changes
  useEffect(() => {
    if (!path.points || !path.points.length) {
      vectorSourcePoints.clear();
      return;
    }
    const featurePoints = path.points.map(
      (point, i) => createFeature(new Point([point.x, point.y]), i, path.ts)
    );
    vectorSourcePoints.clear();
    vectorSourcePoints.addFeatures(featurePoints);
  }, [path.points, path.ts]);

  return (
    <>
      <ReactVectorLayer
        name={name + '.lines'}
        source={vectorSourceSegments}
        style={stylerFn}
        zIndex={zIndex}
      />
      <ReactVectorLayer
        name={name + '.points'}
        source={vectorSourcePoints}
        style={stylerFn}
        zIndex={zIndex}
      />
    </>
  );
};

PathLayer.propTypes = {
  pathPreferences: PropTypes.object,
  path: PropTypes.object,
  zIndex: PropTypes.number,
  name: PropTypes.string
};

export default PathLayer;
