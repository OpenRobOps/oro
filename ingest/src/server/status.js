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
 * This module encapsulates the management of robot
 * status and alert generation.
 */
import { _ } from 'lodash';
import moment from 'moment';
// ORO modules
import { AsyncCache } from '../shared/simpleCache';
import { COLLECTIONS } from '../shared/constants';
import { STATUS } from '../lib/status';
import AttributesManager from './attributes';
import { formatDuration } from '../lib/util';
import { AttributeValueFormatter } from '../shared/attributes';
import MongoManager from '../mongo';
import PeerClient from './peer';

// Time to keep status configs cached
// Sending system, data sources and ros diagnostics every 10 seconds is about 20 updates / minute.
// Keeping a config 1 minute reduces config access to 1/20 of config reads without cache.
// TODO: Implement a way to broadcast configuration
// changes so we can discard a cache and force re-reading it.
const CONFIG_CACHE_AGE_MS = moment.duration(60, 'seconds').valueOf();

/**
 * Set of available status functions.
 *
 * These methods all have this form:
 * - A generator method that sets the comparison parameters
 * - A call that takes the id of the status and updated value for it
 * - The method should return an object with the keys:
 *   - triggered: true iff the state condition has been met
 *   - message: an optional human readable message explaining the result
 *   - data: an optional data value to set on the status object
 */
const AttributeStatusFunctions = {
  // Triggers when value is higher than the provided threshold
  higherThan: ({ max }) => (id, val, prevStatus, formatter) => {
    // TODO Sanity check and handling
    const result = {
      triggered: (val > max)
    };
    if (result.triggered) {
      result.message = `current value = ${formatter(val)} above threshold ${formatter(max)}`;
    }
    return result;
  },
  // Triggers when value is less than the provided threshold
  lessThan: ({ min }) => (id, val, prevStatus, formatter) => {
    // TODO Sanity check and handling
    const result = {
      triggered: (val < min)
    };
    if (result.triggered) {
      result.message = `current value = ${formatter(val)} below threshold ${formatter(min)}`;
    }
    return result;
  },
  // Triggers when value is higher than the provided threshold
  // for at least the minimum given number of seconds
  sustainedHigherThan: ({ maxValue, minSeconds }) => (id, val, prevStatus, formatter) => {
    // NOTE Data is used to record the time in seconds of consecutive
    // measurements on which the recorded value has been higher than the threshold
    const result = { triggered: false };
    if (val > maxValue) {
      result.data = (prevStatus.data || 0) + (Date.now() - prevStatus.ts) / 1000;
      if (result.data > minSeconds) {
        result.triggered = true;
        result.message = `current value = ${formatter(val)} has been higher than `
          + `${formatter(maxValue)} for ${formatDuration(result.data, 's').str}`;
      }
    } else {
      result.data = 0;
    }
    return result;
  },
  // Triggers when value is less than the provided threshold
  // for at least the minimum given number of seconds
  sustainedLessThan: ({ minValue, minSeconds }) => (id, val, prevStatus, formatter) => {
    // NOTE Data is used to record the time in seconds of consecutive
    // measurements on which the recorded value has been less than the threshold
    const result = { triggered: false };
    if (val < minValue) {
      result.data = (prevStatus.data || 0) + (Date.now() - prevStatus.ts) / 1000;
      if (result.data > minSeconds) {
        result.triggered = true;
        result.message = `current value = ${formatter(val)} has been less than `
          + `${formatter(minValue)} for ${formatDuration(result.data, 's').str}`;
      }
    } else {
      result.data = 0;
    }
    return result;
  },
  equals: ({ value }) => (id, val, prevStatus, formatter) => {
    const result = {
      triggered: val == value
    };
    if (result.triggered) {
      result.message = `current value = ${formatter(value)}`;
    }
    return result;
  },
  notEquals: ({ value }) => (id, val, prevStatus, formatter) => {
    const result = {
      triggered: val != value
    };
    if (result.triggered) {
      result.message = `current value = ${formatter(val)} `
        + `differs from expected value  ${formatter(value)}`;
    }
    return result;
  },
  // Triggers when value is equal to provided error value for at least a given
  // minimum number of seconds.
  sustainedEquals: ({ value, minSeconds }) => (id, val, prevStatus, formatter) => {
    // NOTE (israel21) result.data is used to record the time in seconds after the last
    // measurement on which the recorded value was equal to the error value.
    const result = { triggered: false };
    if (val == value) {
      result.data = (prevStatus.data || 0) == 0 ? 1 : (prevStatus.data || 0) + (Date.now() - prevStatus.ts) / 1000;
      if (result.data > minSeconds) {
        result.triggered = true;
        result.message = `current value = ${formatter(val)} has been equal to `
         + `${formatter(value)} for ${formatDuration(result.data, 's').str}`;
      }
    } else {
      result.data = 0;
    }
    return result;   
  },
  // Triggers when value is not equal to provided non-error value for at least a given
  // minimum number of seconds. 
  sustainedNotEquals: ({ value, minSeconds }) => (id, val, prevStatus, formatter) => {
    // NOTE (israel21) result.data is used to record the time in seconds after the last
    // measurement on which the recorded value was not equal to the non-error value
    const result = { triggered: false };
    if (val != value) {
      result.data = (prevStatus.data || 0) == 0 ? 1 : (prevStatus.data || 0) + (Date.now() - prevStatus.ts) / 1000;
      if (result.data > minSeconds) {
        result.triggered = true;
        result.message = `current value = ${formatter(val)} has not been equal to `
         + `${formatter(value)} for ${formatDuration(result.data, 's').str}`;
      }
    } else {
      result.data = 0;
    }
    return result;
  },
  contains: ({ value }) => (id, val, prevStatus, formatter) => {
    const result = {
      triggered: val.toString().indexOf(value) !== -1
    };
    if (result.triggered) {
      result.message = `current value = ${formatter(val)}`;
    }
    return result;
  },
};

