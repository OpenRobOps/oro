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
 * Map annotation and frame-transform helpers shared by server and client.
 *
 * Maps live in `spatial_annotations` in two shapes: the legacy `map: {…}` written by ingest for
 * robot grids, and the InOrbit v2 `{ type:'map', frameId, annotation:{…} }` written by the
 * SpatialAnnotation ConfigAPI kind. Everything downstream consumes the normalized form only.
 *
 * Transforms live in `spatial_transformations` as `transformations[from] = { frameId: to, aTb:{m} }`
 * where `m` maps a pose in `from` into `to` (see `transformPose` in ./geometry.js).
 */

import { transformPose } from './geometry';

const DEFAULT_FRAME_ID = 'map';
const IDENTITY_3X3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

/** Normalizes either annotation shape; returns null for non-map docs. */
function normalizeMapAnnotation(doc) {
  if (!doc) return null;
  const isLegacy = !!doc.map && !doc.annotation;
  if (!isLegacy && doc.type !== 'map') return null;
  const a = isLegacy ? doc.map : (doc.annotation || {});
  return {
    entity: {
      entityType: doc.entityType,
      entityId: doc.entityId,
      frameId: (isLegacy ? a.frameId : doc.frameId) || DEFAULT_FRAME_ID,
    },
    annotation: {
      annotationId: doc.label,
      label: a.label || doc.label,
      x: a.x,
      y: a.y,
      resolution: a.resolution,
      width: a.width,
      height: a.height,
      formatVersion: a.formatVersion || 1,
      dataHash: a.dataHash,
      data: a.data,
      objectUrl: a.objectUrl,
    },
  };
}

/** Inverse of an affine 3x3 `[[a,b,tx],[c,d,ty],[0,0,1]]`. */
function invert3x3(m) {
  const [[a, b, tx], [c, d, ty]] = m;
  const det = a * d - b * c;
  const ia = d / det; const ib = -b / det;
  const ic = -c / det; const id = a / det;
  return [
    [ia, ib, -(ia * tx + ib * ty)],
    [ic, id, -(ic * tx + id * ty)],
    [0, 0, 1],
  ];
}

const lookup = (doc, from, to) => {
  const t = doc && doc.transformations;
  if (!t) return null;
  if (t[from] && t[from].frameId === to && t[from].aTb && t[from].aTb.m) {
    return { frameId: to, aTb: { m: t[from].aTb.m } };
  }
  if (t[to] && t[to].frameId === from && t[to].aTb && t[to].aTb.m) {
    return { frameId: to, aTb: { m: invert3x3(t[to].aTb.m) } };
  }
  return null;
};

/** Robot doc beats system doc; identity when frames match; null when nothing links them. */
function findFrameTransform({ robotDoc = null, systemDoc = null, from, to }) {
  if (from === to) return { frameId: to, aTb: { m: IDENTITY_3X3 } };
  return lookup(robotDoc, from, to) || lookup(systemDoc, from, to);
}

/** Least-squares rigid (rotation + translation, no scale) fit; 2D Kabsch. */
function fitRigidTransform2D(pairs) {
  if (!Array.isArray(pairs) || pairs.length < 3) {
    throw new Error('fitRigidTransform2D requires at least 3 point pairs');
  }
  const n = pairs.length;
  const mean = (sel) => pairs.reduce((acc, p) => ({ x: acc.x + sel(p).x / n, y: acc.y + sel(p).y / n }), { x: 0, y: 0 });
  const cf = mean((p) => p.from); const ct = mean((p) => p.to);
  let sxx = 0; let sxy = 0; let syx = 0; let syy = 0;
  pairs.forEach(({ from, to }) => {
    const fx = from.x - cf.x; const fy = from.y - cf.y;
    const tx = to.x - ct.x; const ty = to.y - ct.y;
    sxx += fx * tx; sxy += fx * ty; syx += fy * tx; syy += fy * ty;
  });
  // Optimal rotation angle for the 2D case: atan2(Σ(fx·ty − fy·tx), Σ(fx·tx + fy·ty))
  const theta = Math.atan2(sxy - syx, sxx + syy);
  const c = Math.cos(theta); const s = Math.sin(theta);
  return [
    [c, -s, ct.x - (c * cf.x - s * cf.y)],
    [s, c, ct.y - (s * cf.x + c * cf.y)],
    [0, 0, 1],
  ];
}

/** Returns an error message, or null when `m` is a valid rigid 3x3 transform. */
function validateTransformMatrix(m) {
  if (!Array.isArray(m) || m.length !== 3 || m.some((r) => !Array.isArray(r) || r.length !== 3)) {
    return 'matrix must be 3x3';
  }
  if (m.some((r) => r.some((v) => !Number.isFinite(v)))) return 'matrix entries must be finite numbers';
  if (m[2][0] !== 0 || m[2][1] !== 0 || m[2][2] !== 1) return 'matrix last row must be [0, 0, 1]';
  const [[a, b], [c, d]] = m;
  const eps = 1e-6;
  if (Math.abs(a * a + c * c - 1) > eps || Math.abs(b * b + d * d - 1) > eps || Math.abs(a * b + c * d) > eps) {
    return 'matrix rotation block must be orthonormal (no scale or shear)';
  }
  if (a * d - b * c < 0) return 'matrix must not be a reflection';
  return null;
}

const isIdentity = (m) => m === IDENTITY_3X3
  || m.every((row, i) => row.every((v, j) => v === IDENTITY_3X3[i][j]));

/** Re-expresses a robot's localization data in the map's frame. Lasers are robot-relative: untouched. */
function transformLocalizationData(data, transform) {
  if (!data || !transform || !transform.aTb || isIdentity(transform.aTb.m)) return data;
  const out = { ...data };
  if (data.robotPose) out.robotPose = transformPose(data.robotPose, transform);
  if (data.paths && typeof data.paths === 'object') {
    out.paths = Object.fromEntries(Object.entries(data.paths).map(([id, p]) => [id, {
      ...p, points: Array.isArray(p.points) ? p.points.map((pt) => transformPose(pt, transform)) : p.points,
    }]));
  }
  if (data.costmap) out.costmap = transformPose(data.costmap, transform);
  return out;
}

/** Inverse of a frame transform, or null when it can't be inverted. */
function inverseTransform(transform) {
  if (!transform || !transform.aTb) return null;
  return { frameId: transform.fromFrameId || null, aTb: { m: invert3x3(transform.aTb.m) } };
}

/** Applies only the rotation block to a delta (relative motion has no origin). */
function transformDelta(delta, transform) {
  if (!delta || !transform || !transform.aTb) return delta;
  const [[a, b], [c, d]] = transform.aTb.m;
  return { ...delta, x: a * delta.x + b * delta.y, y: c * delta.x + d * delta.y };
}

/** Mongo query for every map a robot can display: its own maps plus system-scope maps. */
function mapsListQuery(robotId) {
  return {
    $and: [
      { $or: [{ entityType: 'robot', entityId: robotId }, { entityType: 'system', entityId: '0' }] },
      { $or: [{ type: 'map' }, { type: { $exists: false }, map: { $exists: true } }] },
    ],
  };
}

export {
  DEFAULT_FRAME_ID,
  IDENTITY_3X3,
  normalizeMapAnnotation,
  invert3x3,
  findFrameTransform,
  fitRigidTransform2D,
  validateTransformMatrix,
  mapsListQuery,
  transformLocalizationData,
  inverseTransform,
  transformDelta,
};
