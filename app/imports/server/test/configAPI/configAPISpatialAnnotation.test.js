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
import {
  AuthorizationError, SchemaError, ValidationError, LIST_FORMAT_FULL, LIST_FORMAT_SHORT,
} from '../../../shared/configAPI';
import { ROLE_VIEWER, ROLE_MANAGER } from '../../../lib/roles';
import { createUser } from '../configAPI';
import { SpatialAnnotations } from '../../../lib/collections';

if (!Meteor.isTest) throw new Error('This is TEST code only');
const { expect } = chai;
chai.use(chaiAsPromised);

const KIND = 'SpatialAnnotation';
// 1x1 red PNG
const PNG_1X1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

const obj = (spec = {}, id = 'pretty') => ({
  kind: KIND, apiVersion: 'v0.1', metadata: { id },
  spec: { frameId: 'map', label: 'Pretty', x: 0, y: 0, resolution: 0.05, image: PNG_1X1, ...spec },
});

describe('configAPI:SpatialAnnotation', () => {
  let configApi; let manager;

  beforeEach(async () => {
    await resetDatabase();
    configApi = await new ConfigAPI().init({});
    await new OroRoles().createDefaultRoles();
    manager = await createUser({ id: 'mgr', role: ROLE_MANAGER });
  });

  it('apply: rejects viewers', async () => {
    const user = await createUser({ role: ROLE_VIEWER });
    await expect(configApi.apply({ configObject: obj(), user })).to.be.rejectedWith(AuthorizationError);
  });

  it('apply: stores a system-scope map with computed width/height/hash', async () => {
    await configApi.apply({ configObject: obj(), user: manager });
    const doc = await SpatialAnnotations.findOneAsync({ entityType: 'system', entityId: '0', label: 'pretty' });
    expect(doc.type).to.equal('map');
    expect(doc.frameId).to.equal('map');
    expect(doc.annotation).to.include({ label: 'Pretty', x: 0, y: 0, resolution: 0.05, width: 1, height: 1, formatVersion: 2, data: PNG_1X1 });
    expect(doc.annotation.dataHash).to.match(/^[0-9a-f]{32}$/);
  });

  it('apply: stores a robot-scope map when scope is a robot id', async () => {
    await configApi.apply({ configObject: obj({ scope: 'r1' }), user: manager });
    expect(await SpatialAnnotations.findOneAsync({ entityType: 'robot', entityId: 'r1', label: 'pretty' })).to.exist;
  });

  it('apply: is idempotent (re-apply updates, does not duplicate)', async () => {
    await configApi.apply({ configObject: obj(), user: manager });
    await configApi.apply({ configObject: obj({ x: 5 }), user: manager });
    const docs = await SpatialAnnotations.find({ label: 'pretty' }).fetchAsync();
    expect(docs).to.have.length(1);
    expect(docs[0].annotation.x).to.equal(5);
  });

  it('apply: rejects a non-PNG image, unknown keys and bad resolution', async () => {
    await expect(configApi.apply({ configObject: obj({ image: Buffer.from('nope').toString('base64') }), user: manager })).to.be.rejectedWith(ValidationError);
    await expect(configApi.apply({ configObject: obj({ bogus: 1 }), user: manager })).to.be.rejectedWith(SchemaError);
    await expect(configApi.apply({ configObject: obj({ resolution: 0 }), user: manager })).to.be.rejectedWith(SchemaError);
  });

  it('list: short strips the image, full round-trips it', async () => {
    await configApi.apply({ configObject: obj(), user: manager });
    const short = await configApi.list({ kind: KIND, user: manager, format: LIST_FORMAT_SHORT });
    expect(short).to.have.length(1);
    expect(short[0].metadata.id).to.equal('pretty');
    expect(JSON.stringify(short)).to.not.include(PNG_1X1);
    const full = await configApi.list({ kind: KIND, user: manager, format: LIST_FORMAT_FULL });
    expect(full[0].spec).to.include({ scope: 'system', frameId: 'map', label: 'Pretty', x: 0, y: 0, resolution: 0.05, formatVersion: 2, image: PNG_1X1 });
    // Re-applying the full output must be accepted verbatim
    await configApi.apply({ configObject: full[0], user: manager });
  });

  it('list: does not include legacy robot grids ingested from MQTT', async () => {
    await SpatialAnnotations.insertAsync({ entityType: 'robot', entityId: 'r1', label: 'map', map: { x: 0, y: 0, data: 'x' } });
    expect(await configApi.list({ kind: KIND, user: manager })).to.have.length(0);
  });

  it('clear: removes the map', async () => {
    await configApi.apply({ configObject: obj(), user: manager });
    await configApi.clear({ configObject: { kind: KIND, apiVersion: 'v0.1', metadata: { id: 'pretty' } }, user: manager });
    expect(await SpatialAnnotations.findOneAsync({ label: 'pretty' })).to.not.exist;
  });

  it('apply: rejects an id that collides with the robot\'s ingested map', async () => {
    const legacy = { entityType: 'robot', entityId: 'r1', label: 'map', map: { x: 0, y: 0, data: 'x' } };
    await SpatialAnnotations.insertAsync(legacy);
    await expect(configApi.apply({ configObject: obj({ scope: 'r1' }, 'map'), user: manager })).to.be.rejectedWith(ValidationError);
    expect(await SpatialAnnotations.findOneAsync({ entityType: 'robot', entityId: 'r1', label: 'map' })).to.deep.include(legacy);
  });
});
