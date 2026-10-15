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
 * Configuration as code tests for the Robot kind (real robots and ghost robots)
 */
import { Meteor } from 'meteor/meteor';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
// ORO modules
import { resetDatabase } from '../setup';
import ConfigAPI from '../../configAPI/configAPI';
import OroRoles from '../../roles';
import {
  AuthorizationError, KIND_ROBOT, LIST_FORMAT_FULL, SchemaError, ValidationError,
} from '../../../shared/configAPI';
import { ROLE_VIEWER, ROLE_MANAGER } from '../../../lib/roles';
import { createUser } from '../configAPI';
import { Robots, RobotLocalization, RobotKeyValues } from '../../../lib/collections';
import { AttrValues } from '../../../lib/attributes';
import { RobotStatus } from '../../../lib/status';
import { STATUS } from '../../../shared/status';
import { HACK_GHOST_UPDATE_STAMP_VALUE } from '../../../shared/constants';

// Just make sure this is not getting loaded in dev/prod
if (!Meteor.isTest) {
  throw new Error('This is TEST code only');
}
const { expect } = chai;
chai.use(chaiAsPromised);

const GHOST_TS = HACK_GHOST_UPDATE_STAMP_VALUE;

const robotObject = (id, spec) => ({
  kind: KIND_ROBOT, apiVersion: 'v0.1', metadata: { id }, spec,
});

const GHOST_SPEC = {
  label: 'Picker 4',
  ghost: true,
  tags: ['RSMagni'],
  pose: { x: 4.2, y: 1.1, theta: 1.57 },
  attributes: { batteryPercentage: 0.71, missionStatus: 'idle' },
  statuses: { localization: 'OK', cpuLoadPercentage: 'WARN' },
};

