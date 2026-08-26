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

import { MqttLogins } from '../collections';
import { Robots } from '../../lib/collections';
import { isoAclsFor, provisionIsoRobotCredentials, NotAdmittedError } from '../isoMqttConfig';

if (!Meteor.isTest) {
  throw new Error('This is TEST code only');
}

const UUID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('isoMqttConfig', function () {
  beforeEach(async function () {
    await MqttLogins.removeAsync({ robotId: UUID });
    await Robots.removeAsync({ _id: UUID });
  });

  /** Gate 2: admit the robot, which every credential request now requires. */
  const admit = () => Robots.insertAsync({
    _id: UUID, name: 'Lift-9', version: 'iso-21423-v1', updateStamp: Date.now(),
    status: { agentOnline: false },
  });

  describe('isoAclsFor', function () {
    it('grants read, write and subscribe as separate entries on the robot subtree', function () {
      const acls = isoAclsFor(UUID);
      const own = `/ISO_21423/v1/IMR/${UUID}/#`;
      assert.deepEqual(acls.filter((a) => a.topic === own).map((a) => a.acc), [1, 2, 4]);
    });

    it('grants read and subscribe on the identity wildcard, for discovery', function () {
      const acls = isoAclsFor(UUID);
      const wild = '/ISO_21423/v1/+/+/identity';
      assert.deepEqual(acls.filter((a) => a.topic === wild).map((a) => a.acc), [1, 4]);
    });

    it('grants nothing outside those two topic filters', function () {
      assert.equal(new Set(isoAclsFor(UUID).map((a) => a.topic)).size, 2);
    });

    it('is deterministic', function () {
      assert.deepEqual(isoAclsFor(UUID), isoAclsFor(UUID));
    });
  });

  describe('provisionIsoRobotCredentials', function () {
    it('refuses to mint credentials for a robot that was never admitted', async function () {
      try {
        await provisionIsoRobotCredentials(UUID, 'local');
        assert.fail('expected a NotAdmittedError');
      } catch (e) {
        assert.instanceOf(e, NotAdmittedError);
        assert.isTrue(e.notAdmitted);
        assert.include(e.message, UUID);
        assert.include(e.message, 'IsoRobot');          // names the fix
        assert.include(e.message, '/api/configuration/apply');
      }
      assert.equal(await MqttLogins.find({ robotId: UUID }).countAsync(), 0,
        'a refused request must leave no credential behind');
    });

    it('creates a credential with the ISO ACLs and a hashed password', async function () {
      await admit();
      const doc = await provisionIsoRobotCredentials(UUID, 'local');
      assert.equal(doc.robotId, UUID);
      assert.isFalse(doc.superuser);
      assert.match(doc.password, /^PBKDF2\$sha512\$/);
      assert.isString(doc.encryptedPassword);
      assert.isNumber(doc.tsCreated);
      assert.deepEqual(doc.acls, isoAclsFor(UUID));
    });

    it('is idempotent — a second call returns the same credential, not a new password', async function () {
      await admit();
      const first = await provisionIsoRobotCredentials(UUID, 'local');
      const second = await provisionIsoRobotCredentials(UUID, 'local');
      assert.equal(second.username, first.username);
      assert.equal(second.encryptedPassword, first.encryptedPassword);
      assert.equal(await MqttLogins.find({ robotId: UUID }).countAsync(), 1);
    });

    it('never creates a robot document — Gate 2 is the only thing that does', async function () {
      await admit();
      await Robots.updateAsync({ _id: UUID }, { $set: { name: 'untouched' } });
      await provisionIsoRobotCredentials(UUID, 'local');
      assert.equal((await Robots.findOneAsync({ _id: UUID })).name, 'untouched');
      assert.equal(await Robots.find({}).countAsync(), 1, 'no robot was invented');
    });

    it('keeps the credential when admission is later revoked, so suspension stays the lever', async function () {
      await admit();
      const doc = await provisionIsoRobotCredentials(UUID, 'local');
      await Robots.removeAsync({ _id: UUID });
      const still = await MqttLogins.findOneAsync({ robotId: UUID });
      assert.equal(still.username, doc.username);
    });
  });
});
