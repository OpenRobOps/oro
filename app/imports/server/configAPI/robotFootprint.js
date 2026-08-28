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
 * `RobotFootprint` kind: the outline the Navigation widget draws for a robot.
 *
 * Writes `ui_preferences.map.pose` (InOrbit's shape) at system scope (fleet default) or robot
 * scope (override). Polygons travel as `{x, y}` points in the spec and are stored as `[x, y]`
 * pairs, which is what `RobotPoseLayer` consumes. `spec: null` suppresses (nulls for footprint,
 * bufferFootprint, radius), so a robot can hide a fleet-wide footprint. Resolution against the
 * ISO-reported footprint happens in `shared/footprint.js`.
 */
import Validator from 'fastest-validator';

import OroRoles from '../roles';
import { UIPreferences } from '../../lib/collections';
import { Schemas } from '../../lib/uiPreferences';
import {
  SchemaError, ValidationError, AuthorizationError, LIST_FORMAT_SHORT, KIND_ROBOT_FOOTPRINT,
} from '../../shared/configAPI';
import { RESOURCE_SINGLETONS, ACCESS_LEVEL_CONFIGURE, isSystemUser } from '../../shared/roles';
import { ID_DEFAULT, ID_TYPE_SYSTEM_WIDE, ID_TYPE_ROBOT } from '../../shared/constants';
import {
  POSE_FIELDS, SUPPRESSED_POSE, pairsFromPoints, pointsFromPairs,
} from '../../shared/footprint';

const assertAuthorized = async (user) => {
  if (!user) throw new AuthorizationError('Unauthorized');
  if (!isSystemUser(user) && !await new OroRoles().canAccessSystemElement(
    user._id, RESOURCE_SINGLETONS.FLEET, ACCESS_LEVEL_CONFIGURE,
  )) {
    throw new AuthorizationError('Unauthorized');
  }
};

const point = { type: 'object', strict: true, props: { x: { type: 'number' }, y: { type: 'number' } } };
const color = { type: 'string', pattern: /^#[0-9a-fA-F]{6}$/, optional: true };
const specValidator = new Validator().compile({
  $$strict: true,
  footprint: { type: 'array', min: 3, items: point, optional: true },
  bufferFootprint: { type: 'array', min: 3, items: point, optional: true },
  radius: { type: 'number', min: 0, optional: true },
  primaryColor: color,
  secondaryColor: color,
  opacity: { type: 'number', min: 0, max: 1, optional: true },
});

const entityFor = (id) => (
  id === ID_TYPE_SYSTEM_WIDE
    ? { entityType: ID_TYPE_SYSTEM_WIDE, entityId: ID_DEFAULT }
    : { entityType: ID_TYPE_ROBOT, entityId: id }
);
const idFor = (doc) => (doc.entityType === ID_TYPE_SYSTEM_WIDE ? ID_TYPE_SYSTEM_WIDE : doc.entityId);
const idOf = (configObject) => {
  const id = String(configObject?.metadata?.id || '');
  if (!id) throw new ValidationError('metadata.id is required');
  return id;
};

const isSuppressed = (pose) => Object.keys(SUPPRESSED_POSE).every((k) => pose[k] === null);

/** Stored `map.pose` → spec (`[x,y]` → `{x,y}`), or null when suppressed. */
const toSpec = (pose) => {
  if (isSuppressed(pose)) return null;
  const spec = {};
  POSE_FIELDS.forEach((f) => {
    if (pose[f] === undefined || pose[f] === null) return;
    spec[f] = (f === 'footprint' || f === 'bufferFootprint') ? pointsFromPairs(pose[f]) : pose[f];
  });
  return spec;
};

export class RobotFootprintConfigAPIHandler {
  constructor(configApi) { this._configApi = configApi; }

  isGlobalConfig = () => false;

  list = async ({ id = null, user, format = LIST_FORMAT_SHORT } = {}) => {
    await assertAuthorized(user);
    const query = { 'map.pose': { $exists: true }, ...(id ? entityFor(id) : {}) };
    const docs = await UIPreferences.find(query).fetchAsync();
    if (format === LIST_FORMAT_SHORT) {
      return docs.map((doc) => ({ id: idFor(doc), label: idFor(doc) }));
    }
    return docs.map((doc) => ({
      apiVersion: 'v0.1',
      kind: KIND_ROBOT_FOOTPRINT,
      metadata: { id: idFor(doc) },
      spec: toSpec(doc.map.pose),
    }));
  };

  apply = async ({ configObject, user }) => {
    await assertAuthorized(user);
    const id = idOf(configObject);
    const { spec } = configObject;
    let pose;
    if (spec === null) {
      pose = { ...SUPPRESSED_POSE };
    } else {
      const validation = specValidator(spec || {});
      if (validation !== true) {
        throw new SchemaError(`RobotFootprint spec is invalid: ${validation.map((v) => v.message).join('; ')}`);
      }
      pose = { ...(spec || {}) };
      if (pose.footprint) pose.footprint = pairsFromPoints(pose.footprint);
      if (pose.bufferFootprint) pose.bufferFootprint = pairsFromPoints(pose.bufferFootprint);
      // Same validator the UI preferences write path uses (arrays of [x, y] pairs, ≥ 3).
      Schemas.PosePreferenece.validate(pose);
    }
    await UIPreferences.upsertAsync(entityFor(id), { $set: { 'map.pose': pose } });
  };

  clear = async ({ configObject, user }) => {
    await assertAuthorized(user);
    await UIPreferences.updateAsync(entityFor(idOf(configObject)), { $unset: { 'map.pose': '' } });
  };
}

export default RobotFootprintConfigAPIHandler;
