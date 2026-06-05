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

function makeClient({ publishRetained = true } = {}) {
  return new UpstreamRobotClient({
    localRobotId: 'local1',
    upstreamRobotId: 'up1',
    api: { baseUrl: 'https://example.com', apiKey: 'k' },
    brokerOptions: {},
    credentialEncryptionKey: 'x'.repeat(64),
    credsColl: {},
    denySubtopics: new Set(['in_cmd']),
    publishRetained,
    localBrokerConfig: {},
    logging: false,
    throttledLogger: noopLogger,
  });
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

  it('ignores upstream in_cmd echo/ping messages', () => {
    const client = makeClient();
    const fakeLocal = makeFakeUpstream();
    client._localClient = fakeLocal;

    // Echo pings are sent as '<seq>|' by the callback mechanism.
    client._handleUpstreamMessage('r/up1/in_cmd', Buffer.from('42|'), { qos: 0 });

    assert.strictEqual(fakeLocal.published.length, 0);
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
