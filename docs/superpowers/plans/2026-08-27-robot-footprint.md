# Robot Footprint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Draw each robot's real outline (polygon or radius, colors) in the Navigation widget from a `RobotFootprint` ConfigAPI kind (system default, per-robot override) with ISO 21423 robots' reported `imrFootprint` as the fallback.

**Architecture:** Configured footprints live in `ui_preferences` (`map.pose`, InOrbit shape); ISO-reported ones in `robots.footprint`. One pure function `resolveFootprint` merges robot config → system config → reported. The server publishes the resolved `pose` per robot into a client-only `robot_footprints` collection, and `LocalizationAdapter` feeds it to the existing `RobotPoseLayer` renderer via `robotsUiPreferences`. A REST endpoint exposes the same resolution.

**Tech Stack:** Meteor (app: `fastest-validator`, SimpleSchema, mocha), Node/mocha (ingest), `@openrobops/iso21423` SDK (`subscribeEntities`), OpenLayers renderer (unchanged).

**Spec:** `docs/superpowers/specs/2026-08-27-robot-footprint-design.md`

## Global Constraints

- Scopes: `system` (`entityType:'system', entityId:'0'`) and `<robotId>` (`entityType:'robot', entityId:<robotId>`), constants `ID_TYPE_SYSTEM_WIDE`, `ID_DEFAULT`, `ID_TYPE_ROBOT` from `app/imports/shared/constants.js`.
- Storage shape (configured): `ui_preferences` doc `{ entityType, entityId, map: { pose: { footprint, bufferFootprint, radius, primaryColor, secondaryColor, opacity } } }`; polygons as `[x, y]` pairs (metres, robot frame, +x forward). Spec uses `{x, y}` objects; the kind converts.
- Storage shape (reported): `robots.footprint = { points: [[x,y],…], height, ts, source: 'iso21423' }`; valid when ≥ 3 finite points.
- Resolution: field-wise merge robot → system where a `null` counts as defined (suppression); reported `points` used as `footprint` only when merged `footprint` and `radius` are both `undefined`; nulls dropped from the output.
- Suppression write: `{ footprint: null, bufferFootprint: null, radius: null }`. `clear` unsets `map.pose`.
- Auth for the kind: the fleet/configure guard used in `app/imports/server/configAPI/isoRobots.js` (`RESOURCE_SINGLETONS.FLEET`, `ACCESS_LEVEL_CONFIGURE`, `isSystemUser` bypass). Publications/REST: `ACCESS_LEVEL_VIEW`.
- `bufferFootprint` is stored and published but NOT rendered (`showBufferFootprint` stays false).
- Client-only collections are cached on `globalThis` (HMR), as `robot_maps` does in `app/imports/client/oro/hooks/useRobotMaps.js`.
- Copyright header (Apache 2.0, "Copyright 2026 InOrbit, Inc.") on every new source file; TSDoc on non-trivial ingest members.
- Tests: `cd app && TEST_CLIENT=0 meteor test --once --driver-package meteortesting:mocha --port 3100` (whole suite, minutes; port 3100 avoids the dev server); new app test files imported from `app/tests/main.js`. Ingest: `cd ingest && npm test`. Flatland agent: `cd iso-agent && npm test`.
- Commit after every task; conventional messages; append `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Shared footprint helpers

**Files:**
- Create: `app/imports/shared/footprint.js`
- Test: `app/imports/server/test/footprint.test.js`
- Modify: `app/tests/main.js` (add import)

**Interfaces:**
- Produces:
  - `POSE_FIELDS = ['footprint','bufferFootprint','radius','primaryColor','secondaryColor','opacity']`
  - `pairsFromPoints(points: {x,y}[]) → [x,y][]`, `pointsFromPairs(pairs) → {x,y}[]`
  - `isValidPolygon(pairs) → boolean` (array, ≥3 entries, each `[finite, finite]`)
  - `resolveFootprint({ robotCfg, systemCfg, reported }) → pose object` (see constraints)
  - `SUPPRESSED_POSE = { footprint: null, bufferFootprint: null, radius: null }`
  - `ROBOT_FOOTPRINTS_COLLECTION = 'robot_footprints'`

- [ ] **Step 1: Write the failing tests**

```js
// app/imports/server/test/footprint.test.js
import { Meteor } from 'meteor/meteor';
import { expect } from 'chai';
import {
  pairsFromPoints, pointsFromPairs, isValidPolygon, resolveFootprint, SUPPRESSED_POSE,
} from '../../shared/footprint';

