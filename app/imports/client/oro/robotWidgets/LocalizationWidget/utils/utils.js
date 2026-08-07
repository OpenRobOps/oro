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

import Feature from 'ol/Feature';
import { isArray } from 'lodash';
import Polygon from 'ol/geom/Polygon';
import { asArray as colorAsArray, asString as colorAsString, fromString as colorFromString } from 'ol/color';
import Projection from 'ol/proj/Projection';
import ImageStatic from 'ol/source/ImageStatic';
import { addCoordinateTransforms } from 'ol/proj';
// ORO Modules
import theme from '../../../../Styles';

/**
 * OpenLayers Utils library
 * Contains utility functions used to create OL geometry and drawing
 */

// TODO: Replace with use of ui preferences and defaults
// get colors from ui preference
// until we can get the colors from UIPreferences, we take the palette
// from the theme to use this from anywhere

const PALETTE = theme.palette.map;
const CURRENT_DATA_MS = 1000 * 15; // 15sec, fresh and current data
const RECENT_DATA_MS = 1000 * 60; // 1min, relatively recent data
const STALE_DATA_MS = 1000 * 60 * 60; //  1hr, still drawn: path the robot just followed
const INVALID_DATA = -1; // Not a timer. Just anything different from all previous ms values

// create the features with the given geometry (Point, LineString, Polygon, circle)
const createFeature = (geometry, id, time) => new Feature({ geometry, id, time });

/**
 * Calculate the age based on its timestamp
 */
const calculateDataAge = (timestamp) => {
  const age = Date.now() - timestamp;
  if (age < CURRENT_DATA_MS) {
    return CURRENT_DATA_MS;
  } else if (age < RECENT_DATA_MS) {
    return RECENT_DATA_MS;
  } else if (age < STALE_DATA_MS) {
    return STALE_DATA_MS;
  } else {
    return INVALID_DATA;
  }
};

// This method converts from the 'geometry' parameter in the zone spec
// to the openlayers geometry.
// Currently supported:
// - polygon
const createZoneGeometry = (geometry = {}) => {
  let ret;
  if ('polygon' in geometry && isArray(geometry.polygon)) {
    const points = geometry.polygon.map(p => [p.x, p.y]);
    ret = new Polygon([points]);
  }
  return ret;
};

// Function to calculate the bounding box of a polygon
const calculateBoundingBox = (geometry) => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  // Find minimum and maximum x and y coordinates
  for (const point of geometry.polygon) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  // Calculate center coordinates of the bounding box
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  // Return the bounding box information
  return {
    minX,
    minY,
    maxX,
    maxY,
    centerX,
    centerY
  };
};

/**
 * getPolygonVertices
 * This method gets the coordinates of Polygon Vertices.
 * @param {Object} feature - Feature from it gets the coordinates.
 * Must be a ol/Feature Object
 * @returns {Array} The list of coordinates [{x: Number, y: Number}, ...]
 */
const getPolygonVertices = (feature) => {
  if (feature instanceof Feature) {
    return feature.getGeometry().getCoordinates()[0].map(([x, y]) => ({ x, y }));
  } else {
    throw new Error('Param should be a Feature object');
  }
};

// Helper function to take an RGB color and create a more transparent version using "rgba()" syntax.
const makeTransparentColor = (color, opacity = 0.5) => {
  const array = colorAsArray(color).slice();
  array[3] = opacity;
  return colorAsString(array);
};

/**
 * Converts an input color to rgba format.
 * @param color   Input color in '#xxxxxx' or '#xxx' or 'rgba(x,x,x,x)' formats
 * @param alpha   Opacity value between 0 and 1
 */
const normalizeColor = (color, alpha) => {
  const array = colorFromString(color);
  if (alpha !== undefined) {
    array[3] = alpha;
  }
  return colorAsString(array);
};

/**
 * Calculates the map extent in the map's coordinate system based on its metadata.
 * Assumes x, y is the bottom-left corner in map coordinates.
 * @param {object} mapMetadata - Metadata object { x, y, resolution, width, height }
 * @returns {Array<number>} Extent array [minX, minY, maxX, maxY] in map coordinates.
 * @throws {Error} If metadata is invalid.
 */
const calculateMapExtent = (mapMetadata) => {
  if (!mapMetadata) {
    throw new Error('calculateMapExtent requires mapMetadata');
  }
  const { x, y, resolution, width, height } = mapMetadata;
  if (
    typeof x !== 'number'
    || typeof y !== 'number'
    || typeof resolution !== 'number' || resolution <= 0
    || typeof width !== 'number' || width <= 0
    || typeof height !== 'number' || height <= 0
  ) {
    console.error('Invalid map metadata for extent calculation:', mapMetadata);
    throw new Error('Invalid map metadata provided for extent calculation');
  }

  const minX = x;
  const minY = y;
  const maxX = x + (width * resolution);
  const maxY = y + (height * resolution);
  return [minX, minY, maxX, maxY];
};

