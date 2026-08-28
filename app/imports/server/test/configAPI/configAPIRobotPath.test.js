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
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { resetDatabase } from '../setup';
import ConfigAPI from '../../configAPI/configAPI';
import OroRoles from '../../roles';
import { AuthorizationError, SchemaError, LIST_FORMAT_FULL } from '../../../shared/configAPI';
import { ROLE_VIEWER, ROLE_MANAGER } from '../../../lib/roles';
import { createUser } from '../configAPI';
import { UIPreferences } from '../../../lib/collections';

if (!Meteor.isTest) throw new Error('This is TEST code only');
const { expect } = chai;
chai.use(chaiAsPromised);

const KIND = 'RobotPath';
const PATHS = {
  0: { label: 'Global plan', pointColor: ['#2A3C98', '#7F8CC7', '#C7CCE5'], lineColor: ['#2A3C98', '#7F8CC7'], pointWidth: 3, lineWidth: 2, isDashed: false, shouldPersist: false },
  1: { label: 'Local trajectory', lineColor: ['#B4622A'], isDashed: true },
};
const obj = (spec, id = 'system') => ({ kind: KIND, apiVersion: 'v0.1', metadata: { id }, spec });
const storedOf = (entityType, entityId) => UIPreferences.findOneAsync({ entityType, entityId }).then((d) => d?.map?.robotPath);

describe('configAPI:RobotPath', () => {
  let configApi; let manager;
  beforeEach(async () => {
    await resetDatabase();
    configApi = await new ConfigAPI().init({});
    await new OroRoles().createDefaultRoles();
    manager = await createUser({ id: 'mgr', role: ROLE_MANAGER });
  });

  it('apply: rejects viewers', async () => {
    const user = await createUser({ role: ROLE_VIEWER });
    await expect(configApi.apply({ configObject: obj({ paths: PATHS }), user })).to.be.rejectedWith(AuthorizationError);
  });

  it('apply: stores elementList/elementValues at system scope', async () => {
    await configApi.apply({ configObject: obj({ paths: PATHS }), user: manager });
    const stored = await storedOf('system', '0');
    expect(stored.elementList).to.deep.equal(['0', '1']);
    expect(stored.elementValues['1']).to.deep.equal(PATHS[1]);
  });

  it('apply: robot scope; re-apply replaces the whole object', async () => {
    await configApi.apply({ configObject: obj({ paths: PATHS }, 'r1'), user: manager });
    await configApi.apply({ configObject: obj({ paths: { 1: PATHS[1] } }, 'r1'), user: manager });
    expect((await storedOf('robot', 'r1')).elementList).to.deep.equal(['1']);
  });

  it('apply: schema rejects bad ids, colors, widths, empty paths, unknown keys', async () => {
    for (const bad of [
      { paths: {} },
      { paths: { 'a b': {} } },
      { paths: { 0: { lineColor: ['red'] } } },
      { paths: { 0: { pointColor: ['#000000', '#111111', '#222222', '#333333'] } } },
      { paths: { 0: { lineWidth: 0 } } },
      { paths: { 0: { color: '#000000' } } },
      { extra: 1, paths: PATHS },
    ]) {
      await expect(configApi.apply({ configObject: obj(bad), user: manager })).to.be.rejectedWith(SchemaError);
    }
  });

  it('list: short is {id,label}; full round-trips', async () => {
    await configApi.apply({ configObject: obj({ paths: PATHS }), user: manager });
    const short = await configApi.list({ kind: KIND, user: manager });
    expect(short[0]).to.include({ id: 'system', label: 'system', scope: '' });
    const full = await configApi.list({ kind: KIND, user: manager, format: LIST_FORMAT_FULL });
    expect(full[0].spec).to.deep.equal({ paths: PATHS });
    await configApi.apply({ configObject: full[0], user: manager });
  });

  it('clear: unsets map.robotPath only', async () => {
    await UIPreferences.upsertAsync({ entityType: 'robot', entityId: 'r1' }, { $set: { map: { pose: { radius: 1 }, robotPath: { elementList: ['0'], elementValues: { 0: {} } } } } });
    await configApi.clear({ configObject: { kind: KIND, apiVersion: 'v0.1', metadata: { id: 'r1' } }, user: manager });
    const doc = await UIPreferences.findOneAsync({ entityType: 'robot', entityId: 'r1' });
    expect(doc.map).to.deep.equal({ pose: { radius: 1 } });
  });
});
