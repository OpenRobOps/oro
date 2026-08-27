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
 * `SpatialAnnotation` kind: uploads map images.
 *
 * Maps applied through this kind are stored in `spatial_annotations` using InOrbit's v2 annotation
 * shape (`type:'map'`, top-level `frameId`, `annotation:{…}`), at system scope by default so every
 * robot lists them; `spec.scope: <robotId>` stores a robot-owned map instead. Robot grids that
 * ingest writes from MQTT use the legacy `map:{}` shape and are deliberately invisible to this kind.
 *
 * The image travels as base64 inside the spec (ConfigAPI is JSON-only). Practical cap is 12 MB
 * decoded, matching ingest's `MAP_SIZE_LIMIT_IN_BYTES`.
 * TODO: a REST multipart upload path for browser uploads / larger PNGs (see rest_api.js).
 */
import crypto from 'crypto';
import Validator from 'fastest-validator';

import OroRoles from '../roles';
import { SpatialAnnotations } from '../../lib/collections';
import {
  SchemaError, ValidationError, AuthorizationError, LIST_FORMAT_SHORT, KIND_SPATIAL_ANNOTATION,
} from '../../shared/configAPI';
import { RESOURCE_SINGLETONS, ACCESS_LEVEL_CONFIGURE, isSystemUser } from '../../shared/roles';
import { ID_DEFAULT, ID_TYPE_SYSTEM_WIDE, ID_TYPE_ROBOT } from '../../shared/constants';

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const assertAuthorized = async (user) => {
  if (!user) throw new AuthorizationError('Unauthorized');
  if (!isSystemUser(user) && !await new OroRoles().canAccessSystemElement(
    user._id, RESOURCE_SINGLETONS.FLEET, ACCESS_LEVEL_CONFIGURE,
  )) {
    throw new AuthorizationError('Unauthorized');
  }
};

const specValidator = new Validator().compile({
  $$strict: true,
  scope: { type: 'string', optional: true, empty: false },
  type: { type: 'equal', value: 'map', optional: true },
  frameId: { type: 'string', empty: false },
  label: { type: 'string', empty: false },
  x: { type: 'number' },
  y: { type: 'number' },
  resolution: { type: 'number', positive: true },
  formatVersion: { type: 'enum', values: [1, 2], optional: true },
  image: { type: 'string', empty: false },
});

/** Reads width/height from the PNG IHDR chunk; throws on anything that is not a PNG. */
const pngInfo = (buf) => {
  if (buf.length < 24 || !buf.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new ValidationError('image must be a base64-encoded PNG');
  }
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
};

const entityFor = (scope) => (
  !scope || scope === ID_TYPE_SYSTEM_WIDE
    ? { entityType: ID_TYPE_SYSTEM_WIDE, entityId: ID_DEFAULT }
    : { entityType: ID_TYPE_ROBOT, entityId: scope }
);

const toSpec = (doc, withImage) => ({
  scope: doc.entityType === ID_TYPE_SYSTEM_WIDE ? ID_TYPE_SYSTEM_WIDE : doc.entityId,
  type: 'map',
  frameId: doc.frameId,
  label: doc.annotation.label,
  x: doc.annotation.x,
  y: doc.annotation.y,
  resolution: doc.annotation.resolution,
  formatVersion: doc.annotation.formatVersion,
  ...(withImage ? { image: doc.annotation.data } : {}),
});

export class SpatialAnnotationConfigAPIHandler {
  constructor(configApi) { this._configApi = configApi; }

  isGlobalConfig = () => false;

  list = async ({ id = null, user, format = LIST_FORMAT_SHORT } = {}) => {
    await assertAuthorized(user);
    const query = { type: 'map', ...(id ? { label: id } : {}) };
    const projection = format === LIST_FORMAT_SHORT ? { 'annotation.data': 0 } : {};
    const docs = await SpatialAnnotations.find(query, { projection }).fetchAsync();
    return docs.map((doc) => ({
      apiVersion: 'v0.1',
      kind: KIND_SPATIAL_ANNOTATION,
      metadata: { id: doc.label },
      spec: toSpec(doc, format !== LIST_FORMAT_SHORT),
    }));
  };

  apply = async ({ configObject, user }) => {
    await assertAuthorized(user);
    const label = String(configObject?.metadata?.id || '');
    const spec = configObject.spec || {};
    const validation = specValidator(spec);
    if (validation !== true) {
      throw new SchemaError(`SpatialAnnotation spec is invalid: ${validation.map((v) => v.message).join('; ')}`);
    }
    const buf = Buffer.from(spec.image, 'base64');
    if (buf.length > MAX_IMAGE_BYTES) {
      throw new ValidationError(`image exceeds ${MAX_IMAGE_BYTES} bytes decoded`);
    }
    const { width, height } = pngInfo(buf);
    const entity = entityFor(spec.scope);
    if (await SpatialAnnotations.findOneAsync({ ...entity, label, type: { $exists: false } })) {
      throw new ValidationError(`SpatialAnnotation id "${label}" collides with the robot's ingested map; choose another id`);
    }
    const now = Date.now();
    await SpatialAnnotations.upsertAsync(
      { ...entity, label },
      {
        $set: {
          type: 'map',
          frameId: spec.frameId,
          annotation: {
            label: spec.label,
            x: spec.x,
            y: spec.y,
            resolution: spec.resolution,
            width,
            height,
            formatVersion: spec.formatVersion || 2,
            dataHash: crypto.createHash('md5').update(buf).digest('hex'),
            data: spec.image,
          },
          updatedTs: now,
        },
        $setOnInsert: { createdTs: now },
      },
    );
  };

  clear = async ({ configObject, user }) => {
    await assertAuthorized(user);
    const label = String(configObject?.metadata?.id || '');
    await SpatialAnnotations.removeAsync({ type: 'map', label });
  };
}

export default SpatialAnnotationConfigAPIHandler;