let instance;
export default class RobotStatusManager {
  constructor() {
    // Singleton pattern
    if (instance === undefined) {
      instance = this;

      // TODO Get collection names from system-shared constants import
      this.mongoManager = new MongoManager();
      this._robotStatusColl = this.mongoManager.getCollection(COLLECTIONS.ROBOT_STATUS);
      this._statusConfigColl = this.mongoManager.getCollection(COLLECTIONS.STATUS_CONFIG);
      this._statusConfigCache = new AsyncCache({
        maxAge: CONFIG_CACHE_AGE_MS,
        createFunction: this._doGetStatusConfig
      });
      this.peerClient = new PeerClient();

      this.alertsQueue = [];
      // Max number of alerts that will be queued to process.
      this.maxAlertsQueueLength = 500;
      // Max number of alerts to process on each call of processStatusMessages.
      this.maxAlertsToProcess = 10;
      this.timer = null;
      this.processStatusMessages();
    }
    // eslint-disable-next-line no-constructor-return
    return instance;
  }

  /**
   * Set a specific instance of PeerClient to use.
   * Used by unit tests to set-up a mock.
   */
  setPeerClient = (peerClient) => {
    this.peerClient = peerClient;
  };

  /**
   * Gets the status configuration
   * 
   * TODO Move config reading to peer api requests (don't read DB Configs from ingest)
   */
  _doGetStatusConfig = async () => (
    (await this._statusConfigColl.find({}).toArray()).reduce((acc, doc) => {
      acc[doc.attributeId] = doc.rules;
      return acc;
    }, {})
  );

