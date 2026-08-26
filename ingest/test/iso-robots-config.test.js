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
import assert from 'assert';

import { parseShared, DEFAULT_ATTRIBUTE_SOURCES } from '../src/server/iso21423/sharedConfig';
import { validateConfig, isoModeEnabled } from '../src/server/isoRobots/config';

const MIN = {
  robots: {
    enabled: true,
    imrfmId: '11111111-1111-4111-8111-111111111111',
    broker: { url: 'mqtt://localhost:1883' },
    mqtt: { username: 'iso-fleet', password: 'pw' },
  },
};
const withRobots = (over) => ({ ...MIN, robots: { ...MIN.robots, ...over } });

describe('iso21423 parseShared', () => {
  it('defaults every shared key', () => {
    const { shared, errors } = parseShared({});
    assert.deepStrictEqual(errors, []);
    assert.strictEqual(shared.uuidNamespace, '6ba7b810-9dad-11d1-80b4-00c04fd430c8');
    assert.strictEqual(shared.logging, false);
    assert.deepStrictEqual(shared.ccs, { id: null, name: 'facility', referencePoints: [] });
  });

  it('does not own the broker — that is per-direction (decision 13)', () => {
    const { shared } = parseShared({ broker: { url: 'mqtt://ignored:1883' } });
    assert.strictEqual('broker' in shared, false);
  });

  it('rejects a non-uuid namespace and a non-uuid ccs id', () => {
    const a = parseShared({ uuidNamespace: 'nope' });
    assert.ok(a.errors.some((e) => e.includes('uuidNamespace')), a.errors.join('; '));
    const b = parseShared({ ccs: { id: 'nope' } });
    assert.ok(b.errors.some((e) => e.includes('ccs.id')), b.errors.join('; '));
  });

  it('rejects non-array referencePoints', () => {
    const { errors } = parseShared({ ccs: { referencePoints: 'three' } });
    assert.ok(errors.some((e) => e.includes('referencePoints')), errors.join('; '));
  });

  it('tolerates an absent block', () => {
    assert.deepStrictEqual(parseShared(undefined).errors, []);
  });
});

describe('iso-robots isoModeEnabled', () => {
  it('is false when absent, disabled, or only the other direction is on', () => {
    assert.strictEqual(isoModeEnabled({}), false);
    assert.strictEqual(isoModeEnabled({ iso21423: { robots: { enabled: false } } }), false);
    assert.strictEqual(isoModeEnabled({ iso21423: { upstream: { enabled: true } } }), false);
  });

  it('is true only for robots.enabled', () => {
    assert.strictEqual(isoModeEnabled({ iso21423: { robots: { enabled: true } } }), true);
  });
});

describe('iso-robots validateConfig', () => {
  it('returns a null config with no errors when disabled', () => {
    const { config, errors } = validateConfig({ robots: { enabled: false } });
    assert.strictEqual(config, null);
    assert.deepStrictEqual(errors, []);
  });

  it('reports every problem at once', () => {
    const { config, errors } = validateConfig({ robots: { enabled: true } });
    assert.strictEqual(config, null);
    assert.strictEqual(errors.length, 2, errors.join('; '));
    assert.ok(errors.some((e) => e.includes('robots.imrfmId')));
    assert.ok(errors.some((e) => e.includes('robots.broker.url')));
  });

  it('ignores the sibling upstream subtree', () => {
    const { config, errors } = validateConfig({ ...MIN, upstream: { enabled: true, junk: 1 } });
    assert.deepStrictEqual(errors, []);
    assert.strictEqual('upstream' in config, false);
  });

  it('defaults the broker endpoint to ingest\'s own configured broker', () => {
    const oroMqtt = {
      defaultBrokerId: 'local',
      brokers: { local: { protocol: 'mqtt://', hostname: 'mosquitto.local', port: 1883 } },
    };
    const { config } = validateConfig(
      { robots: { ...MIN.robots, broker: undefined } }, oroMqtt);
    assert.strictEqual(config.mqtt.url, 'mqtt://mosquitto.local:1883');
    // The credential never defaults — the ISO session needs its own broker user.
    assert.strictEqual(config.mqtt.username, 'iso-fleet');
  });

  it('lets an explicit robots.broker override ingest\'s', () => {
    const oroMqtt = { brokers: { local: { hostname: 'ignored', port: 1883 } } };
    const { config } = validateConfig(
      withRobots({ broker: { url: 'mqtts://iso-broker:8883' } }), oroMqtt);
    assert.strictEqual(config.mqtt.url, 'mqtts://iso-broker:8883');
  });

  it('errors when neither robots.broker nor ingest has a usable broker', () => {
    const { errors } = validateConfig(
      { robots: { ...MIN.robots, broker: undefined } }, { brokers: {} });
    assert.ok(errors.some((e) => e.includes('robots.broker.url')), errors.join('; '));
  });

  it('merges shared keys and applies defaults', () => {
    const { config } = validateConfig({ ...MIN, logging: true });
    assert.strictEqual(config.logging, true);
    assert.strictEqual(config.manufacturerName, 'OpenRobOps');
    assert.strictEqual(config.rosterPollMs, 30000);
    assert.strictEqual(config.requestTimeoutMs, 30000);
    assert.strictEqual(config.mqtt.url, 'mqtt://localhost:1883');
    assert.strictEqual(config.mqtt.username, 'iso-fleet');
    assert.deepStrictEqual(config.attributeSources, DEFAULT_ATTRIBUTE_SOURCES);
  });

  it('defaults the two ORO navigation subtopics and leaves pause/resume unset', () => {
    const { config } = validateConfig(MIN);
    assert.strictEqual(config.commandTopics.navGoal, 'ros/loc/nav_goal');
    assert.strictEqual(config.commandTopics.cancelNav, 'ros/nav/goal_to_current_pose');
    assert.strictEqual(config.commandTopics.pause, null);
    assert.strictEqual(config.commandTopics.resume, null);
  });

  it('accepts deployment-named pause/resume subtopics', () => {
    const { config } = validateConfig(withRobots({
      commandTopics: { pause: 'ros/fleet/pause', resume: 'ros/fleet/resume' },
    }));
    assert.strictEqual(config.commandTopics.pause, 'ros/fleet/pause');
    assert.strictEqual(config.commandTopics.navGoal, 'ros/loc/nav_goal');
  });
});
