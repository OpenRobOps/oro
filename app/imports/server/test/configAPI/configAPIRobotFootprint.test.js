import { Meteor } from 'meteor/meteor';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { resetDatabase } from '../setup';
import ConfigAPI from '../../configAPI/configAPI';
import OroRoles from '../../roles';
import {
  AuthorizationError, SchemaError, ValidationError, LIST_FORMAT_FULL,
} from '../../../shared/configAPI';
import { ROLE_VIEWER, ROLE_MANAGER } from '../../../lib/roles';
import { createUser } from '../configAPI';
import { UIPreferences } from '../../../lib/collections';

if (!Meteor.isTest) throw new Error('This is TEST code only');
const { expect } = chai;
chai.use(chaiAsPromised);

const KIND = 'RobotFootprint';
const SQ = [{ x: 0.3, y: 0.2 }, { x: 0.3, y: -0.2 }, { x: -0.3, y: -0.2 }, { x: -0.3, y: 0.2 }];
const obj = (spec, id = 'system') => ({ kind: KIND, apiVersion: 'v0.1', metadata: { id }, spec });
const poseOf = (entityType, entityId) => UIPreferences.findOneAsync({ entityType, entityId }).then((d) => d?.map?.pose);

describe('configAPI:RobotFootprint', () => {
  let configApi; let manager;
  beforeEach(async () => {
    await resetDatabase();
    configApi = await new ConfigAPI().init({});
    await new OroRoles().createDefaultRoles();
    manager = await createUser({ id: 'mgr', role: ROLE_MANAGER });
  });

  it('apply: rejects viewers', async () => {
    const user = await createUser({ role: ROLE_VIEWER });
    await expect(configApi.apply({ configObject: obj({ radius: 0.3 }), user })).to.be.rejectedWith(AuthorizationError);
  });

  it('apply: stores polygons as [x,y] pairs at system scope', async () => {
    await configApi.apply({ configObject: obj({ footprint: SQ, radius: 0.3, primaryColor: '#2A3C98', opacity: 0.9 }), user: manager });
    const pose = await poseOf('system', '0');
    expect(pose.footprint).to.deep.equal([[0.3, 0.2], [0.3, -0.2], [-0.3, -0.2], [-0.3, 0.2]]);
    expect(pose).to.include({ radius: 0.3, primaryColor: '#2A3C98', opacity: 0.9 });
  });

  it('apply: robot scope; re-apply replaces map.pose wholesale', async () => {
    await configApi.apply({ configObject: obj({ radius: 0.3, primaryColor: '#111111' }, 'r1'), user: manager });
    await configApi.apply({ configObject: obj({ radius: 0.5 }, 'r1'), user: manager });
    expect(await poseOf('robot', 'r1')).to.deep.equal({ radius: 0.5 });
  });

  it('apply: spec null writes the suppression triple', async () => {
    await configApi.apply({ configObject: obj(null, 'r1'), user: manager });
    expect(await poseOf('robot', 'r1')).to.deep.equal({ footprint: null, bufferFootprint: null, radius: null });
  });

  it('apply: schema rejects short polygons, bad colors, opacity > 1, unknown keys', async () => {
    for (const bad of [{ footprint: SQ.slice(0, 2) }, { primaryColor: 'red' }, { opacity: 2 }, { shape: 'circle' }]) {
      await expect(configApi.apply({ configObject: obj(bad), user: manager })).to.be.rejectedWith(SchemaError);
    }
  });

  it('apply: rejects an empty id', async () => {
    await expect(configApi.apply({ configObject: obj({ radius: 1 }, ''), user: manager })).to.be.rejectedWith(ValidationError);
  });

  it('list: short is flat {id,label}; full round-trips with {x,y} points', async () => {
    await configApi.apply({ configObject: obj({ footprint: SQ, radius: 0.3 }), user: manager });
    const short = await configApi.list({ kind: KIND, user: manager });
    expect(short[0]).to.include({ id: 'system', label: 'system', scope: '' });
    const full = await configApi.list({ kind: KIND, user: manager, format: LIST_FORMAT_FULL });
    expect(full[0].metadata.id).to.equal('system');
    expect(full[0].spec).to.deep.equal({ footprint: SQ, radius: 0.3 });
    await configApi.apply({ configObject: full[0], user: manager });
  });

  it('list full: a suppressed entity lists with spec null', async () => {
    await configApi.apply({ configObject: obj(null, 'r1'), user: manager });
    const full = await configApi.list({ kind: KIND, user: manager, format: LIST_FORMAT_FULL });
    expect(full[0].spec).to.equal(null);
  });

  it('clear: unsets map.pose only', async () => {
    await UIPreferences.upsertAsync({ entityType: 'robot', entityId: 'r1' }, { $set: { map: { pose: { radius: 1 }, lasers: { a: 1 } } } });
    await configApi.clear({ configObject: { kind: KIND, apiVersion: 'v0.1', metadata: { id: 'r1' } }, user: manager });
    const doc = await UIPreferences.findOneAsync({ entityType: 'robot', entityId: 'r1' });
    expect(doc.map).to.deep.equal({ lasers: { a: 1 } });
  });
});
