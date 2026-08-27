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
import { AuthorizationError, SchemaError, ValidationError, LIST_FORMAT_FULL } from '../../../shared/configAPI';
import { ROLE_VIEWER, ROLE_MANAGER } from '../../../lib/roles';
import { createUser } from '../configAPI';
import { SpatialTransformations } from '../../../lib/collections';

if (!Meteor.isTest) throw new Error('This is TEST code only');
const { expect } = chai;
chai.use(chaiAsPromised);

const KIND = 'SpatialTransformation';
const near = (a, b, eps = 1e-6) => expect(Math.abs(a - b)).to.be.below(eps, `${a} !== ${b}`);
const TRANSLATE_10 = [[1, 0, 10], [0, 1, 10], [0, 0, 1]];
const obj = (transformations, id = 'system') => ({
  kind: KIND, apiVersion: 'v0.1', metadata: { id }, spec: { transformations },
});

describe('configAPI:SpatialTransformation', () => {
  let configApi; let manager;

  beforeEach(async () => {
    await resetDatabase();
    configApi = await new ConfigAPI().init({});
    await new OroRoles().createDefaultRoles();
    manager = await createUser({ id: 'mgr', role: ROLE_MANAGER });
  });

  it('apply: rejects viewers', async () => {
    const user = await createUser({ role: ROLE_VIEWER });
    await expect(configApi.apply({ configObject: obj([{ from: 'map', to: 'ccs', matrix: TRANSLATE_10 }]), user })).to.be.rejectedWith(AuthorizationError);
  });

  it('apply: stores a matrix at system scope', async () => {
    await configApi.apply({ configObject: obj([{ from: 'map', to: 'ccs', matrix: TRANSLATE_10 }]), user: manager });
    const doc = await SpatialTransformations.findOneAsync({ entityType: 'system', entityId: '0' });
    expect(doc.transformations.map.frameId).to.equal('ccs');
    expect(doc.transformations.map.aTb.m).to.deep.equal(TRANSLATE_10);
  });

  it('apply: fits reference points and stores at robot scope', async () => {
    const pts = [
      { from: { x: 0, y: 0 }, to: { x: 10, y: 10 } },
      { from: { x: 4, y: 0 }, to: { x: 14, y: 10 } },
      { from: { x: 0, y: 3 }, to: { x: 10, y: 13 } },
    ];
    await configApi.apply({ configObject: obj([{ from: 'map', to: 'ccs', referencePoints: pts }], 'r1'), user: manager });
    const doc = await SpatialTransformations.findOneAsync({ entityType: 'robot', entityId: 'r1' });
    near(doc.transformations.map.aTb.m[0][2], 10);
    near(doc.transformations.map.aTb.m[1][2], 10);
    near(doc.transformations.map.aTb.m[0][0], 1);
  });

  it('apply: rejects both/neither of matrix and referencePoints, bad matrices, <3 points', async () => {
    const bad = async (entry) => expect(configApi.apply({ configObject: obj([entry]), user: manager })).to.be.rejectedWith(ValidationError);
    await bad({ from: 'map', to: 'ccs' });
    await bad({ from: 'map', to: 'ccs', matrix: TRANSLATE_10, referencePoints: [] });
    await bad({ from: 'map', to: 'ccs', matrix: [[2, 0, 0], [0, 2, 0], [0, 0, 1]] });
    await bad({ from: 'map', to: 'ccs', referencePoints: [{ from: { x: 0, y: 0 }, to: { x: 1, y: 1 } }] });
    await bad({ from: 'map', to: 'map', matrix: TRANSLATE_10 });
    await expect(configApi.apply({ configObject: obj([{ from: 'map', to: 'ccs', matrix: TRANSLATE_10, extra: 1 }]), user: manager })).to.be.rejectedWith(SchemaError);
  });

  it('apply: replaces the whole transformations set for the entity', async () => {
    await configApi.apply({ configObject: obj([{ from: 'map', to: 'a', matrix: TRANSLATE_10 }]), user: manager });
    await configApi.apply({ configObject: obj([{ from: 'odom', to: 'b', matrix: TRANSLATE_10 }]), user: manager });
    const doc = await SpatialTransformations.findOneAsync({ entityType: 'system' });
    expect(Object.keys(doc.transformations)).to.deep.equal(['odom']);
  });

  it('list short: flat id/label with the CLI scope field', async () => {
    await configApi.apply({ configObject: obj([{ from: 'map', to: 'ccs', matrix: TRANSLATE_10 }], 'r1'), user: manager });
    const short = await configApi.list({ kind: KIND, user: manager });
    expect(short).to.have.length(1);
    expect(short[0]).to.include({ id: 'r1', label: 'r1', scope: '' });
  });

  it('list full: round-trips as matrices', async () => {
    await configApi.apply({ configObject: obj([{ from: 'map', to: 'ccs', matrix: TRANSLATE_10 }]), user: manager });
    const full = await configApi.list({ kind: KIND, user: manager, format: LIST_FORMAT_FULL });
    expect(full).to.have.length(1);
    expect(full[0].metadata.id).to.equal('system');
    expect(full[0].spec.transformations).to.deep.equal([{ from: 'map', to: 'ccs', matrix: TRANSLATE_10 }]);
    await configApi.apply({ configObject: full[0], user: manager });
  });

  it('clear: removes the entity doc', async () => {
    await configApi.apply({ configObject: obj([{ from: 'map', to: 'ccs', matrix: TRANSLATE_10 }], 'r1'), user: manager });
    await configApi.clear({ configObject: { kind: KIND, apiVersion: 'v0.1', metadata: { id: 'r1' } }, user: manager });
    expect(await SpatialTransformations.findOneAsync({ entityId: 'r1' })).to.not.exist;
  });
});
