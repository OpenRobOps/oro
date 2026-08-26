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
  return { saved, saveAttributeValues: async (args) => { saved.push(args); } };
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
