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
 * Unit tests for UpstreamRobotClient's retained-message buffering: retained
 * messages received before the upstream connection is ready must be remembered
 * and replayed on 'connect', since the local broker only delivers them once.
 */
import assert from 'assert';

import { UpstreamRobotClient } from '../src/server/modules/upstream';

const noopLogger = { log: () => {}, warn: () => {}, error: () => {} };

function makeClient({
  publishRetained = true, oroMqtt, eventLogColl, downstreamCommands,
} = {}) {
  return new UpstreamRobotClient({
    localRobotId: 'local1',
    upstreamRobotId: 'up1',
    api: { baseUrl: 'https://example.com', apiKey: 'k' },
    brokerOptions: {},
    credentialEncryptionKey: 'x'.repeat(64),
    credsColl: {},
    denySubtopics: new Set(['in_cmd']),
    downstreamCommands,
    publishRetained,
    localBrokerConfig: {},
    logging: false,
    throttledLogger: noopLogger,
    oroMqtt,
    eventLogColl,
  });
}

// A fake event-log mongo collection recording inserted documents.
function makeFakeEventLog() {
  const inserted = [];
  return {
    inserted,
    insertOne(doc) { inserted.push(doc); return Promise.resolve({ acknowledged: true }); },
  };
}

// A fake oroMqtt exposing lookupType, returning decoders keyed by proto type name.
function makeFakeOroMqtt(decoders) {
  return {
    lookupType(name) {
      const decode = decoders[name];
      if (!decode) throw new Error(`no such type ${name}`);
      return { decode };
    },
  };
}

// A fake upstream mqtt client that records publishes and invokes the callback.
function makeFakeUpstream() {
  const published = [];
  return {
    published,
    publish(topic, payload, options, cb) {
      published.push({ topic, payload, options });
      if (cb) cb();
    },
  };
}

// A fake oroMqtt whose `oro.Echo` type round-trips through JSON, so tests can
// build a robot echo and inspect the reconstructed echo the forwarder publishes.
// `decode`/`encode` mirror protobufjs: `echo.payload` names the populated oneof
// field, and `create({ stringPayload })` maps to that oneof.
function makeEchoOroMqtt() {
  const EchoType = {
    decode: (buf) => {
      const obj = JSON.parse(buf.toString());
      return { ...obj, payload: 'stringPayload' };
    },
    create: ({ timeStamp, topic, stringPayload }) => ({ timeStamp, topic, stringPayload }),
    encode: (msg) => ({ finish: () => Buffer.from(JSON.stringify(msg)) }),
  };
  return {
    lookupType(name) {
      if (name !== 'oro.Echo') throw new Error(`no such type ${name}`);
      return EchoType;
    },
  };
}

// Build a robot-echo buffer the makeEchoOroMqtt decoder understands.
function makeRobotEcho(stringPayload, timeStamp = 1000) {
  return Buffer.from(JSON.stringify({ stringPayload, timeStamp }));
}