if (!Meteor.isTest) throw new Error('This is TEST code only');

const SQUARE = [[0.3, 0.2], [0.3, -0.2], [-0.3, -0.2], [-0.3, 0.2]];

describe('shared/footprint', () => {
  it('converts between {x,y} points and [x,y] pairs', () => {
    const pts = [{ x: 1, y: 2 }, { x: 3, y: 4 }, { x: 5, y: 6 }];
    expect(pairsFromPoints(pts)).to.deep.equal([[1, 2], [3, 4], [5, 6]]);
    expect(pointsFromPairs(pairsFromPoints(pts))).to.deep.equal(pts);
  });

  it('isValidPolygon: ≥3 finite pairs', () => {
    expect(isValidPolygon(SQUARE)).to.equal(true);
    expect(isValidPolygon(SQUARE.slice(0, 2))).to.equal(false);
    expect(isValidPolygon([[0, 0], [1, NaN], [2, 2]])).to.equal(false);
    expect(isValidPolygon(null)).to.equal(false);
  });

  describe('resolveFootprint', () => {
    const reported = { points: SQUARE, height: 0.4 };
    it('returns {} with nothing configured or reported', () => {
      expect(resolveFootprint({})).to.deep.equal({});
    });
    it('uses the reported polygon when config defines neither footprint nor radius', () => {
      expect(resolveFootprint({ reported })).to.deep.equal({ footprint: SQUARE });
      expect(resolveFootprint({ systemCfg: { primaryColor: '#111111' }, reported }))
        .to.deep.equal({ footprint: SQUARE, primaryColor: '#111111' });
    });
    it('config radius or footprint beats the reported polygon', () => {
      expect(resolveFootprint({ systemCfg: { radius: 0.3 }, reported })).to.deep.equal({ radius: 0.3 });
    });
    it('merges field-wise, robot over system', () => {
      const out = resolveFootprint({
        systemCfg: { radius: 0.3, primaryColor: '#111111', opacity: 0.8 },
        robotCfg: { primaryColor: '#222222' },
      });
      expect(out).to.deep.equal({ radius: 0.3, primaryColor: '#222222', opacity: 0.8 });
    });
    it('a robot-scope null suppresses the system value and the reported one, and is dropped', () => {
      const out = resolveFootprint({ systemCfg: { radius: 0.3 }, robotCfg: SUPPRESSED_POSE, reported });
      expect(out).to.deep.equal({});
    });
    it('ignores an invalid reported polygon', () => {
      expect(resolveFootprint({ reported: { points: [[0, 0]] } })).to.deep.equal({});
    });
  });
});
```
Add to `app/tests/main.js` after the `maps.test.js` import: `import '../imports/server/test/footprint.test.js'`

- [ ] **Step 2: Run to verify failure**

Run: `cd app && TEST_CLIENT=0 meteor test --once --driver-package meteortesting:mocha --port 3100 2>&1 | grep -A3 "shared/footprint"`
Expected: `Cannot find module '../../shared/footprint'`.

- [ ] **Step 3: Implement `app/imports/shared/footprint.js`**

```js
/**
 * Copyright 2026 InOrbit, Inc. (Apache 2.0 header — copy verbatim from app/imports/shared/maps.js)
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

/** Client-only collection fed by the `robot_footprints` publication (resolved pose per robot). */
const ROBOT_FOOTPRINTS_COLLECTION = 'robot_footprints';

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
  POSE_FIELDS, SUPPRESSED_POSE, ROBOT_FOOTPRINTS_COLLECTION,
  pairsFromPoints, pointsFromPairs, isValidPolygon, resolveFootprint,
};
```

- [ ] **Step 4: Run to verify pass** — same command; all `shared/footprint` tests green, no regressions.

- [ ] **Step 5: Commit**

```bash
git add app/imports/shared/footprint.js app/imports/server/test/footprint.test.js app/tests/main.js
git commit -m "feat(footprint): shared footprint resolution helpers"
```

---

### Task 2: `RobotFootprint` ConfigAPI kind

**Files:**
- Create: `app/imports/server/configAPI/robotFootprint.js`
- Modify: `app/imports/server/configAPI/configAPI.js` (replace the commented import at line 35 and registration at line 120 with live ones)
- Modify: `app/imports/lib/collections.js` — add `footprint: { type: Object, blackbox: true, optional: true }` to `Schemas.robot` (~line 36–58) so the reported footprint is a documented field
- Test: `app/imports/server/test/configAPI/configAPIRobotFootprint.test.js`
- Modify: `app/tests/main.js`

**Interfaces:**
- Consumes: `pairsFromPoints`, `pointsFromPairs`, `SUPPRESSED_POSE`, `POSE_FIELDS` (Task 1); `UIPreferences` from `app/imports/lib/collections.js`; `Schemas.PosePreferenece` from `app/imports/lib/uiPreferences.js`.
- Produces: `ui_preferences` docs `{entityType, entityId, map:{pose}}` at system/robot scope; `metadata.id` = `system` | `<robotId>`.

- [ ] **Step 1: Write the failing tests**

```js
// app/imports/server/test/configAPI/configAPIRobotFootprint.test.js
import { Meteor } from 'meteor/meteor';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { resetDatabase } from '../setup';
import ConfigAPI from '../../configAPI/configAPI';
import OroRoles from '../../roles';
import {
  AuthorizationError, SchemaError, ValidationError, LIST_FORMAT_FULL,
} from '../../../shared/configAPI';
import { ROLE_VIEWER, ROLE_MANAGER } from '../../../lib/roles';
import { createUser } from '../configAPI';
import { UIPreferences } from '../../../lib/collections';

