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
 * Server-side resolution of the `map.*` UI preferences the localization widget reads:
 * footprint pose (configured `ui_preferences.map.pose`, system + robot scope, merged with the
 * ISO-reported polygon; see shared/footprint.js) and robot path styling (`map.robotPath`; see
 * shared/robotPath.js).
 */
import { UIPreferences, Robots } from '../lib/collections';
import { resolveFootprint } from '../shared/footprint';
import { resolveRobotPath } from '../shared/robotPath';
import { ID_DEFAULT, ID_TYPE_SYSTEM_WIDE, ID_TYPE_ROBOT } from '../shared/constants';

/** Resolved `{ pose, robotPath }` (the `map.*` preferences the widget reads) per robot id. */
export async function uiPreferencesDocsFor(robotIds) {
  const [prefs, robots] = await Promise.all([
    UIPreferences.find({
      $or: [{ entityType: ID_TYPE_SYSTEM_WIDE, entityId: ID_DEFAULT }, { entityType: ID_TYPE_ROBOT, entityId: { $in: robotIds } }],
    }, { fields: { entityType: 1, entityId: 1, 'map.pose': 1, 'map.robotPath': 1 } }).fetchAsync(),
    Robots.find({ _id: { $in: robotIds } }, { fields: { footprint: 1 } }).fetchAsync(),
  ]);
  const system = prefs.find((p) => p.entityType === ID_TYPE_SYSTEM_WIDE)?.map || {};
  const byRobot = Object.fromEntries(prefs.filter((p) => p.entityType === ID_TYPE_ROBOT).map((p) => [p.entityId, p.map || {}]));
  const reported = Object.fromEntries(robots.map((r) => [r._id, r.footprint || null]));
  return Object.fromEntries(robotIds.map((id) => {
    const robot = byRobot[id] || {};
    return [id, {
      pose: resolveFootprint({ robotCfg: robot.pose || null, systemCfg: system.pose || null, reported: reported[id] || null }),
      robotPath: resolveRobotPath({ robotCfg: robot.robotPath || null, systemCfg: system.robotPath || null }),
    }];
  }));
}

export async function resolvedFootprintFor(robotId) {
  return (await uiPreferencesDocsFor([robotId]))[robotId].pose;
}
