# Shared ("pretty") Maps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let operators upload human-oriented maps shared by every robot, list them per robot next to the robot's own grids, switch between them in the Navigation widget, and place robots on them through frame transforms — including ISO robots that publish no map.

**Architecture:** Shared maps are `spatial_annotations` docs at system scope (`entityType:'system', entityId:'0'`) in InOrbit's v2 annotation shape; robot grids keep their legacy `map:{}` shape and are normalized on read. Frame transforms live in the existing (unused) `spatial_transformations` collection as 3x3 matrices, robot scope overriding system scope, and the ISO CCS becomes the system-scope `map → <ccsId>` entry. Both are uploaded through two ConfigAPI kinds; the client applies transforms to poses before drawing and the inverse to map clicks.

**Tech Stack:** Meteor (app), Node/mocha (ingest), `fastest-validator`, OpenLayers, React/MUI, Python 3 stdlib (tooling).

**Spec:** `docs/superpowers/specs/2026-08-27-shared-maps-design.md`

## Global Constraints

- Shared maps: `entityType: 'system'`, `entityId: '0'` (constants `ID_TYPE_SYSTEM_WIDE`, `ID_DEFAULT` from `app/imports/shared/constants.js`).
- Map geometry: `x, y` = world metres of the image's bottom-left corner; `resolution` metres/pixel; `formatVersion` 1 = image vertically flipped, 2 = as uploaded (default 2 for uploads).
- Decoded PNG cap: 12 MB (`12 * 1024 * 1024` bytes), same as ingest's `MAP_SIZE_LIMIT_IN_BYTES`.
- Transform storage: `transformations[<from>] = { frameId: <to>, aTb: { m: 3x3 } }`; `m` maps a pose in `from` to `to`, exactly as `transformPose()` in `app/imports/shared/geometry.js` expects. Inverses are derived, never stored.
- Frame lookup order: robot doc → system doc → identity if `from === to` → `null`.
- Authorization for both kinds: same guard as `app/imports/server/configAPI/isoRobots.js` (`RESOURCE_SINGLETONS.FLEET`, `ACCESS_LEVEL_CONFIGURE`, system user bypass).
- The ISO SDK (`@openrobops/iso21423`) cannot be imported from `app/` (packaging issue documented in `isoRobots.js`); geometry needed in `app/` is implemented in `app/imports/shared/maps.js`.
- Copyright header on every new source file, as in every existing file (Apache 2.0, "Copyright 2026 InOrbit, Inc.").
- App tests: `cd app && npm test` (runs the whole meteor mocha suite, several minutes; new test files must be imported from `app/tests/main.js`). Ingest tests: `cd ingest && npm test`.
- Commit after every task; messages in the repo's conventional style (`feat:`, `test:`, `docs:`).

---

### Task 1: Shared map/frame helpers (`app/imports/shared/maps.js`)

**Files:**
- Create: `app/imports/shared/maps.js`
- Test: `app/imports/server/test/maps.test.js`
- Modify: `app/tests/main.js` (add import)

**Interfaces:**
- Produces:
  - `normalizeMapAnnotation(doc) → { entity: {entityType, entityId, frameId}, annotation: {annotationId, label, x, y, resolution, width, height, formatVersion, dataHash, data} } | null`
  - `invert3x3(m) → m⁻¹` (for affine `[[a,b,tx],[c,d,ty],[0,0,1]]`)
  - `findFrameTransform({ robotDoc, systemDoc, from, to }) → { frameId: to, aTb: {m} } | null` (identity when `from === to`)
  - `fitRigidTransform2D(pairs: [{from:{x,y}, to:{x,y}}]) → m` (≥3 pairs, throws otherwise)
  - `validateTransformMatrix(m) → string | null` (null = valid)
  - `IDENTITY_3X3`

- [ ] **Step 1: Write the failing tests**

```js
// app/imports/server/test/maps.test.js
import { Meteor } from 'meteor/meteor';
import { expect } from 'chai';
import {
  normalizeMapAnnotation, invert3x3, findFrameTransform, fitRigidTransform2D,
  validateTransformMatrix, IDENTITY_3X3,
} from '../../shared/maps';
import { transformPose } from '../../shared/geometry';

if (!Meteor.isTest) throw new Error('This is TEST code only');

const near = (a, b, eps = 1e-9) => expect(Math.abs(a - b)).to.be.below(eps, `${a} !== ${b}`);
const rot = (t, tx, ty) => [
  [Math.cos(t), -Math.sin(t), tx],
  [Math.sin(t), Math.cos(t), ty],
  [0, 0, 1],
];

describe('shared/maps', () => {
  describe('normalizeMapAnnotation', () => {
    it('normalizes a legacy robot map doc', () => {
      const n = normalizeMapAnnotation({
        entityType: 'robot', entityId: 'r1', label: 'map',
        map: { frameId: 'map', x: -1, y: -2, resolution: 0.05, width: 10, height: 20, formatVersion: 1, dataHash: 'h', data: 'AAAA' },
      });
      expect(n.entity).to.deep.equal({ entityType: 'robot', entityId: 'r1', frameId: 'map' });
      expect(n.annotation).to.include({ annotationId: 'map', label: 'map', x: -1, y: -2, resolution: 0.05, width: 10, height: 20, formatVersion: 1, dataHash: 'h', data: 'AAAA' });
    });
    it('normalizes a v2 system map doc', () => {
      const n = normalizeMapAnnotation({
        entityType: 'system', entityId: '0', label: 'pretty', type: 'map', frameId: 'ccs-1',
        annotation: { label: 'Pretty', x: 0, y: 0, resolution: 0.0125, width: 1600, height: 1600, formatVersion: 2 },
      });
      expect(n.entity.frameId).to.equal('ccs-1');
      expect(n.annotation.annotationId).to.equal('pretty');
      expect(n.annotation.label).to.equal('Pretty');
    });
    it('defaults a missing frameId to "map" and returns null for non-map docs', () => {
      expect(normalizeMapAnnotation({ entityType: 'robot', entityId: 'r1', label: 'm', map: { x: 0 } }).entity.frameId).to.equal('map');
      expect(normalizeMapAnnotation({ entityType: 'robot', entityId: 'r1', label: 'w', type: 'waypoint', annotation: {} })).to.equal(null);
      expect(normalizeMapAnnotation(null)).to.equal(null);
    });
  });

  describe('invert3x3', () => {
    it('inverts an affine rotation+translation', () => {
      const m = rot(0.7, 3, -2);
      const p = transformPose({ x: 1, y: 2, theta: 0.1 }, { frameId: 'b', aTb: { m } });
      const back = transformPose(p, { frameId: 'a', aTb: { m: invert3x3(m) } });
      near(back.x, 1); near(back.y, 2); near(back.theta, 0.1);
    });
  });

  describe('findFrameTransform', () => {
    const systemDoc = { transformations: { map: { frameId: 'ccs', aTb: { m: rot(0, 10, 10) } } } };
    const robotDoc = { transformations: { map: { frameId: 'ccs', aTb: { m: rot(0, 1, 1) } } } };
    it('returns identity when frames are equal', () => {
      expect(findFrameTransform({ from: 'map', to: 'map' }).aTb.m).to.deep.equal(IDENTITY_3X3);
    });
    it('prefers the robot doc over the system doc', () => {
      expect(findFrameTransform({ robotDoc, systemDoc, from: 'map', to: 'ccs' }).aTb.m[0][2]).to.equal(1);
      expect(findFrameTransform({ systemDoc, from: 'map', to: 'ccs' }).aTb.m[0][2]).to.equal(10);
    });
    it('derives the inverse when only the reverse entry exists', () => {
      const t = findFrameTransform({ systemDoc, from: 'ccs', to: 'map' });
      expect(t.frameId).to.equal('map');
      near(t.aTb.m[0][2], -10);
    });
    it('returns null when no entry links the frames', () => {
      expect(findFrameTransform({ systemDoc, from: 'map', to: 'other' })).to.equal(null);
      expect(findFrameTransform({ from: 'a', to: 'b' })).to.equal(null);
    });
  });

  describe('fitRigidTransform2D', () => {
    it('recovers a +90° rotation plus translation from 3 pairs', () => {
      const m = rot(Math.PI / 2, 5, -3);
      const src = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 2, y: 2 }];
      const pairs = src.map((p) => ({ from: p, to: transformPose(p, { frameId: 'b', aTb: { m } }) }));
      const fit = fitRigidTransform2D(pairs);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) near(fit[i][j], m[i][j], 1e-6);
    });
    it('throws with fewer than 3 pairs', () => {
      expect(() => fitRigidTransform2D([{ from: { x: 0, y: 0 }, to: { x: 1, y: 1 } }])).to.throw(/at least 3/);
    });
  });

  describe('validateTransformMatrix', () => {
    it('accepts a rigid transform and rejects malformed ones', () => {
      expect(validateTransformMatrix(rot(1, 2, 3))).to.equal(null);
      expect(validateTransformMatrix([[1, 0], [0, 1]])).to.match(/3x3/);
      expect(validateTransformMatrix([[1, 0, 0], [0, 1, 0], [0, 0, 2]])).to.match(/last row/);
      expect(validateTransformMatrix([[2, 0, 0], [0, 2, 0], [0, 0, 1]])).to.match(/rotation/);
      expect(validateTransformMatrix([[1, 0, 0], [0, -1, 0], [0, 0, 1]])).to.match(/reflection/);
      expect(validateTransformMatrix([[NaN, 0, 0], [0, 1, 0], [0, 0, 1]])).to.match(/finite/);
    });
  });
});
```

