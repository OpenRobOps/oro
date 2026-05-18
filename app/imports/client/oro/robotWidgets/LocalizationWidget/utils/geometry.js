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
 * Geometry library
 * Contains various functions that allow abstracting geometrical operations
 * from the rendering layers of components.
 */

/**
 * Applies a translation and then rotation to a given geometry by a given pose
 */
function transform(geometry, pose = {}) {
  const { x = 0, y = 0, theta = 0 } = pose;
  geometry.rotate(theta, [0, 0]);
  geometry.translate(x, y);
}

/**
 * Applies a translation and then rotation to a given list of OpenLayers features
 */
function transformFeatures(features = [], pose = {}) {
  features.forEach((f) => {
    transform(f.getGeometry(), pose);
  });
  return features;
}

/**
 * Rotates anti-clockwise a point [ x, y ] by a given angle around the origin
 */
function rotatePoint2D(point = [], angle = 0) {
  const [x = 0, y = 0] = point;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [
    x * cos - y * sin,
    x * sin + y * cos
  ];
}

/**
 * Returns the distance between p1 and p0.
 *
 * p1 and p0 are expected as objects in the form [x, y]
 */
function getDistanceBetweenPoints(p1, p0 = [0, 0]) {
  const [x1, y1] = p1;
  const [x0, y0] = p0;
  return Math.sqrt(((x1 - x0) ** 2) + ((y1 - y0) ** 2));
}

/**
 * Combines a list of transforms into a single rotation and translation
 * Transforms must be ordered from map to children.
 */
function combineTransforms(transformChain) {
  let x = 0; let y = 0; let
    theta = 0;

  for (let i = 0; i < transformChain.length; i++) {
    // we will incorporate the next transform to the final calculation
    const t = transformChain[i];

    // Add the translation of the current transform rotated by the
    // accumulated-so-far rotation
    const [dx, dy] = rotatePoint2D([t.x, t.y], theta);
    x += dx;
    y += dy;

    // Add the rotation
    theta += t.theta;
  }

  return { x, y, theta };
}

export {
  transform,
  transformFeatures,
  rotatePoint2D,
  combineTransforms,
  getDistanceBetweenPoints
};