/**
 * Creates a unique pixel-based OpenLayers Projection for a specific map image.
 * @param {object} mapMetadata - Metadata object { _id, width, height }
 * @returns {Projection} OL Projection instance for the image pixels.
 */
const createImagePixelProjection = (mapMetadata, codePrefix = 'image-pixels') => {
  if (!mapMetadata || !mapMetadata._id || typeof mapMetadata.width !== 'number' || typeof mapMetadata.height !== 'number') {
    throw new Error('createImagePixelProjection requires mapMetadata with _id, width, and height');
  }
  const projectionCode = `${codePrefix}-${mapMetadata._id}`;
  return new Projection({
    code: projectionCode,
    units: 'pixels',
    extent: [0, 0, mapMetadata.width, mapMetadata.height],
  });
};

/**
 * Registers coordinate transformations between a map view projection and an image pixel projection.
 * Supports formatVersion 1 (y-flipped) and formatVersion 2 (standard cartesian).
 *
 * @param {Projection} mapProjection - The projection of the OpenLayers view.
 * @param {Projection} imagePixelProjection - The pixel projection for the specific image.
 * @param {object} mapMetadata - Metadata object { x, y, resolution, width, height, formatVersion }
 */
const registerMapImageTransforms = (mapProjection, imagePixelProjection, mapMetadata) => {
  if (!mapProjection || !imagePixelProjection || !mapMetadata) {
    console.error('Missing arguments for registerMapImageTransforms');
    return;
  }
  const { x, y, resolution, width, height, formatVersion } = mapMetadata;
  if (
    typeof x !== 'number'
    || typeof y !== 'number'
    || typeof resolution !== 'number' || resolution <= 0
    || typeof width !== 'number' || width <= 0
    || typeof height !== 'number' || height <= 0
  ) {
    console.error('Invalid map metadata for coordinate transforms:', mapMetadata);
    return;
  }

  if (formatVersion === 1 || formatVersion === undefined) {
    // formatVersion 1: image y-axis is flipped with respect to the map y-axis.
    addCoordinateTransforms(
      mapProjection,
      imagePixelProjection,
      ([mX, mY]) => [
        (mX - x) / resolution,
        height - ((mY - y) / resolution)
      ],
      ([iX, iY]) => [
        iX * resolution + x,
        (height - iY) * resolution + y
      ]
    );
  } else {
    if (formatVersion !== 2) {
      console.error('Invalid formatVersion', formatVersion, '. Rendering as formatVersion 2.');
    }
    // formatVersion 2: standard cartesian, y increases upward like the map coordinate system.
    addCoordinateTransforms(
      mapProjection,
      imagePixelProjection,
      ([mX, mY]) => [
        (mX - x) / resolution,
        (mY - y) / resolution
      ],
      ([iX, iY]) => [
        iX * resolution + x,
        iY * resolution + y
      ]
    );
  }
};

/**
 * Creates an OpenLayers ImageStatic source configured for a map image.
 * @param {object} mapMetadata - Metadata object including { imageUrl, _id, x, y, resolution,
 * width, height }.
 * @returns {ImageStatic} Configured OL ImageStatic source instance.
 */
const createStaticImageSource = (mapMetadata) => {
  if (!mapMetadata || !mapMetadata.imageUrl || !mapMetadata._id || typeof mapMetadata.width !== 'number' || typeof mapMetadata.height !== 'number') {
    throw new Error('createStaticImageSource requires mapMetadata with _id, imageUrl, width, and height');
  }

  const imagePixelProjection = createImagePixelProjection(mapMetadata);
  const imageExtent = [0, 0, mapMetadata.width, mapMetadata.height];

  return new ImageStatic({
    url: mapMetadata.imageUrl,
    projection: imagePixelProjection,
    imageExtent,
    interpolate: true,
  });
};

export {
  calculateDataAge,
  createFeature,
  CURRENT_DATA_MS,
  RECENT_DATA_MS,
  STALE_DATA_MS,
  PALETTE,
  calculateBoundingBox,
  createZoneGeometry,
  getPolygonVertices,
  makeTransparentColor,
  normalizeColor,
  calculateMapExtent,
  createImagePixelProjection,
  registerMapImageTransforms,
  createStaticImageSource
};
