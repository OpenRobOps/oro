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
 * Unit tests for BasicsModule class.
 */

import mongoUnit from 'mongo-unit';
import { assert } from 'chai';

// ORO modules
import { COLLECTIONS } from '../src/shared/constants';
import * as robotsTestData from './testData/robots.json';
import { BasicsModule } from '../src/server/modules';
import MongoManager from '../src/mongo';
import MqttMock from './mocks/mqtt';


const mongo = new MongoManager();

const mockAgentVersion = '1.2.3';

const robotApiKey = robotsTestData.dummyWithApiKey.robotKey;

/**
 * Creates the dummy robot in the DB and returns its id.
 */
async function createDummyRobotInDB() {
  await mongo.getCollection(COLLECTIONS.ROBOTS).insertOne(robotsTestData.dummy);
  return robotsTestData.dummy._id;
}

describe('BasicModule module', () => {
  beforeEach(async () => {
    await mongoUnit.drop();
  });

  /**
   * Validate that agent status updates properly when sending onState messages.
   */
  it('Updates agent online/offline status on state messages', async () => {
    const mqtt = new MqttMock();
    const basicModule = new BasicsModule(mqtt);
    basicModule.load();
    const robotsCollection = mongo.getCollection(COLLECTIONS.ROBOTS);
    const robotId = await createDummyRobotInDB();

    // Process online state
    await basicModule.onState(robotId, `1|${robotApiKey}|${mockAgentVersion}`, { retain: false });
    const robotStateOnline = await robotsCollection.findOne({ _id: robotId });
    assert.equal(robotStateOnline.status && robotStateOnline.status.agentOnline, true);
    assert.equal(robotStateOnline.version, mockAgentVersion);

    // Process offline state
    await basicModule.onState(robotId, `0|${robotApiKey}|${mockAgentVersion}`, { retain: false });
    const robotStateOffline = await robotsCollection.findOne({ _id: robotId });
    assert.equal(robotStateOffline.status && robotStateOffline.status.agentOnline, false);
    assert.equal(robotStateOffline.version, mockAgentVersion);
  });

  /**
   * Validate that agent status updates properly when sending onState messages but using
   * a valid robotApiKey instead of company apiKey
   */
  it('Updates agent online/offline status on state messages with robotApiKey', async () => {
    const mqtt = new MqttMock();
    const basicModule = new BasicsModule(mqtt);
    basicModule.load();
    const robotsCollection = mongo.getCollection(COLLECTIONS.ROBOTS);
    const robotId = await createDummyRobotInDB();
    const apiKey = "123";

    // Process online state
    await basicModule.onState(robotId, `1|${robotApiKey}|${mockAgentVersion}`, { retain: false });
    const robotStateOnline = await robotsCollection.findOne({ _id: robotId });
    console.log(robotStateOnline);
    assert.equal(robotStateOnline.status && robotStateOnline.status.agentOnline, true);
    assert.equal(robotStateOnline.version, mockAgentVersion);

    // Process offline state
    await basicModule.onState(robotId, `0|${robotApiKey}|${mockAgentVersion}`, { retain: false });
    const robotStateOffline = await robotsCollection.findOne({ _id: robotId });
    assert.equal(robotStateOffline.status && robotStateOffline.status.agentOnline, false);
    assert.equal(robotStateOffline.version, mockAgentVersion);
  });
});
