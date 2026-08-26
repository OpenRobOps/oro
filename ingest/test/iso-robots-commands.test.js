import assert from 'assert';

import { IsoCommandRouter, parseNavGoal } from '../src/server/isoRobots/commands';

const UUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CCS_ID = '22222222-2222-4222-8222-222222222222';

// ORO map (1,2) is CCS (11,12).
const converter = {
  calibrated: true,
  ccsId: CCS_ID,
  toLocationPoint: ({ x, y }) => ({ ccsId: CCS_ID, x: x + 10, y: y + 10, z: 0 }),
  toOrientation: ({ theta }) => ({ yaw: theta, pitch: 0, roll: 0 }),
};

// The SDK surface the router uses: the four action builders.
const sdk = {
  move: (props) => ({ type: 'move', properties: props }),
  pauseImr: () => ({ type: 'pauseImr', properties: {} }),
  resumeImr: () => ({ type: 'resumeImr', properties: {} }),
};

/** Stands in for IsoTelemetryIngester.lastCcsPose — `pose: null` means no odometry seen yet. */
const fakeTelemetry = (pose = { locationPoint: { ccsId: CCS_ID, x: 30, y: 40, z: 0 }, yaw: 1.25 }) =>
  ({ lastCcsPose: () => pose || undefined });

function fakeImrfm({ fail = null } = {}) {
  const sent = [];
  const handles = [];
  const diagnostics = [];
  return {
    sent,
    handles,
    diagnostics,
    ctx: { diagnostic: (code, data) => diagnostics.push({ code, data }) },
    sendRequest: async (cmd) => {
      sent.push(cmd);
      if (fail) throw new Error(fail);
      const handle = { requestUuid: `req-${sent.length}`, canceled: false,
        cancel: async () => { handle.canceled = true; } };
      handles.push(handle);
      return handle;
    },
  };
}

function fakeOroMqtt() {
  const listeners = {};
  const echoes = [];
  return {
    listeners,
    echoes,
    registerListener: (subtopic, cb) => { listeners[subtopic] = cb; },
    lookupType: () => ({ encode: (m) => ({ finish: () => Buffer.from(JSON.stringify(m)) }) }),
    publishProtobuf: async (robotId, subtopic, msg) => { echoes.push({ robotId, subtopic, msg }); },
  };
}

const TOPICS = {
  navGoal: 'ros/loc/nav_goal',
  cancelNav: 'ros/nav/goal_to_current_pose',
  pause: 'ros/fleet/pause',
  resume: 'ros/fleet/resume',
};

function routerFor(opts = {}) {
  const oroMqtt = opts.oroMqtt || fakeOroMqtt();
  const imrfm = opts.imrfm || fakeImrfm();
  return {
    oroMqtt,
    imrfm,
    router: new IsoCommandRouter({
      oroMqtt,
      imrfm,
      roster: { isAdmitted: () => true },
      converter,
      sdk,
      commandTopics: TOPICS,
      telemetry: fakeTelemetry(),
      ...opts,
    }),
  };
}

describe('iso-robots parseNavGoal', () => {
  it('parses the seq-prefixed five-field payload', () => {
    assert.deepStrictEqual(parseNavGoal('7|1756100000000|1.5|2.5|0.75'), {
      seq: '7', executionTs: 1756100000000, x: 1.5, y: 2.5, theta: 0.75,
    });
  });

  it('accepts a Buffer', () => {
    assert.strictEqual(parseNavGoal(Buffer.from('7|1|1|2|0')).x, 1);
  });

  it('parses negative and exponent-free decimals', () => {
    const p = parseNavGoal('12|1|-3.25|0|-1.5707963');
    assert.strictEqual(p.x, -3.25);
    assert.strictEqual(p.theta, -1.5707963);
  });

  it('returns null for the wrong field count or non-numeric coordinates', () => {
    assert.strictEqual(parseNavGoal('7|1|2|3'), null);
    assert.strictEqual(parseNavGoal('7|1|a|3|0'), null);
    assert.strictEqual(parseNavGoal(''), null);
    assert.strictEqual(parseNavGoal(undefined), null);
  });
});

