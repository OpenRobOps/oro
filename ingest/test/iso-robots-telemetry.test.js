import assert from 'assert';

import { IsoTelemetryIngester, mapStatus } from '../src/server/isoRobots/ingestTelemetry';
import { DEFAULT_ATTRIBUTE_SOURCES } from '../src/server/iso21423/sharedConfig';

const UUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CCS_ID = '22222222-2222-4222-8222-222222222222';

// Inverse of a +10/+10 translation: CCS (11,12) is ORO map (1,2).
const converter = {
  calibrated: true,
  ccsId: CCS_ID,
  fromCcsPoint: ({ x, y }) => ({ x: x - 10, y: y - 10 }),
  fromCcsYaw: (yaw) => yaw,
};

function fakeAttributes() {
  const saved = [];
  const keyValues = [];
  return {
    saved, keyValues,
    saveAttributeValues: async (args) => { saved.push(args); },
    handleKeyValuePairs: async (robotId, customField, pairs, ts) => { keyValues.push({ robotId, customField, pairs, ts }); },
  };
}

function fakeKeyValuesColl() {
  const updates = [];
  return { updates, updateOne: async (q, u, o) => { updates.push({ q, u, o }); } };
}

function fakeRobots() {
  const updates = [];
  return { updates, updateOne: async (q, u) => { updates.push({ q, u }); } };
}

function ingesterFor(opts = {}) {
  const attributesManager = opts.attributesManager || fakeAttributes();
  const robotsColl = opts.robotsColl || fakeRobots();
  return {
    attributesManager,
    robotsColl,
    ingester: new IsoTelemetryIngester({
      client: null,
      attributesManager,
      robotsColl,
      converter,
      sources: DEFAULT_ATTRIBUTE_SOURCES,
      ...opts,
    }),
  };
}

const valuesOf = (saved) => Object.fromEntries(
  Object.entries(saved.attributeValues).map(([k, v]) => [k, v.value]));

describe('iso-robots mapStatus', () => {
  it('is online for ordinary operating states', () => {
    assert.deepStrictEqual(mapStatus(['MODE_AUTO', 'IDLE']), { online: true });
    assert.deepStrictEqual(mapStatus(['MODE_AUTO', 'FORWARD']), { online: true });
  });

  it('is offline for OFFLINE and for the broker-published LOST_CONNECTION', () => {
    assert.deepStrictEqual(mapStatus(['OFFLINE']), { online: false });
    assert.deepStrictEqual(mapStatus(['LOST_CONNECTION']), { online: false });
    assert.deepStrictEqual(mapStatus(['MODE_AUTO', 'IDLE', 'OFFLINE']), { online: false });
  });

  it('treats a missing or empty states array as online-unknown-but-present', () => {
    assert.deepStrictEqual(mapStatus(undefined), { online: true });
    assert.deepStrictEqual(mapStatus([]), { online: true });
  });
});