Add to `app/tests/main.js` after the `isoRobots.test` import:
```js
import '../imports/server/test/maps.test.js'
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd app && npm test 2>&1 | grep -A3 "shared/maps"`
Expected: failures — `Cannot find module '../../shared/maps'`.

- [ ] **Step 3: Implement `app/imports/shared/maps.js`**

```js
/**
 * Copyright 2026 InOrbit, Inc.
 * (Apache 2.0 header — copy verbatim from app/imports/shared/geometry.js)
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

export {
  DEFAULT_FRAME_ID,
  IDENTITY_3X3,
  normalizeMapAnnotation,
  invert3x3,
  findFrameTransform,
  fitRigidTransform2D,
  validateTransformMatrix,
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd app && npm test 2>&1 | grep -B2 -A20 "shared/maps"`
Expected: all `shared/maps` tests passing, no other suite regressed.

- [ ] **Step 5: Commit**

```bash
git add app/imports/shared/maps.js app/imports/server/test/maps.test.js app/tests/main.js
git commit -m "feat(maps): shared map annotation and frame transform helpers"
```

---

### Task 2: `SpatialAnnotation` ConfigAPI kind

**Files:**
- Create: `app/imports/server/configAPI/spatialAnnotation.js`
- Modify: `app/imports/server/configAPI/configAPI.js` (import + register; add `KIND_SPATIAL_ANNOTATION` to the shared import list)
- Modify: `app/imports/shared/configAPI.js` (export `KIND_SPATIAL_ANNOTATION` if not already exported — check the export block at the bottom of the file)
- Test: `app/imports/server/test/configAPI/configAPISpatialAnnotation.test.js`
- Modify: `app/tests/main.js`

**Interfaces:**
- Consumes: `normalizeMapAnnotation` (Task 1).
- Produces: docs in `SpatialAnnotations` with shape `{ entityType, entityId, label, type:'map', frameId, annotation:{label,x,y,resolution,width,height,formatVersion,dataHash,data}, createdTs, updatedTs }`.
- `spec`: `{ scope?: 'system'|<robotId> (default 'system'), type?: 'map', frameId: string, label: string, x: number, y: number, resolution: number>0, formatVersion?: 1|2 (default 2), image: base64 string }`.

- [ ] **Step 1: Write the failing tests**

```js
// app/imports/server/test/configAPI/configAPISpatialAnnotation.test.js
import { Meteor } from 'meteor/meteor';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { resetDatabase } from '../setup';
import ConfigAPI from '../../configAPI/configAPI';
import OroRoles from '../../roles';
import {
  AuthorizationError, SchemaError, ValidationError, LIST_FORMAT_FULL, LIST_FORMAT_SHORT,
} from '../../../shared/configAPI';
import { ROLE_VIEWER, ROLE_MANAGER } from '../../../lib/roles';
import { createUser } from '../configAPI';
import { SpatialAnnotations } from '../../../lib/collections';

if (!Meteor.isTest) throw new Error('This is TEST code only');
const { expect } = chai;
chai.use(chaiAsPromised);

const KIND = 'SpatialAnnotation';
// 1x1 red PNG
const PNG_1X1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

const obj = (spec = {}, id = 'pretty') => ({
  kind: KIND, apiVersion: 'v0.1', metadata: { id },
  spec: { frameId: 'map', label: 'Pretty', x: 0, y: 0, resolution: 0.05, image: PNG_1X1, ...spec },
});

describe('configAPI:SpatialAnnotation', () => {
  let configApi; let manager;

  beforeEach(async () => {
    await resetDatabase();
    configApi = await new ConfigAPI().init({});
    await new OroRoles().createDefaultRoles();
    manager = await createUser({ id: 'mgr', role: ROLE_MANAGER });
  });

  it('apply: rejects viewers', async () => {
    const user = await createUser({ role: ROLE_VIEWER });
    await expect(configApi.apply({ configObject: obj(), user })).to.be.rejectedWith(AuthorizationError);
  });

  it('apply: stores a system-scope map with computed width/height/hash', async () => {
    await configApi.apply({ configObject: obj(), user: manager });
    const doc = await SpatialAnnotations.findOneAsync({ entityType: 'system', entityId: '0', label: 'pretty' });
    expect(doc.type).to.equal('map');
    expect(doc.frameId).to.equal('map');
    expect(doc.annotation).to.include({ label: 'Pretty', x: 0, y: 0, resolution: 0.05, width: 1, height: 1, formatVersion: 2, data: PNG_1X1 });
    expect(doc.annotation.dataHash).to.match(/^[0-9a-f]{32}$/);
  });

  it('apply: stores a robot-scope map when scope is a robot id', async () => {
    await configApi.apply({ configObject: obj({ scope: 'r1' }), user: manager });
    expect(await SpatialAnnotations.findOneAsync({ entityType: 'robot', entityId: 'r1', label: 'pretty' })).to.exist;
  });

  it('apply: is idempotent (re-apply updates, does not duplicate)', async () => {
    await configApi.apply({ configObject: obj(), user: manager });
    await configApi.apply({ configObject: obj({ x: 5 }), user: manager });
    const docs = await SpatialAnnotations.find({ label: 'pretty' }).fetchAsync();
    expect(docs).to.have.length(1);
    expect(docs[0].annotation.x).to.equal(5);
  });

  it('apply: rejects a non-PNG image, unknown keys and bad resolution', async () => {
    await expect(configApi.apply({ configObject: obj({ image: Buffer.from('nope').toString('base64') }), user: manager })).to.be.rejectedWith(ValidationError);
    await expect(configApi.apply({ configObject: obj({ bogus: 1 }), user: manager })).to.be.rejectedWith(SchemaError);
    await expect(configApi.apply({ configObject: obj({ resolution: 0 }), user: manager })).to.be.rejectedWith(SchemaError);
  });

  it('list: short strips the image, full round-trips it', async () => {
    await configApi.apply({ configObject: obj(), user: manager });
    const short = await configApi.list({ kind: KIND, user: manager, format: LIST_FORMAT_SHORT });
    expect(short).to.have.length(1);
    expect(short[0].metadata.id).to.equal('pretty');
    expect(JSON.stringify(short)).to.not.include(PNG_1X1);
    const full = await configApi.list({ kind: KIND, user: manager, format: LIST_FORMAT_FULL });
    expect(full[0].spec).to.include({ scope: 'system', frameId: 'map', label: 'Pretty', x: 0, y: 0, resolution: 0.05, formatVersion: 2, image: PNG_1X1 });
    // Re-applying the full output must be accepted verbatim
    await configApi.apply({ configObject: full[0], user: manager });
  });

  it('list: does not include legacy robot grids ingested from MQTT', async () => {
    await SpatialAnnotations.insertAsync({ entityType: 'robot', entityId: 'r1', label: 'map', map: { x: 0, y: 0, data: 'x' } });
    expect(await configApi.list({ kind: KIND, user: manager })).to.have.length(0);
  });

  it('clear: removes the map', async () => {
    await configApi.apply({ configObject: obj(), user: manager });
    await configApi.clear({ configObject: { kind: KIND, apiVersion: 'v0.1', metadata: { id: 'pretty' } }, user: manager });
    expect(await SpatialAnnotations.findOneAsync({ label: 'pretty' })).to.not.exist;
  });
});
```

Add to `app/tests/main.js`: `import '../imports/server/test/configAPI/configAPISpatialAnnotation.test.js'`

- [ ] **Step 2: Run to verify failure**

Run: `cd app && npm test 2>&1 | grep -A5 "configAPI:SpatialAnnotation"`
Expected: `Unsupported object kind SpatialAnnotation`.

- [ ] **Step 3: Implement the handler**

```js
// app/imports/server/configAPI/spatialAnnotation.js
/**
 * Copyright 2026 InOrbit, Inc.  (Apache 2.0 header — copy verbatim from isoRobots.js)
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
```