describe('UpstreamRobotClient retained-message buffering', () => {
  it('buffers retained messages received while upstream is not connected', () => {
    const client = makeClient();
    // Not connected yet.
    client._forward('r/local1/state', Buffer.from('online'), { retain: true, qos: 1 });

    assert.strictEqual(client._retainedMessages.size, 1);
    const entry = client._retainedMessages.get('r/up1/state');
    assert.ok(entry, 'expected retained entry keyed by upstream topic');
    assert.strictEqual(entry.payload.toString(), 'online');
    assert.strictEqual(entry.qos, 1);
  });

  it('does not buffer non-retained messages', () => {
    const client = makeClient();
    client._forward('r/local1/pose', Buffer.from('1,2,3'), { retain: false, qos: 0 });
    assert.strictEqual(client._retainedMessages.size, 0);
  });

  it('replays buffered retained messages on connect, with retain=true', () => {
    const client = makeClient();
    client._forward('r/local1/state', Buffer.from('online'), { retain: true, qos: 1 });

    const fake = makeFakeUpstream();
    client._upstreamClient = fake;
    client._connected = true;
    client._flushRetainedMessages();

    assert.strictEqual(fake.published.length, 1);
    const pub = fake.published[0];
    assert.strictEqual(pub.topic, 'r/up1/state');
    assert.strictEqual(pub.payload.toString(), 'online');
    assert.strictEqual(pub.options.qos, 1);
    assert.strictEqual(pub.options.retain, true);
  });

  it('keeps only the latest retained value per topic', () => {
    const client = makeClient();
    client._forward('r/local1/state', Buffer.from('first'), { retain: true, qos: 0 });
    client._forward('r/local1/state', Buffer.from('second'), { retain: true, qos: 0 });
    assert.strictEqual(client._retainedMessages.size, 1);
    assert.strictEqual(client._retainedMessages.get('r/up1/state').payload.toString(), 'second');
  });

  it('clears the buffered retained value when an empty retained payload arrives', () => {
    const client = makeClient();
    client._forward('r/local1/state', Buffer.from('online'), { retain: true, qos: 0 });
    assert.strictEqual(client._retainedMessages.size, 1);
    // Empty payload with retain flag clears the retained message (MQTT semantics).
    client._forward('r/local1/state', Buffer.alloc(0), { retain: true, qos: 0 });
    assert.strictEqual(client._retainedMessages.size, 0);
  });

  it('does not buffer messages on denied subtopics', () => {
    const client = makeClient();
    client._forward('r/local1/in_cmd', Buffer.from('x'), { retain: true, qos: 0 });
    assert.strictEqual(client._retainedMessages.size, 0);
  });

  it('replays with retain=false when publishRetained is disabled', () => {
    const client = makeClient({ publishRetained: false });
    client._forward('r/local1/state', Buffer.from('online'), { retain: true, qos: 0 });

    const fake = makeFakeUpstream();
    client._upstreamClient = fake;
    client._connected = true;
    client._flushRetainedMessages();

    assert.strictEqual(fake.published.length, 1);
    assert.strictEqual(fake.published[0].options.retain, false);
  });
});

