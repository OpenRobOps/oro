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
 * Unit tests for the ROS Diagnostics module.
 */
import mongoUnit from 'mongo-unit';
import { expect } from 'chai';
import * as sinon from 'sinon';
// ORO modules
import MqttMock from './mocks/mqtt';
import DiagnosticsModule from '../src/server/modules/diagnostics';
import { SOURCES } from '../src/shared/attributes';

const ROBOT_ID = 'r0';
const TS = 1712870181770;

describe('DiagnosticsModule: incoming diagnostics messages processing', () => {
  let diagnostics;
  let mqtt;
  let sandbox;
  let saveAttributesFromMappings;

  const protoEncodeDiagnosticsMessage = (msg) =>
    mqtt.lookupType('oro.RosDiagnosticsMessage').encode(msg).finish();

  beforeEach(async () => {
    await mongoUnit.drop();
    mqtt = new MqttMock();
    diagnostics = new DiagnosticsModule(mqtt);
    diagnostics.load({});
    sandbox = sinon.createSandbox();
    // Stub the AttributesManager: its pipeline is tested in attributes.test.js
    saveAttributesFromMappings = sandbox.stub(diagnostics.attrMgr, 'saveAttributesFromMappings');
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('exposes level and msg of every status as mappable key-values', async () => {
    const buffer = protoEncodeDiagnosticsMessage({
      ts: TS,
      fields: [
        { name: '/Other/amcl: Standard deviation', level: 1, msg: 'Too large', hasLevel: true },
        { name: '/Motors', level: 0, msg: 'OK', hasLevel: true }
      ]
    });
    await diagnostics.onMessageV2(ROBOT_ID, buffer);

    sandbox.assert.calledOnce(saveAttributesFromMappings);
    const { robotId, source, updates, ts } = saveAttributesFromMappings.firstCall.args[0];
    expect(robotId).to.equal(ROBOT_ID);
    expect(source).to.equal(SOURCES.ROS_DIAGNOSTICS.value);
    expect(ts).to.equal(TS);
    expect(updates).to.deep.include.members([
      { value: 1, namespace: '/Other/amcl: Standard deviation', key: '__level__' },
      { value: 'Too large', namespace: '/Other/amcl: Standard deviation', key: '__msg__' },
      { value: 0, namespace: '/Motors', key: '__level__' },
      { value: 'OK', namespace: '/Motors', key: '__msg__' }
    ]);
  });

  it('still forwards real key-values along with the reserved ones', async () => {
    const buffer = protoEncodeDiagnosticsMessage({
      ts: TS,
      fields: [{
        name: '/Other/amcl: Standard deviation',
        level: 0,
        msg: 'OK',
        hasLevel: true,
        keyValues: [{ key: 'std_x', value: '0.05' }]
      }]
    });
    await diagnostics.onMessageV2(ROBOT_ID, buffer);

    const { updates } = saveAttributesFromMappings.firstCall.args[0];
    expect(updates).to.deep.include.members([
      { value: '0.05', namespace: '/Other/amcl: Standard deviation', key: 'std_x' },
      { value: 0, namespace: '/Other/amcl: Standard deviation', key: '__level__' },
      { value: 'OK', namespace: '/Other/amcl: Standard deviation', key: '__msg__' }
    ]);
  });
});
