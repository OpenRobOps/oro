/**
 * Common functions that should be reused across tests.
 */
import MongoManager from '../src/mongo';
import { COLLECTIONS } from '../src/shared/constants';
import * as robotsTestData from './testData/robots.json';

const randomId = () => (
  (Math.random() + 1).toString(36).substring(4)
);

/**
 * Creates the dummy robot in the DB and returns its id.
 */
const createDummyRobotInDB = async (companyId) => {
  const robotDoc = {
    ...robotsTestData.dummy,
    _id: randomId(),
    companyId
  };
  await new MongoManager().getCollection(COLLECTIONS.ROBOTS).insertOne(robotDoc);
  return robotDoc._id;
};

const createDummyRobotOfflineInDB = async (companyId) => {
  const robotDoc = {
    ...robotsTestData.dummyOffline,
    _id: randomId(),
    companyId
  };
  await new MongoManager().getCollection(COLLECTIONS.ROBOTS).insertOne(robotDoc);
  return robotDoc._id;
};

export {
  createDummyRobotInDB,
  createDummyRobotOfflineInDB,
  randomId
};