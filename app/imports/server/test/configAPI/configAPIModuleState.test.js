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
 * Configuration as code tests for system-wide module states.
 */
import { Meteor } from 'meteor/meteor';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
// ORO modules
import { resetDatabase } from '../setup';
import ConfigAPI from '../../configAPI/configAPI';
import OroRoles from '../../roles';
import {
  AuthorizationError,
  KIND_MODULE_STATE,
  LIST_FORMAT_FULL,
  LIST_FORMAT_SHORT,
  SchemaError,
} from '../../../shared/configAPI';
import { ROLE_VIEWER, ROLE_MANAGER } from '../../../lib/roles';
import { createUser } from '../configAPI';
import { RobotModuleState } from '../../../lib/collections';
import { ID_DEFAULT, ID_TYPE_SYSTEM_WIDE } from '../../../shared/constants';

// Just make sure this is not getting loaded in dev/prod
if (!Meteor.isTest) {
  throw new Error('This is TEST code only');
}
const { expect } = chai;
chai.use(chaiAsPromised);

const findSystemDoc = moduleName => (
  RobotModuleState.findOneAsync({
    entityType: ID_TYPE_SYSTEM_WIDE,
    entityId: ID_DEFAULT,
    moduleName,
  })
);

describe('configAPI:ModuleState', () => {
  let configApi;

  beforeEach(async () => {
    await resetDatabase();
    configApi = await new ConfigAPI().init({});
    await new OroRoles().createDefaultRoles();
  });

  // ---- authorization ----------------------------------------------------

  it('apply: rejects users without account/configure permission', async () => {
    const user = await createUser({ role: ROLE_VIEWER });
    await expect(
      configApi.apply({
        configObject: {
          kind: KIND_MODULE_STATE,
          apiVersion: 'v0.1',
          metadata: { id: 'RosImageAgentlet' },
          spec: { state: { cameraViewOn: true } },
        },
        user,
      })
    ).to.be.rejectedWith(AuthorizationError);
  });

  it('clear: rejects users without account/configure permission', async () => {
    const user = await createUser({ role: ROLE_VIEWER });
    await expect(
      configApi.clear({
        configObject: {
          kind: KIND_MODULE_STATE,
          apiVersion: 'v0.1',
          metadata: { id: 'RosImageAgentlet' },
        },
        user,
      })
    ).to.be.rejectedWith(AuthorizationError);
  });

  it('list: rejects users without account/configure permission', async () => {
    const user = await createUser({ role: ROLE_VIEWER });
    await expect(
      configApi.list({
        user,
        kind: KIND_MODULE_STATE,
        format: LIST_FORMAT_SHORT,
      })
    ).to.be.rejectedWith(AuthorizationError);
  });

  // ---- apply ------------------------------------------------------------

  it('apply: rejects malformed specs (extra top-level fields)', async () => {
    const user = await createUser({ role: ROLE_MANAGER });
    await expect(
      configApi.apply({
        configObject: {
          kind: KIND_MODULE_STATE,
          apiVersion: 'v0.1',
          metadata: { id: 'RosImageAgentlet' },
          spec: { state: {}, somethingElse: 'nope' },
        },
        user,
      })
    ).to.be.rejectedWith(SchemaError);
  });

  it('apply: rejects specs where state is not an object', async () => {
    const user = await createUser({ role: ROLE_MANAGER });
    await expect(
      configApi.apply({
        configObject: {
          kind: KIND_MODULE_STATE,
          apiVersion: 'v0.1',
          metadata: { id: 'RosImageAgentlet' },
          spec: { state: 'oops' },
        },
        user,
      })
    ).to.be.rejectedWith(SchemaError);
  });

  it('apply: creates a system-wide module state document', async () => {
    const user = await createUser({ role: ROLE_MANAGER });
    await configApi.apply({
      configObject: {
        kind: KIND_MODULE_STATE,
        apiVersion: 'v0.1',
        metadata: { id: 'RosImageAgentlet' },
        spec: { state: { cameraViewOn: true, quality: 10 } },
      },
      user,
    });
    const doc = await findSystemDoc('RosImageAgentlet');
    expect(doc).to.exist;
    expect(doc.entityType).to.eq(ID_TYPE_SYSTEM_WIDE);
    expect(doc.entityId).to.eq(ID_DEFAULT);
    expect(doc.moduleName).to.eq('RosImageAgentlet');
    expect(doc.cameraViewOn).to.eq(true);
    expect(doc.quality).to.eq(10);
  });

  it('apply: replaces the document (fields removed from state disappear)', async () => {
    const user = await createUser({ role: ROLE_MANAGER });
    await configApi.apply({
      configObject: {
        kind: KIND_MODULE_STATE,
        apiVersion: 'v0.1',
        metadata: { id: 'RosImageAgentlet' },
        spec: { state: { cameraViewOn: true, quality: 10 } },
      },
      user,
    });
    await configApi.apply({
      configObject: {
        kind: KIND_MODULE_STATE,
        apiVersion: 'v0.1',
        metadata: { id: 'RosImageAgentlet' },
        spec: { state: { cameraViewOn: false } },
      },
      user,
    });
    const doc = await findSystemDoc('RosImageAgentlet');
    expect(doc.cameraViewOn).to.eq(false);
    expect(doc).to.not.have.property('quality');
  });

  it('apply: null spec deletes the document', async () => {
    const user = await createUser({ role: ROLE_MANAGER });
    await configApi.apply({
      configObject: {
        kind: KIND_MODULE_STATE,
        apiVersion: 'v0.1',
        metadata: { id: 'RosImageAgentlet' },
        spec: { state: { cameraViewOn: true } },
      },
      user,
    });
    expect(await findSystemDoc('RosImageAgentlet')).to.exist;
    await configApi.apply({
      configObject: {
        kind: KIND_MODULE_STATE,
        apiVersion: 'v0.1',
        metadata: { id: 'RosImageAgentlet' },
        spec: null,
      },
      user,
    });
    expect(await findSystemDoc('RosImageAgentlet')).to.not.exist;
  });

  it('apply: identification fields are not overridable via state', async () => {
    // Even if a caller puts entityType/entityId/moduleName inside state, the
    // resulting document still belongs to the system layer with the requested
    // moduleName.
    const user = await createUser({ role: ROLE_MANAGER });
    await configApi.apply({
      configObject: {
        kind: KIND_MODULE_STATE,
        apiVersion: 'v0.1',
        metadata: { id: 'RosImageAgentlet' },
        spec: {
          state: {
            entityType: 'robot',
            entityId: 'r2d2',
            moduleName: 'OtherAgentlet',
            cameraViewOn: true,
          }
        },
      },
      user,
    });
    const doc = await findSystemDoc('RosImageAgentlet');
    expect(doc).to.exist;
    expect(doc.entityType).to.eq(ID_TYPE_SYSTEM_WIDE);
    expect(doc.entityId).to.eq(ID_DEFAULT);
    expect(doc.moduleName).to.eq('RosImageAgentlet');
    expect(doc.cameraViewOn).to.eq(true);
    // And there is no impostor document for the (robot, r2d2, OtherAgentlet) triple
    const impostor = await RobotModuleState.findOneAsync({
      entityType: 'robot', entityId: 'r2d2', moduleName: 'OtherAgentlet'
    });
    expect(impostor).to.not.exist;
  });

  // ---- clear ------------------------------------------------------------

  it('clear: deletes the matching system-wide document', async () => {
    const user = await createUser({ role: ROLE_MANAGER });
    await configApi.apply({
      configObject: {
        kind: KIND_MODULE_STATE,
        apiVersion: 'v0.1',
        metadata: { id: 'RosImageAgentlet' },
        spec: { state: { cameraViewOn: true } },
      },
      user,
    });
    expect(await findSystemDoc('RosImageAgentlet')).to.exist;
    await configApi.clear({
      configObject: {
        kind: KIND_MODULE_STATE,
        apiVersion: 'v0.1',
        metadata: { id: 'RosImageAgentlet' },
      },
      user,
    });
    expect(await findSystemDoc('RosImageAgentlet')).to.not.exist;
  });

  it('clear: is a no-op when the document does not exist', async () => {
    const user = await createUser({ role: ROLE_MANAGER });
    await configApi.clear({
      configObject: {
        kind: KIND_MODULE_STATE,
        apiVersion: 'v0.1',
        metadata: { id: 'DoesNotExist' },
      },
      user,
    });
    expect(await findSystemDoc('DoesNotExist')).to.not.exist;
  });

  it('clear: does not touch non-system documents with the same moduleName', async () => {
    const user = await createUser({ role: ROLE_MANAGER });
    // Pre-existing robot-scoped document for the same module
    await RobotModuleState.insertAsync({
      entityType: 'robot',
      entityId: 'r2d2',
      moduleName: 'RosImageAgentlet',
      cameraViewOn: true,
    });
    await configApi.apply({
      configObject: {
        kind: KIND_MODULE_STATE,
        apiVersion: 'v0.1',
        metadata: { id: 'RosImageAgentlet' },
        spec: { state: { cameraViewOn: false } },
      },
      user,
    });
    await configApi.clear({
      configObject: {
        kind: KIND_MODULE_STATE,
        apiVersion: 'v0.1',
        metadata: { id: 'RosImageAgentlet' },
      },
      user,
    });
    // System doc gone, robot doc still here
    expect(await findSystemDoc('RosImageAgentlet')).to.not.exist;
    const robotDoc = await RobotModuleState.findOneAsync({
      entityType: 'robot', entityId: 'r2d2', moduleName: 'RosImageAgentlet'
    });
    expect(robotDoc).to.exist;
    expect(robotDoc.cameraViewOn).to.eq(true);
  });

  // ---- list -------------------------------------------------------------

  it('list: short format returns system module states only', async () => {
    const user = await createUser({ role: ROLE_MANAGER });
    await configApi.apply({
      configObject: {
        kind: KIND_MODULE_STATE,
        apiVersion: 'v0.1',
        metadata: { id: 'RosImageAgentlet' },
        spec: { state: { cameraViewOn: true } },
      },
      user,
    });
    await configApi.apply({
      configObject: {
        kind: KIND_MODULE_STATE,
        apiVersion: 'v0.1',
        metadata: { id: 'RosTeleopAgentlet' },
        spec: { state: { linear_vel: 1 } },
      },
      user,
    });
    // Noise that must NOT be returned: a robot-scoped doc and an agent-scoped doc.
    await RobotModuleState.insertAsync({
      entityType: 'robot',
      entityId: 'r2d2',
      moduleName: 'RosImageAgentlet',
      cameraViewOn: false,
    });
    await RobotModuleState.insertAsync({
      entityType: 'agent',
      entityId: 'r2d2',
      moduleName: 'RosImageAgentlet',
      loaded: true,
    });
    const result = await configApi.list({
      user,
      kind: KIND_MODULE_STATE,
      format: LIST_FORMAT_SHORT,
    });
    const ids = result.map(r => r.id).sort();
    expect(ids).to.deep.eq(['RosImageAgentlet', 'RosTeleopAgentlet']);
    result.forEach((r) => {
      expect(r.kind).to.eq(KIND_MODULE_STATE);
    });
  });

  it('list: full format round-trips through apply', async () => {
    const user = await createUser({ role: ROLE_MANAGER });
    const spec = { state: { cameraViewOn: true, quality: 10 } };
    await configApi.apply({
      configObject: {
        kind: KIND_MODULE_STATE,
        apiVersion: 'v0.1',
        metadata: { id: 'RosImageAgentlet' },
        spec,
      },
      user,
    });
    const result = await configApi.list({
      user,
      kind: KIND_MODULE_STATE,
      format: LIST_FORMAT_FULL,
    });
    expect(result).to.have.length(1);
    const [item] = result;
    expect(item.kind).to.eq(KIND_MODULE_STATE);
    expect(item.apiVersion).to.eq('v0.1');
    expect(item.metadata.id).to.eq('RosImageAgentlet');
    expect(item.spec.state).to.deep.eq({ cameraViewOn: true, quality: 10 });
  });

  it('list: filters by id', async () => {
    const user = await createUser({ role: ROLE_MANAGER });
    await configApi.apply({
      configObject: {
        kind: KIND_MODULE_STATE,
        apiVersion: 'v0.1',
        metadata: { id: 'RosImageAgentlet' },
        spec: { state: { cameraViewOn: true } },
      },
      user,
    });
    await configApi.apply({
      configObject: {
        kind: KIND_MODULE_STATE,
        apiVersion: 'v0.1',
        metadata: { id: 'RosTeleopAgentlet' },
        spec: { state: { linear_vel: 1 } },
      },
      user,
    });
    const result = await configApi.list({
      user,
      kind: KIND_MODULE_STATE,
      id: 'RosTeleopAgentlet',
      format: LIST_FORMAT_SHORT,
    });
    expect(result).to.have.length(1);
    expect(result[0].id).to.eq('RosTeleopAgentlet');
  });
});