if (!Meteor.isTest) throw new Error('This is TEST code only');
const { expect } = chai;
chai.use(chaiAsPromised);

const KIND = 'RobotFootprint';
const SQ = [{ x: 0.3, y: 0.2 }, { x: 0.3, y: -0.2 }, { x: -0.3, y: -0.2 }, { x: -0.3, y: 0.2 }];
const obj = (spec, id = 'system') => ({ kind: KIND, apiVersion: 'v0.1', metadata: { id }, spec });
const poseOf = (entityType, entityId) => UIPreferences.findOneAsync({ entityType, entityId }).then((d) => d?.map?.pose);

describe('configAPI:RobotFootprint', () => {
  let configApi; let manager;
  beforeEach(async () => {
    await resetDatabase();
    configApi = await new ConfigAPI().init({});
    await new OroRoles().createDefaultRoles();
    manager = await createUser({ id: 'mgr', role: ROLE_MANAGER });
  });

  it('apply: rejects viewers', async () => {
    const user = await createUser({ role: ROLE_VIEWER });
    await expect(configApi.apply({ configObject: obj({ radius: 0.3 }), user })).to.be.rejectedWith(AuthorizationError);
  });

  it('apply: stores polygons as [x,y] pairs at system scope', async () => {
    await configApi.apply({ configObject: obj({ footprint: SQ, radius: 0.3, primaryColor: '#2A3C98', opacity: 0.9 }), user: manager });
    const pose = await poseOf('system', '0');
    expect(pose.footprint).to.deep.equal([[0.3, 0.2], [0.3, -0.2], [-0.3, -0.2], [-0.3, 0.2]]);
    expect(pose).to.include({ radius: 0.3, primaryColor: '#2A3C98', opacity: 0.9 });
  });

  it('apply: robot scope; re-apply replaces map.pose wholesale', async () => {
    await configApi.apply({ configObject: obj({ radius: 0.3, primaryColor: '#111111' }, 'r1'), user: manager });
    await configApi.apply({ configObject: obj({ radius: 0.5 }, 'r1'), user: manager });
    expect(await poseOf('robot', 'r1')).to.deep.equal({ radius: 0.5 });
  });

  it('apply: spec null writes the suppression triple', async () => {
    await configApi.apply({ configObject: obj(null, 'r1'), user: manager });
    expect(await poseOf('robot', 'r1')).to.deep.equal({ footprint: null, bufferFootprint: null, radius: null });
  });

  it('apply: schema rejects short polygons, bad colors, opacity > 1, unknown keys', async () => {
    for (const bad of [{ footprint: SQ.slice(0, 2) }, { primaryColor: 'red' }, { opacity: 2 }, { shape: 'circle' }]) {
      await expect(configApi.apply({ configObject: obj(bad), user: manager })).to.be.rejectedWith(SchemaError);
    }
  });

  it('apply: rejects an empty id', async () => {
    await expect(configApi.apply({ configObject: obj({ radius: 1 }, ''), user: manager })).to.be.rejectedWith(ValidationError);
  });

  it('list: short is flat {id,label}; full round-trips with {x,y} points', async () => {
    await configApi.apply({ configObject: obj({ footprint: SQ, radius: 0.3 }), user: manager });
    const short = await configApi.list({ kind: KIND, user: manager });
    expect(short[0]).to.include({ id: 'system', label: 'system', scope: '' });
    const full = await configApi.list({ kind: KIND, user: manager, format: LIST_FORMAT_FULL });
    expect(full[0].metadata.id).to.equal('system');
    expect(full[0].spec).to.deep.equal({ footprint: SQ, radius: 0.3 });
    await configApi.apply({ configObject: full[0], user: manager });
  });

  it('list full: a suppressed entity lists with spec null', async () => {
    await configApi.apply({ configObject: obj(null, 'r1'), user: manager });
    const full = await configApi.list({ kind: KIND, user: manager, format: LIST_FORMAT_FULL });
    expect(full[0].spec).to.equal(null);
  });

  it('clear: unsets map.pose only', async () => {
    await UIPreferences.upsertAsync({ entityType: 'robot', entityId: 'r1' }, { $set: { map: { pose: { radius: 1 }, lasers: { a: 1 } } } });
    await configApi.clear({ configObject: { kind: KIND, apiVersion: 'v0.1', metadata: { id: 'r1' } }, user: manager });
    const doc = await UIPreferences.findOneAsync({ entityType: 'robot', entityId: 'r1' });
    expect(doc.map).to.deep.equal({ lasers: { a: 1 } });
  });
});
```
Add to `app/tests/main.js`: `import '../imports/server/test/configAPI/configAPIRobotFootprint.test.js'`

- [ ] **Step 2: Run to verify failure** — `Unsupported object kind RobotFootprint`.

- [ ] **Step 3: Implement the handler**

```js
// app/imports/server/configAPI/robotFootprint.js
/**
 * Copyright 2026 InOrbit, Inc. (Apache 2.0 header — copy verbatim from isoRobots.js)
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
```
`configAPI.js`: `import RobotFootprintConfigAPIHandler from './robotFootprint';` and `[KIND_ROBOT_FOOTPRINT]: new RobotFootprintConfigAPIHandler(this),` (uncomment/replace). `KIND_ROBOT_FOOTPRINT` is already imported there and exported from `shared/configAPI.js`.

Note: `UIPreferences` has `Schemas.uiPreferences` attached with `map` blackbox — `$set: {'map.pose': …}` passes. If collection2 rejects the dotted key, switch to reading the doc and `$set: { map: { ...doc.map, pose } }`.

- [ ] **Step 4: Run to verify pass**; **Step 5: Commit**

```bash
git add app/imports/server/configAPI/robotFootprint.js app/imports/server/configAPI/configAPI.js app/imports/lib/collections.js app/imports/server/test/configAPI/configAPIRobotFootprint.test.js app/tests/main.js
git commit -m "feat(configapi): RobotFootprint kind writes ui_preferences map.pose"
```

---

### Task 3: Server-side resolution + REST `GET /api/robots/{robotId}/footprint`

**Files:**
- Create: `app/imports/server/footprints.js`
- Modify: `app/imports/server/rest/robots.js` (un-comment the route at lines 245–252; add handler)
- Test: extend `app/imports/server/test/footprint.test.js`

**Interfaces:**
- Produces: `resolvedFootprintFor(robotId) → Promise<pose>` and `footprintDocsFor(robotIds) → Promise<{ [robotId]: pose }>` (one query each for `ui_preferences` and `robots`), both using `resolveFootprint`.
- REST: `GET /api/robots/{robotId}/footprint` → `{ footprint?, bufferFootprint?, radius? }` (pairs), `{}` when none.

- [ ] **Step 1: Failing tests** (append to `footprint.test.js`, add imports `resetDatabase` from `./setup`, `UIPreferences, Robots` from `../../lib/collections`, `resolvedFootprintFor, footprintDocsFor` from `../footprints`, `apiGetRobotFootprint` from `../rest/robots`)

```js
  describe('server resolution', () => {
    beforeEach(async () => {
      await resetDatabase();
      await Robots.insertAsync({ _id: 'iso1', name: 'iso1', version: 'iso-21423-v1', status: { agentOnline: true }, updateStamp: Date.now(),
        footprint: { points: SQUARE, height: 0.4, ts: 1, source: 'iso21423' } });
      await Robots.insertAsync({ _id: 'r1', name: 'r1', version: '1', status: { agentOnline: true }, updateStamp: Date.now() });
      await UIPreferences.insertAsync({ entityType: 'system', entityId: '0', map: { pose: { radius: 0.3, primaryColor: '#111111' } } });
      await UIPreferences.insertAsync({ entityType: 'robot', entityId: 'r1', map: { pose: { primaryColor: '#222222' } } });
    });
    it('resolvedFootprintFor: robot over system; system radius beats reported polygon', async () => {
      expect(await resolvedFootprintFor('r1')).to.deep.equal({ radius: 0.3, primaryColor: '#222222' });
      expect(await resolvedFootprintFor('iso1')).to.deep.equal({ radius: 0.3, primaryColor: '#111111' });
    });
    it('footprintDocsFor: reported polygon used when no radius/footprint is configured', async () => {
      await UIPreferences.updateAsync({ entityType: 'system', entityId: '0' }, { $set: { 'map.pose': { primaryColor: '#111111' } } });
      const docs = await footprintDocsFor(['r1', 'iso1']);
      expect(docs.iso1).to.deep.equal({ footprint: SQUARE, primaryColor: '#111111' });
      expect(docs.r1).to.deep.equal({ primaryColor: '#222222' });
    });
    it('REST: returns geometry only, {} when none', async () => {
      const [body] = await apiGetRobotFootprint({ robot: { getId: () => 'r1' } });
      expect(body).to.deep.equal({ radius: 0.3 });
      await UIPreferences.removeAsync({});
      const [empty] = await apiGetRobotFootprint({ robot: { getId: () => 'r1' } });
      expect(empty).to.deep.equal({});
    });
  });
```

- [ ] **Step 2: Run to verify failure.**

- [ ] **Step 3: Implement**

```js
// app/imports/server/footprints.js
/** Copyright header (Apache 2.0) */
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
```
In `rest/robots.js`: import `resolvedFootprintFor` and add
```js
/**
 * GET /robots/{robotId}/footprint — the resolved footprint geometry (configured over
 * ISO-reported), as [x, y] pairs in the robot frame. Colors are UI-only and omitted.
 */
