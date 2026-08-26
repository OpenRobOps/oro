import assert from 'assert';

// eslint-disable-next-line import/no-unresolved
import * as sdk from '@openrobops/iso21423';

import { CcsConverter } from '../src/server/iso21423/ccs';

const CCS_ID = '22222222-2222-4222-8222-222222222222';

const geometry = {
  fitTransform: sdk.fitTransform,
  applyTransform: sdk.applyTransform,
  invertTransform: sdk.invertTransform,
  transformYaw: sdk.transformYaw,
};

// A pure translation by (+10, +10).
const TRANSLATION = [
  { id: 'a', map: { x: 0, y: 0 }, ccs: { x: 10, y: 10 } },
  { id: 'b', map: { x: 4, y: 0 }, ccs: { x: 14, y: 10 } },
  { id: 'c', map: { x: 0, y: 3 }, ccs: { x: 10, y: 13 } },
];

// A +90° rotation about the origin.
const ROTATION = [
  { id: 'a', map: { x: 1, y: 0 }, ccs: { x: 0, y: 1 } },
  { id: 'b', map: { x: 0, y: 1 }, ccs: { x: -1, y: 0 } },
  { id: 'c', map: { x: 2, y: 0 }, ccs: { x: 0, y: 2 } },
];

const make = (points, id = CCS_ID) =>
  CcsConverter.create({ id, referencePoints: points }, geometry);
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !== ${b}`);

describe('iso21423 CcsConverter', () => {
  it('is uncalibrated with fewer than 3 reference points, and says why', () => {
    const c = make(TRANSLATION.slice(0, 2));
    assert.strictEqual(c.calibrated, false);
    assert.match(c.reason, /at least 3/);
  });

  it('is uncalibrated with no ccs.id', () => {
    const c = make(TRANSLATION, null);
    assert.strictEqual(c.calibrated, false);
    assert.match(c.reason, /ccs\.id/);
  });

  it('rejects a reference point missing map or ccs coordinates', () => {
    const c = make([...TRANSLATION.slice(0, 2), { id: 'c', map: { x: 0, y: 3 } }]);
    assert.strictEqual(c.calibrated, false);
    assert.match(c.reason, /referencePoints/);
  });

  it('converts an ORO pose out to the CCS (Plan 5 direction)', () => {
    const c = make(TRANSLATION);
    assert.strictEqual(c.calibrated, true);
    const p = c.toLocationPoint({ x: 1, y: 2, theta: 0.5 });
    assert.strictEqual(p.ccsId, CCS_ID);
    near(p.x, 11);
    near(p.y, 12);
    assert.strictEqual(p.z, 0);
    near(c.toOrientation({ theta: 0.5 }).yaw, 0.5);
  });

  it('converts a CCS point back into the ORO map frame (this plan direction)', () => {
    const c = make(TRANSLATION);
    const p = c.fromCcsPoint({ ccsId: CCS_ID, x: 11, y: 12, z: 0 });
    near(p.x, 1);
    near(p.y, 2);
  });

  it('rotates yaw both ways', () => {
    const c = make(ROTATION);
    near(c.toOrientation({ theta: 0 }).yaw, Math.PI / 2);
    near(c.fromCcsYaw(Math.PI / 2), 0);
  });

  it('round-trips a pose through both directions', () => {
    const c = make(ROTATION);
    const iso = c.toLocationPoint({ x: 3, y: -2, theta: 0.3 });
    const back = c.fromCcsPoint(iso);
    near(back.x, 3);
    near(back.y, -2);
    near(c.fromCcsYaw(c.toOrientation({ theta: 0.3 }).yaw), 0.3);
  });

  it('throws in either direction when uncalibrated, rather than lying about the frame', () => {
    const c = make([]);
    assert.throws(() => c.toLocationPoint({ x: 0, y: 0, theta: 0 }), /uncalibrated/);
    assert.throws(() => c.fromCcsPoint({ x: 0, y: 0 }), /uncalibrated/);
    assert.throws(() => c.fromCcsYaw(0), /uncalibrated/);
  });
});
