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