export async function apiGetRobotFootprint({ robot }) {
  const { footprint, bufferFootprint, radius } = await resolvedFootprintFor(robot.getId());
  const out = {};
  if (footprint) out.footprint = footprint;
  if (bufferFootprint) out.bufferFootprint = bufferFootprint;
  if (radius !== undefined) out.radius = radius;
  return [out];
}
```
and un-comment the route object (keep `checkUserCanRobot: ACCESS_LEVEL_VIEW`, `loadRobot: true`). Add the endpoint to `website/docs/api/robots.md` in Task 6.

- [ ] **Step 4: Run to verify pass**; **Step 5: Commit** — `feat(footprint): server-side resolution and GET /robots/{id}/footprint`

---

### Task 4: Publication + client hook + widget wiring

**Files:**
- Modify: `app/imports/server/publications.js` (add `robot_footprints`)
- Create: `app/imports/client/oro/hooks/useRobotsFootprints.js`
- Modify: `app/imports/client/oro/robotWidgets/LocalizationWidget/LocalizationAdapter.js:166` (replace `const robotsUiPreferences = {};`)

**Interfaces:**
- Publication `robot_footprints({ robotIds })` → client-only collection `robot_footprints` docs `{ _id: robotId, pose }` (resolved).
- Hook `useRobotsFootprints(robotIds) → { [robotId]: { map: { pose } } }` (memoized; stable `{}` when empty).

- [ ] **Step 1: Publication** (`publications.js`; imports: `UIPreferences, Robots` already/available from `../lib/collections`, `footprintDocsFor` from `./footprints`, `ROBOT_FOOTPRINTS_COLLECTION` from `../shared/footprint`)

```js
/**
 * Publish each robot's RESOLVED footprint pose (configured over ISO-reported) into the
 * client-only `robot_footprints` collection. Resolution runs server-side so the widget stays a
 * plain renderer; recomputed for the whole set whenever a relevant ui_preferences or robots
 * document changes (footprints change rarely, so a full recompute per change is fine).
 */
