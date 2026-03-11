/**
 * Represents a Robot object, backed by the Robots collection.
 *
 * IMPORTANT: Please see the class comment for Model before doing
 * any work on this class.
 **/
import { _ } from 'lodash';
// ORO modules
import { COLLECTIONS } from '../../shared/constants';
import Model from './model';
import MongoManager from '../../mongo';

export default class Robot extends Model {
  constructor(robotId) {
    // Get access to Robots collection
    const Robots = new MongoManager().getCollection(COLLECTIONS.ROBOTS);
    super(robotId, Robots);
  }

  /**
   * Returns a new Robot object based on the provided
   * MongoDB query parameters, or undefined if none
   * is found.
   */
  static findOne = (params) => {
    // TODO Sanity checks and error handling.
    const Robots = new MongoManager().getCollection(COLLECTIONS.ROBOTS);
    const doc = Robots.findOne(params);
    if (doc) {
      return new Robot(doc._id);
    }
  }

  /**
   * Tells whether a robot is online
   */
  isOnline = async () => {
    this._checkValid();
    const robotDoc = await this._fetch({ _id: 0, 'status.agentOnline': 1 });
    return robotDoc.status && robotDoc.status.agentOnline;
  }

  /**
   * Returns the current robot overal status value
   */
  getStatusValue = () => {
    this._checkValid();
    const robotDoc = this._fetch({ _id: 0, 'status.value': 1 });
    return robotDoc.status && robotDoc.status.value;
  }

  /**
   * Gets the name of the robot
   */
  getName = async () => {
    this._checkValid();
    const doc = await this._fetch({ _id: 0, name: 1 });
    return doc.name;
  }

  /**
   * Gets the hostname of the robot
   */
  getHostname = async () => {
    this._checkValid();
    const doc = await this._fetch({ _id: 0, hostname: 1 });
    return doc.hostname;
  }

  /**
   * Gets the installed agent version on this robot
   */
  getAgentVersion = async () => {
    const doc = await this._fetch({ _id: 0, version: 1 });
    return doc.version;
  }

  /**
   * Gets the list of collection IDs a robot belongs to.
   */
  getCollections = async () => {
    this._checkValid();
    const doc = await this._fetch({ _id: 0, collections: 1 });
    return doc.collections || [];
  }

  /**
   * Sets minRunlevel:2 to RosDiagnosticsAgentlet at robot level.
   */
  setDiagnosticsMinRunlevel = async (minRunlevel) => {
    if (_.isNumber(minRunlevel)) {
      const robotModuleState = await new MongoManager().getCollection(COLLECTIONS.MODULE_STATES);

      await robotModuleState.updateOne({
        entityId: this._id,
        moduleName: "RosDiagnosticsAgentlet",
        entityType: "robot"
      }, { $set: { minRunlevel }}, { upsert: true });
    }
  }

  getRobotKey = async () => {
    this._checkValid();
    const doc = await this._fetch({ _id: 0, robotKey: 1 });
    return doc.robotKey;
  }

}