describe('UpstreamRobotClient downstream command delivery', () => {
  it('republishes an upstream custom_command/ros to the local robot', () => {
    const client = makeClient();
    const fakeLocal = makeFakeUpstream();
    client._localClient = fakeLocal;

    client._handleUpstreamMessage('r/up1/custom_command/ros', Buffer.from('cmd'), { qos: 0 });

    assert.strictEqual(fakeLocal.published.length, 1);
    const pub = fakeLocal.published[0];
    assert.strictEqual(pub.topic, 'r/local1/custom_command/ros');
    assert.strictEqual(pub.payload.toString(), 'cmd');
    assert.strictEqual(pub.options.retain, false);
  });

  it('republishes an upstream custom_command/script/command to the local robot', () => {
    const client = makeClient();
    const fakeLocal = makeFakeUpstream();
    client._localClient = fakeLocal;

    client._handleUpstreamMessage('r/up1/custom_command/script/command', Buffer.from('s'), { qos: 1 });

    assert.strictEqual(fakeLocal.published.length, 1);
    assert.strictEqual(fakeLocal.published[0].topic, 'r/local1/custom_command/script/command');
    assert.strictEqual(fakeLocal.published[0].options.qos, 1);
  });

  it('ignores upstream status feedback (custom_command/script/status)', () => {
    const client = makeClient();
    const fakeLocal = makeFakeUpstream();
    client._localClient = fakeLocal;

    client._handleUpstreamMessage('r/up1/custom_command/script/status', Buffer.from('x'), { qos: 0 });

    assert.strictEqual(fakeLocal.published.length, 0);
  });

  it('ignores upstream messages outside the upstream robot prefix', () => {
    const client = makeClient();
    const fakeLocal = makeFakeUpstream();
    client._localClient = fakeLocal;

    client._handleUpstreamMessage('r/otherbot/custom_command/ros', Buffer.from('x'), { qos: 0 });

    assert.strictEqual(fakeLocal.published.length, 0);
  });

  it('does not forward downstream command subtopics back upstream (no echo loop)', () => {
    const client = makeClient();
    const fake = makeFakeUpstream();
    client._upstreamClient = fake;
    client._connected = true;

    // This would be our own downstream-injected command echoing off the local broker.
    client._forward('r/local1/custom_command/ros', Buffer.from('cmd'), { retain: false, qos: 0 });

    assert.strictEqual(fake.published.length, 0);
  });

  it('still forwards custom_command/script/status feedback upstream', () => {
    const client = makeClient();
    const fake = makeFakeUpstream();
    client._upstreamClient = fake;
    client._connected = true;

    client._forward('r/local1/custom_command/script/status', Buffer.from('s'), { retain: false, qos: 0 });

    assert.strictEqual(fake.published.length, 1);
    assert.strictEqual(fake.published[0].topic, 'r/up1/custom_command/script/status');
  });

  it('delivers an upstream in_cmd restart to the local robot', () => {
    const client = makeClient();
    const fakeLocal = makeFakeUpstream();
    client._localClient = fakeLocal;

    client._handleUpstreamMessage('r/up1/in_cmd', Buffer.from('restart'), { qos: 0 });

    assert.strictEqual(fakeLocal.published.length, 1);
    assert.strictEqual(fakeLocal.published[0].topic, 'r/local1/in_cmd');
    assert.strictEqual(fakeLocal.published[0].payload.toString(), 'restart');
  });

  it('relays an upstream in_cmd ping to the robot, rewriting the seq to a negative value', () => {
    const client = makeClient();
    const fakeLocal = makeFakeUpstream();
    client._localClient = fakeLocal;

    // Echo pings are sent as '<seq>|' by the callback mechanism. We rewrite the
    // seq to a forwarder-local negative value (so the robot's echo can be routed
    // back to the upstream server) and record the mapping (see _handleRobotEcho).
    client._handleUpstreamMessage('r/up1/in_cmd', Buffer.from('42|'), { qos: 0 });

    assert.strictEqual(fakeLocal.published.length, 1);
    assert.strictEqual(fakeLocal.published[0].topic, 'r/local1/in_cmd');
    assert.strictEqual(fakeLocal.published[0].payload.toString(), '-1|');
    assert.deepStrictEqual(client._callbackTable.get('-1'), { upstreamSeq: '42', subtopic: 'in_cmd' });
  });

  it('ignores other upstream in_cmd commands (e.g. update)', () => {
    const client = makeClient();
    const fakeLocal = makeFakeUpstream();
    client._localClient = fakeLocal;

    client._handleUpstreamMessage('r/up1/in_cmd', Buffer.from('update'), { qos: 0 });

    assert.strictEqual(fakeLocal.published.length, 0);
  });

  it('does not forward in_cmd back upstream (no echo loop)', () => {
    const client = makeClient();
    const fake = makeFakeUpstream();
    client._upstreamClient = fake;
    client._connected = true;

    client._forward('r/local1/in_cmd', Buffer.from('restart'), { retain: false, qos: 0 });

    assert.strictEqual(fake.published.length, 0);
  });
});