Meteor.publish('robot_footprints', async function ({ robotIds }) {
  if (!this.userId || !isArray(robotIds) || robotIds.length === 0) {
    return this.ready();
  }
  if (!await new OroRoles().canAccessRobots(this.userId, robotIds, ACCESS_LEVEL_VIEW)) {
    return this.error(new Meteor.Error('Unauthorized'));
  }
  let published = {};
  const refresh = async () => {
    const docs = await footprintDocsFor(robotIds);
    Object.entries(docs).forEach(([id, pose]) => {
      if (published[id]) this.changed(ROBOT_FOOTPRINTS_COLLECTION, id, { pose });
      else this.added(ROBOT_FOOTPRINTS_COLLECTION, id, { pose });
    });
    published = docs;
  };
  // ponytail: any change to an input → recompute all robotIds (tiny sets, rare changes).
  const onChange = { added: refresh, changed: refresh, removed: refresh };
  const handles = await Promise.all([
    UIPreferences.find({ $or: [{ entityType: 'system', entityId: '0' }, { entityType: 'robot', entityId: { $in: robotIds } }] },
      { fields: { 'map.pose': 1 } }).observeChangesAsync(onChange),
    Robots.find({ _id: { $in: robotIds } }, { fields: { footprint: 1 } }).observeChangesAsync(onChange),
  ]);
  await refresh();
  this.onStop(() => handles.forEach((h) => h.stop()));
  return this.ready();
});
```
(`observeChangesAsync` fires `added` for the initial docs; `refresh` is idempotent so the extra calls are harmless.)

- [ ] **Step 2: Hook**

```js
// app/imports/client/oro/hooks/useRobotsFootprints.js
/** Copyright header (Apache 2.0) */
/** Resolved footprint (`map.pose` shape) per robot, from the `robot_footprints` publication. */
import { useMemo } from 'react';
import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { useTracker } from 'meteor/react-meteor-data';
import { ROBOT_FOOTPRINTS_COLLECTION } from '../../../shared/footprint';