describe('configAPI:Robot kind', () => {
  let configApi;
  let manager;

  beforeEach(async () => {
    await resetDatabase();
    configApi = await new ConfigAPI().init({});
    await new OroRoles().createDefaultRoles();
    manager = await createUser({ role: ROLE_MANAGER });
  });

  after(resetDatabase);

  it('apply: rejects users without fleet configure permission', async () => {
    const viewer = await createUser({ id: 'v1ewer', role: ROLE_VIEWER });
    await expect(configApi.apply({ configObject: robotObject('r1', { label: 'R1' }), user: viewer }))
      .to.be.rejectedWith(AuthorizationError);
  });

  it('apply: creates an offline real robot with name and tags, and nothing else', async () => {
    await configApi.apply({ configObject: robotObject('r1', { label: 'R1', tags: ['a', 'b'] }), user: manager });
    const doc = await Robots.findOneAsync({ _id: 'r1' });
    expect(doc.name).to.equal('R1');
    expect(doc.tags).to.deep.equal(['a', 'b']);
    expect(doc.status.agentOnline).to.equal(false);
    expect(doc.updateStamp).to.not.equal(GHOST_TS);
    expect(await AttrValues.findOneAsync({ _id: 'r1' })).to.equal(undefined);
    expect(await RobotLocalization.findOneAsync({ _id: 'r1' })).to.equal(undefined);
  });

  it('apply: defaults the name to the id', async () => {
    await configApi.apply({ configObject: robotObject('r1', {}), user: manager });
    expect((await Robots.findOneAsync({ _id: 'r1' })).name).to.equal('r1');
  });

  it('apply: re-applying an existing robot touches only name and tags', async () => {
    await Robots.insertAsync({
      _id: 'r1', name: 'old', version: '4.15.1', status: { agentOnline: true }, updateStamp: 1000,
    });
    await configApi.apply({ configObject: robotObject('r1', { label: 'new', tags: ['x'] }), user: manager });
    const doc = await Robots.findOneAsync({ _id: 'r1' });
    expect(doc).to.include({ name: 'new', version: '4.15.1', updateStamp: 1000 });
    expect(doc.tags).to.deep.equal(['x']);
    expect(doc.status.agentOnline).to.equal(true);
  });

  it('apply: rejects static data on a non-ghost robot', async () => {
    for (const extra of [{ pose: { x: 0, y: 0 } }, { attributes: { a: 1 } }, { statuses: { a: 'OK' } }]) {
      await expect(configApi.apply({ configObject: robotObject('r1', { ...extra }), user: manager }))
        .to.be.rejectedWith(SchemaError);
    }
    expect(await Robots.findOneAsync({ _id: 'r1' })).to.equal(undefined);
  });

  it('apply: rejects unknown spec fields and bad status values', async () => {
    await expect(configApi.apply({ configObject: robotObject('r1', { nope: 1 }), user: manager }))
      .to.be.rejectedWith(SchemaError);
    await expect(configApi.apply({
      configObject: robotObject('r1', { ghost: true, statuses: { a: 'FINE' } }), user: manager,
    })).to.be.rejectedWith(SchemaError);
  });

  it('apply: a ghost is online with the sentinel stamp and static data in every collection', async () => {
    await configApi.apply({ configObject: robotObject('g1', GHOST_SPEC), user: manager });

    const robot = await Robots.findOneAsync({ _id: 'g1' });
    expect(robot).to.include({ name: 'Picker 4', updateStamp: GHOST_TS });
    expect(robot.status.agentOnline).to.equal(true);
    expect(robot.tags).to.deep.equal(['RSMagni']);

    const attrs = await AttrValues.findOneAsync({ _id: 'g1' });
    expect(attrs.batteryPercentage).to.deep.equal({ value: 0.71, ts: GHOST_TS });
    expect(attrs.missionStatus).to.deep.equal({ value: 'idle', ts: GHOST_TS });
    expect(attrs.agentOnline).to.deep.equal({ value: true, ts: GHOST_TS });

    const kv = await RobotKeyValues.findOneAsync({ _id: 'g1' });
    expect(kv.batteryPercentage).to.deep.equal({ value: 0.71, ts: GHOST_TS });

    const status = await RobotStatus.findOneAsync({ _id: 'g1' });
    expect(status.localization).to.deep.equal({ name: 'localization', value: STATUS.OK.value, ts: GHOST_TS });
    expect(status.cpuLoadPercentage.value).to.equal(STATUS.WARN.value);

    const loc = await RobotLocalization.findOneAsync({ _id: 'g1' });
    expect(loc.robotPose).to.deep.equal({ x: 4.2, y: 1.1, theta: 1.57, ts: GHOST_TS });
    expect(loc.robotPoseUpdatedTs).to.equal(GHOST_TS);
  });

  it('apply: re-applying a ghost replaces its static values', async () => {
    await configApi.apply({ configObject: robotObject('g1', GHOST_SPEC), user: manager });
    await configApi.apply({
      configObject: robotObject('g1', { ...GHOST_SPEC, attributes: { batteryPercentage: 0.2 } }), user: manager,
    });
    const attrs = await AttrValues.findOneAsync({ _id: 'g1' });
    expect(attrs.batteryPercentage.value).to.equal(0.2);
    expect(await Robots.find({}).countAsync()).to.equal(1);
  });

  it('clear: removes a ghost and all of its static data', async () => {
    await configApi.apply({ configObject: robotObject('g1', GHOST_SPEC), user: manager });
    await configApi.clear({ configObject: robotObject('g1'), user: manager });
    for (const coll of [Robots, AttrValues, RobotKeyValues, RobotStatus, RobotLocalization]) {
      expect(await coll.findOneAsync({ _id: 'g1' })).to.equal(undefined);
    }
  });

  it('clear: removes an offline real robot but refuses an online one', async () => {
    await configApi.apply({ configObject: robotObject('r1', { label: 'R1' }), user: manager });
    await configApi.clear({ configObject: robotObject('r1'), user: manager });
    expect(await Robots.findOneAsync({ _id: 'r1' })).to.equal(undefined);

    await Robots.insertAsync({
      _id: 'r2', name: 'r2', version: '1', status: { agentOnline: true }, updateStamp: Date.now(),
    });
    await expect(configApi.clear({ configObject: robotObject('r2'), user: manager }))
      .to.be.rejectedWith(ValidationError);
    expect(await Robots.findOneAsync({ _id: 'r2' })).to.not.equal(undefined);
  });

  it('list: full format returns re-applicable identity specs, flagging ghosts', async () => {
    await configApi.apply({ configObject: robotObject('g1', GHOST_SPEC), user: manager });
    await configApi.apply({ configObject: robotObject('r1', { label: 'R1', tags: ['t'] }), user: manager });
    const list = await configApi.list({ user: manager, kind: KIND_ROBOT, format: LIST_FORMAT_FULL });
    const byId = Object.fromEntries(list.map((o) => [o.metadata.id, o]));
    expect(Object.keys(byId).sort()).to.deep.equal(['g1', 'r1']);
    expect(byId.r1.spec).to.deep.equal({ label: 'R1', tags: ['t'] });
    expect(byId.g1.spec).to.deep.equal({ label: 'Picker 4', tags: ['RSMagni'], ghost: true });
    const short = await configApi.list({ user: manager, kind: KIND_ROBOT });
    expect(short[0].spec).to.equal(undefined);
  });
});
