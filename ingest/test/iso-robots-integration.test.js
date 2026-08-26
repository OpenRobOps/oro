import assert from 'assert';
import fs from 'fs';
import os from 'os';
import path from 'path';
import * as sinon from 'sinon';

// eslint-disable-next-line import/no-unresolved
import { MemoryBroker } from '@openrobops/iso21423/testing';
// eslint-disable-next-line import/no-unresolved
import { Iso21423Client } from '@openrobops/iso21423';

import MongoManager from '../src/mongo';
import AttributesManager from '../src/server/attributes';
import InMemoryWorkerQueues from '../src/server/queues/memoryWorkerQueue';
import IsoRobotsModule from '../src/server/isoRobots';
import MqttMock from './mocks/mqtt';
import { COLLECTIONS } from '../src/shared/constants';

// Controller ruling R4: a fresh state dir before any Iso21423Client connects, so neither the
// module's client nor the simulated robots below write SDK sequence state to the developer's
// home directory (the SDK defaults FileSequenceStore to `~/.iso21423`).
process.env.ISO21423_STATE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'iso-robots-'));

const ROBOT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const STRANGER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const IMRFM = '11111111-1111-4111-8111-111111111111';
const CCS_ID = '22222222-2222-4222-8222-222222222222';

const SETTINGS = {
  ccs: {
    id: CCS_ID,
    name: 'test-facility',
    referencePoints: [
      { id: 'a', map: { x: 0, y: 0 }, ccs: { x: 10, y: 10 } },
      { id: 'b', map: { x: 4, y: 0 }, ccs: { x: 14, y: 10 } },
      { id: 'c', map: { x: 0, y: 3 }, ccs: { x: 10, y: 13 } },
    ],
  },
  robots: {
    enabled: true,
    imrfmId: IMRFM,
    broker: { url: 'mqtt://unused' },   // ignored: the test injects a MemoryTransport
    mqtt: { username: 'iso-fleet', password: 'pw' },
    rosterPollMs: 60000,
  },
};

const settle = () => new Promise((r) => setTimeout(r, 40));
const coll = (name) => new MongoManager().getCollection(name);

/** Registers a simulated ISO robot that publishes its own identity, as a real IMR does. */
async function simulatedRobot(broker, uuid, accepts = ['move', 'pauseImr', 'resumeImr', 'cancelRequest']) {
  const client = await Iso21423Client.connect({ transport: broker.createTransport() });
  const handle = await client.registerSelfEntity({
    entityUuid: uuid,
    entityType: 'IMR',
    manufacturerName: 'Acme',
    capabilities: { provides: [], accepts },
  });
  return { client, handle };
}

