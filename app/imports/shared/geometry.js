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
 * This module provides geometrical operations, mostly related with transforming poses.
 */

/**
 * Transforms a pose using a transformation expressed as a 3x3 matrix.
 * @param {object} poseA
 * @param {Array} aTb
 * @returns {object} transformed pose in the B frame
 */
export function transformPoseWith3x3Matrix(poseA, aTb) {
  const { x: aX, y: aY, theta: aTheta } = poseA;

  /* NOTE:
   *
   * pose can be expressed in matrix form as:
   *        | cos(theta) -sin(theta)   x |
   * pose = | sin(theta)  cos(theta)   y |
   *        |          0           0   1 |
   *
   * pose in B = aTb * pose. Here we calculate only the terms that
   * we need to get x, y and theta in the b frame.
   */
  const bX = aTb[0][0] * aX + aTb[0][1] * aY + aTb[0][2];
  const bY = aTb[1][0] * aX + aTb[1][1] * aY + aTb[1][2];

  const poseB = { x: bX, y: bY };
  if (Number.isFinite(aTheta)) {
    // If there is an orientation, transform it too
    const aThetaCos = Math.cos(aTheta);
    const aThetaSin = Math.sin(aTheta);
    const c = aTb[0][0] * aThetaCos + aTb[0][1] * aThetaSin;
    const s = aTb[1][0] * aThetaCos + aTb[1][1] * aThetaSin;
    poseB.theta = Math.atan2(s, c);
  }
  return poseB;
}

/**
 * Transforms a pose to another reference frame using the provided frameTransformations.
 * This is done by transforming the position, orientation and frameId as specified by the provided
 * transformation.
 *
 * @param {object} pose
 * @param {object} frameTransformation with frameId and aTb transformation matrix.
 * @returns {object}
 * @see SpatialTransformations in web/imports/lib/collections.js
 */
export function transformPose(poseA, frameTransformation) {
  if (!frameTransformation) {
    return poseA;
  }
  const { frameId: frameIdB, aTb } = frameTransformation;
  const aTbMatrix = aTb && Array.isArray(aTb.m) && aTb.m;
  const { x, y, theta } = aTbMatrix ? transformPoseWith3x3Matrix(poseA, aTbMatrix) : poseA;
  const poseB = {
    ...poseA,
    x,
    y,
    theta,
    frameId: frameIdB
  };
  return poseB;
}