describe('UpstreamRobotClient downstream allow-list (defaults + config)', () => {
  const DEFAULT_DELIVERED = [
    'ros/teleop/step',
    'ros/teleop/go',
    'ros/loc/set_pose',
    'ros/loc/nav_goal',
    'ros/nav/goal_path',
    'ros/nav/goal_to_current_pose',
    'ros/loc/mapreq',
    'ros/rosbag/upload',
    'ros/databag/upload',
  ];

  it('delivers teleop, navigation, and upload commands downstream by default', () => {
    const client = makeClient();
    const fakeLocal = makeFakeUpstream();
    client._localClient = fakeLocal;

    for (const sub of DEFAULT_DELIVERED) {
      client._handleUpstreamMessage(`r/up1/${sub}`, Buffer.from('x'), { qos: 0 });
    }

    assert.deepStrictEqual(
      fakeLocal.published.map((p) => p.topic),
      DEFAULT_DELIVERED.map((s) => `r/local1/${s}`)
    );
    // Commands are never retained on the local broker.
    assert.ok(fakeLocal.published.every((p) => p.options.retain === false));
  });

  it('does not deliver modules/set_state downstream by default (intentional omission)', () => {
    const client = makeClient();
    const fakeLocal = makeFakeUpstream();
    client._localClient = fakeLocal;

    client._handleUpstreamMessage('r/up1/modules/set_state', Buffer.from('{}'), { qos: 0 });

    assert.strictEqual(fakeLocal.published.length, 0);
  });

  it('restricts in_cmd to restart and get_state by default', () => {
    const client = makeClient();
    const fakeLocal = makeFakeUpstream();
    client._localClient = fakeLocal;

    client._handleUpstreamMessage('r/up1/in_cmd', Buffer.from('get_state'), { qos: 0 });
    client._handleUpstreamMessage('r/up1/in_cmd', Buffer.from('load_module|foo|5'), { qos: 0 });

    assert.strictEqual(fakeLocal.published.length, 1);
    assert.strictEqual(fakeLocal.published[0].payload.toString(), 'get_state');
  });

  it('honors a config-provided downstreamCommands allow-list', () => {
    const client = makeClient({
      downstreamCommands: [
        { subtopic: 'ros/teleop/go' },
        { subtopic: 'modules/set_state' },
      ],
    });
    const fakeLocal = makeFakeUpstream();
    client._localClient = fakeLocal;

    // Now opted in via config.
    client._handleUpstreamMessage('r/up1/modules/set_state', Buffer.from('{}'), { qos: 0 });
    // Not in the custom list anymore, so it must not be delivered.
    client._handleUpstreamMessage('r/up1/custom_command/ros', Buffer.from('x'), { qos: 0 });

    assert.strictEqual(fakeLocal.published.length, 1);
    assert.strictEqual(fakeLocal.published[0].topic, 'r/local1/modules/set_state');
  });

  it('applies the acceptsPayloads filter from config', () => {
    const client = makeClient({
      downstreamCommands: [{ subtopic: 'in_cmd', acceptsPayloads: ['update'] }],
    });
    const fakeLocal = makeFakeUpstream();
    client._localClient = fakeLocal;

    client._handleUpstreamMessage('r/up1/in_cmd', Buffer.from('update'), { qos: 0 });
    client._handleUpstreamMessage('r/up1/in_cmd', Buffer.from('restart'), { qos: 0 });

    assert.strictEqual(fakeLocal.published.length, 1);
    assert.strictEqual(fakeLocal.published[0].payload.toString(), 'update');
  });

  it('an explicit empty allow-list disables downstream command delivery', () => {
    const client = makeClient({ downstreamCommands: [] });
    const fakeLocal = makeFakeUpstream();
    client._localClient = fakeLocal;

    client._handleUpstreamMessage('r/up1/custom_command/ros', Buffer.from('x'), { qos: 0 });

    assert.strictEqual(fakeLocal.published.length, 0);
  });

  it('still prevents downstream-injected commands from looping back upstream', () => {
    const client = makeClient();
    const fake = makeFakeUpstream();
    client._upstreamClient = fake;
    client._connected = true;

    // A newly-allowed downstream command echoing off the local broker.
    client._forward('r/local1/ros/teleop/go', Buffer.from('go'), { retain: false, qos: 0 });

    assert.strictEqual(fake.published.length, 0);
  });
});

