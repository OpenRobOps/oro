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

// const companyApiKey = companiesTestData.dummyWithApiKey.apiKey;
// const robotApiKey = robotsTestData.dummyWithApiKey.robotKey;

/**
 * Creates the dummy robot in the DB and returns its id.
 */
async function createDummyRobotInDB() {
  await mongo.getCollection(COLLECTIONS.ROBOTS).insertOne(robotsTestData.dummy);
  return robotsTestData.dummy._id;
}

/**
 * Creates the dummy robot in the DB and returns its id.
 */
async function createDummyRobotWithApiKeyInDB() {
  await mongo.getCollection(COLLECTIONS.ROBOTS).insertOne(robotsTestData.dummyWithApiKey);
  return robotsTestData.dummyWithApiKey._id;
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
    const apiKey = "123";

    // Process online state
    await basicModule.onState(robotId, `1|${apiKey}|${mockAgentVersion}`, { retain: false });
    const robotStateOnline = await robotsCollection.findOne({ _id: robotId });
    assert.equal(robotStateOnline.status && robotStateOnline.status.agentOnline, true);
    assert.equal(robotStateOnline.version, mockAgentVersion);

    // Process offline state
    await basicModule.onState(robotId, `0|${apiKey}|${mockAgentVersion}`, { retain: false });
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
    await basicModule.onState(robotId, `1|${apiKey}|${mockAgentVersion}`, { retain: false });
    const robotStateOnline = await robotsCollection.findOne({ _id: robotId });
    console.log(robotStateOnline);
    assert.equal(robotStateOnline.status && robotStateOnline.status.agentOnline, true);
    assert.equal(robotStateOnline.version, mockAgentVersion);

    // Process offline state
    await basicModule.onState(robotId, `0|${apiKey}|${mockAgentVersion}`, { retain: false });
    const robotStateOffline = await robotsCollection.findOne({ _id: robotId });
    assert.equal(robotStateOffline.status && robotStateOffline.status.agentOnline, false);
    assert.equal(robotStateOffline.version, mockAgentVersion);
  });
});
