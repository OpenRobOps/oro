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
import { Meteor } from 'meteor/meteor';
import { assert } from 'chai';

import { Robots } from '../../lib/collections';
import { IsoRobotConfigAPIHandler } from '../configAPI/isoRobots';
import { ValidationError, SchemaError } from '../../shared/configAPI';

if (!Meteor.isTest) {
  throw new Error('This is TEST code only');
}

const UUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SYSTEM_USER = { userId: 'oro' };

const handler = () => new IsoRobotConfigAPIHandler({});
const objectFor = (spec = {}, id = UUID) => ({
  apiVersion: 'v0.1', kind: 'IsoRobot', metadata: { id, scope: 'system/0' }, spec,
});

describe('IsoRobotConfigAPIHandler', function () {
  beforeEach(async function () {
    await Robots.removeAsync({ _id: UUID });
  });

  it('derives the version suffix from the protocol namespace, never hardcoding it', async function () {
    // The SDK's dist chunks import bare `@swc/helpers/_/*` specifiers it doesn't declare as a
    // runtime dependency, which the client test bundle can't resolve through the symlinked
    // package (see isoRobots.js's ROOT_NAMESPACE comment) — so this checks the derived literal
    // instead of importing `@openrobops/iso21423` directly.
    const { ISO_VERSION } = await import('../configAPI/isoRobots');
    assert.equal(ISO_VERSION, 'iso-21423-v1');
  });

  it('admits a robot by creating a robots document keyed on the ISO uuid', async function () {
    await handler().apply({ configObject: objectFor({ label: 'Lift-9 #3' }), user: SYSTEM_USER });
    const doc = await Robots.findOneAsync({ _id: UUID });
    assert.isOk(doc, 'no robot document created');
    assert.equal(doc.name, 'Lift-9 #3');
    assert.equal(doc.version, 'iso-21423-v1');   // suffix tracks ROOT_NAMESPACE's /v1
    assert.isFalse(doc.status.agentOnline);
    assert.isNumber(doc.updateStamp);
  });

  it('builds a name from the manufacturer when no label is given', async function () {
    await handler().apply({ configObject: objectFor({ manufacturerName: 'Acme' }), user: SYSTEM_USER });
    assert.equal((await Robots.findOneAsync({ _id: UUID })).name, 'Acme aaaaaaaa');
  });

  it('falls back to the uuid when neither label nor manufacturer is given', async function () {
    await handler().apply({ configObject: objectFor({}), user: SYSTEM_USER });
    assert.equal((await Robots.findOneAsync({ _id: UUID })).name, UUID);
  });

  it('stores the hostname when given', async function () {
    await handler().apply({ configObject: objectFor({ hostname: 'lift9-3.local' }), user: SYSTEM_USER });
    assert.equal((await Robots.findOneAsync({ _id: UUID })).hostname, 'lift9-3.local');
  });

  it('is idempotent — re-applying updates the name and does not duplicate', async function () {
    const h = handler();
    await h.apply({ configObject: objectFor({ label: 'First' }), user: SYSTEM_USER });
    await h.apply({ configObject: objectFor({ label: 'Renamed' }), user: SYSTEM_USER });
    assert.equal(await Robots.find({ _id: UUID }).countAsync(), 1);
    assert.equal((await Robots.findOneAsync({ _id: UUID })).name, 'Renamed');
  });

  it('rejects a metadata.id that is not a UUID', async function () {
    try {
      await handler().apply({ configObject: objectFor({}, 'flatland-ros2'), user: SYSTEM_USER });
      assert.fail('expected a ValidationError');
    } catch (e) {
      assert.instanceOf(e, ValidationError);
      assert.include(e.message, 'UUID');
    }
  });

  it('rejects unknown spec keys', async function () {
    try {
      await handler().apply({ configObject: objectFor({ nonsense: 1 }), user: SYSTEM_USER });
      assert.fail('expected a SchemaError');
    } catch (e) {
      assert.instanceOf(e, SchemaError);
    }
  });

  it('revokes admission by deleting the robot document', async function () {
    const h = handler();
    await h.apply({ configObject: objectFor({ label: 'Gone soon' }), user: SYSTEM_USER });
    await h.clear({ configObject: objectFor({}), user: SYSTEM_USER });
    assert.isUndefined(await Robots.findOneAsync({ _id: UUID }));
  });

  it('lists only ISO robots, not wire robots', async function () {
    await handler().apply({ configObject: objectFor({ label: 'ISO' }), user: SYSTEM_USER });
    await Robots.insertAsync({
      _id: 'flatland-ros2', name: 'wire', version: '1.0', updateStamp: Date.now(),
      status: { agentOnline: false },
    });
    const listed = await handler().list({ user: SYSTEM_USER });
    assert.deepEqual(listed.map((o) => o.metadata.id), [UUID]);
    await Robots.removeAsync({ _id: 'flatland-ros2' });
  });
});
