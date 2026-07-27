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
 * Unit tests for NotificationChannelsManager: webhook-channel validation and CRUD.
 */
import { Meteor } from 'meteor/meteor';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
// ORO modules
import { resetDatabase } from './setup';
import { NotificationChannels } from '../../lib/alerts';
import NotificationChannelsManager from '../notificationChannelsManager';

if (!Meteor.isTest) {
  throw new Error('This is TEST code only');
}
const { expect } = chai;
chai.use(chaiAsPromised);

const VALID = { type: 'webhook', url: 'https://hooks.example.com/h', secret: 'topsecret' };

describe('NotificationChannelsManager', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  // --- validation ---
  it('validateChannelSpec: accepts a valid webhook spec', () => {
    expect(() => new NotificationChannelsManager().validateChannelSpec(VALID)).to.not.throw();
  });

  it('validateChannelSpec: accepts a spec without a secret', () => {
    expect(() => new NotificationChannelsManager().validateChannelSpec(
      { type: 'webhook', url: 'https://x.example.com/h' })).to.not.throw();
  });

  it('validateChannelSpec: rejects an unsupported channel type', () => {
    expect(() => new NotificationChannelsManager().validateChannelSpec(
      { type: 'slack', url: 'https://x.example.com/h' })).to.throw();
  });

  it('validateChannelSpec: rejects a missing url', () => {
    expect(() => new NotificationChannelsManager().validateChannelSpec(
      { type: 'webhook' })).to.throw();
  });

  it('validateChannelSpec: rejects a malformed url', () => {
    expect(() => new NotificationChannelsManager().validateChannelSpec(
      { type: 'webhook', url: 'not-a-url' })).to.throw();
  });

  it('validateChannelSpec: rejects an unknown field (strict)', () => {
    expect(() => new NotificationChannelsManager().validateChannelSpec(
      { ...VALID, bogus: true })).to.throw();
  });

  // --- CRUD ---
  it('upsertChannel: creates a channel keyed by id', async () => {
    await new NotificationChannelsManager().upsertChannel({ id: 'ops-webhook', spec: VALID });
    const doc = await NotificationChannels.findOneAsync({ _id: 'ops-webhook' });
    expect(doc).to.be.ok;
    expect(doc.type).eq('webhook');
    expect(doc.url).eq('https://hooks.example.com/h');
    expect(doc.secret).eq('topsecret');
  });

  it('upsertChannel: replaces in place and drops a removed secret', async () => {
    const mgr = new NotificationChannelsManager();
    await mgr.upsertChannel({ id: 'ops-webhook', spec: VALID });
    await mgr.upsertChannel({ id: 'ops-webhook', spec: { type: 'webhook', url: 'https://new.example.com/h' } });
    const docs = await NotificationChannels.find({ _id: 'ops-webhook' }).fetchAsync();
    expect(docs.length).eq(1);
    expect(docs[0].url).eq('https://new.example.com/h');
    expect(docs[0].secret).to.be.undefined;
  });

  it('upsertChannel: rejects an invalid spec (no write)', async () => {
    const mgr = new NotificationChannelsManager();
    await expect(mgr.upsertChannel({ id: 'bad', spec: { type: 'slack', url: 'https://x/h' } }))
      .to.be.rejected;
    expect(await NotificationChannels.findOneAsync({ _id: 'bad' })).to.not.be.ok;
  });

  it('removeChannel: removes the channel', async () => {
    const mgr = new NotificationChannelsManager();
    await mgr.upsertChannel({ id: 'ops-webhook', spec: VALID });
    await mgr.removeChannel('ops-webhook');
    expect(await NotificationChannels.findOneAsync({ _id: 'ops-webhook' })).to.not.be.ok;
  });

  it('listChannels: returns all, or one by id', async () => {
    const mgr = new NotificationChannelsManager();
    await mgr.upsertChannel({ id: 'a', spec: VALID });
    await mgr.upsertChannel({ id: 'b', spec: { type: 'webhook', url: 'https://b.example.com/h' } });
    const all = await mgr.listChannels();
    expect(all.map(c => c._id).sort()).deep.eq(['a', 'b']);
    const one = await mgr.listChannels({ id: 'a' });
    expect(one.map(c => c._id)).deep.eq(['a']);
  });
});