  /**
   * Evaluate and update robot status according to configuration, based on the given
   * attribute updates.
   *
   * @arg newValues is an object with attributeId: { value: x } pairs
   */
  evaluateStatus = async (robotId, newValues) => {
    console.log(`evaluating status for robot ${robotId}: ${Object.keys(newValues)}`);
    // Store time for attributes metrics calculation.
    const t0 = Date.now();

    const config = await this._statusConfigCache.get('');
    const attributes = await new AttributesManager().getRobotVitalsConfig(robotId);

    // We will use this variable to aggregate state updates
    let status;
    const now = Date.now();
    // Lists the IDs of the attributes for which the status changed
    const updatedAttributes = [];

    // Go through all updated attributes and process the ones that are configured for status
    // tracking.
    for (const attributeId in newValues) {
      if (config[attributeId]) {
        // Lazy fetch status as soon as we find an attribute for which there is a config
        if (status == undefined) {
          status = (await this._robotStatusColl.findOne({ _id: robotId }, { fields: Object.keys(newValues) })) || {};
        }

        // Create an entry in the robot status for this attribute if it doesn't exist yet
        if (!status[attributeId]) {
          status[attributeId] = this._defaultAttributeStatus(attributeId);
        }

        // Get and use a pointer to the status for this attribute
        const attrStatus = status[attributeId];

        // Process with configured status methods
        const newStatus = { value: STATUS.OK.value };
        const c = config[attributeId];
        const formatter = AttributeValueFormatter(
          attributes && attributes.getAttributeDefinition(attributeId)
        );
        for (let i = 0; i < c.length; i++) {
          try {
            const { functionName, params, status } = c[i];
            const func = AttributeStatusFunctions[functionName].call(this, params);
            const result = func(attributeId, newValues[attributeId].value, attrStatus, formatter);
            // If result.data is set, it *must* be stored in the new status.
            // Otherwise alerts for conditions sustained in time will fail to trigger.
            if (result.data !== undefined) {
              newStatus.data = result.data;
            }
            if (result.triggered) {
              newStatus.value = status;
              newStatus.message = result.message;
              // TODO:
              // This early exit from the loop can cause an error to be falsely reported as
              // a warning, if the config has the atributes in the wrong order. Consider:
              //
              //   [{maxValue, 1, WARN}, {maxValue, 2, ERROR}]
              //
              // If newValue is 3, then we will abandon the loop with a warning, but actually
              // we should be emiting an ERROR!
              // My suggestion: don't break in case a func triggers.
              break;
            }
          } catch (e) {
            console.error('Exception evaluating state', { e, robotId, attributeId, newValues });
          }
        }

        // Update the status for this attribute with new values
        attrStatus.ts = now;
        // Refresh the related incident if the status has changed, or if the attribute has changed
        // or the status has an open alert
        // (and the status is not Ok; otherwise we constantly "resolve" unexisting incidents)
        if (attrStatus.value != newStatus.value
          || (attrStatus.attributeValue != newValues[attributeId].value
              && newStatus.value != STATUS.OK.value
          ) || (newStatus.value == STATUS.OK.value && attrStatus.hasOpenAlert)) {
          attrStatus.lastChangeTs = now;
          updatedAttributes.push(attributeId);
        }
        attrStatus.value = newStatus.value;
        attrStatus.message = newStatus.message;
        attrStatus.data = newStatus.data;
        attrStatus.attributeValue = newValues[attributeId].value;
        attrStatus.formattedValue = formatter(attrStatus.attributeValue);
      }
    }

    // Update status if there was any update (could be only timestamps)
    if (status !== undefined) {
      await this._robotStatusColl.updateOne(
        { _id: robotId }, 
        { $set: status }, 
        { upsert: true }
      );
    }

    // If there was any status update, re-calculate overal robot status
    // and dispatch any alerts that are necessary to dispatch.
    // TODO If this grows, trigger an event and implement each
    // cascading functionality as a listener.
    // TODO(b-Tomas): Consider refactoring to update hasOpenAlert in the `status` object and then
    // perform the database update, instead of two separate database updates. Also, setting an
    // alert open should be done only if the alert is not already open.
    if (updatedAttributes.length > 0) {
      // Dispatch new alerts
      for await (const attributeId of updatedAttributes) {
        const attribute = attributes && attributes.getAttributeDefinition(attributeId);
        if (status[attributeId].value == STATUS.OK.value) {
          // Clear alert
          try {
            await this.peerClient.resolveAlert({
              robotId, triggerId: attributeId
            });
            // The alert has been resolved, hasOpenAlert must be cleared
            await this._robotStatusColl.updateOne(
              { _id: robotId }, 
              { $set: { [attributeId]: { hasOpenAlert: null } } }, 
              { upsert: true }
            );
          } catch (e) {
            console.error(`Error when calling resolveAlert() for triggerId ${attributeId} and robotId ${robotId}: ${e.message}`);
          }
        } else {
          // Trigger alert
          try {
            const st = status[attributeId];
            await this.peerClient.createAlert({
              robotId,
              triggerId: attributeId,
              name: (attribute && attribute.label) || attributeId,
              // TODO Make alert values consistent with STATUS constants
              level: STATUS.TEXT[st.value],
              message: st.message,
              attributeValue: st.attributeValue,
              formattedValue: st.formattedValue,
              source: 'status'
            });
            // The alert has been created, hasOpenAlert must be set to true
            await this._robotStatusColl.updateOne(
              { _id: robotId }, 
              { $set: { [attributeId]: { hasOpenAlert: true } } }, 
              { upsert: true }
            );
          } catch (e) {
            console.error(`Error when calling createAlert() for triggerId ${attributeId} and robotId ${robotId}: ${e.message}`);
          }
        }
      }
    }

    const durationMs = Date.now() - t0;
  };

  /**
   * Queues status updates received directly from the agent.
   * These are currently coming from the alerts module, which sends
   * alerts generated from ROS Diagnostics.
   * NOTE(Flor_Grosso) This is only a partial adaptation to the
   * attribute-based model and has a few TODOs left:
   * - Alerts sent through this via should be deprecated and instead
   *   compute a single diagnostics status directly from the diagnostics
   *   messages received from the agent.
   * - This is currently called directly from the ingest module
   *   when messages are received from the agent. Instead, the
   *   route should be through the attribute manager and from
   *   there to here.
   * - Agent status should be managed directy by the evaluateStatus
   *   function.
   */
  evaluateAgentStatus = (robotId, statusMessage) => {
    // If the length of the queue has reached the max number of elements
    // supported, remove the oldest data.
    if (this.alertsQueue.length >= this.maxAlertsQueueLength) {
      this.alertsQueue.shift();
      // TODO (Flor_Grosso): add an error log to notify that status are
      // being dropped. Throttle msgs to avoid spamming the logs.
    }
    this.alertsQueue.push({ robotId, statusMessage });

    // Set the timer to process queued messages, if not active.
    if (!this.timer) {
      this.timer = setTimeout(this.processStatusMessages, 100);
    }
  };