Register in `configAPI.js`: add `import SpatialAnnotationConfigAPIHandler from './spatialAnnotation';`, add `KIND_SPATIAL_ANNOTATION` to the `'../../shared/configAPI'` import list, and add `[KIND_SPATIAL_ANNOTATION]: new SpatialAnnotationConfigAPIHandler(this),` to `_kindsHandlers`. In `app/imports/shared/configAPI.js`, confirm `KIND_SPATIAL_ANNOTATION` is in the `export {…}` block; add it if missing.

Note on `clear`: it removes by label across scopes (a label is unique per entity, and the same id was chosen by the operator). If the same label exists at both scopes, both are cleared — acceptable; document in the kind docs (Task 11).

- [ ] **Step 4: Run to verify pass**

Run: `cd app && npm test 2>&1 | grep -B2 -A15 "configAPI:SpatialAnnotation"`
Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add app/imports/server/configAPI/spatialAnnotation.js app/imports/server/configAPI/configAPI.js app/imports/shared/configAPI.js app/imports/server/test/configAPI/configAPISpatialAnnotation.test.js app/tests/main.js
git commit -m "feat(configapi): SpatialAnnotation kind uploads shared and robot maps"
```

---

### Task 3: `SpatialTransformation` ConfigAPI kind

**Files:**
- Create: `app/imports/server/configAPI/spatialTransformation.js`
- Modify: `app/imports/server/configAPI/configAPI.js` (replace the commented import/registration with real ones)
- Test: `app/imports/server/test/configAPI/configAPISpatialTransformation.test.js`
- Modify: `app/tests/main.js`

**Interfaces:**
- Consumes: `fitRigidTransform2D`, `validateTransformMatrix` (Task 1).
- Produces: docs in `SpatialTransformations`: `{ entityType, entityId, transformations: { [from]: { frameId: to, aTb: { m } } } }`.
- `metadata.id`: `'system'` or `<robotId>`. `spec.transformations: [{ from, to, matrix? | referencePoints? }]`, exactly one of `matrix`/`referencePoints` per entry; `referencePoints` items `{ from:{x,y}, to:{x,y} }`, ≥3.

- [ ] **Step 1: Write the failing tests**

```js
// app/imports/server/test/configAPI/configAPISpatialTransformation.test.js
import { Meteor } from 'meteor/meteor';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { resetDatabase } from '../setup';
import ConfigAPI from '../../configAPI/configAPI';
import OroRoles from '../../roles';
import { AuthorizationError, SchemaError, ValidationError, LIST_FORMAT_FULL } from '../../../shared/configAPI';
import { ROLE_VIEWER, ROLE_MANAGER } from '../../../lib/roles';
import { createUser } from '../configAPI';
import { SpatialTransformations } from '../../../lib/collections';

if (!Meteor.isTest) throw new Error('This is TEST code only');
const { expect } = chai;
chai.use(chaiAsPromised);

const KIND = 'SpatialTransformation';
const near = (a, b, eps = 1e-6) => expect(Math.abs(a - b)).to.be.below(eps, `${a} !== ${b}`);
const TRANSLATE_10 = [[1, 0, 10], [0, 1, 10], [0, 0, 1]];
const obj = (transformations, id = 'system') => ({
  kind: KIND, apiVersion: 'v0.1', metadata: { id }, spec: { transformations },
});

describe('configAPI:SpatialTransformation', () => {
  let configApi; let manager;

  beforeEach(async () => {
    await resetDatabase();
    configApi = await new ConfigAPI().init({});
    await new OroRoles().createDefaultRoles();
    manager = await createUser({ id: 'mgr', role: ROLE_MANAGER });
  });

  it('apply: rejects viewers', async () => {
    const user = await createUser({ role: ROLE_VIEWER });
    await expect(configApi.apply({ configObject: obj([{ from: 'map', to: 'ccs', matrix: TRANSLATE_10 }]), user })).to.be.rejectedWith(AuthorizationError);
  });

  it('apply: stores a matrix at system scope', async () => {
    await configApi.apply({ configObject: obj([{ from: 'map', to: 'ccs', matrix: TRANSLATE_10 }]), user: manager });
    const doc = await SpatialTransformations.findOneAsync({ entityType: 'system', entityId: '0' });
    expect(doc.transformations.map.frameId).to.equal('ccs');
    expect(doc.transformations.map.aTb.m).to.deep.equal(TRANSLATE_10);
  });

  it('apply: fits reference points and stores at robot scope', async () => {
    const pts = [
      { from: { x: 0, y: 0 }, to: { x: 10, y: 10 } },
      { from: { x: 4, y: 0 }, to: { x: 14, y: 10 } },
      { from: { x: 0, y: 3 }, to: { x: 10, y: 13 } },
    ];
    await configApi.apply({ configObject: obj([{ from: 'map', to: 'ccs', referencePoints: pts }], 'r1'), user: manager });
    const doc = await SpatialTransformations.findOneAsync({ entityType: 'robot', entityId: 'r1' });
    near(doc.transformations.map.aTb.m[0][2], 10);
    near(doc.transformations.map.aTb.m[1][2], 10);
    near(doc.transformations.map.aTb.m[0][0], 1);
  });

  it('apply: rejects both/neither of matrix and referencePoints, bad matrices, <3 points', async () => {
    const bad = async (entry) => expect(configApi.apply({ configObject: obj([entry]), user: manager })).to.be.rejectedWith(ValidationError);
    await bad({ from: 'map', to: 'ccs' });
    await bad({ from: 'map', to: 'ccs', matrix: TRANSLATE_10, referencePoints: [] });
    await bad({ from: 'map', to: 'ccs', matrix: [[2, 0, 0], [0, 2, 0], [0, 0, 1]] });
    await bad({ from: 'map', to: 'ccs', referencePoints: [{ from: { x: 0, y: 0 }, to: { x: 1, y: 1 } }] });
    await bad({ from: 'map', to: 'map', matrix: TRANSLATE_10 });
    await expect(configApi.apply({ configObject: obj([{ from: 'map', to: 'ccs', matrix: TRANSLATE_10, extra: 1 }]), user: manager })).to.be.rejectedWith(SchemaError);
  });

  it('apply: replaces the whole transformations set for the entity', async () => {
    await configApi.apply({ configObject: obj([{ from: 'map', to: 'a', matrix: TRANSLATE_10 }]), user: manager });
    await configApi.apply({ configObject: obj([{ from: 'odom', to: 'b', matrix: TRANSLATE_10 }]), user: manager });
    const doc = await SpatialTransformations.findOneAsync({ entityType: 'system' });
    expect(Object.keys(doc.transformations)).to.deep.equal(['odom']);
  });

  it('list full: round-trips as matrices', async () => {
    await configApi.apply({ configObject: obj([{ from: 'map', to: 'ccs', matrix: TRANSLATE_10 }]), user: manager });
    const full = await configApi.list({ kind: KIND, user: manager, format: LIST_FORMAT_FULL });
    expect(full).to.have.length(1);
    expect(full[0].metadata.id).to.equal('system');
    expect(full[0].spec.transformations).to.deep.equal([{ from: 'map', to: 'ccs', matrix: TRANSLATE_10 }]);
    await configApi.apply({ configObject: full[0], user: manager });
  });

  it('clear: removes the entity doc', async () => {
    await configApi.apply({ configObject: obj([{ from: 'map', to: 'ccs', matrix: TRANSLATE_10 }], 'r1'), user: manager });
    await configApi.clear({ configObject: { kind: KIND, apiVersion: 'v0.1', metadata: { id: 'r1' } }, user: manager });
    expect(await SpatialTransformations.findOneAsync({ entityId: 'r1' })).to.not.exist;
  });
});
```

Add to `app/tests/main.js`: `import '../imports/server/test/configAPI/configAPISpatialTransformation.test.js'`

- [ ] **Step 2: Run to verify failure**

Run: `cd app && npm test 2>&1 | grep -A5 "configAPI:SpatialTransformation"`
Expected: `Unsupported object kind SpatialTransformation`.

- [ ] **Step 3: Implement the handler**

```js
// app/imports/server/configAPI/spatialTransformation.js
/**
 * Copyright 2026 InOrbit, Inc.  (Apache 2.0 header — copy verbatim from isoRobots.js)
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
```

In `configAPI.js`: replace `// import SpatialTransformationConfigAPIHandler from './spatialTransformation';` with the live import, add `KIND_SPATIAL_TRANSFORMATION` to the shared import, and register `[KIND_SPATIAL_TRANSFORMATION]: new SpatialTransformationConfigAPIHandler(this),`. Confirm `KIND_SPATIAL_TRANSFORMATION` is exported from `app/imports/shared/configAPI.js`.

- [ ] **Step 4: Run to verify pass**

Run: `cd app && npm test 2>&1 | grep -B2 -A15 "configAPI:SpatialTransformation"`
Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add app/imports/server/configAPI/spatialTransformation.js app/imports/server/configAPI/configAPI.js app/imports/shared/configAPI.js app/imports/server/test/configAPI/configAPISpatialTransformation.test.js app/tests/main.js
git commit -m "feat(configapi): SpatialTransformation kind stores frame transforms"
```

---

### Task 4: Publications for map lists, map data by entity, and transforms

**Files:**
- Modify: `app/imports/server/publications.js:64-81`
- Test: extend `app/imports/server/test/maps.test.js` (query helper only — publications are thin)

**Interfaces:**
- Produces:
  - `Meteor.publish('spatial_annotations.maps', { robotId })` → map docs for robot ∪ system, without image bytes.
  - `Meteor.publish('spatial_annotations.map', { robotId, entityType = 'robot', entityId, label })` → one full doc. `robotId` is what the viewer must have access to; `entityType/entityId` (defaulting to `robot`/`robotId`) is the doc to fetch.
  - `Meteor.publish('spatial_transformations', { robotId })` → robot + system docs.
  - Exported helper `mapsListQuery(robotId)` from `app/imports/shared/maps.js`.

- [ ] **Step 1: Add the query helper test**

Append to `app/imports/server/test/maps.test.js` inside `describe('shared/maps')`:
```js
  describe('mapsListQuery', () => {
    it('matches robot maps (legacy and v2) and system maps, not other annotation types', () => {
      const q = mapsListQuery('r1');
      expect(q).to.deep.equal({
        $and: [
          { $or: [{ entityType: 'robot', entityId: 'r1' }, { entityType: 'system', entityId: '0' }] },
          { $or: [{ type: 'map' }, { type: { $exists: false }, map: { $exists: true } }] },
        ],
      });
    });
  });
```
and add `mapsListQuery` to the import.

- [ ] **Step 2: Run to verify failure**

Run: `cd app && npm test 2>&1 | grep -A3 "mapsListQuery"` → `mapsListQuery is not a function`.

- [ ] **Step 3: Implement**

In `app/imports/shared/maps.js` add and export:
```js
/** Mongo query for every map a robot can display: its own maps plus system-scope maps. */
function mapsListQuery(robotId) {
  return {
    $and: [
      { $or: [{ entityType: 'robot', entityId: robotId }, { entityType: 'system', entityId: '0' }] },
      { $or: [{ type: 'map' }, { type: { $exists: false }, map: { $exists: true } }] },
    ],
  };
}
```

In `app/imports/server/publications.js`, import `SpatialTransformations` from `../lib/collections` (check the existing import line) and `mapsListQuery` from `../shared/maps`; replace the `spatial_annotations.map` publication with:

```js
/**
 * Publish the list of maps a robot can display (its own + system-wide), metadata only.
 */
