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
 * Robot footprint helpers shared by server and client.
 *
 * A footprint is the robot's outline in its own frame (metres, +x forward), drawn by
 * `RobotPoseLayer` from a `map.pose`-shaped object. Configured footprints live in
 * `ui_preferences` (`map.pose`, InOrbit's shape, polygons as [x, y] pairs); ISO 21423 robots
 * report theirs in `robots.footprint` (`points`). `resolveFootprint` merges them.
 */

const POSE_FIELDS = ['footprint', 'bufferFootprint', 'radius', 'primaryColor', 'secondaryColor', 'opacity'];

/** Written by `RobotFootprint` `apply` with `spec: null` (InOrbit semantics). */
const SUPPRESSED_POSE = { footprint: null, bufferFootprint: null, radius: null };

const pairsFromPoints = (points) => points.map(({ x, y }) => [x, y]);
const pointsFromPairs = (pairs) => pairs.map(([x, y]) => ({ x, y }));

function isValidPolygon(pairs) {
  return Array.isArray(pairs) && pairs.length >= 3
    && pairs.every((p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite));
}

/**
 * Robot config → system config (field-wise; a `null` is a deliberate suppression and counts as
 * defined) → reported polygon (only when neither footprint nor radius is configured). Nulls are
 * dropped so the renderer sees only real values.
 */
function resolveFootprint({ robotCfg = null, systemCfg = null, reported = null } = {}) {
  const merged = {};
  POSE_FIELDS.forEach((f) => {
    if (robotCfg && robotCfg[f] !== undefined) merged[f] = robotCfg[f];
    else if (systemCfg && systemCfg[f] !== undefined) merged[f] = systemCfg[f];
  });
  if (merged.footprint === undefined && merged.radius === undefined
      && reported && isValidPolygon(reported.points)) {
    merged.footprint = reported.points;
  }
  return Object.fromEntries(Object.entries(merged).filter(([, v]) => v !== null && v !== undefined));
}

export {
  POSE_FIELDS, SUPPRESSED_POSE,
  pairsFromPoints, pointsFromPairs, isValidPolygon, resolveFootprint,
};
