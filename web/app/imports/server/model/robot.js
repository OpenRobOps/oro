/**
 * Represents a Robot object, backed by the Robots collection.
 *
 * IMPORTANT: Please see the class comment for Model before doing
 * any work on this class.
 *
 */
import { isEmpty, isObject } from 'lodash';
import Model from './model';
import { Robots } from '../../lib/collections';
import { toDotNotation } from '../../lib/util';
import { HACK_GHOST_UPDATE_STAMP_VALUE } from '../../shared/constants';

export default class Robot extends Model {
  constructor(robotId) {
    super(robotId, Robots);
  }

  /**
   * Creates a new robot.
   *
   * @return The id of the newly created robot.
   */
  static createAsync = async ({ robotId, name, agentVersion, variant, hostname }) => {
    const newRobot = {
      _id: robotId,
      version: agentVersion,
      name,
      updateStamp: new Date().getTime(),
      status: { agentOnline: false },
    };
    if (variant) {
      newRobot.variant = variant;
    }
    if (hostname) {
      newRobot.hostname = hostname;
    }
    const robotDocId = await Robots.insertAsync(newRobot);
    // NOTE Create any related data structures here.
    // Use the corresponding manager when applicable.
    return robotDocId;
  };

  /**
   * Tells whether a robot is online
   */
  isOnlineAsync = async () => {
    this._checkValid();
    const robotDoc = await this._fetchAsync({ _id: 0, 'status.agentOnline': 1 });
    return robotDoc.status && robotDoc.status.agentOnline;
  };

  getStatusValueAsync = async () => {
    this._checkValid();
    const robotDoc = await this._fetchAsync({ _id: 0, 'status.value': 1 });
    return robotDoc.status && robotDoc.status.value;
  };

  deleteAsync = async (force) => {
    this._checkValid();
    // Robot needs to be offline (otherwise the delete will be futile)
    const online = await this.isOnlineAsync();
    if (online && !force) {
      throw new Error('Attempt to delete online robot');
    }
    const robotId = this._id;
    // Clear MQTT retained messages for this robot
    // const mqtt = new Mqtt();  // TODO
    // mqtt.clearRobotState({ robotId });
    // Delete MQTT credentials and ACLs
    await new MqttAssignmentManager().deleteConfig({ robotId });

    // Delete the robot record
    await Robots.removeAsync(robotId);
  };

  /**
   * Gets the name of the robot
   */
  getNameAsync = async () => {
    this._checkValid();
    const doc = await this._fetchAsync({ _id: 0, name: 1 });
    return doc.name;
  };

  getAgentVersionAsync = async () => {
    this._checkValid();
    const doc = await this._fetchAsync({ _id: 0, version: 1 });
    return doc.version;
  };

  /**
   * Hack/demo method: Tells if this robot represents a ghost robot - they are db stub documents,
   * not real robots.
   * These are identified as a hack in our platform with a updated timestamp `12`.
   */
  isGhostAsync = async () => {
    this._checkValid();
    const doc = await this._fetchAsync({ updateStamp: 1 });
    return doc && doc.updateStamp == HACK_GHOST_UPDATE_STAMP_VALUE;
  };

  /**
   * Gets the current Lock (see lock module)
   */
  getLockAsync = async () => {
    this._checkValid();
    const doc = await this._fetchAsync({ _id: 0, lock: 1 });
    return doc.lock;
  };

  /**
   * Updates the robot Lock. See lock module.
   * If lock is an object and lock.locked is true, the robot is also
   * added to the collection `LOCKED_ROBOTS_ID`, otherwise both the lock
   * object is removed from the robot, and the robot from the collection.
   */
  setLockAsync = async (lock) => {
    this._checkValid();
    const update = {};
    if (lock && lock.locked) {
      update.$set = { lock };
    } else {
      update.$unset = { lock: 1 };
    }
    await Robots.updateAsync({ _id: this._id }, update);
  };

  /**
   * Updates fields from the robot Lock. See lock module.
   * The update is performend only if the lock has not changed (e.g. broken
   * and locked by other user), which we detect by the initial timestamp matching
   * the expected value `lockTs`.
   */
  updateLockAsync = async (lockTs, fields) => {
    this._checkValid();
    if (!isObject(fields) || isEmpty(fields)) {
      throw new Error('invalid fields for lock update');
    }
    // convert fields update to point-wise notation: { locked: false }
    // would become { 'lock.locked': false }
    const update = { $set: toDotNotation(fields, 'lock') };
    // Perform the update only if the initial lock timestamp matches
    return await Robots.updateAsync({ _id: this._id, 'lock.ts': lockTs }, update);
  };
}