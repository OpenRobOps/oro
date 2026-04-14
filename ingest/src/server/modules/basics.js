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
 * Ingest-side implementation of the Basics server module.
 *
 * This module handles basic agent information and communication
 * such as status, version, in/out commands, etc.
 */
import MongoManager from '../../mongo';
import PeerClient from '../peer';
import { COLLECTIONS } from '../../shared/constants';
import AttributesManager from '../attributes';
import { VITAL_ONLINE, VITAL_AGENT_VERSION } from '../../shared/attributes';
import Robot from '../model/robot';

export default class BasicsModule {
  constructor(mqtt) {
    this.mqtt = mqtt;
    this.attrMgr = new AttributesManager();
  }

  load = () => {
    this.mongoManager = new MongoManager();
    this.robots = this.mongoManager.getCollection(COLLECTIONS.ROBOTS);

    this.mqtt.registerListener('state', this.onState);
    this.mqtt.registerListener('out_cmd', this.onOutCommand);

    return this;
  };

  onState = async (robotId, msg, packetFlags) => {
    // Retrieve message parameters
    const parts = msg.toString().split('|');
    const [onlineString, apiKey, version, hostname] = parts;
    const online = (onlineString == '1');

    const robot = new Robot(robotId);
    // Compose status update information
    const statusUpdate = {
      _id: robotId,
      'status.agentOnline': online
    };

    // Update the last-connected timestamp. Do this only if the r/<robotid>/state message
    // is NOT a retained message, that we receive every time the broker reconnects to clients.
    // Do this only in the case the message is "current" (not retained).
    if (!packetFlags.retain) {
      statusUpdate.updateStamp = Date.now();
    }

    if (parts.length > 2) {
      // There is agent version information!
      statusUpdate.version = version;
    }

    // The following block updates the robot name (with the hostname)
    // only if it has not been changed from the UI.
    if (hostname) {
      statusUpdate.hostname = hostname;
      const [prevHostname, robotName] = await Promise.all([
        robot.getHostname(),
        robot.getName()
      ]);

      if (prevHostname !== hostname && robotName === prevHostname) {
        statusUpdate.name = hostname;
      }
    }

    // NOTE This is legacy, moving to use attributes instead
    // Otherwise just try an update of the fields we got
    await this.robots.updateOne({ _id: robotId }, { $set: statusUpdate });

    const attrMgrUpdates = {
      [VITAL_ONLINE]: { value: online }
    };

    if (version) {
      attrMgrUpdates[VITAL_AGENT_VERSION] = { value: version };
    }
    await this.attrMgr.handleSystemUpdates(robotId, attrMgrUpdates);
  };

  // Request coming from the robot
  // eslint-disable-next-line class-methods-use-this
  onOutCommand = (robotId, msg) => {
    const [command] = msg.toString().split('|');
    // Forward to Application server for processing
    new PeerClient().robotCommand({ robotId, command });
  };
}
