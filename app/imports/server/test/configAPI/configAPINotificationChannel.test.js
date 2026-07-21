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
 * Configuration as code tests for notification channels (webhook endpoints).
 */
import { Meteor } from 'meteor/meteor';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
// ORO modules
import { resetDatabase } from '../setup';
import ConfigAPI from '../../configAPI/configAPI';
import OroRoles from '../../roles';
import { KIND_NOTIFICATION_CHANNEL, LIST_FORMAT_FULL } from '../../../shared/configAPI';
import { NotificationChannels } from '../../../lib/alerts';
import { createUser } from '../configAPI';
import { ROLE_ADMIN, ROLE_VIEWER } from '../../../lib/roles';

if (!Meteor.isTest) {
  throw new Error('This is TEST code only');
}
const { expect } = chai;
chai.use(chaiAsPromised);

const makeConfigObject = (id, spec) => {
  const configObject = {
    kind: KIND_NOTIFICATION_CHANNEL,
    apiVersion: 'v0.1',
    metadata: { id }
  };
  // Only include `spec` when provided; `clear` rejects config objects carrying a spec key.
  if (spec !== undefined) {
    configObject.spec = spec;
  }
  return configObject;
};

const VALID_SPEC = {
  type: 'webhook',
  url: 'https://hooks.example.com/oro-alerts',
  secret: 'topsecret'
};

describe('configAPI:NotificationChannel', () => {
  beforeEach(async () => {
    await resetDatabase();
    await new OroRoles().createDefaultRoles();
  });

  it('apply: requires configure permission', async () => {
    const user = await createUser({ role: ROLE_VIEWER });
    new ConfigAPI().init();
    await expect(
      new ConfigAPI().apply({ configObject: makeConfigObject('ops-webhook', VALID_SPEC), user })
    ).to.be.rejectedWith(/Unauthorized/);
  });

  it('apply: stores a webhook channel keyed by id', async () => {
    const user = await createUser({ role: ROLE_ADMIN });
    new ConfigAPI().init();
    await new ConfigAPI().apply(
      { configObject: makeConfigObject('ops-webhook', VALID_SPEC), user });

    const doc = await NotificationChannels.findOneAsync({ _id: 'ops-webhook' });
    expect(doc).to.be.ok;
    expect(doc._id).eq('ops-webhook');
    expect(doc.type).eq('webhook');
    expect(doc.url).eq('https://hooks.example.com/oro-alerts');
    expect(doc.secret).eq('topsecret');
  });

  it('apply: secret is optional', async () => {
    const user = await createUser({ role: ROLE_ADMIN });
    new ConfigAPI().init();
    await new ConfigAPI().apply({
      configObject: makeConfigObject('no-secret', { type: 'webhook', url: 'https://x.example.com/h' }),
      user
    });

    const doc = await NotificationChannels.findOneAsync({ _id: 'no-secret' });
    expect(doc).to.be.ok;
    expect(doc.secret).to.be.undefined;
  });

  it('apply: updates an existing channel in place', async () => {
    const user = await createUser({ role: ROLE_ADMIN });
    new ConfigAPI().init();
    await new ConfigAPI().apply(
      { configObject: makeConfigObject('ops-webhook', VALID_SPEC), user });
    await new ConfigAPI().apply({
      configObject: makeConfigObject('ops-webhook', { type: 'webhook', url: 'https://new.example.com/h' }),
      user
    });

    const docs = await NotificationChannels.find({ _id: 'ops-webhook' }).fetchAsync();
    expect(docs.length).eq(1);
    expect(docs[0].url).eq('https://new.example.com/h');
    expect(docs[0].secret).to.be.undefined;
  });

  it('apply: rejects an invalid spec (unknown field)', async () => {
    const user = await createUser({ role: ROLE_ADMIN });
    new ConfigAPI().init();
    await expect(
      new ConfigAPI().apply({
        configObject: makeConfigObject('ops-webhook', { ...VALID_SPEC, bogus: true }),
        user
      })
    ).to.be.rejected;
  });

  it('apply: rejects an unsupported channel type', async () => {
    const user = await createUser({ role: ROLE_ADMIN });
    new ConfigAPI().init();
    await expect(
      new ConfigAPI().apply({
        configObject: makeConfigObject('slack-chan', { type: 'slack', url: 'https://x.example.com/h' }),
        user
      })
    ).to.be.rejected;
  });

  it('apply: rejects a missing url', async () => {
    const user = await createUser({ role: ROLE_ADMIN });
    new ConfigAPI().init();
    await expect(
      new ConfigAPI().apply({
        configObject: makeConfigObject('ops-webhook', { type: 'webhook' }),
        user
      })
    ).to.be.rejected;
  });

  it('apply: null spec removes the channel', async () => {
    const user = await createUser({ role: ROLE_ADMIN });
    new ConfigAPI().init();
    await new ConfigAPI().apply(
      { configObject: makeConfigObject('ops-webhook', VALID_SPEC), user });
    await new ConfigAPI().apply(
      { configObject: makeConfigObject('ops-webhook', null), user });

    const doc = await NotificationChannels.findOneAsync({ _id: 'ops-webhook' });
    expect(doc).to.not.be.ok;
  });

  it('clear: removes the channel', async () => {
    const user = await createUser({ role: ROLE_ADMIN });
    new ConfigAPI().init();
    await new ConfigAPI().apply(
      { configObject: makeConfigObject('ops-webhook', VALID_SPEC), user });
    await new ConfigAPI().clear(
      { configObject: makeConfigObject('ops-webhook'), user });

    const doc = await NotificationChannels.findOneAsync({ _id: 'ops-webhook' });
    expect(doc).to.not.be.ok;
  });

  it('list: round-trips a channel in FULL format', async () => {
    const user = await createUser({ role: ROLE_ADMIN });
    new ConfigAPI().init();
    await new ConfigAPI().apply(
      { configObject: makeConfigObject('ops-webhook', VALID_SPEC), user });

    const listed = await new ConfigAPI().list(
      { kind: KIND_NOTIFICATION_CHANNEL, user, format: LIST_FORMAT_FULL });
    expect(listed.length).eq(1);
    expect(listed[0].metadata.id).eq('ops-webhook');
    expect(listed[0].spec.type).eq('webhook');
    expect(listed[0].spec.url).eq('https://hooks.example.com/oro-alerts');
  });
});
