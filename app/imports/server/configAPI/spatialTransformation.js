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
 * `SpatialTransformation` kind: rigid transforms between coordinate frames.
 *
 * `metadata.id` is `system` (shared by all robots) or a robot id (overrides for that robot).
 * Each entry links two frames with either an explicit 3x3 `matrix` (from → to) or ≥3
 * `referencePoints` pairs that are fitted server-side. Stored in `spatial_transformations`
 * as `transformations[from] = { frameId: to, aTb: { m } }`, the shape `transformPose()` consumes.
 *
 * The ISO 21423 facility CCS is one such frame: ingest reads the system `map → <ccsId>` entry
 * (see ingest/src/server/iso21423/ccs.js).
 */
import Validator from 'fastest-validator';

import OroRoles from '../roles';
import { SpatialTransformations } from '../../lib/collections';
import {
  SchemaError, ValidationError, AuthorizationError, LIST_FORMAT_SHORT, KIND_SPATIAL_TRANSFORMATION,
} from '../../shared/configAPI';
import { RESOURCE_SINGLETONS, ACCESS_LEVEL_CONFIGURE, isSystemUser } from '../../shared/roles';
import { ID_DEFAULT, ID_TYPE_SYSTEM_WIDE, ID_TYPE_ROBOT } from '../../shared/constants';
import { fitRigidTransform2D, validateTransformMatrix } from '../../shared/maps';

const assertAuthorized = async (user) => {
  if (!user) throw new AuthorizationError('Unauthorized');
  if (!isSystemUser(user) && !await new OroRoles().canAccessSystemElement(
    user._id, RESOURCE_SINGLETONS.FLEET, ACCESS_LEVEL_CONFIGURE,
  )) {
    throw new AuthorizationError('Unauthorized');
  }
};

const point = { type: 'object', strict: true, props: { x: { type: 'number' }, y: { type: 'number' } } };
const specValidator = new Validator().compile({
  $$strict: true,
  transformations: {
    type: 'array',
    min: 1,
    items: {
      type: 'object',
      strict: true,
      props: {
        from: { type: 'string', empty: false },
        to: { type: 'string', empty: false },
        matrix: { type: 'array', optional: true, items: { type: 'array', items: 'number' } },
        referencePoints: {
          type: 'array', optional: true,
          items: { type: 'object', strict: true, props: { from: point, to: point } },
        },
      },
    },
  },
});

const entityFor = (id) => (
  id === ID_TYPE_SYSTEM_WIDE
    ? { entityType: ID_TYPE_SYSTEM_WIDE, entityId: ID_DEFAULT }
    : { entityType: ID_TYPE_ROBOT, entityId: id }
);
const idFor = (doc) => (doc.entityType === ID_TYPE_SYSTEM_WIDE ? ID_TYPE_SYSTEM_WIDE : doc.entityId);

/** Resolves one spec entry to a validated 3x3 matrix. */
const matrixFor = (entry) => {
  if (entry.from === entry.to) throw new ValidationError(`transformation from "${entry.from}" to itself`);
  const hasM = Array.isArray(entry.matrix);
  const hasP = Array.isArray(entry.referencePoints);
  if (hasM === hasP) {
    throw new ValidationError(`transformation ${entry.from} → ${entry.to}: provide exactly one of matrix or referencePoints`);
  }
  let m;
  if (hasM) {
    m = entry.matrix;
  } else {
    try {
      m = fitRigidTransform2D(entry.referencePoints);
    } catch (err) {
      throw new ValidationError(`transformation ${entry.from} → ${entry.to}: ${err.message}`);
    }
  }
  const error = validateTransformMatrix(m);
  if (error) throw new ValidationError(`transformation ${entry.from} → ${entry.to}: ${error}`);
  return m;
};

export class SpatialTransformationConfigAPIHandler {
  constructor(configApi) { this._configApi = configApi; }

  isGlobalConfig = () => false;

  list = async ({ id = null, user, format = LIST_FORMAT_SHORT } = {}) => {
    await assertAuthorized(user);
    const query = id ? entityFor(id) : {};
    const docs = await SpatialTransformations.find(query).fetchAsync();
    return docs.map((doc) => ({
      apiVersion: 'v0.1',
      kind: KIND_SPATIAL_TRANSFORMATION,
      metadata: { id: idFor(doc) },
      ...(format === LIST_FORMAT_SHORT ? {} : {
        spec: {
          transformations: Object.entries(doc.transformations || {}).map(([from, t]) => ({
            from, to: t.frameId, matrix: t.aTb.m,
          })),
        },
      }),
    }));
  };

  apply = async ({ configObject, user }) => {
    await assertAuthorized(user);
    const id = String(configObject?.metadata?.id || '');
    const spec = configObject.spec || {};
    const validation = specValidator(spec);
    if (validation !== true) {
      throw new SchemaError(`SpatialTransformation spec is invalid: ${validation.map((v) => v.message).join('; ')}`);
    }
    const transformations = {};
    spec.transformations.forEach((entry) => {
      if (transformations[entry.from]) {
        throw new ValidationError(`duplicate source frame "${entry.from}" (one transformation per source frame)`);
      }
      transformations[entry.from] = { frameId: entry.to, aTb: { m: matrixFor(entry) } };
    });
    await SpatialTransformations.upsertAsync(entityFor(id), { $set: { transformations } });
  };

  clear = async ({ configObject, user }) => {
    await assertAuthorized(user);
    await SpatialTransformations.removeAsync(entityFor(String(configObject?.metadata?.id || '')));
  };
}

export default SpatialTransformationConfigAPIHandler;
