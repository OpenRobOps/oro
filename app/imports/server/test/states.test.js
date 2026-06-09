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
 * Tests for getCalculatedStateAsync, the helper that merges robot/system module
 * state into an effective configuration.
 *
 * Regression coverage: getCalculatedStateAsync takes `{ robotId, moduleName, keys }`.
 * The Images module used to call it with the getEntityConfig shape
 * (`{ entityId, entityType, fields }`), which left `robotId` undefined and made
 * the downstream getEntityConfig throw 'Missing entityId/entityType'. Because
 * that call runs from the image-agentlet runlevel-change callback, the throw was
 * uncaught and crashed the server when opening a Navigation dashboard with a
 * camera widget. These tests pin the contract so the wrong call shape fails fast.
 */
import { Meteor } from 'meteor/meteor';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
// ORO modules
import { resetDatabase } from './setup';
import { getCalculatedStateAsync } from '../../lib/states';
import { RobotModuleState } from '../../lib/collections';
import { ID_TYPE_ROBOT } from '../../lib/configManagerAsync';
import { MODULE_NAMES } from '../../shared/constants';

// Just make sure this is not getting loaded in dev/prod
if (!Meteor.isTest) {
  throw new Error('This is TEST code only');
}
const { expect } = chai;
chai.use(chaiAsPromised);

const ROBOT_ID = 'r2d2';
const MODULE_NAME = MODULE_NAMES.ROS_IMAGE_AGENTLET;

describe('states:getCalculatedStateAsync', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('returns the calculated module state for a valid robotId', async () => {
    // Robot-scoped module state, the shape the Images module reads.
    await RobotModuleState.insertAsync({
      entityType: ID_TYPE_ROBOT,
      entityId: ROBOT_ID,
      moduleName: MODULE_NAME,
      cameras_config: { 0: { fps: 5 } },
    });

    const state = await getCalculatedStateAsync({
      robotId: ROBOT_ID,
      moduleName: MODULE_NAME,
      keys: ['cameras_config'],
    });

    expect(state).to.deep.equal({ cameras_config: { 0: { fps: 5 } } });
  });

  it('returns null for a valid robotId with no configuration for the module', async () => {
    // The happy path the Images module relies on: an empty result must resolve,
    // never throw.
    const state = await getCalculatedStateAsync({
      robotId: ROBOT_ID,
      moduleName: MODULE_NAME,
      keys: ['cameras_config'],
    });

    expect(state).to.equal(null);
  });

  it('throws when robotId is missing (regression: the getEntityConfig call shape)', async () => {
    // This is exactly the bug that crashed Navigation dashboards: the Images
    // module passed `{ entityId, entityType }` instead of `robotId`, so the
    // function received an undefined robotId and threw downstream.
    await expect(
      getCalculatedStateAsync({
        entityId: ROBOT_ID,
        entityType: ID_TYPE_ROBOT,
        moduleName: MODULE_NAME,
        keys: ['cameras_config'],
      })
    ).to.be.rejectedWith(/Missing entityId\/entityType/);
  });
});