  /**
   * Processes status messages from alertsQueue.
   * This function is constantly running and handling the calculation
   * of tmpAgentStatus + incidents linked to alerts when available.
   *
   * NOTE: the queue is an array of elements composed of
   * [robotId, statusMessage] elements. There is a single queue for
   * all robots so this might get quite large. Consider limiting the
   * number of queued elements.
   *
   * NOTE: think of a proper logic to discard old messages
   * from the same robot/componentId which weren't yet processed if new
   * ones are received.
   *
   */
  processStatusMessages = async () => {
    // Counter for current processed messages
    let processedMessages = 0;

    // Process up to `this.maxAlertsToProcess` while the queue still has
    // elements.
    while (this.alertsQueue.length && processedMessages < this.maxAlertsToProcess) {
      const { robotId, statusMessage } = this.alertsQueue.shift() || {};
      try {
        if (robotId && statusMessage) {
          // 1- Incorporate agent-reported status into tracked robot status
          //
          // NOTE This is currently done in a temporary way, not tied
          // to attributes. Needs to be updated to match when the infrastructure
          // of sending status from the agent side is upgraded to support it.

          // As a temporary hack, we keep status of agent reported status as a
          // 'tmpAgentStatus' entry in the robot status collection

          const status = await this._robotStatusColl.findOne({ _id: robotId }, { fields: ['tmpAgentStatus'] }) || {};

          // The first time this is used, we need to initialize it with a default status
          // We use the 'data' element to collect which alerts are current, in a set
          // that has componentId as key and { message, value } entries.
          // The status is calculated as the max from all componentId status values.
          const tmpAgentStatus = status.tmpAgentStatus || {
            name: 'Agent Status', value: STATUS.OK.value, data: {} };

          if (!_.isObject(tmpAgentStatus.data)) { tmpAgentStatus.data = {}; }

          // Update the status for this componentId
          if (statusMessage.status == 'new') {
            tmpAgentStatus.data[statusMessage.componentId] = {
              value: statusMessage.level,
              message: statusMessage.message
            };
          } else {
            delete tmpAgentStatus.data[statusMessage.componentId];
          }

          // Recalculate general value for tmpAgentStatus
          let agentStatusValue = 0;
          const agentStatusMessages = [];
          Object.values(tmpAgentStatus.data).forEach((compStatus) => {
            // If the status is already in error (max value possible) and
            // we have processed 10 messages, quit.
            if (agentStatusValue == STATUS.ERROR.value && agentStatusMessages.length >= 10) {
              return;
            }
            agentStatusValue = Math.max(agentStatusValue, compStatus.value);
            agentStatusMessages.push(compStatus.message);
          });

          // Update tmpAgentStatus
          tmpAgentStatus.value = agentStatusValue;
          tmpAgentStatus.message = agentStatusMessages.join('\n');
          // TODO (Flor_Grosso): consider receiving the ts from the moment
          // evaluateAgentStatus was called with this statusMessage.
          tmpAgentStatus.ts = Date.now();

          await this._robotStatusColl.updateOne(
            { _id: robotId }, 
            { $set: { tmpAgentStatus } }, 
            { upsert: true }
          );

          // TODO Properly integrate to incidents when this is tied to attributes
          // 2- Route the statusMessage to the alerts manager for dispatching
          if (statusMessage.status == 'new') {
            await this.peerClient.createAlert({
              robotId,
              triggerId: statusMessage.componentId,
              name: statusMessage.name,
              level: STATUS.TEXT[statusMessage.level],
              message: statusMessage.message,
              attributeValue: statusMessage.attributeValue,
              formattedValue: statusMessage.formattedValue,
              source: 'Agent',
              isRosDiagHack: true
            });
          } else {
            await this.peerClient.resolveAlert({
              robotId,
              triggerId: statusMessage.componentId,
              isRosDiagHack: true
            });
          }
        }
        // Increment count for processed messages
        processedMessages++;
      } catch (e) {
        this.timer = null;
        console.error('Exception processing status', { e, robotId, statusMessage });
      }
    }
    // Reset timer for next updates. This is done after processing the
    // chunk of messages to avoid the timer triggering before it is
    // done.
    this.timer = null;

    // If there are messages left to process, set timer back.
    if (this.alertsQueue.length) {
      setTimeout(this.processStatusMessages, 100);
    }
  };

  /**
   * Generate a default for an attribute-based robot status.
   */
  _defaultAttributeStatus = (attributeId, attributeName) => {
    // TODO Denormalize attribute name from vitals configuration
    attributeName = attributeName || attributeId;
    return {
      name: attributeName,
      value: STATUS.OK.value,
    };
  };
}