describe('iso-robots IsoTelemetryIngester', () => {
  it('writes agentOnline and refreshes the robot document from status', async () => {
    const { ingester, attributesManager, robotsColl } = ingesterFor();
    await ingester.onStatus(UUID, { states: ['MODE_AUTO', 'IDLE'] });

    assert.strictEqual(attributesManager.saved.length, 1);
    assert.strictEqual(attributesManager.saved[0].robotId, UUID);
    assert.deepStrictEqual(valuesOf(attributesManager.saved[0]), { agentOnline: true });

    assert.strictEqual(robotsColl.updates.length, 1);
    assert.deepStrictEqual(robotsColl.updates[0].q, { _id: UUID });
    assert.strictEqual(robotsColl.updates[0].u.$set['status.agentOnline'], true);
    assert.ok(Number.isFinite(robotsColl.updates[0].u.$set.updateStamp));
  });

  it('marks the robot offline on an OFFLINE status', async () => {
    const { ingester, attributesManager, robotsColl } = ingesterFor();
    await ingester.onStatus(UUID, { states: ['OFFLINE'] });
    assert.deepStrictEqual(valuesOf(attributesManager.saved[0]), { agentOnline: false });
    assert.strictEqual(robotsColl.updates[0].u.$set['status.agentOnline'], false);
  });

  it('converts odometry into the ORO map frame and writes pose plus speeds', async () => {
    const { ingester, attributesManager } = ingesterFor();
    await ingester.onOdometry(UUID, {
      pose: {
        locationPoint: { ccsId: CCS_ID, x: 11, y: 12, z: 0 },
        orientation: { yaw: 1.5, pitch: 0, roll: 0 },
      },
      velocity: { linear: 0.4, angular: -0.1 },
    });
    const values = valuesOf(attributesManager.saved[0]);
    assert.deepStrictEqual(values.pose, { x: 1, y: 2, theta: 1.5 });
    assert.strictEqual(values.speedLinear, 0.4);
    assert.strictEqual(values.speedAngular, -0.1);
  });

  it('mirrors the converted pose into localization.robotPose for the Navigation widget', async () => {
    const localizationColl = fakeKeyValuesColl();   // same updateOne recorder shape
    const { ingester } = ingesterFor({ localizationColl });
    await ingester.onOdometry(UUID, {
      pose: { locationPoint: { ccsId: CCS_ID, x: 11, y: 12, z: 0 }, orientation: { yaw: 1.5 } },
    });
    assert.strictEqual(localizationColl.updates.length, 1);
    const { q, u, o } = localizationColl.updates[0];
    assert.deepStrictEqual(q, { _id: UUID });
    assert.deepStrictEqual(o, { upsert: true });
    const { robotPose, robotPoseUpdatedTs } = u.$set;
    assert.deepStrictEqual({ x: robotPose.x, y: robotPose.y, theta: robotPose.theta, frameId: robotPose.frameId },
      { x: 1, y: 2, theta: 1.5, frameId: 'map' });
    assert.strictEqual(robotPose.ts, robotPoseUpdatedTs);
  });

  it('still writes speeds when the converter is uncalibrated, but no pose', async () => {
    const { ingester, attributesManager } = ingesterFor({
      converter: { calibrated: false, reason: 'no points' },
    });
    await ingester.onOdometry(UUID, {
      pose: { locationPoint: { x: 11, y: 12, z: 0 }, orientation: { yaw: 1.5 } },
      velocity: { linear: 0.4, angular: 0 },
    });
    const values = valuesOf(attributesManager.saved[0]);
    assert.strictEqual('pose' in values, false);
    assert.strictEqual(values.speedLinear, 0.4);
  });

  it('passes battery soc through as a 0..1 fraction and maps the charging state to a boolean', async () => {
    const { ingester, attributesManager } = ingesterFor();
    await ingester.onBattery(UUID, {
      batterySoc: 0.42, batteryVoltage: 48.2, batteryChargingState: 'CHARGING',
    });
    assert.deepStrictEqual(valuesOf(attributesManager.saved[0]), {
      batteryPercentage: 0.42, batteryVoltage: 48.2, batteryIsCharging: true,
    });
  });

  it('maps every non-CHARGING charging state to false', async () => {
    const { ingester, attributesManager } = ingesterFor();
    await ingester.onBattery(UUID, { batterySoc: 0.5, batteryChargingState: 'DISCHARGING' });
    assert.strictEqual(valuesOf(attributesManager.saved[0]).batteryIsCharging, false);
  });

  it('omits absent optional battery fields rather than writing undefined', async () => {
    const { ingester, attributesManager } = ingesterFor();
    await ingester.onBattery(UUID, { batterySoc: 0.5 });
    assert.deepStrictEqual(valuesOf(attributesManager.saved[0]), { batteryPercentage: 0.5 });
  });

  it('honours an overridden attribute source id', async () => {
    const { ingester, attributesManager } = ingesterFor({
      sources: { ...DEFAULT_ATTRIBUTE_SOURCES, batteryPercentage: 'socPercent' },
    });
    await ingester.onBattery(UUID, { batterySoc: 0.5 });
    assert.deepStrictEqual(valuesOf(attributesManager.saved[0]), { socPercent: 0.5 });
  });

  it('writes nothing for a message with no usable fields', async () => {
    const { ingester, attributesManager } = ingesterFor();
    await ingester.onBattery(UUID, {});
    await ingester.onOdometry(UUID, {});
    assert.deepStrictEqual(attributesManager.saved, []);
  });

  it('never lets a save failure escape onto the ISO callback', async () => {
    const { ingester } = ingesterFor({
      attributesManager: { saveAttributeValues: async () => { throw new Error('mongo down'); } },
    });
    await ingester.onStatus(UUID, { states: ['IDLE'] });
  });

  it('does not write telemetry for a robot the roster no longer admits', async () => {
    const roster = { isAdmitted: () => false };
    const { ingester, attributesManager, robotsColl } = ingesterFor({ roster });
    await ingester.onStatus(UUID, { states: ['IDLE'] });
    await ingester.onOdometry(UUID, { velocity: { linear: 0.4, angular: 0 } });
    await ingester.onBattery(UUID, { batterySoc: 0.5 });
    assert.deepStrictEqual(attributesManager.saved, []);
    assert.deepStrictEqual(robotsColl.updates, []);
  });
});