describe('iso-robots IsoCommandRouter', () => {
  it('registers a listener for every configured subtopic', () => {
    const { router, oroMqtt } = routerFor();
    router.register();
    assert.deepStrictEqual(Object.keys(oroMqtt.listeners).sort(), [
      'ros/fleet/pause', 'ros/fleet/resume', 'ros/loc/nav_goal', 'ros/nav/goal_to_current_pose',
    ]);
  });

  it('does not register pause/resume when the deployment named no subtopics', () => {
    const { router, oroMqtt } = routerFor({
      commandTopics: { ...TOPICS, pause: null, resume: null },
    });
    router.register();
    assert.deepStrictEqual(Object.keys(oroMqtt.listeners).sort(), [
      'ros/loc/nav_goal', 'ros/nav/goal_to_current_pose',
    ]);
  });

  it('echoes first, then sends an ISO move in the facility CCS', async () => {
    const { router, oroMqtt, imrfm } = routerFor();
    await router.onNavGoal(UUID, Buffer.from('7|1756100000000|1|2|0.75'));

    assert.strictEqual(oroMqtt.echoes.length, 1, 'the app is waiting for this echo');
    assert.deepStrictEqual(
      [oroMqtt.echoes[0].robotId, oroMqtt.echoes[0].subtopic], [UUID, 'echo']);
    assert.strictEqual(oroMqtt.echoes[0].msg.topic, 'ros/loc/nav_goal');
    assert.strictEqual(oroMqtt.echoes[0].msg.stringPayload, '7|1756100000000|1|2|0.75');

    assert.strictEqual(imrfm.sent.length, 1);
    assert.strictEqual(imrfm.sent[0].destination, UUID);
    assert.strictEqual(imrfm.sent[0].destinationType, 'IMR');
    const detail = imrfm.sent[0].details[0];
    assert.strictEqual(detail.type, 'move');
    assert.deepStrictEqual(detail.properties.location, { ccsId: CCS_ID, x: 11, y: 12, z: 0 });
    assert.strictEqual(detail.properties.orientation.yaw, 0.75);
  });

  it('ignores a robot that is not admitted, and does not echo it', async () => {
    const { router, oroMqtt, imrfm } = routerFor({ roster: { isAdmitted: () => false } });
    await router.onNavGoal(UUID, Buffer.from('7|1|1|2|0'));
    assert.deepStrictEqual(imrfm.sent, []);
    assert.deepStrictEqual(oroMqtt.echoes, []);
  });

  it('ignores a malformed payload without echoing, so the app fails loudly', async () => {
    const { router, oroMqtt, imrfm } = routerFor();
    await router.onNavGoal(UUID, Buffer.from('garbage'));
    assert.deepStrictEqual(imrfm.sent, []);
    assert.deepStrictEqual(oroMqtt.echoes, []);
  });

  it('refuses a move while the CCS is uncalibrated, without echoing', async () => {
    const { router, oroMqtt, imrfm } = routerFor({
      converter: { calibrated: false, reason: 'no points' },
    });
    await router.onNavGoal(UUID, Buffer.from('7|1|1|2|0'));
    assert.deepStrictEqual(imrfm.sent, []);
    assert.deepStrictEqual(oroMqtt.echoes, []);
  });

  it('still echoes when the ISO request itself fails, since the command was received', async () => {
    const { router, oroMqtt } = routerFor({ imrfm: fakeImrfm({ fail: 'broker down' }) });
    await router.onNavGoal(UUID, Buffer.from('7|1|1|2|0'));
    assert.strictEqual(oroMqtt.echoes.length, 1);
  });

  it('cancels the in-flight move when a cancel-nav arrives', async () => {
    const { router, imrfm } = routerFor();
    await router.onNavGoal(UUID, Buffer.from('7|1|1|2|0'));
    await router.onCancelNav(UUID);
    assert.strictEqual(imrfm.handles[0].canceled, true);
    assert.strictEqual(imrfm.sent.length, 1, 'cancel goes through the handle, not a new request');
  });

  it('with nothing in flight, moves the robot to its current position — not pauseImr', async () => {
    const { router, imrfm } = routerFor();
    await router.onCancelNav(UUID);
    assert.strictEqual(imrfm.sent.length, 1);
    const detail = imrfm.sent[0].details[0];
    assert.strictEqual(detail.type, 'move', 'pauseImr would resume navigating on resumeImr');
    // The last odometry point, reused verbatim in its own CCS frame — no transform in the path.
    assert.deepStrictEqual(detail.properties.location, { ccsId: CCS_ID, x: 30, y: 40, z: 0 });
    assert.strictEqual(detail.properties.orientation.yaw, 1.25);
  });

  it('forgets the in-flight move once cancelled, so a second cancel stops in place', async () => {
    const { router, imrfm } = routerFor();
    await router.onNavGoal(UUID, Buffer.from('7|1|1|2|0'));
    await router.onCancelNav(UUID);
    await router.onCancelNav(UUID);
    const last = imrfm.sent[imrfm.sent.length - 1].details[0];
    assert.strictEqual(last.type, 'move');
    assert.deepStrictEqual(last.properties.location, { ccsId: CCS_ID, x: 30, y: 40, z: 0 });
  });

  it('no-ops with a diagnostic when no odometry has ever been seen', async () => {
    const { router, imrfm } = routerFor({ telemetry: fakeTelemetry(null) });
    await router.onCancelNav(UUID);
    assert.deepStrictEqual(imrfm.sent, [], 'must not fabricate a goal');
    assert.deepStrictEqual(imrfm.diagnostics.map((d) => d.code), ['cancel-nav-no-pose']);
  });

  it('sends pauseImr and resumeImr for the configured subtopics', async () => {
    const { router, imrfm } = routerFor();
    await router.onPause(UUID);
    await router.onResume(UUID);
    assert.deepStrictEqual(imrfm.sent.map((c) => c.details[0].type), ['pauseImr', 'resumeImr']);
  });

  it('never lets a send failure escape onto the MQTT callback', async () => {
    const { router } = routerFor({ imrfm: fakeImrfm({ fail: 'broker down' }) });
    await router.onPause(UUID);
    await router.onCancelNav(UUID);
  });
});
