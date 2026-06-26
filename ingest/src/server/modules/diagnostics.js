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
 * Ingest-side implementation of the ROS Diagnostics agent module
 */
import { omit, isNumber } from 'lodash';
// ORO modules
import MongoManager from '../../mongo';
import { COLLECTIONS } from '../../shared/constants';
import RateLimiter from '../rateLimiter';
import AttributesManager from '../attributes';
import { SOURCES } from '../../shared/attributes';

export default class DiagnosticsModule {
  constructor(mqtt) {
    this.mqtt = mqtt;
    this.attrMgr = new AttributesManager();
  }

  load = (settings) => {
    const { rateLimit = 10 * 1000 } = settings || {}; // Default rate limit to 1 message every 10 seconds
    this._diagRateLimiter = new RateLimiter(rateLimit);
    console.log('DiagnosticsModule loaded with rateLimit', rateLimit);
    // Register to MQTT topics
    this.mqtt.registerListener('ros/diagnostics2', this.onMessageV2);
    // AGENT_VER_1.16.1
    this.mqtt.registerListener('ros/diagnostics/status', this.onStatusMessage);
    this.RosDiagnosticsMessage = this.mqtt.lookupType('oro.RosDiagnosticsMessage');
    this.RosDiagnosticsStatusMessage = this.mqtt.lookupType('oro.RosDiagnosticsStatusMessage');
    this.rosDiagnostics = new MongoManager().getCollection(COLLECTIONS.DIAGNOSTICS);
  };

  /**
   * Parse protobuf-based message with ROS Diagnostics data.
   */
  onMessageV2 = async (robotId, message) => {
    const status = { robotId };
    const sensorEvents = [];
    // Key-values collected from every diagnostic status. Each one is turned into an attribute
    // value only if it matches an attribute mapping (by node name and key); the rest are
    // ignored.
    const keyValueUpdates = [];
    // Decode the MQTT payload
    try {
      // Limit ROS Diagnostics message rate to once per minute
      // Rate limiter note: timestamp used for throttling is "now", now the one 'ts' from the message
      if (!this._diagRateLimiter.accepts(robotId, Date.now())) {
        return;
      }
      const diagnosticsData = this.RosDiagnosticsMessage.decode(message);
      const diagnosticsFields = diagnosticsData.fields;
      const ts = diagnosticsData.ts.toNumber();
      status.ts = ts;
      diagnosticsFields.forEach((field) => {
        // TODO: agent version >= 1.19.0 will include a hasLevel flag
        // to indicate that level field is present on the message
        // (to avoid confusing default protobuf value with real 0 value).
        // Consider adding it to the checks here too once all agents report it.
        if (field?.name && isNumber(field.level)) {
          const { name, level, msg, keyValues: keyValuesArray } = field;
          const event = { name, level, msg: msg !== undefined ? msg : '' };
          if (keyValuesArray?.length > 0) {
            event.keyValues = keyValuesArray.reduce((acc, kv) => ({
              ...acc,
              [kv.key]: kv.value
            }), {});
            keyValuesArray.forEach((kv) => {
              keyValueUpdates.push({ value: kv.value, namespace: name, key: kv.key });
            });
          }
          sensorEvents.push(event);
        }
      });
    } catch (e) {
      console.error('Failed to parse diagnostics msg', e);
    }
    status.statusList = sensorEvents;

    // Update diagnostics information for this robot
    await this.rosDiagnostics.updateOne(
      { _id: robotId },
      { $set: { ...omit(status, 'robotId') } },
      { upsert: true }
    );

    // Map diagnostics key-values to attributes for robots that configured ros-diagnostics data
    // sources. Unmapped key-values are ignored by saveAttributesFromMappings.
    if (keyValueUpdates.length > 0) {
      await this.attrMgr.saveAttributesFromMappings({
        robotId,
        source: SOURCES.ROS_DIAGNOSTICS.value,
        updates: keyValueUpdates,
        ts: status.ts,
      });
    }
  };

  /**
   * Parse diagnostics status message.
   * Only available from agent 1.16.0 onwards
   */
  onStatusMessage = async (robotId, message) => {
    // Decode the MQTT payload
    try {
      const statusV2 = this.RosDiagnosticsStatusMessage.decode(message);
    console.log("Diagnostics: onStatusMessage" , statusV2)
      if (statusV2 && statusV2.hasStatus) {
        const status = statusV2.status || 0;
        // Save to vitals and propagate updates.
        this.attrMgr.handleDiagnosticsStatus(robotId, status);
      }
    } catch (e) {
      console.error('Failed to parse diagnostics status msg', e);
    }
  };
}