describe('iso-robots integration', () => {
  let broker; let module_; let oroMqtt; let queue; let robot;

  beforeEach(async () => {
    const mongo = new MongoManager();
    await coll(COLLECTIONS.ROBOTS).deleteMany({});
    await coll(COLLECTIONS.ATTR_VALUES).deleteMany({});
    await coll(COLLECTIONS.ATTRIBUTE_DEFINITIONS).deleteMany({});
    // Attribute definitions so saveAttributeValues can parse and persist.
    await coll(COLLECTIONS.ATTRIBUTE_DEFINITIONS).insertMany(
      ['agentOnline', 'pose', 'speedLinear', 'speedAngular', 'batteryPercentage']
        .map((attributeId) => ({ attributeId, definition: { label: attributeId } })));
    // Gate 2: admit the robot, not the stranger.
    await coll(COLLECTIONS.ROBOTS).insertOne({
      _id: ROBOT, name: 'Lift-9', version: 'iso-21423-v1', updateStamp: Date.now(),
      status: { agentOnline: false },
    });

    broker = new MemoryBroker();
    queue = new InMemoryWorkerQueues();
    await queue.init({});
    await new AttributesManager().init({ workerQueue: queue });

    oroMqtt = new MqttMock();
    oroMqtt.listeners = {};
    oroMqtt.echoes = [];
    oroMqtt.registerListener = (subtopic, cb) => { oroMqtt.listeners[subtopic] = cb; };
    oroMqtt.publishProtobuf = async (robotId, subtopic, msg) => {
      oroMqtt.echoes.push({ robotId, subtopic, msg });
    };

    module_ = new IsoRobotsModule({ mongo, mqtt: oroMqtt, workerQueue: queue });
    await module_.load(SETTINGS, { transport: broker.createTransport() });
    robot = await simulatedRobot(broker, ROBOT);
    await settle();
  });

  afterEach(async () => {
    await robot.client.close();
    await module_.shutdown();
  });

  it('registers ORO as an IMRFM and claims no managed entities', async () => {
    const health = await module_.reportHealth();
    assert.strictEqual(health.status, 'UP');
    assert.strictEqual(health.ccs, 'calibrated');
    const identity = JSON.parse(
      broker.retainedOn(`/ISO_21423/v1/IMRFM/${IMRFM}/identity`).toString());
    assert.deepStrictEqual(identity.capabilities.manages || [], []);
  });

  it('admits the robot from the robots collection', async () => {
    assert.strictEqual((await module_.reportHealth()).admitted, 1);
  });

  it('ingests ISO status into ORO attributes and the robot document', async () => {
    await robot.handle.publishStatus({ states: ['MODE_AUTO', 'IDLE'] });
    await settle();
    const values = await coll(COLLECTIONS.ATTR_VALUES).findOne({ _id: ROBOT });
    assert.strictEqual(values.agentOnline.value, true);
    const doc = await coll(COLLECTIONS.ROBOTS).findOne({ _id: ROBOT });
    assert.strictEqual(doc.status.agentOnline, true);
  });

  it('converts inbound odometry out of the CCS into the ORO map frame', async () => {
    await robot.handle.publishOdometry({
      pose: {
        locationPoint: { ccsId: CCS_ID, x: 11, y: 12, z: 0 },
        orientation: { yaw: 0.5, pitch: 0, roll: 0 },
      },
      velocity: { linear: 0.4, angular: -0.1 },
    });
    await settle();
    const values = await coll(COLLECTIONS.ATTR_VALUES).findOne({ _id: ROBOT });
    assert.ok(Math.abs(values.pose.value.x - 1) < 1e-6, JSON.stringify(values.pose.value));
    assert.ok(Math.abs(values.pose.value.y - 2) < 1e-6);
    assert.strictEqual(values.speedLinear.value, 0.4);
  });

  it('ingests battery as an ORO percentage', async () => {
    await robot.handle.publishBatteryStatus({ batterySoc: 0.42 });
    await settle();
    const values = await coll(COLLECTIONS.ATTR_VALUES).findOne({ _id: ROBOT });
    assert.strictEqual(values.batteryPercentage.value, 42);
  });

  it('publishes to the attributes exchange, which is what the Upstream direction taps', async () => {
    const seen = [];
    queue.buildExchangeDirect('attributes');
    await queue.bindQueue('attributes', 'update-values', 'iso-robots-test', { durable: true });
    await queue.subscribeRaw('iso-robots-test', () => seen.push(1));
    await robot.handle.publishStatus({ states: ['MODE_AUTO', 'IDLE'] });
    await settle();
    assert.ok(seen.length >= 1, 'no attributes-exchange publication');
  });

  it('ignores a robot that is on the network but not admitted', async () => {
    const stranger = await simulatedRobot(broker, STRANGER);
    await stranger.handle.publishStatus({ states: ['MODE_AUTO', 'IDLE'] });
    await settle();
    assert.strictEqual(await coll(COLLECTIONS.ATTR_VALUES).countDocuments({ _id: STRANGER }), 0);
    await stranger.client.close();
  });

  it('turns an ORO nav goal into an ISO move, and echoes it', async () => {
    const received = [];
    await robot.handle.onRequest('move', async (action, ctx) => {
      received.push(action.properties);
      return ctx.succeeded();
    });
    await settle();

    // What the app publishes: "<seq>|<executionTs>|<x>|<y>|<theta>" in the ORO map frame.
    await oroMqtt.listeners['ros/loc/nav_goal'](ROBOT, Buffer.from(`7|${Date.now()}|1|2|0.5`));
    await settle();

    assert.strictEqual(received.length, 1);
    assert.strictEqual(received[0].location.ccsId, CCS_ID);
    assert.ok(Math.abs(received[0].location.x - 11) < 1e-6);
    assert.ok(Math.abs(received[0].location.y - 12) < 1e-6);

    assert.strictEqual(oroMqtt.echoes.length, 1, 'the app would time out without this echo');
    assert.strictEqual(oroMqtt.echoes[0].subtopic, 'echo');
    assert.ok(oroMqtt.echoes[0].msg.stringPayload.startsWith('7|'));
  });

  it('turns an ORO cancel-nav with nothing in flight into a move to the current position', async () => {
    const received = [];
    await robot.handle.onRequest('move', async (action, ctx) => {
      received.push(action.properties.location);
      return ctx.succeeded();
    });
    // The robot must have reported a pose, or cancel-nav correctly no-ops.
    await robot.handle.publishOdometry({
      pose: {
        locationPoint: { ccsId: CCS_ID, x: 17, y: 19, z: 0 },
        orientation: { yaw: 0.25, pitch: 0, roll: 0 },
      },
      velocity: { linear: 0, angular: 0 },
    });
    await settle();

    await oroMqtt.listeners['ros/nav/goal_to_current_pose'](ROBOT);
    await settle();

    assert.strictEqual(received.length, 1);
    // Verbatim round trip: the point the robot published comes straight back, untransformed.
    assert.deepStrictEqual(received[0], { ccsId: CCS_ID, x: 17, y: 19, z: 0 });
  });

  it('ignores a cancel-nav for a robot that has never reported a pose', async () => {
    const received = [];
    await robot.handle.onRequest('move', async (a, ctx) => { received.push(a); return ctx.succeeded(); });
    await settle();
    await oroMqtt.listeners['ros/nav/goal_to_current_pose'](ROBOT);
    await settle();
    assert.deepStrictEqual(received, []);
  });

  it('sends nothing to an unadmitted robot', async () => {
    const stranger = await simulatedRobot(broker, STRANGER);
    const received = [];
    await stranger.handle.onRequest('move', async (a, ctx) => {
      received.push(a.type); return ctx.succeeded();
    });
    await settle();
    await oroMqtt.listeners['ros/nav/goal_to_current_pose'](STRANGER);
    await settle();
    assert.deepStrictEqual(received, []);
    await stranger.client.close();
  });

  it('stops observing a robot whose admission was revoked', async () => {
    await coll(COLLECTIONS.ROBOTS).deleteOne({ _id: ROBOT });
    const diff = await module_._roster.refresh();
    assert.deepStrictEqual(diff.revoked, [ROBOT]);
    assert.strictEqual((await module_.reportHealth()).admitted, 0);
  });

  it('reports OFF and touches nothing when disabled', async () => {
    const off = new IsoRobotsModule({
      mongo: new MongoManager(), mqtt: oroMqtt, workerQueue: queue,
    });
    await off.load({ robots: { enabled: false } });
    assert.strictEqual((await off.reportHealth()).status, 'OFF');
    await off.shutdown();
  });

  it('does not warn about an admitted robot whose identity was already retained before load '
    + '(roster must start before the fleet-wide identity watch replays retained identities)', async () => {
    const freshBroker = new MemoryBroker();
    const preAdmitted = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    await coll(COLLECTIONS.ROBOTS).insertOne({
      _id: preAdmitted, name: 'Pre-connected', version: 'iso-21423-v1', updateStamp: Date.now(),
      status: { agentOnline: false },
    });
    // Simulates a production restart: the robot's identity is retained on the broker BEFORE
    // ORO's module even connects, so the SDK replays it synchronously as soon as
    // subscribeEntities is called (client.ts: subscribeEntities iterates the already-warm cache).
    const preConnected = await simulatedRobot(freshBroker, preAdmitted);

    const freshModule = new IsoRobotsModule({
      mongo: new MongoManager(), mqtt: oroMqtt, workerQueue: queue,
    });
    await freshModule.load(SETTINGS, { transport: freshBroker.createTransport() });
    await settle();

    assert.ok(!freshModule._seenUnadmitted.has(preAdmitted),
      'a robot already admitted in Mongo before load() must never land in seenUnadmitted');

    await preConnected.client.close();
    await freshModule.shutdown();
  });

  it('closes the client when load() fails after connecting, instead of leaking the session', async () => {
    const freshBroker = new MemoryBroker();
    const sandbox = sinon.createSandbox();
    const closeSpy = sandbox.spy(Iso21423Client.prototype, 'close');
    // Fails the roster's first refresh — a real post-connect failure (registerSelfEntity,
    // subscribeEntities and the identity watch all already succeeded by this point).
    const brokenMongo = {
      getCollection: (name) => (name === COLLECTIONS.ROBOTS
        ? { find: () => { throw new Error('mongo down'); } }
        : coll(name)),
    };
    const failing = new IsoRobotsModule({ mongo: brokenMongo, mqtt: oroMqtt, workerQueue: queue });
    try {
      await failing.load(SETTINGS, { transport: freshBroker.createTransport() });
      assert.strictEqual(failing._client, null, 'client must be nulled after a failed load');
      assert.ok(closeSpy.calledOnce, 'load() must close the client it connected before failing');
    } finally {
      sandbox.restore();
    }
  });
});