Meteor.publish('spatial_annotations.maps', async function ({ robotId }) {
  if (!this.userId || !robotId) {
    return this.ready();
  }
  if (!await new OroRoles().canAccessRobot(this.userId, robotId, ACCESS_LEVEL_VIEW)) {
    return this.error(new Meteor.Error('Unauthorized'));
  }
  return SpatialAnnotations.find(mapsListQuery(robotId), {
    fields: { 'map.data': 0, 'annotation.data': 0 },
  });
});

/**
 * Publish one map annotation (metadata + image data). `robotId` is the robot the viewer is
 * looking at (access check); the doc itself is `entityType/entityId/label`, which defaults to
 * that robot's own map but may name a system-scope map.
 * Clients use `objectUrl` when available, otherwise `data` (base64 PNG) as fallback.
 */
Meteor.publish('spatial_annotations.map', async function ({
  robotId, entityType = 'robot', entityId, label = 'map',
}) {
  if (!this.userId || !robotId) {
    return this.ready();
  }
  if (!await new OroRoles().canAccessRobot(this.userId, robotId, ACCESS_LEVEL_VIEW)) {
    return this.error(new Meteor.Error('Unauthorized'));
  }
  const id = entityType === 'system' ? '0' : (entityId || robotId);
  if (entityType === 'robot' && id !== robotId) {
    return this.error(new Meteor.Error('Unauthorized'));
  }
  return SpatialAnnotations.find({ entityType, entityId: id, label });
});

/**
 * Publish frame transformations relevant to a robot: its own overrides and the system-wide set.
 */
Meteor.publish('spatial_transformations', async function ({ robotId }) {
  if (!this.userId || !robotId) {
    return this.ready();
  }
  if (!await new OroRoles().canAccessRobot(this.userId, robotId, ACCESS_LEVEL_VIEW)) {
    return this.error(new Meteor.Error('Unauthorized'));
  }
  return SpatialTransformations.find({
    $or: [{ entityType: 'robot', entityId: robotId }, { entityType: 'system', entityId: '0' }],
  });
});
```

- [ ] **Step 4: Run tests and lint**

Run: `cd app && npm test 2>&1 | grep -B2 -A6 "mapsListQuery"` → passing. Run `cd app && npx eslint imports/server/publications.js imports/shared/maps.js` → clean.

- [ ] **Step 5: Commit**

```bash
git add app/imports/server/publications.js app/imports/shared/maps.js app/imports/server/test/maps.test.js
git commit -m "feat(maps): publish per-robot map lists, entity-scoped map data and transforms"
```

---

### Task 5: Client data hooks — map by entity, map list, frame transform

**Files:**
- Modify: `app/imports/client/oro/robotWidgets/LocalizationWidget/MeteorLocalizationDataSources.js:73-115` (`useMeteorMapData`)
- Create: `app/imports/client/oro/hooks/useRobotMaps.js`
- Modify: `app/imports/client/oro/robotWidgets/LocalizationWidget/LocalizationAdapter.js:113-120`

**Interfaces:**
- `useMeteorMapData({ robotId, entityType = 'robot', entityId, label }, cb)` → `{ isLoading, mapUrl, entityType, entityId, label, frameId, width, height, x, y, resolution, formatVersion, dataHash }`.
- `useRobotMapsList(robotId)` → `{ isLoading, maps: [{ mapId, label, entityType, entityId, frameId }], defaultMap: { mapId, entityType, entityId } | null }`.
- `useFrameTransform({ robotId, from, to })` → `{ isLoading, transform: {frameId, aTb:{m}} | null }` (uses `findFrameTransform`).
- `LocalizationAdapter` accepts `mapLabel` as either a plain string (legacy: robot's own map label) or `"system:<mapId>"` / `"robot:<mapId>"`; exported `parseMapRef(mapLabel, robotId)` → `{ entityType, entityId, label }` lives in `useRobotMaps.js`.

- [ ] **Step 1: Write `useRobotMaps.js`**

```js
// app/imports/client/oro/hooks/useRobotMaps.js
/**
 * Copyright 2026 InOrbit, Inc.  (Apache 2.0 header — copy verbatim from isoRobots.js)
 */

/**
 * Hooks for the maps a robot can display and the frame transforms that place it on them.
 *
 * A map selection travels through dashboard context as a string ("map ref"):
 *   - `system:<mapId>` — a shared map
 *   - `robot:<mapId>`  — one of the robot's own maps
 *   - `<mapId>`        — legacy: the robot's own map with that label
 */
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
import {
  RobotLocalization, SpatialAnnotations, SpatialTransformations,
} from '../../../lib/collections';
import { mapsListQuery, normalizeMapAnnotation, findFrameTransform } from '../../../shared/maps';

const SYSTEM = { entityType: 'system', entityId: '0' };

/** Parses a map ref into the annotation's entity + label. */
export function parseMapRef(mapRef, robotId) {
  if (!mapRef) return null;
  const [prefix, ...rest] = String(mapRef).split(':');
  const label = rest.join(':');
  if (prefix === 'system' && label) return { ...SYSTEM, label };
  if (prefix === 'robot' && label) return { entityType: 'robot', entityId: robotId, label };
  return { entityType: 'robot', entityId: robotId, label: mapRef };
}

export const mapRefFor = ({ entityType, mapId }) => `${entityType}:${mapId}`;

/** Every map the robot can display, plus which one to show by default. */
export function useRobotMapsList(robotId) {
  return useTracker(() => {
    if (!robotId) return { isLoading: false, maps: [], defaultMap: null };
    const subs = [
      Meteor.subscribe('spatial_annotations.maps', { robotId }),
      Meteor.subscribe('localization', { robotIds: [robotId], lowBandwidth: true }),
    ];
    const maps = SpatialAnnotations.find(mapsListQuery(robotId)).fetch()
      .map(normalizeMapAnnotation)
      .filter(Boolean)
      .map((n) => ({
        mapId: n.annotation.annotationId,
        label: n.annotation.label,
        entityType: n.entity.entityType,
        entityId: n.entity.entityId,
        frameId: n.entity.frameId,
      }));
    const robotDefault = RobotLocalization.findOne({ _id: robotId })?.defaultMap;
    const own = maps.find((m) => m.entityType === 'robot' && m.mapId === robotDefault);
    const firstSystem = maps.find((m) => m.entityType === 'system');
    const def = own || firstSystem || null;
    return {
      isLoading: subs.some((s) => !s.ready()),
      maps,
      defaultMap: def && { mapId: def.mapId, entityType: def.entityType, entityId: def.entityId },
    };
  }, [robotId]);
}

