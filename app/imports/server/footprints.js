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
 * Server-side footprint resolution: configured (`ui_preferences.map.pose`, system + robot scope)
 * merged with the ISO-reported polygon (`robots.footprint`). See shared/footprint.js.
 */
import { UIPreferences, Robots } from '../lib/collections';
import { resolveFootprint } from '../shared/footprint';
import { ID_DEFAULT, ID_TYPE_SYSTEM_WIDE, ID_TYPE_ROBOT } from '../shared/constants';

/** Resolved `map.pose` for each robot id, from one query per collection. */
export async function footprintDocsFor(robotIds) {
  const [prefs, robots] = await Promise.all([
    UIPreferences.find({
      'map.pose': { $exists: true },
      $or: [
        { entityType: ID_TYPE_SYSTEM_WIDE, entityId: ID_DEFAULT },
        { entityType: ID_TYPE_ROBOT, entityId: { $in: robotIds } },
      ],
    }, { fields: { entityType: 1, entityId: 1, 'map.pose': 1 } }).fetchAsync(),
    Robots.find({ _id: { $in: robotIds } }, { fields: { footprint: 1 } }).fetchAsync(),
  ]);
  const systemCfg = prefs.find((p) => p.entityType === ID_TYPE_SYSTEM_WIDE)?.map.pose || null;
  const robotCfgs = Object.fromEntries(prefs.filter((p) => p.entityType === ID_TYPE_ROBOT).map((p) => [p.entityId, p.map.pose]));
  const reported = Object.fromEntries(robots.map((r) => [r._id, r.footprint || null]));
  return Object.fromEntries(robotIds.map((id) => [id, resolveFootprint({
    robotCfg: robotCfgs[id] || null, systemCfg, reported: reported[id] || null,
  })]));
}

export async function resolvedFootprintFor(robotId) {
  return (await footprintDocsFor([robotId]))[robotId];
}
