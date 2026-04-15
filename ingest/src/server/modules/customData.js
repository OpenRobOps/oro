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
 * Ingest-side implementation of the Custom Data Module.
 *
 * Handles state configuration and communication with the CustomDataAgentlet.
 */

import zlib from 'zlib';
import { COLLECTIONS } from '../../shared/constants';
import AttributesManager from '../attributes';

const KV_RESERED_KEYS = new Set(['robotId', '_id']); // cannot publish/change these


export default class CustomDataModule {
  /**
   * Creates a new instance of the CustomDataModule.
   *
   * @param {OroMqtt} mqtt - The MQTT client object.
   * @param {boolean} [batchProcessing=false] - Flag to indicate in batch mode processing.
   */
  constructor({ mqtt, mongo }) {
    this._mqtt = mqtt;
    this._mongoMgr = mongo;
    this._attrMgr = new AttributesManager();
  }

  /**
   * Registers to MQTT topics and initializes necessary data structures for the application.
   *
   * @returns {CustomDataModule} - The object itself for method chaining.
   */
  load = () => {
    // Register to MQTT topics
    this._mqtt.registerListener('custom', this.onMessage);
    this._customDataCollMessage = this._mqtt.lookupType('oro.CustomDataMessage');
    this._customDataColl = this._mongoMgr.getCollection(COLLECTIONS.CUSTOM_DATA);
    this._keyValuesColl = this._mongoMgr.getCollection(COLLECTIONS.ROBOT_KEY_VALUES);
    return this;
  };

  /**
   * Process incoming MQTT custom data messages.
   *
   * @param {string} robotId - The ID of the robot sending the message.
   * @param {ArrayBuffer} msg - The incoming message as an ArrayBuffer.
   * @returns {Promise} - A promise that resolves when the message has been processed.
   */
  onMessage = async (robotId, msg, _packet) => {
    const decodedMsg = this._customDataCollMessage.decode(msg);
    await this.processDecodedMessage(robotId, decodedMsg);
  };

  /**
   * Processes a decoded message received from a robot.
   *
   * @param {string} robotId - The ID of the robot.
   * @param {Object} decodedMsg - The decoded message object.
   * @returns {Promise} A promise that resolves when processing is complete.
   */
  processDecodedMessage = async (robotId, decodedMsg) => {
    const payloadType = decodedMsg.payload;
    const { customField } = decodedMsg;
    const customData = {};
    const ts = (decodedMsg.ts && decodedMsg.ts.toNumber()) || Date.now();
    // Decode message according to payload type.
    if (payloadType == 'keyValuePayload') {
      // Propagate these values to AttributeManager.
      // Convert ts on each k/v pair element to a JavaScript number.
      // Also remove if the value is zero since that means no data was received.
      // TODO This is losing precision! Consider updating the whole
      // attributes pipeline to support 64-bits timestamps.
      const pairs = decodedMsg[payloadType].pairs.map((pair) => {
        const msg = { key: pair.key, value: pair.value };
        const kvTs = pair.ts.toNumber();
        if (kvTs != 0) {
          msg.ts = kvTs;
        }
        return msg;
      });
      await this._attrMgr.handleKeyValuePairs(robotId, customField, pairs, ts);
      // Update available _keys_ for this robot in the db
      this.updateDataKeys(robotId, pairs, ts);

    } else if (payloadType == 'textFilePayload_2') {
      // NOTE: Older protocol versions used payloadType 'textFilePayload' for custom data.
      // That one has been deprecated; we only keep compatibility for textFilePayload_2
      const { data } = decodedMsg[payloadType];
      zlib.inflate(data, (error, data) => {
        if (data) {
          customData.text = data.toString();
          customData.ts = ts;
          // Save extra details
          customData.details = {};
          customData.details.blobOffset = decodedMsg[payloadType].blobOffset;
          customData.details.blobSize = decodedMsg[payloadType].blobSize;
          customData.details.totalFileSize = decodedMsg[payloadType].totalFileSize;
          // Avoid updating real-time data in mongo if we are processing batch data from the past
          if (!this._batchProcessing) {
            this._customDataColl.updateOne(
              { robotId, customField },
              { $set: customData },
              { upsert: true }
            );
          }
        }
        if (error) {
          console.error(error);
        }
      });

    } else if (payloadType == 'imagePayload') {
      // Data is binary on mqtt, and we store and transmit base64 to client
      customData._image = new Buffer(decodedMsg[payloadType]).toString('base64');
      customData.ts = ts;
      // Avoid updating real-time data in mongo if we are processing batch data from the past
      if (!this._batchProcessing) {
        await this._customDataColl.updateOne(
          { robotId, customField },
          { $set: customData },
          { upsert: true }
        );
      }

    } else if (payloadType == 'diagnosticsPayload') {
      // NOTE(herchu) The agent is still responsible for sending a `label` field back
      //              with the custom data. This was originally sent as `name` in the mapping
      //              definition.
      // TODO(herchu) Don't use `name` or `field`. Just look for the attribute definition and
      //              use the correct attribute on the robot name to place in
      //              RobotCustomDataKeyValues to display in the widget.
      const { label, value: diagValue } = decodedMsg[payloadType];

      // Send the data to Vitals module to be processed
      const attr = CustomDataModule.getAttributeKey({
        sourceId: decodedMsg.customField,
      });

      // calculate mappingKey and use that in the next call
      // TODO: Consider dropping handleDiagnosticsData and just using a generic
      //                   attribute manager updates handlers.
      this.attrMgr.handleDiagnosticsData({ robotId }, attr, diagValue, ts);
      // Save these key-value in the 'last seen key-values' collection too
      this.updateDataKeys(robotId, [{ key: label, value: diagValue }], ts);
    }
  };

  /**
   * Generates an attribute Key to be used for values coming from this source for the given
   * parameters.
   *
   * @param {Object} object - The object containing the source ID.
   * @param {string} object.sourceId - The source ID used to generate the attribute key.
   * @returns {string} The attribute key corresponding to the source ID.
   */
  static getAttributeKey = ({ sourceId }) => sourceId;

  /**
   * Updates a "recently seen" snapshot of custom data _keys_ in the db. For each robot, we keep a
   * set of keys with their last-seen timestamp.
   *
   * @param {string} robotId - The ID of the robot.
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
      if (kv?.key && !KV_RESERED_KEYS.has(kv.key)) {
        $set[kv.key] = {
          value: kv.value,
          ts: kv.ts || ts
        };
      }
    });
    await this._keyValuesColl.updateOne({ _id: robotId }, { $set }, { upsert: true });
  };
}