/** Transform from frame `from` to frame `to` for a robot: robot override → system → identity → null. */
export function useFrameTransform({ robotId, from, to }) {
  return useTracker(() => {
    if (!robotId || !from || !to) return { isLoading: false, transform: null };
    const sub = Meteor.subscribe('spatial_transformations', { robotId });
    const robotDoc = SpatialTransformations.findOne({ entityType: 'robot', entityId: robotId });
    const systemDoc = SpatialTransformations.findOne(SYSTEM);
    return { isLoading: !sub.ready(), transform: findFrameTransform({ robotDoc, systemDoc, from, to }) };
  }, [robotId, from, to]);
}
```

Add `SpatialTransformations` to the export list of `app/imports/lib/collections.js` if it isn't exported already (check the `export {` block near line 830).

- [ ] **Step 2: Widen `useMeteorMapData`**

Replace the hook body in `MeteorLocalizationDataSources.js`:
```js
const useMeteorMapData = (
  { robotId, entityId, entityType = 'robot', label = 'map' },
  cb = null,
) => useTracker(() => {
  const accessRobotId = robotId || entityId;
  if (!accessRobotId || !label) {
    cb && cb({ isLoading: false });
    return { isLoading: false };
  }
  const query = entityType === 'system'
    ? { entityType: 'system', entityId: '0', label }
    : { entityType: 'robot', entityId: entityId || accessRobotId, label };

  const sub = Meteor.subscribe('spatial_annotations.map', { robotId: accessRobotId, ...query });
  const isLoading = !sub.ready();
  const normalized = normalizeMapAnnotation(SpatialAnnotations.findOne(query));
  const a = normalized?.annotation;

  let mapUrl = null;
  if (a?.objectUrl?.startsWith('http')) {
    mapUrl = a.objectUrl;
  } else if (a?.data) {
    mapUrl = `data:image/png;base64,${a.data}`;
  }

  const result = {
    isLoading,
    mapUrl,
    ...(a ? {
      entityType: normalized.entity.entityType,
      entityId: normalized.entity.entityId,
      label,
      frameId: normalized.entity.frameId,
      // OL projection code must be unique per image (MapImageLayer); `_id` feeds createImagePixelProjection
      _id: `${normalized.entity.entityType}-${normalized.entity.entityId}-${label}`,
      width: a.width,
      height: a.height,
      x: a.x,
      y: a.y,
      resolution: a.resolution,
      formatVersion: a.formatVersion,
      dataHash: a.dataHash,
    } : {}),
  };

  cb && cb(result);
  return result;
}, [robotId, entityId, entityType, label]);
```
Import `normalizeMapAnnotation` from `'../../../../shared/maps'`.

- [ ] **Step 3: Resolve the map ref in `LocalizationAdapter`**

Replace lines 113-120 (`const mapLabel = …; useDataSource(… MAP …)`) with:
```js
  // Which map to show: the ref from context (system:<id> | robot:<id> | <label>), else the
  // robot's own default map, else the first shared map (ISO robots publish no map at all).
  const { defaultMap } = useRobotMapsList(mainRobotId);
  const mapRef = contextMapLabel
    || (defaultMap && mapRefFor(defaultMap))
    || robotsLocalizationData?.[mainRobotId]?.defaultMap;
  const mapQuery = parseMapRef(mapRef, mainRobotId) || {};

  useDataSource(
    state,
    dispatch,
    LOCALIZATION_DATA_TYPE.MAP,
    { robotId: mainRobotId, entityType: mapQuery.entityType, entityId: mapQuery.entityId, label: mapQuery.label }
  );
```
Import `{ useRobotMapsList, parseMapRef, mapRefFor }` from `'../../hooks/useRobotMaps'`.

- [ ] **Step 4: Manual check in the running app**

Run flatland + ORO as in `website/docs/iso21423/flatland-simulator.md`. Open the Navigation widget: the robot's grid renders exactly as before (regression check). In a browser console with a logged-in session, `Meteor.subscribe('spatial_annotations.maps', {robotId: '<id>'})` then `SpatialAnnotations.find().fetch()` shows the robot map without `map.data`.

- [ ] **Step 5: Lint and commit**

Run: `cd app && npx eslint imports/client/oro/hooks/useRobotMaps.js imports/client/oro/robotWidgets/LocalizationWidget/MeteorLocalizationDataSources.js imports/client/oro/robotWidgets/LocalizationWidget/LocalizationAdapter.js`

```bash
git add app/imports/client/oro/hooks/useRobotMaps.js app/imports/client/oro/robotWidgets/LocalizationWidget/MeteorLocalizationDataSources.js app/imports/client/oro/robotWidgets/LocalizationWidget/LocalizationAdapter.js app/imports/lib/collections.js
git commit -m "feat(maps): client hooks for map lists, entity-scoped map data and frame transforms"
```

---

### Task 6: Map switcher in the Navigation control bar

**Files:**
- Create: `app/imports/client/oro/util/MapSelector.js`
- Modify: `app/imports/client/oro/navigationWidgets/NavigationControlBar/NavigationControlBarComponent.js` (render selector next to `ActionsDropdownComponent`, and in the mobile `Grid`; add `mapLabel`, `setMapLabel` to props/propTypes)
- Modify: `app/imports/client/oro/Dashboard/Dashboard_index.js:811-815` (pass `mapLabel`/`setMapLabel` to `NavigationControlBar`)

**Interfaces:**
- `MapSelector({ robotId, mapSelected, onChange })` — renders an MUI `Select` of `useRobotMapsList(robotId).maps` when `maps.length > 1`; value is a map ref (`mapRefFor`), `onChange(ref)`; when `mapSelected` is not in the list it shows the default.
- Consumes: `useRobotMapsList`, `mapRefFor`, `parseMapRef` (Task 5).

- [ ] **Step 1: Write `MapSelector.js`**

```js
// app/imports/client/oro/util/MapSelector.js
/**
 * Copyright 2026 InOrbit, Inc.  (Apache 2.0 header)
 */

/** Dropdown to switch the Navigation widget between the maps a robot can display. */
import React from 'react';
import PropTypes from 'prop-types';
import { MenuItem, Select } from '@mui/material';
import { useRobotMapsList, mapRefFor, parseMapRef } from '../hooks/useRobotMaps';

const MapSelector = ({ robotId, mapSelected, onChange, className }) => {
  const { maps, defaultMap } = useRobotMapsList(robotId);
  if (maps.length < 2) return null;

  const refs = maps.map((m) => mapRefFor(m));
  const selectedQ = parseMapRef(mapSelected, robotId);
  const selectedRef = selectedQ
    && refs.find((r) => r === `${selectedQ.entityType}:${selectedQ.label}`);
  const value = selectedRef || (defaultMap && mapRefFor(defaultMap)) || refs[0];

  return (
    <Select
      size="small"
      variant="standard"
      className={className}
      value={value}
      onChange={(e) => onChange && onChange(e.target.value)}
      data-test="navdet-controls-map-switcher"
      disabled={!onChange}
    >
      {maps.map((m) => (
        <MenuItem key={mapRefFor(m)} value={mapRefFor(m)}>
          {m.label}{m.entityType === 'system' ? ' (shared)' : ''}
        </MenuItem>
      ))}
    </Select>
  );
};

MapSelector.propTypes = {
  robotId: PropTypes.string,
  mapSelected: PropTypes.string,
  onChange: PropTypes.func,
  className: PropTypes.string,
};

export default MapSelector;
```

- [ ] **Step 2: Render it in the control bar**

In `NavigationControlBarComponent.js`: import `MapSelector from '../../util/MapSelector'`; destructure `mapLabel, setMapLabel` from `props` alongside `robotId`; in the desktop branch insert directly after `<ActionsDropdownComponent … />`:
```jsx
                <MapSelector
                  robotId={robotId}
                  mapSelected={mapLabel}
                  onChange={setMapLabel}
                  className={classNames(classes.baseButtonRoot, colorClassNames)}
                />
```
and in the mobile `<Grid>` before `<FullscreenButton`:
```jsx
              <MapSelector robotId={robotId} mapSelected={mapLabel} onChange={setMapLabel} />
```
Add to propTypes: `mapLabel: PropTypes.string, setMapLabel: PropTypes.func`.

In `Dashboard_index.js:811-815`:
```jsx
    <NavigationControlBar
      robotId={getRobotId(context, scope)}
      selectRobotCallback={setRobotId(setContext, scope)}
      setSelectedRobotId={setRobotId(setContext, scope)}
      mapLabel={getNavigationMap(context, scope)}
      setMapLabel={setNavigationMap(setContext, scope)}
    />
```
(`NavigationDetail/index.js:117-124` already forwards `mapLabel`/`setMapLabel` to the fullscreen control bar — no change.)

- [ ] **Step 3: Manual check**

With only the robot's own map present the selector is hidden. Apply a shared map (use the YAML from Task 10 Step 3, or any PNG through `png2map.py` → `POST /api/configuration/apply`) — the selector appears with "map" and "<label> (shared)"; switching re-renders the raster. Also verify the selector shows up for an ISO robot (which has no own map) only once ≥2 shared maps exist, and that a lone shared map renders for it without a selector.

- [ ] **Step 4: Lint and commit**

```bash
cd app && npx eslint imports/client/oro/util/MapSelector.js imports/client/oro/navigationWidgets/NavigationControlBar/NavigationControlBarComponent.js imports/client/oro/Dashboard/Dashboard_index.js
git add app/imports/client/oro/util/MapSelector.js app/imports/client/oro/navigationWidgets/NavigationControlBar/NavigationControlBarComponent.js app/imports/client/oro/Dashboard/Dashboard_index.js
git commit -m "feat(navigation): map switcher between robot and shared maps"
```

---

### Task 7: Render robots through the frame transform (+ unique image projection)

**Files:**
- Modify: `app/imports/client/oro/robotWidgets/LocalizationWidget/LocalizationAdapter.js` (transform localization data before passing to `Localization`)
- Modify: `app/imports/client/oro/robotWidgets/LocalizationWidget/Localization.js` (banner + hide robot layers when `map.noTransform`)
- Modify: `app/imports/client/oro/robotWidgets/LocalizationWidget/Map/MapImageLayer.js:49-54` (projection code)
- Modify: `app/imports/shared/maps.js` (add `transformLocalizationData`)
- Test: extend `app/imports/server/test/maps.test.js`

**Interfaces:**
- `transformLocalizationData(data, transform) → data'` — applies `transformPose` to `robotPose`, every point of every `paths[*].points` (check the actual paths shape in `app/imports/lib/collections.js:97-141` `paths` field and mirror it), and `costmap.{x,y,theta}`; returns `data` unchanged when `transform` is identity or null. `laserRanges` are robot-relative and untouched.
- `Localization` receives `map.frameTransform` (`{frameId, aTb}` | null) and `map.robotFrameId`; when the map has a `frameId` and `frameTransform === null` it renders the banner and no `RobotLayer`/`InteractionPicker`.

- [ ] **Step 1: Write the failing test**

Append to `maps.test.js`:
```js
  describe('transformLocalizationData', () => {
    const t = { frameId: 'ccs', aTb: { m: rot(Math.PI / 2, 0, 0) } };
    it('rotates pose, path points and costmap origin; leaves lasers alone', () => {
      const data = {
        robotPose: { x: 1, y: 0, theta: 0 },
        laserRanges: { ranges: [1, 2] },
        paths: [{ points: [{ x: 1, y: 0 }, { x: 2, y: 0 }] }],
        costmap: { x: 1, y: 0, theta: 0, width: 2 },
      };
      const out = transformLocalizationData(data, t);
      near(out.robotPose.x, 0); near(out.robotPose.y, 1); near(out.robotPose.theta, Math.PI / 2);
      expect(out.robotPose.frameId).to.equal('ccs');
      near(out.paths[0].points[1].y, 2);
      near(out.costmap.y, 1); expect(out.costmap.width).to.equal(2);
      expect(out.laserRanges).to.equal(data.laserRanges);
    });
    it('returns the same object for identity/null', () => {
      const data = { robotPose: { x: 1, y: 2 } };
      expect(transformLocalizationData(data, null)).to.equal(data);
      expect(transformLocalizationData(data, { frameId: 'map', aTb: { m: IDENTITY_3X3 } })).to.equal(data);
    });
  });
```
Import `transformLocalizationData`.

- [ ] **Step 2: Run to verify failure** — `cd app && npm test 2>&1 | grep -A3 transformLocalizationData`.

- [ ] **Step 3: Implement in `shared/maps.js`**

```js
import { transformPose } from './geometry';

const isIdentity = (m) => m === IDENTITY_3X3
  || m.every((row, i) => row.every((v, j) => v === IDENTITY_3X3[i][j]));

/** Re-expresses a robot's localization data in the map's frame. Lasers are robot-relative: untouched. */
function transformLocalizationData(data, transform) {
  if (!data || !transform || !transform.aTb || isIdentity(transform.aTb.m)) return data;
  const out = { ...data };
  if (data.robotPose) out.robotPose = transformPose(data.robotPose, transform);
  if (Array.isArray(data.paths)) {
    out.paths = data.paths.map((p) => ({
      ...p,
      points: Array.isArray(p.points) ? p.points.map((pt) => transformPose(pt, transform)) : p.points,
    }));
  }
  if (data.costmap) out.costmap = { ...data.costmap, ...transformPose(data.costmap, transform) };
  return out;
}
```
Export it. Before finalizing, open `app/imports/lib/collections.js` `paths` schema (~line 130) and `RobotLayers/PathLayer.js` to confirm the point array field name; if it is not `points`, use the real name in both code and test.

- [ ] **Step 4: Wire the adapter**

In `LocalizationAdapter.js`, after the `useDataSource(… MAP …)` call:
```js
  // Place robots on the selected map: robot frame → map frame.
  const robotFrameId = robotsLocalizationData?.[mainRobotId]?.map?.frameId || DEFAULT_FRAME_ID;
  const { transform: frameTransform } = useFrameTransform({
    robotId: mainRobotId, from: robotFrameId, to: map.frameId,
  });
  const mapWithFrame = useMemo(() => ({
    ...map, frameTransform, robotFrameId, noTransform: !!map.frameId && !frameTransform,
  }), [map, frameTransform, robotFrameId]);
```
and replace `pickKeys(robotsLocalizationData, robotIdsToDisplay)` with:
```js
  const filteredRobotLocalizationData = useMemo(() => Object.fromEntries(
    Object.entries(pickKeys(robotsLocalizationData, robotIdsToDisplay))
      .map(([rId, d]) => [rId, transformLocalizationData(d, frameTransform)])
  ), [robotsLocalizationData, robotIdsToDisplay, frameTransform]);
```
Pass `map={mapWithFrame}` to `<Localization>`. Imports: `useFrameTransform` from `'../../hooks/useRobotMaps'`, `transformLocalizationData, DEFAULT_FRAME_ID` from `'../../../../shared/maps'`.

Ponytail note: all robots on the widget use the *main* robot's frame/transform. `// ponytail: one transform for all displayed robots (main robot's); per-robot transforms when mixed-frame fleets appear.`

- [ ] **Step 5: Banner in `Localization.js`**

Add a style `noTransformBanner` next to `offlineMessage` in `useStyles` (position absolute, top 8px, centered, `theme.palette.warning.main` background, padding 4px 12px, border-radius 4). Inside `<Layers>`, wrap the `RobotLayer` map and `InteractionPicker` with `{!map.noTransform && (…)}` and add, right after `</Layers>` inside `MapComponent`:
```jsx
      {map.noTransform && (
        <div className={classes.noTransformBanner}>
          No transform from frame “{map.robotFrameId}” to “{map.frameId}” for this robot
        </div>
      )}