describe('iso-robots IsoTelemetryIngester customData', () => {
  const payload = JSON.stringify({
    timestamp: '2026-08-26T20:00:00.000Z', values: { echo: 'hello', battery_charging: 'true', n: 3 },
  });

  it('routes the pairs through the key-value path with the ISO custom field and the message timestamp', async () => {
    const { ingester, attributesManager } = ingesterFor();
    await ingester.onCustomData(UUID, payload);
    assert.deepStrictEqual(attributesManager.keyValues, [{
      robotId: UUID, customField: 'iso21423', ts: Date.parse('2026-08-26T20:00:00.000Z'),
      pairs: [{ key: 'echo', value: 'hello' }, { key: 'battery_charging', value: 'true' }, { key: 'n', value: '3' }],
    }]);
  });

  it('upserts robot_key_values for the Key-Values widget, skipping reserved keys', async () => {
    const keyValuesColl = fakeKeyValuesColl();
    const { ingester } = ingesterFor({ keyValuesColl });
    await ingester.onCustomData(UUID, JSON.stringify({ values: { echo: 'x', _id: 'evil' } }));
    assert.strictEqual(keyValuesColl.updates.length, 1);
    const { q, u, o } = keyValuesColl.updates[0];
    assert.deepStrictEqual(q, { _id: UUID });
    assert.deepStrictEqual(Object.keys(u.$set), ['echo']);
    assert.strictEqual(u.$set.echo.value, 'x');
    assert.deepStrictEqual(o, { upsert: true });
  });

  it('ignores malformed payloads, empty value maps and revoked robots', async () => {
    const { ingester, attributesManager } = ingesterFor();
    await ingester.onCustomData(UUID, 'not json');
    await ingester.onCustomData(UUID, JSON.stringify({ values: 'nope' }));
    await ingester.onCustomData(UUID, JSON.stringify({ values: {} }));
    const revoked = ingesterFor({ roster: { isAdmitted: () => false } });
    await revoked.ingester.onCustomData(UUID, payload);
    assert.strictEqual(attributesManager.keyValues.length + revoked.attributesManager.keyValues.length, 0);
  });
});

describe('iso-robots IsoTelemetryIngester observe', () => {
  it('unsubscribes every fulfilled subscription and rethrows when one subscribe rejects', async () => {
    const unsubscribeCalls = { status: 0, odometry: 0, batteryStatus: 0 };
    const spy = (name) => ({ unsubscribe: async () => { unsubscribeCalls[name] += 1; } });
    const client = {
      sdk: { EntityFilter: { entity: (u) => u } },
      subscribeResource: async (resource) => {
        if (resource === 'batteryStatus') throw new Error('subscribe failed');
        if (resource === 'status' || resource === 'odometry') return spy(resource);
        return spy('other');
      },
      subscribeEntities: async () => spy('other'),
    };
    const { ingester } = ingesterFor({ client });
    await assert.rejects(ingester.observe(UUID), /subscribe failed/);
    assert.strictEqual(unsubscribeCalls.status, 1);
    assert.strictEqual(unsubscribeCalls.odometry, 1);
    assert.strictEqual(ingester._subs.has(UUID), false);
  });
});

