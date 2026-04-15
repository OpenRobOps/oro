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
 * Mock class for ../../server/mqtt.js InOrbitMqtt
 */
export default class MqttMock {
  constructor() {
    this.reset();
  }

  reset() {
    this._messageCounts = {};
    this._lastCommand = {};
    this._lastScript = {};
    this._agentRestart = {};
    this._agentUpdate = {};
  }

  /**
   * Simulates sending a PublishToTopic command.
   */
  sendCustomCommand = ({ robotId, cmd }) => {
    // Keep a copy of just the last command (topic message) set
    this._lastCommand[robotId] = cmd;
    this._incMessageCount(robotId);
  }

  /**
   * Simulates sending a RunScript command.
   */
  sendCustomScript = ({ robotId, fileName, scriptParams }) => {
    // Keep a copy of just the last command (topic message) set
    const args = scriptParams && scriptParams.argOptions;
    this._lastScript[robotId] = fileName
      // append all args as the agent will do in its OS to run a script
      + (args && args.length ? ' ' + args.join(' ') : '');
    this._incMessageCount(robotId);
    // Return an execution Id
    return fileName;
  }

  triggerAgentRestart = ({ robotId }) => {
    this._agentRestart[robotId] = true;
    this._incMessageCount(robotId);
  }

  triggerAgentUpdate = ({ robotId }) => {
    this._agentUpdate[robotId] = true;
    this._incMessageCount(robotId);
  }

  /*
   * Increment number of msgs (of any kind) sent to a robot. Just to track
   * things that are supposed to be transmitted.
   */
  _incMessageCount = (robotId) => {
    // Keep a count of all commands sent
    if (!(robotId in this._messageCounts)) {
      this._messageCounts[robotId] = 0;
    }
    this._messageCounts[robotId]++;
  }

  getLastPublishedCommand = robotId => (
    this._lastCommand[robotId]
  )

  getLastCustomScript = robotId => (
    this._lastScript[robotId]
  )

  getMessagesCount = robotId => (
    this._messageCounts[robotId] || 0
  )

  hasAgentRestarted = robotId => (
    this._agentRestart[robotId] || false
  )

  hasAgentUpdated = robotId => (
    this._agentUpdate[robotId] || false
  )
}