```
Add `frameId`, `robotFrameId`, `noTransform`, `frameTransform` to `Localization.propTypes.map` shape if the shape is enumerated.

- [ ] **Step 6: Unique projection code in `MapImageLayer.js`**

Replace the `new Projection({ code: 'image-map', … })` block with:
```js
    const imageProjection = new Projection({
      code: `image-map-${mapMetadata._id || 'default'}`,
      units: 'pixels',
      extent: imageExtent,
    });
```
(`_id` is set by `useMeteorMapData` in Task 5.) Add `_id: PropTypes.string` to the `mapMetadata` shape.

- [ ] **Step 7: Verify**

`cd app && npm test 2>&1 | grep -B2 -A8 transformLocalizationData` passing. Manual: apply a shared map with `frameId: map` — robot renders unchanged on it. Apply the same PNG with `frameId: ccs-test` and a `SpatialTransformation` `system` with `map → ccs-test` translation (10,10): the robot draws 10 m offset on that map. Clear the transformation: banner appears, robot hidden.

- [ ] **Step 8: Commit**

```bash
git add app/imports/shared/maps.js app/imports/server/test/maps.test.js app/imports/client/oro/robotWidgets/LocalizationWidget/LocalizationAdapter.js app/imports/client/oro/robotWidgets/LocalizationWidget/Localization.js app/imports/client/oro/robotWidgets/LocalizationWidget/Map/MapImageLayer.js
git commit -m "feat(navigation): draw robots on shared maps through frame transforms"
```

---

### Task 8: Send map clicks back in the robot frame

**Files:**
- Modify: `app/imports/client/oro/navigationWidgets/NavigationDetail/ActiveInteractionExecutors.js:40-76`
- Test: extend `app/imports/server/test/maps.test.js`

**Interfaces:**
- Add to `shared/maps.js`: `inverseTransform(transform) → transform⁻¹ | null` and `transformDelta({x,y,theta}, transform) → delta'` (rotates the translation by the transform's rotation block, keeps `theta`).
- `ActiveInteractionExecutors` computes the transform itself via `useFrameTransform` with `from = state.robotsLocalizationData[robotId]?.map?.frameId || 'map'` and `to = state.map.frameId` (both read from `useRobotsDataContext()`), mirroring Task 7's adapter.

