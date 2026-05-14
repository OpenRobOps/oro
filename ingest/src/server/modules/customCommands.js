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
 * Ingest-side implementation of the Custom Commands - Scripts module.
 *
 * Handles communication with the CustomCommandsAgentlet.
 */
import { COLLECTIONS } from "../../shared/constants";
import MongoManager from "../../mongo";

const MODULE_NAME = "CustomCommandsAgentlet";

export default class CustomCommandsModule {
  constructor(mqtt) {
    this.mqtt = mqtt;
  }

  load = () => {
    // Register to MQTT topics
    this.mqtt.registerListener("custom_command/script/status", this.onMessage);

    this.CustomScriptStatusMessage = this.mqtt.lookupType(
      "oro.CustomScriptStatusMessage"
    );

    this.customScript = new MongoManager().getCollection(
      COLLECTIONS.CUSTOM_SCRIPT
    );
  };

  /**
   * Process incoming MQTT custom script messages.
   */
  onMessage = async (robotId, msg) => {
    const decodedMsg = this.CustomScriptStatusMessage.decode(msg);
    const fileName = decodedMsg.fileName;
    const executionStatus = decodedMsg.executionStatus;
    const executionStatusDetails = decodedMsg.executionStatusDetails || null;
    const updatedTs = (decodedMsg.ts && decodedMsg.ts.toNumber()) || null;
    const returnCode = decodedMsg.returnCode || null;
    const stdout = decodedMsg.stdout || null;
    const stderr = decodedMsg.stderr || null;

    // Register the server-time this was received
    // NOTE Changed to using Date object to leverage MongoDB TTL indices
    const serverTime = new Date();
    // TODO Perform contract steps:
    // 1- After 1.15 is deployed, stop writing serverTs and remove it from the DB
    const serverTs = Date.now();

    // NOTE Agents prior to 1.7.0 don't provide an execution ID
    // so we resort to the fileName in that case
    const executionId = decodedMsg.executionId || fileName;

    // Find a document with the same executionId and robotId
    // It could either be previous feedback from the same execution or a document created by
    // ActionsEngine to indicate the feedback should be redirected to a different robot.
    const existingExecutionDoc = await this.customScript.findOne({
      fileName: executionId,
      robotId,
    });

    // If the doc exists, it either means:
    // 1. The custom command was called from the robot itself and this is not the fist feedback
    // message.
    //    In this case, update the same document with the new information
    // 2. If there is a `.reportResultToId` field, the custom command was called from an IoC proxy
    // robot and the fetched document was created by `ActionsEngine._executeAction()` to indicate
    // where the message should be reported to.
    //    If so, use the robot id specified in the fetched doc to create a new document and store
    // the message.
    const feedbackRecipientRobotId =
      existingExecutionDoc?.reportResultToId || robotId;

    // Update/Create the custom script document
    // TODO: Check if ts of the message received is higher than the last update stored
    // in the database. If it's not, do not override the current document.
    // Overwriting behaviour was observed while testing
    // TODO: Rename fileName to executionId. https://inorbit.atlassian.net/browse/IO-582
    await this.customScript.updateOne(
      { fileName: executionId, robotId: feedbackRecipientRobotId },
      {
        $set: {
          executionId,
          executionStatus,
          executionStatusDetails,
          updatedTs,
          serverTs,
          serverTime,
          returnCode,
          stdout,
          stderr,
        },
      },
      { upsert: true }
    );
  };
}