describe('UpstreamRobotClient command callback relay (seq translation)', () => {
  it('rewrites an echo-awaiting command seq to a negative value and records the mapping', () => {
    const client = makeClient();
    const fakeLocal = makeFakeUpstream();
    client._localClient = fakeLocal;

    client._handleUpstreamMessage('r/up1/ros/loc/nav_goal', Buffer.from('42|1720|1.5|2.3|0.5'), { qos: 0 });

    assert.strictEqual(fakeLocal.published.length, 1);
    assert.strictEqual(fakeLocal.published[0].topic, 'r/local1/ros/loc/nav_goal');
    assert.strictEqual(fakeLocal.published[0].payload.toString(), '-1|1720|1.5|2.3|0.5');
    assert.deepStrictEqual(
      client._callbackTable.get('-1'),
      { upstreamSeq: '42', subtopic: 'ros/loc/nav_goal' }
    );
  });

  it('translates the robot echo back to the upstream seq and publishes it upstream', () => {
    const client = makeClient({ oroMqtt: makeEchoOroMqtt() });
    const fakeLocal = makeFakeUpstream();
    const fakeUpstream = makeFakeUpstream();
    client._localClient = fakeLocal;
    client._upstreamClient = fakeUpstream;
    client._connected = true;

    client._handleUpstreamMessage('r/up1/ros/loc/nav_goal', Buffer.from('42|1720|1.5|2.3|0.5'), { qos: 0 });
    client._handleRobotEcho(makeRobotEcho('-1|1720|1.5|2.3|0.5', 999));

    assert.strictEqual(fakeUpstream.published.length, 1);
    const pub = fakeUpstream.published[0];
    assert.strictEqual(pub.topic, 'r/up1/echo');
    const echoed = JSON.parse(pub.payload.toString());
    assert.strictEqual(echoed.stringPayload, '42|1720|1.5|2.3|0.5');
    assert.strictEqual(echoed.topic, 'r/up1/ros/loc/nav_goal');
    assert.strictEqual(echoed.timeStamp, 999); // robot's own timestamp preserved
  });

  it('round-trips an in_cmd ping (rewrite + echo translate)', () => {
    const client = makeClient({ oroMqtt: makeEchoOroMqtt() });
    const fakeLocal = makeFakeUpstream();
    const fakeUpstream = makeFakeUpstream();
    client._localClient = fakeLocal;
    client._upstreamClient = fakeUpstream;
    client._connected = true;

    client._handleUpstreamMessage('r/up1/in_cmd', Buffer.from('55|'), { qos: 0 });
    assert.strictEqual(fakeLocal.published[0].payload.toString(), '-1|');

    client._handleRobotEcho(makeRobotEcho('-1|', 777));
    assert.strictEqual(fakeUpstream.published.length, 1);
    assert.strictEqual(
      JSON.parse(fakeUpstream.published[0].payload.toString()).stringPayload,
      '55|'
    );
  });

  it('ignores a robot echo whose seq we did not forward (local-ORO command)', () => {
    const client = makeClient({ oroMqtt: makeEchoOroMqtt() });
    const fakeUpstream = makeFakeUpstream();
    client._upstreamClient = fakeUpstream;
    client._connected = true;

    // Positive seq (a local-ORO-originated command) is never in our negative table.
    client._handleRobotEcho(makeRobotEcho('7|some-result'));

    assert.strictEqual(fakeUpstream.published.length, 0);
  });

  it('consumes the mapping so a duplicate/late echo is not relayed twice', () => {
    const client = makeClient({ oroMqtt: makeEchoOroMqtt() });
    const fakeLocal = makeFakeUpstream();
    const fakeUpstream = makeFakeUpstream();
    client._localClient = fakeLocal;
    client._upstreamClient = fakeUpstream;
    client._connected = true;

    client._handleUpstreamMessage('r/up1/ros/loc/nav_goal', Buffer.from('42|x'), { qos: 0 });
    client._handleRobotEcho(makeRobotEcho('-1|x'));
    client._handleRobotEcho(makeRobotEcho('-1|x')); // duplicate / late echo

    assert.strictEqual(fakeUpstream.published.length, 1);
  });

  it('forwards non-echo-awaiting commands verbatim with no mapping', () => {
    const client = makeClient();
    const fakeLocal = makeFakeUpstream();
    client._localClient = fakeLocal;

    client._handleUpstreamMessage('r/up1/custom_command/ros', Buffer.from('42|verbatim'), { qos: 0 });
    client._handleUpstreamMessage('r/up1/ros/teleop/go', Buffer.from('binary'), { qos: 0 });

    assert.strictEqual(fakeLocal.published.length, 2);
    assert.strictEqual(fakeLocal.published[0].payload.toString(), '42|verbatim'); // unchanged
    assert.strictEqual(fakeLocal.published[1].payload.toString(), 'binary');
    assert.strictEqual(client._callbackTable.size(), 0);
  });

  it('does not relay an echo once its mapping is gone (expired/evicted)', () => {
    const client = makeClient({ oroMqtt: makeEchoOroMqtt() });
    const fakeLocal = makeFakeUpstream();
    const fakeUpstream = makeFakeUpstream();
    client._localClient = fakeLocal;
    client._upstreamClient = fakeUpstream;
    client._connected = true;

    client._handleUpstreamMessage('r/up1/ros/loc/nav_goal', Buffer.from('42|x'), { qos: 0 });
    client._callbackTable.unset('-1'); // simulate TTL expiry / eviction
    client._handleRobotEcho(makeRobotEcho('-1|x'));

    assert.strictEqual(fakeUpstream.published.length, 0);
  });
});