const clientCollections = (globalThis.__oroClientCollections ||= {});
const RobotFootprints = (clientCollections[ROBOT_FOOTPRINTS_COLLECTION]
  ||= new Mongo.Collection(ROBOT_FOOTPRINTS_COLLECTION));

const EMPTY = {};

export function useRobotsFootprints(robotIds) {
  const key = (robotIds || []).join(',');
  const docs = useTracker(() => {
    if (!robotIds || robotIds.length === 0) return [];
    Meteor.subscribe('robot_footprints', { robotIds });
    return RobotFootprints.find({ _id: { $in: robotIds } }).fetch();
  }, [key]);
  return useMemo(() => (docs.length === 0 ? EMPTY
    : Object.fromEntries(docs.map((d) => [d._id, { map: { pose: d.pose } }]))), [docs]);
}
```

- [ ] **Step 3: Wire the adapter** — in `LocalizationAdapter.js` replace
```js
  // TODO: Implement useRobotsUiPreferences for ORO (not available yet)
  // UI preferences control robot avatar and map visualization per robot.
  const robotsUiPreferences = {};
```
with
```js
  // Per-robot avatar/footprint preferences (resolved server-side from RobotFootprint config and
  // ISO-reported footprints); RobotPoseLayer reads `map.pose`.
  const robotsUiPreferences = useRobotsFootprints(robotIdsToQuery);
```
and import `{ useRobotsFootprints } from '../../hooks/useRobotsFootprints'`. Check the `useTracker` in `useRobotMaps.js` for the import path style.

- [ ] **Step 4: Verify** — `cd app && TEST_CLIENT=0 meteor test … --port 3100` (bundle compiles, totals unchanged). Manual (dev server on :3000): `POST /api/configuration/apply` a system `RobotFootprint` with `radius: 0.6, primaryColor: "#ff0000"` → flatland robot's ring grows and turns red; apply `footprint` (the 4-point square) → polygon; apply robot-scope `spec: null` → default ring returns.

- [ ] **Step 5: Commit** — `feat(navigation): draw configured/reported robot footprints`

---

### Task 5: ISO ingest — identity footprint → `robots.footprint`

**Files:**
- Modify: `ingest/src/server/isoRobots/ingestTelemetry.js` (`observe`, new `onIdentity`)
- Test: `ingest/test/iso-robots-telemetry.test.js` (append)

**Interfaces:**
- `onIdentity(uuid, identity)`: when `identity.details.imrFootprint` is an array of ≥3 `{x,y}` finite points → `robotsColl.updateOne({_id: uuid}, {$set: {footprint: {points: [[x,y]…], height: details.imrHeight ?? null, ts: Date.now(), source: 'iso21423'}}})`; otherwise warn once per uuid (Set), no write.
- Subscription: `this._client.subscribeEntities(filter, (identity) => this.onIdentity(identity.id, identity))` added to the `Promise.all` in `observe` (the SDK documents `subscribeEntities` as the identity path; it replays the retained identity).

- [ ] **Step 1: Failing tests** (append; the fake `robotsColl` records `updateOne` calls)

```js
  it('onIdentity: stores a valid imrFootprint as robots.footprint', async () => {
    const { ingester, robotsColl } = ingesterFor();
    await ingester.onIdentity(UUID, { id: UUID, entityType: 'IMR', details: {
      imrFootprint: [{ x: -0.2, y: -0.2 }, { x: 0.2, y: -0.2 }, { x: 0.2, y: 0.2 }, { x: -0.2, y: 0.2 }], imrHeight: 0.4 } });
    assert.strictEqual(robotsColl.updates.length, 1);
    assert.deepStrictEqual(robotsColl.updates[0].q, { _id: UUID });
    const fp = robotsColl.updates[0].u.$set.footprint;
    assert.deepStrictEqual(fp.points, [[-0.2, -0.2], [0.2, -0.2], [0.2, 0.2], [-0.2, 0.2]]);
    assert.strictEqual(fp.height, 0.4);
    assert.strictEqual(fp.source, 'iso21423');
    assert.ok(Number.isFinite(fp.ts));
  });

  it('onIdentity: ignores missing or malformed footprints', async () => {
    const { ingester, robotsColl } = ingesterFor();
    await ingester.onIdentity(UUID, { id: UUID, details: {} });
    await ingester.onIdentity(UUID, { id: UUID, details: { imrFootprint: [{ x: 0, y: 0 }, { x: 1, y: 1 }] } });
    await ingester.onIdentity(UUID, { id: UUID, details: { imrFootprint: [{ x: 0, y: 0 }, { x: 1 }, { x: 2, y: 2 }] } });
    assert.strictEqual(robotsColl.updates.length, 0);
  });