describe('iso-robots IsoTelemetryIngester onIdentity', () => {
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
});

describe('paths', () => {
  const plan = (pts) => ({ timestamp: new Date().toISOString(),
    globalPlan: pts.map(([x, y]) => ({ timestamp: new Date().toISOString(), locationPoint: { ccsId: CCS_ID, x, y, z: 0 } })) });
  it('onGlobalPlan converts CCS points into the map frame and writes paths["0"]', async () => {
    const localizationColl = fakeKeyValuesColl();
    const { ingester } = ingesterFor({ localizationColl });
    await ingester.onGlobalPlan(UUID, plan([[11, 12], [12, 12]]));   // TRANSLATION converter: ccs = map + 10
    assert.strictEqual(localizationColl.updates.length, 1);
    const { q, u, o } = localizationColl.updates[0];
    assert.deepStrictEqual(q, { _id: UUID }); assert.deepStrictEqual(o, { upsert: true });
    const path = u.$set['paths.0'];
    assert.deepStrictEqual(path.points, [{ x: 1, y: 2 }, { x: 2, y: 2 }]);
    assert.strictEqual(path.frameId, 'map');
    assert.strictEqual(path.ts, u.$set.pathsUpdatedTs);
    assert.ok(Number.isFinite(path.ts));
  });
  it('onLocalTrajectory writes paths["1"]; an empty trajectory clears it', async () => {
    const localizationColl = fakeKeyValuesColl();
    const { ingester } = ingesterFor({ localizationColl });
    await ingester.onLocalTrajectory(UUID, { timestamp: new Date().toISOString(), localTrajectory: [] });
    assert.deepStrictEqual(localizationColl.updates[0].u.$set['paths.1'].points, []);
  });
  it('drops non-finite points and does nothing when uncalibrated', async () => {
    const a = fakeKeyValuesColl();
    const { ingester } = ingesterFor({ localizationColl: a });
    await ingester.onGlobalPlan(UUID, { timestamp: 't', globalPlan: [
      { timestamp: 't', locationPoint: { ccsId: CCS_ID, x: 11, y: 12, z: 0 } },
      { timestamp: 't', locationPoint: { ccsId: CCS_ID, x: NaN, y: 12, z: 0 } }] });
    assert.deepStrictEqual(a.updates[0].u.$set['paths.0'].points, [{ x: 1, y: 2 }]);
    const b = fakeKeyValuesColl();
    const { ingester: unc } = ingesterFor({ localizationColl: b, converter: { calibrated: false, reason: 'no points' } });
    await unc.onGlobalPlan(UUID, plan([[11, 12]]));
    assert.strictEqual(b.updates.length, 0);
  });
  it('rate-limits writes per (robot, path) to one per ISO_PATH_MIN_MS, latest wins', async () => {
    const localizationColl = fakeKeyValuesColl();
    const { ingester } = ingesterFor({ localizationColl });
    const realNow = Date.now; let now = 1_000_000; Date.now = () => now;
    try {
      await ingester.onGlobalPlan(UUID, plan([[11, 12]]));        // written immediately
      now += 100; await ingester.onGlobalPlan(UUID, plan([[12, 12]]));  // deferred
      now += 100; await ingester.onGlobalPlan(UUID, plan([[13, 12]]));  // replaces the deferred one
      assert.strictEqual(localizationColl.updates.length, 1);
      await ingester.flushPendingPaths();                           // test hook: fire pending timers now
      assert.strictEqual(localizationColl.updates.length, 2);
      assert.deepStrictEqual(localizationColl.updates[1].u.$set['paths.0'].points, [{ x: 3, y: 2 }]);
    } finally { Date.now = realNow; ingester.flushPendingPaths(); }
  });
});