describe('UpstreamRobotClient _logUpstreamCommand', () => {
  it('logs a PublishToTopic action for custom_command/ros, decoding the protobuf', async () => {
    const eventLog = makeFakeEventLog();
    const oroMqtt = makeFakeOroMqtt({
      'oro.CustomCommandRosMessage': () => ({ cmd: 'do-something' }),
    });
    const client = makeClient({ oroMqtt, eventLogColl: eventLog });

    await client._logUpstreamCommand('r/up1/custom_command/ros', Buffer.from('ignored'));

    assert.strictEqual(eventLog.inserted.length, 1);
    const doc = eventLog.inserted[0];
    assert.strictEqual(doc.module, 'action');
    assert.strictEqual(doc.eventType, 'action.executed');
    assert.strictEqual(doc.robotId, 'local1');
    assert.strictEqual(doc.eventData.type, 'PublishToTopic');
    assert.strictEqual(doc.eventData.action.source, 'upstream');
    assert.strictEqual(doc.eventData.action.upstreamRobotId, 'up1');
    assert.strictEqual(doc.eventData.action.elementValues.message, 'do-something');
    assert.strictEqual(typeof doc.ts, 'number');
  });

  it('logs a RunScript action for custom_command/script/command, decoding the protobuf', async () => {
    const eventLog = makeFakeEventLog();
    const oroMqtt = makeFakeOroMqtt({
      'oro.CustomScriptCommandMessage': () => ({ fileName: 'job.sh', executionId: 'e1', argOptions: ['-x'] }),
    });
    const client = makeClient({ oroMqtt, eventLogColl: eventLog });

    await client._logUpstreamCommand('r/up1/custom_command/script/command', Buffer.from('ignored'));

    assert.strictEqual(eventLog.inserted.length, 1);
    const { eventData } = eventLog.inserted[0];
    assert.strictEqual(eventData.type, 'RunScript');
    assert.strictEqual(eventData.action.elementValues.fileName, 'job.sh');
    assert.strictEqual(eventData.action.elementValues.executionId, 'e1');
  });

  it('logs a RestartAgent action for in_cmd restart (no protobuf decode)', async () => {
    const eventLog = makeFakeEventLog();
    const client = makeClient({ eventLogColl: eventLog });

    await client._logUpstreamCommand('r/up1/in_cmd', Buffer.from('restart'));

    assert.strictEqual(eventLog.inserted.length, 1);
    assert.strictEqual(eventLog.inserted[0].eventData.type, 'RestartAgent');
  });

  it('does not log for unknown command topics', async () => {
    const eventLog = makeFakeEventLog();
    const client = makeClient({ eventLogColl: eventLog });

    await client._logUpstreamCommand('r/up1/custom_command/script/status', Buffer.from('x'));
    await client._logUpstreamCommand('r/up1/pose', Buffer.from('x'));

    assert.strictEqual(eventLog.inserted.length, 0);
  });

  it('still logs the action when protobuf decoding fails (best effort)', async () => {
    const eventLog = makeFakeEventLog();
    const oroMqtt = makeFakeOroMqtt({
      'oro.CustomCommandRosMessage': () => { throw new Error('bad payload'); },
    });
    const client = makeClient({ oroMqtt, eventLogColl: eventLog });

    await client._logUpstreamCommand('r/up1/custom_command/ros', Buffer.from('garbage'));

    assert.strictEqual(eventLog.inserted.length, 1);
    assert.strictEqual(eventLog.inserted[0].eventData.type, 'PublishToTopic');
    // Could not decode → no message argument captured.
    assert.strictEqual(eventLog.inserted[0].eventData.action.elementValues.message, undefined);
  });

  it('does not throw when no event-log collection is configured', async () => {
    const client = makeClient();
    await client._logUpstreamCommand('r/up1/in_cmd', Buffer.from('restart'));
    // No assertion needed; reaching here without throwing is the test.
  });
});