```

- [ ] **Step 2: Run to verify failure** — `cd ingest && npm test` → `ingester.onIdentity is not a function`.

- [ ] **Step 3: Implement** (in `ingestTelemetry.js`)

```js
  /**
   * Handles an ISO `identity` (retained; replayed on subscribe). The only field ORO uses is the
   * robot's physical outline, `details.imrFootprint` (+ `imrHeight`), stored as the robot's
   * REPORTED footprint. A configured `RobotFootprint` overrides it (spec decision 1). Malformed
   * footprints are ignored with one warning per robot.
   *
   * @param {string} uuid
   * @param {Object} identity an ISO EntityIdentity
   */
  onIdentity = async (uuid, identity) => {
    if (this._isRevoked(uuid)) return;
    const details = (identity && identity.details) || {};
    const pts = details.imrFootprint;
    const valid = Array.isArray(pts) && pts.length >= 3
      && pts.every((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y));
    if (!valid) {
      if (pts !== undefined && !this._warnedFootprint.has(uuid)) {
        this._warnedFootprint.add(uuid);
        console.warn(`ISO 21423 robots: ignoring malformed imrFootprint for ${uuid}`);
      }
      return;
    }
    const footprint = {
      points: pts.map(({ x, y }) => [x, y]),
      height: Number.isFinite(details.imrHeight) ? details.imrHeight : null,
      ts: Date.now(),
      source: 'iso21423',
    };
    try {
      await this._robots.updateOne({ _id: uuid }, { $set: { footprint } });
    } catch (err) {
      if (this._logging) console.warn(`ISO 21423 robots: footprint update failed for ${uuid}: ${err.message}`);
    }
  };
```
Constructor: `this._warnedFootprint = new Set();`. In `observe`, add to the `Promise.all`:
```js
      this._client.subscribeEntities(filter, (identity) => this.onIdentity(uuid, identity)),
```
(Check the `Subscription` return has `unsubscribe()` like the others so `unobserve` keeps working.)

- [ ] **Step 4: `cd ingest && npm test` green.** **Step 5: Commit** — `feat(iso21423): store the identity's imrFootprint as the robot's reported footprint`

---

### Task 6: Docs

**Files:**
- Modify: `website/docs/api/configapikinds.md` (new `## RobotFootprint` section after `## SpatialTransformation`, before `## See Also`)
- Modify: `website/docs/maps.md` (new section "Robot footprint")
- Modify: `website/docs/api/robots.md` (document `GET /api/robots/{robotId}/footprint`)
- Modify: `website/docs/iso21423/iso-robots-setup.md` (identity `imrFootprint` is used; remove `footprint` from "Known limitations")

- [ ] **Step 1: Write** — kind section: purpose, YAML example (system + robot override + `spec: null` suppression), field table (`footprint`, `bufferFootprint` (stored, not rendered yet), `radius`, `primaryColor`, `secondaryColor`, `opacity`; units metres, robot frame, +x forward, hex colors, opacity 0–1), scope ids `system`/`<robotId>`, `clear` semantics. `maps.md`: precedence rules exactly as spec §1 step 1–3. `robots.md`: endpoint, response `{footprint, bufferFootprint, radius}` or `{}`, VIEW access.
- [ ] **Step 2: `cd website && npm run build`** — no broken links.
- [ ] **Step 3: Commit** — `docs: RobotFootprint kind, footprint resolution and REST endpoint`

