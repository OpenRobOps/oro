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
 * Keeps a notion of current RTT to each robot using server-generated
 * application-level pings. Pings start on request and stop once no active
 * subscribers remain for a given robot.
 */
import { Meteor } from 'meteor/meteor';
import { AttrValues } from '../lib/attributes';
import { VITAL_PING_RTT_AVG, VITAL_PING_RTT_LAST } from '../shared/attributes';
import OroMqtt from './mqtt';
import QueuesMap from './lib/queuesMap';

const PING_INTERVAL = 1000;

let instance;

export default class RttManager {
  constructor() {
    if (instance === undefined) {
      instance = this;
      this.init();
    }
    // eslint-disable-next-line no-constructor-return
    return instance;
  }

  startPing = (robotId) => {
    this.requests[robotId] = robotId in this.requests ? this.requests[robotId] + 1 : 1;
  };

  stopPing = (robotId) => {
    if (robotId in this.requests) {
      if (this.requests[robotId]-- < 1) {
        delete this.requests[robotId];
      }
    }
  };

  init = () => {
    // Map of active ping requests by robotId. Each entry holds a refcount.
    this.requests = {};
    this.queuesMap = new QueuesMap({
      expirationTimeMs: 20000,
      timestampField: 'tsServerReceive',
      maxCapacity: 20
    });
    this.doPings();
    this.mqtt = new OroMqtt();
  };

  /**
   * Send pings for all requested robots. Reschedules itself every PING_INTERVAL.
   */
  doPings = () => {
    try {
      for (const robotId of Object.keys(this.requests)) {
        if (this.requests[robotId] > 0) {
          this.mqtt.ping({ robotId }, (err, res) => {
            if (!err) {
              this.recordTiming(robotId, res);
            }
          });
        }
      }
    } catch (e) {
      console.error('RttManager.doPings: Exception sending pings to robots', e);
    }
    setTimeout(Meteor.bindEnvironment(this.doPings), PING_INTERVAL);
  };

  /**
   * Records a ping callback timing and writes the rolling-average + last RTT as robot
   * attribute values (pingAvg / pingLast). Consumed via the standard attribute-values
   * pipeline.
   */
  recordTiming = async (robotId, { tsServerReceive, tsServerSend, tsAgent }) => {
    let invalid = false;
    [tsServerReceive, tsServerSend, tsAgent].forEach((val) => {
      if (Number.isNaN(val) || val < 0) {
        invalid = true;
      }
    });
    if (invalid) {
      console.warn('Invalid timing recording', { tsServerReceive, tsServerSend, tsAgent });
      return;
    }
    const queue = this.queuesMap.get(robotId);
    queue.push({ tsServerSend, tsServerReceive, tsAgent });
    const now = Date.now();
    const results = queue.getValues(now);
    const lastRtt = tsServerReceive - tsServerSend;
    const totalRtt = results.reduce((sum, data) => sum + (data.tsServerReceive - data.tsServerSend), 0);
    const avg = totalRtt / results.length;
    try {
      await AttrValues.upsertAsync({ _id: robotId }, {
        $set: {
          [VITAL_PING_RTT_AVG]: { value: avg, ts: now },
          [VITAL_PING_RTT_LAST]: { value: lastRtt, ts: now },
        }
      });
    } catch (error) {
      console.error('Exception updating RTT attribute values', error);
    }
  };
}
