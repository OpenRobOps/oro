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
 * Ingest-side implementation of the Robot Events module.
 *
 * This module receives events sent by the agent (on the 'events' subtopic) and relays them
 * to the proper component. Events carry the same CustomDataMessage payload as the Custom Data
 * module, but represent sampled events rather than periodically-published values.
 */
import { COLLECTIONS } from '../../shared/constants';
import AttributesManager from '../attributes';

const KV_RESERVED_KEYS = new Set(['robotId', '_id']); // cannot publish/change these

export default class RobotEventsModule {
  /**
   * Creates a new instance of the RobotEventsModule.
   *
   * @param {OroMqtt} mqtt - The MQTT client object.
   * @param {MongoManager} mongo - The MongoDB manager object.
   */
  constructor({ mqtt, mongo }) {
    this._mqtt = mqtt;
    this._mongoMgr = mongo;
    this._attrMgr = new AttributesManager();
  }

  /**
   * Registers to MQTT topics and initializes necessary data structures.
   *
   * @returns {RobotEventsModule} - The object itself for method chaining.
   */
  load = () => {
    // Register to MQTT topics
    this._mqtt.registerListener('events', this.onEvent);
    this._customDataMessage = this._mqtt.lookupType('oro.CustomDataMessage');
    this._keyValuesColl = this._mongoMgr.getCollection(COLLECTIONS.ROBOT_KEY_VALUES);
    return this;
  };

  /**
   * Process incoming MQTT event messages.
   *
   * @param {string} robotId - The ID of the robot sending the message.
   * @param {ArrayBuffer} msg - The incoming message as an ArrayBuffer.
   * @returns {Promise} - A promise that resolves when the message has been processed.
   */
  onEvent = async (robotId, msg, _packet) => {
    const decodedMsg = this._customDataMessage.decode(msg);
    const payloadType = decodedMsg.payload;
    const { customField } = decodedMsg;
    const ts = (decodedMsg.ts && decodedMsg.ts.toNumber()) || Date.now();

    // Decode message according to payload type.
    if (payloadType == 'keyValuePayload') {
      // Propagate these values to AttributesManager.
      // Convert ts on each k/v pair element to a JavaScript number.
      // Also remove if the value is zero since that means no data was received.
      // TODO This is losing precision! Consider updating the whole
      // attributes pipeline to support 64-bits timestamps.
      const pairs = decodedMsg[payloadType].pairs.map((pair) => {
        const kvMsg = { key: pair.key, value: pair.value };
        const kvTs = pair.ts.toNumber();
        if (kvTs != 0) {
          kvMsg.ts = kvTs;
        }
        return kvMsg;
      });
      await this._attrMgr.handleEvents({ robotId, customField }, pairs, ts);
      // Update available _keys_ for this robot in the db
      await this.updateDataKeys(robotId, pairs, ts);
    } else {
      console.warn(`event unsupported payload type: ${payloadType}`);
    }
  };

  /**
   * Updates a "recently seen" snapshot of custom data _keys_ in the db. For each robot, we keep
   * a set of keys with their last-seen timestamp.
   *
   * @param {string} robotId - The ID of the robot reporting these k-v pairs.
   * @param {Array<Object>} pairs - An array of key-value pairs to update.
   * @param {number} [ts=Date.now()] - The timestamp for the update.
   * @returns {Promise<undefined>} - A Promise that resolves to undefined.
   */
  updateDataKeys = async (robotId, pairs, ts = Date.now()) => {
    // TODO(herchu) instead of blindly updating all keys, consider determining if there is _any_
    // key that deserves updating (ie. older than 5min) and skip the update otherwise, saving writes
    const $set = {
      _id: robotId
    };
    pairs.forEach((kv) => {
      if (kv?.key && !KV_RESERVED_KEYS.has(kv.key)) {
        $set[kv.key] = {
          value: kv.value,
          ts: kv.ts || ts
        };
      }
    });
    await this._keyValuesColl.updateOne({ _id: robotId }, { $set }, { upsert: true });
  };
}