---

### Task 7: Flatland iso-agent publishes a spec-valid identity (sim-flatland repo)

**Repo:** `/home/herchu/inorbit/flatland` — branch off `main` (`feat/iso-identity-footprint`), separate PR.
**Files:**
- Modify: `iso-agent/src/mapping.js` (add `circlePolygon(radius, n = 16)` and `imrDetails({ uuid, version })`)
- Modify: `iso-agent/src/main.js:54` (`details: { model: 'flatland-nav2' }` → `details: imrDetails({...})`)
- Test: `iso-agent/test/mapping.test.js`

- [ ] **Step 1: Failing test**

```js
test('imrDetails is a spec-valid IMR identity with a 16-point footprint of the 0.22 m body', () => {
  const d = imrDetails({ uuid: '7b1a9c3e-1111-4222-8333-444455556666', version: '1.2.3' });
  assert.equal(d.imrModel, 'flatland-nav2');
  assert.equal(d.imrSerialNumber, '7b1a9c3e-1111-4222-8333-444455556666');
  assert.equal(d.imrFootprint.length, 16);
  for (const p of d.imrFootprint) assert.ok(Math.abs(Math.hypot(p.x, p.y) - 0.22) < 1e-9);
  assert.deepEqual(d.imrWorkingArea, d.imrFootprint);
  assert.equal(d.imrHeight, 0.4);
  assert.deepEqual(d.softwareVersions, [{ name: 'iso-agent', version: '1.2.3' }]);
});
```
Also assert against the schema if the existing tests use `assertValid` for identities (they import it from `@openrobops/iso21423/schema`): `assertValid('identity', { id: uuid, timestamp: new Date().toISOString(), entityType: 'IMR', manufacturerName: 'x', capabilities: { provides: [], accepts: [] }, details: d })`.

- [ ] **Step 2: Implement**

```js
/** Regular polygon approximating the turtlebot body circle (worlds/turtlebot.model.yaml: radius 0.22). */
export function circlePolygon(radius, n = 16) {
  return Array.from({ length: n }, (_, i) => {
    const a = (2 * Math.PI * i) / n;
    return { x: +(radius * Math.cos(a)).toFixed(4), y: +(radius * Math.sin(a)).toFixed(4) };
  });
}

/** ISO §3.1 ImrDetails for the flatland robot; all six required fields present. */
export function imrDetails({ uuid, version }) {
  const footprint = circlePolygon(0.22);
  return {
    imrModel: 'flatland-nav2',
    imrSerialNumber: uuid,
    imrFootprint: footprint,
    imrWorkingArea: footprint,
    imrHeight: 0.4,
    softwareVersions: [{ name: 'iso-agent', version }],
  };
}
```
`main.js`: `details: imrDetails({ uuid: ENTITY_UUID, version: process.env.npm_package_version || '0.0.0' })` (use whatever constant holds the entity uuid in `main.js`). Note the test's radius check tolerates the 4-decimal rounding only if you compare against `0.22` with `1e-3`; adjust the assertion tolerance to `1e-3` accordingly.

- [ ] **Step 3: `cd iso-agent && npm test`; commit** — `iso-agent: publish a spec-valid IMR identity with the robot footprint`; push; `gh pr create` (body: what changed, "requires `docker compose build iso-agent`", companion of the oro footprint PR).

---

## Self-review

- **Spec coverage:** §1 data model → T1 (resolve), T2 (config storage), T5 (reported). §2 kind + REST → T2, T3. §3 publication/hook/adapter → T4. §4 ISO ingest + flatland agent → T5, T7. §5 docs/tests → T6 and per-task tests. Decision 3 (buffer not rendered) → T4 leaves `showBufferFootprint` false.
- **Placeholders:** none; the only conditional instruction is the collection2 dotted-`$set` fallback in T2 and the `subscribeEntities` handle check in T5, both with the concrete alternative stated.
- **Type consistency:** `resolveFootprint({robotCfg, systemCfg, reported})` (T1) used by `footprintDocsFor` (T3) and via it by the publication (T4); `reported.points` matches what T5 writes; `ROBOT_FOOTPRINTS_COLLECTION` shared by T4's publication and hook; REST returns pairs, kind list returns points.