- [ ] **Step 1: Failing test**

```js
  describe('inverse for map clicks', () => {
    const t = { frameId: 'ccs', aTb: { m: rot(Math.PI / 2, 10, 0) } };
    it('inverseTransform round-trips a pose', () => {
      const p = transformPose({ x: 1, y: 2, theta: 0.3 }, t);
      const back = transformPose(p, inverseTransform(t));
      near(back.x, 1); near(back.y, 2); near(back.theta, 0.3);
      expect(inverseTransform(null)).to.equal(null);
    });
    it('transformDelta rotates the translation only', () => {
      const d = transformDelta({ x: 1, y: 0, theta: 0.2 }, inverseTransform(t));
      near(d.x, 0); near(d.y, -1); near(d.theta, 0.2);
    });
  });
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement**

In `shared/maps.js`:
```js
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
```
Export both.

In `ActiveInteractionExecutors.js`:
```js
import { useRobotsDataContext } from '../../contexts/RobotsDataContext/RobotsDataContext';
import { useFrameTransform } from '../../hooks/useRobotMaps';
import { transformPose } from '../../../../shared/geometry';
import { inverseTransform, transformDelta, DEFAULT_FRAME_ID } from '../../../../shared/maps';
…
  const { state } = useRobotsDataContext();
  const robotFrameId = state.robotsLocalizationData?.[robotId]?.map?.frameId || DEFAULT_FRAME_ID;
  const { transform } = useFrameTransform({ robotId, from: robotFrameId, to: state.map?.frameId });
  const toRobotFrame = inverseTransform(transform);
```
Then in the NAVIGATE callback use `args: { pose: transformPose(pose, toRobotFrame) }` (with `frameId` stripped: `const { frameId, ...robotPose } = transformPose(pose, toRobotFrame);`), and in RELOCALIZE `deltaPose: transformDelta(pose, toRobotFrame)`. Add `transform` to the `useEffect` dependency array. Check the import path of `useRobotsDataContext` against `LocalizationAdapter.js`'s import.

- [ ] **Step 4: Verify**

Tests pass. Manual (Task 7's `ccs-test` setup): click-to-navigate on the offset map sends the robot to the clicked spot (goal lands under the pin), and relocalize drags behave the same as on the raw map.

- [ ] **Step 5: Commit**

```bash
git add app/imports/shared/maps.js app/imports/server/test/maps.test.js app/imports/client/oro/navigationWidgets/NavigationDetail/ActiveInteractionExecutors.js
git commit -m "feat(navigation): send waypoint and relocalize interactions in the robot frame"
```

---

### Task 9: Ingest — CCS transform from `spatial_transformations`

**Files:**
- Modify: `ingest/src/server/iso21423/ccs.js` (add `CcsConverter.load`)
- Modify: `ingest/src/server/isoRobots/index.js:153` (use `load`)
- Test: `ingest/test/iso-robots-ccs.test.js` (append)

**Interfaces:**
- `static async load(ccsConfig, geometry, transformsColl)` → `CcsConverter`. Reads `{entityType:'system', entityId:'0'}`; if `transformations.map.frameId === ccsConfig.id`, builds the converter from that matrix. Otherwise falls back to `create()`; when that is calibrated it upserts `transformations.map = { frameId: id, aTb: { m } }` into the system doc (only if the doc has no `map` entry — never clobber an operator's explicit config).
- Matrix ↔ `RigidTransform2D`: `m = [[cos r, -sin r, tx],[sin r, cos r, ty],[0,0,1]]` ⇔ `{ rotation: atan2(m[1][0], m[0][0]), tx: m[0][2], ty: m[1][2] }`.

- [ ] **Step 1: Failing tests** (append to `iso-robots-ccs.test.js`)

```js
const fakeColl = (doc) => {
  const store = { doc };
  return {
    store,
    findOne: async () => store.doc,
    updateOne: async (q, update) => {
      store.doc = { ...(store.doc || q), ...(update.$set || {}) };
      store.doc.transformations = { ...((store.doc && store.doc.transformations) || {}), ...(update.$set && update.$set.transformations) };
      return { acknowledged: true };
    },
  };
};

describe('iso21423 CcsConverter.load', () => {
  it('prefers the system spatial_transformations entry over settings', async () => {
    const coll = fakeColl({ entityType: 'system', entityId: '0',
      transformations: { map: { frameId: CCS_ID, aTb: { m: [[1, 0, 100], [0, 1, 100], [0, 0, 1]] } } } });
    const c = await CcsConverter.load({ id: CCS_ID, referencePoints: TRANSLATION }, geometry, coll);
    const p = c.toLocationPoint({ x: 0, y: 0 });
    near(p.x, 100); near(p.y, 100);
  });

  it('falls back to settings and writes the fitted matrix back', async () => {
    const coll = fakeColl(null);
    const c = await CcsConverter.load({ id: CCS_ID, referencePoints: TRANSLATION }, geometry, coll);
    assert.strictEqual(c.calibrated, true);
    const m = coll.store.doc.transformations.map.aTb.m;
    assert.strictEqual(coll.store.doc.transformations.map.frameId, CCS_ID);
    near(m[0][2], 10); near(m[1][2], 10); near(m[0][0], 1);
  });

  it('ignores a system entry that targets a different frame and stays uncalibrated without settings', async () => {
    const coll = fakeColl({ transformations: { map: { frameId: 'other', aTb: { m: [[1, 0, 1], [0, 1, 1], [0, 0, 1]] } } } });
    const c = await CcsConverter.load({ id: CCS_ID, referencePoints: [] }, geometry, coll);
    assert.strictEqual(c.calibrated, false);
    assert.strictEqual(coll.store.doc.transformations.map.frameId, 'other');
  });
});
```

- [ ] **Step 2: Run** `cd ingest && npm test 2>&1 | grep -A4 "CcsConverter.load"` → `CcsConverter.load is not a function`.

- [ ] **Step 3: Implement** (in `ccs.js`, after `create`)

```js
  /**
   * Like `create`, but the shared `spatial_transformations` system document is the source of
   * truth: a `map → <ccs.id>` entry there wins over `settings.iso21423.ccs.referencePoints`.
   * When only settings are available and they calibrate, the fitted matrix is written to that
   * document so the SpatialTransformation ConfigAPI kind, the Navigation widget and this
   * converter all read one transform. An existing `map` entry for another frame is left alone.
   *
   * @param {{id: string|null, referencePoints: Array}} ccsConfig
   * @param {Object} geometry
   * @param {import('mongodb').Collection} transformsColl the `spatial_transformations` collection
   * @returns {Promise<CcsConverter>}
   */
  static async load(ccsConfig, geometry, transformsColl) {
    const { id } = ccsConfig || {};
    const query = { entityType: 'system', entityId: '0' };
    const doc = await transformsColl.findOne(query);
    const entry = doc && doc.transformations && doc.transformations.map;
    if (id && entry && entry.frameId === id && entry.aTb && Array.isArray(entry.aTb.m)) {
      const m = entry.aTb.m;
      const t = { rotation: Math.atan2(m[1][0], m[0][0]), tx: m[0][2], ty: m[1][2] };
      return new CcsConverter(id, t, geometry, null);
    }
    const converter = CcsConverter.create(ccsConfig, geometry);
    if (converter.calibrated && !entry) {
      const { rotation, tx, ty } = converter._t;
      const c = Math.cos(rotation); const s = Math.sin(rotation);
      await transformsColl.updateOne(query, {
        $set: { transformations: { map: { frameId: id, aTb: { m: [[c, -s, tx], [s, c, ty], [0, 0, 1]] } } } },
      }, { upsert: true });
    }
    return converter;
  }
```
In `isoRobots/index.js:153`:
```js
      this._converter = await CcsConverter.load(
        config.ccs, this._sdk, this._mongo.getCollection(COLLECTIONS.SPATIAL_TRANSFORMATIONS));
```
Confirm the enclosing function is `async` (it awaits elsewhere; if not, make it so and check its caller). `COLLECTIONS.SPATIAL_TRANSFORMATIONS` already exists in `ingest/src/shared/constants.js:86`.

Check `updateOne` with `$set: { transformations: {...} }` vs. dot notation: since `!entry` guarantees no `map` key, use dot notation `'transformations.map'` to avoid wiping other frames — adjust both code and the fake collection in the test (`$set['transformations.map']`).

- [ ] **Step 4: Run** `cd ingest && npm test` → all green (including the existing CCS and integration tests).

- [ ] **Step 5: Commit**

```bash
git add ingest/src/server/iso21423/ccs.js ingest/src/server/isoRobots/index.js ingest/test/iso-robots-ccs.test.js
git commit -m "feat(iso21423): CCS transform read from and seeded into spatial_transformations"
```

---

### Task 10: `png2map.py`, flatland bootstrap map, REST TODO

**Files:**
- Create: `tools/png2map.py`
- Create: `app/private/bootstrap/SpatialAnnotation.yaml` (generated)
- Modify: `app/private/bootstrap/README.md` (mention the new file)
- Modify: `app/imports/server/rest_api.js:36` (TODO comment)

- [ ] **Step 1: Write the tool**

```python
#!/usr/bin/env python3
"""Turn a PNG into a SpatialAnnotation ConfigAPI YAML document.

    png2map.py map.png --id warehouse --frame map --resolution 0.05 --x 0 --y 0 [--label ...]
               [--scope system|<robotId>] [--format-version 1|2] [--from-ros-yaml map.yaml]

--from-ros-yaml lifts `resolution` and `origin[0..1]` from a ROS map_server yaml (values given
explicitly on the command line win). Output goes to stdout; pipe into a file or straight into
`curl -X POST .../api/configuration/apply`.
"""
import argparse, base64, json, re, sys

def ros_yaml(path):
    # Tiny parser for the flat ROS map yaml; avoids a PyYAML dependency.
    out = {}
    for line in open(path):
        m = re.match(r"^(\w+):\s*(.+?)\s*$", line)
        if m:
            k, v = m.groups()
            out[k] = json.loads(v) if v.startswith("[") else v
    return out

p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
p.add_argument("png")
p.add_argument("--id", required=True, help="map id (metadata.id / label)")
p.add_argument("--frame", default="map", help="frameId the image is drawn in")
p.add_argument("--label", help="display name (default: --id)")
p.add_argument("--scope", default="system", help="'system' or a robot id")
p.add_argument("--resolution", type=float, help="metres per pixel")
p.add_argument("--x", type=float, help="world x of the bottom-left corner")
p.add_argument("--y", type=float, help="world y of the bottom-left corner")
p.add_argument("--format-version", type=int, choices=[1, 2], default=2)
p.add_argument("--from-ros-yaml")
a = p.parse_args()

if a.from_ros_yaml:
    r = ros_yaml(a.from_ros_yaml)
    a.resolution = a.resolution if a.resolution is not None else float(r["resolution"])
    a.x = a.x if a.x is not None else float(r["origin"][0])
    a.y = a.y if a.y is not None else float(r["origin"][1])
for k in ("resolution", "x", "y"):
    if getattr(a, k) is None:
        sys.exit(f"--{k} is required (or --from-ros-yaml)")

data = open(a.png, "rb").read()
assert data[:8] == b"\x89PNG\r\n\x1a\n", "not a PNG"
b64 = base64.b64encode(data).decode()

print(f"""kind: SpatialAnnotation
apiVersion: v0.1
metadata:
  id: {a.id}
spec:
  scope: {a.scope}
  type: map
  frameId: {a.frame}
  label: {json.dumps(a.label or a.id)}
  x: {a.x}
  y: {a.y}
  resolution: {a.resolution}
  formatVersion: {a.format_version}
  image: {b64}""")
```
`chmod +x tools/png2map.py`.

- [ ] **Step 2: Self-check the tool**

```bash
python3 tools/png2map.py /home/herchu/inorbit/flatland/maps/pretty/sample_map_pretty_400x400.png --id t --from-ros-yaml /home/herchu/inorbit/flatland/maps/sample_map.yaml | head -12
```
Expected: `resolution: 0.05`, `x: 0.0`, `y: 0.0`, an `image:` line. Then decode round-trip: `… | grep image: | cut -d' ' -f4 | base64 -d | cmp - …/sample_map_pretty_400x400.png` → no output.

- [ ] **Step 3: Generate the flatland bootstrap map**

The 1600×1600 PNG is a 4× integer upscale of the 400×400 PGM (same extent, rows top-down like the PGM ⇒ `formatVersion 1`):
```bash
python3 tools/png2map.py /home/herchu/inorbit/flatland/maps/pretty/sample_map_pretty_1600x1600.png \
  --id flatland-pretty --label "Flatland (rendered)" --frame map \
  --resolution 0.0125 --x 0 --y 0 --format-version 1 > app/private/bootstrap/SpatialAnnotation.yaml
```
Add a line to `app/private/bootstrap/README.md`: "`SpatialAnnotation.yaml` — the rendered flatland sample map, shared by all robots (generated with `tools/png2map.py`)."

- [ ] **Step 4: REST TODO**

In `app/imports/server/rest_api.js` next to the commented `rest/maps` import (line 36) add:
```js
// TODO(maps): REST multipart `POST /api/maps` for browser uploads and PNGs too large for
// base64-in-JSON. Maps are uploaded through the SpatialAnnotation ConfigAPI kind today.
```

- [ ] **Step 5: Verify bootstrap**

Start the app against an empty DB (or `db.spatial_annotations.deleteMany({type:'map'})`), watch the log for `bootstrap(SpatialAnnotation): loading 1 items`; the Navigation widget for the flatland robot shows the selector with "map" and "Flatland (rendered) (shared)", both aligned with the robot pose.

- [ ] **Step 6: Commit**

```bash
git add tools/png2map.py app/private/bootstrap/SpatialAnnotation.yaml app/private/bootstrap/README.md app/imports/server/rest_api.js
git commit -m "feat(maps): png2map tool, flatland shared map bootstrap, REST upload TODO"
```

---

### Task 11: Docs

**Files:**
- Modify: `website/docs/api/configapikinds.md` (two new sections, after `## ModuleState`)
- Create: `website/docs/maps.md` (short guide) — check `website/sidebars.ts`: if the sidebar is autogenerated from `docs/`, nothing else; otherwise add the page next to the API section.
- Modify: `website/docs/iso21423/iso-robots-setup.md` (note that the CCS transform is also visible/editable as `SpatialTransformation` `system`, and that maps drawn in the facility CCS use `frameId: <ccs.id>`).

- [ ] **Step 1: `configapikinds.md`**

Add `## SpatialAnnotation` (purpose; spec table — `scope`, `type`, `frameId`, `label`, `x`, `y`, `resolution`, `formatVersion`, `image`; 12 MB cap; `list` short strips the image; `clear` removes the label at every scope; a YAML example using a placeholder `image: <base64 PNG>`; pointer to `tools/png2map.py`) and `## SpatialTransformation` (id `system`|robotId; entries `from`/`to` with `matrix` or `referencePoints`; lookup order robot → system; one entry per source frame; the ISO CCS is the `map → <ccs.id>` entry; example with three reference points copied from `iso-robots-setup.md` lines 29-32 in `{from:{x,y}, to:{x,y}}` form).

- [ ] **Step 2: `maps.md`**

Sections: *Robot maps vs shared maps* (one paragraph), *Uploading a shared map* (png2map → apply), *Frames and transforms* (when a map's `frameId` differs from the robot's, the widget needs a `SpatialTransformation`; otherwise the robot is hidden and a banner explains), *Switching maps in the Navigation widget*, *ISO robots* (no own map; shared maps are their only map). Link both kinds.

- [ ] **Step 3: Build the site**

`cd website && npm run build` → no broken links.

- [ ] **Step 4: Commit**

```bash
git add website/docs
git commit -m "docs: shared maps, SpatialAnnotation and SpatialTransformation kinds"
```

---

## Self-review

- **Spec coverage:** §1 data model → Tasks 1–3; §2 kinds + bootstrap + REST TODO → Tasks 2, 3, 10; §3 CCS unification → Task 9; §4 publications → Task 4; §5 client (list, switcher, map data, transforms, banner, projection code) → Tasks 5–8; §6 tooling → Task 10; §7 bootstrap → Task 10; §8 tests → each task; manual checks in Tasks 6, 7, 8, 10.
- **Deviation from spec, deliberate:** the map selection string is a *map ref* (`system:<id>` / `robot:<id>`) rather than a bare label, because a bare label cannot distinguish a robot map from a shared map with the same id; legacy bare labels still resolve to robot maps.
- **Type consistency:** `findFrameTransform` returns `{frameId, aTb:{m}}` everywhere; `transformPose` consumes that shape; `useFrameTransform` returns `{ isLoading, transform }`; `mapRefFor` takes `{entityType, mapId}` and `useRobotMapsList.maps[]` items carry both.
