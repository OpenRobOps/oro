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
 * Unit tests for customCommands module.
 */
import mongoUnit from "mongo-unit";
import { expect } from "chai";
// InOrbit modules
import MqttMock from "./mocks/mqtt";
import CustomCommandsModule from "../src/server/modules/customCommands";
import { COLLECTIONS } from "../src/shared/constants";
import MongoManager from "../src/mongo";

const ROBOT_ID = "r0";
const ROBOT_ID2 = "r1";
const EXECUTION_ID = "c3K8";
const SCRIPT_FILE_NAME = "script.sh";

describe("CustomCommandsModule: incoming custom script messages processing", () => {
  let RobotCustomScript;
  let customCommands;
  let mqtt;

  const protoEncodeCustomScriptStatusMessage = (msg) =>
    mqtt.lookupType("oro.CustomScriptStatusMessage").encode(msg).finish();

  beforeEach(async () => {
    await mongoUnit.drop();
    RobotCustomScript = new MongoManager().getCollection(
      COLLECTIONS.CUSTOM_SCRIPT
    );
    mqtt = new MqttMock();
    customCommands = new CustomCommandsModule(mqtt);
    customCommands.load();
  });

  it("Registers feedback messages from the robot", async () => {
    // Create test data and simulate receiving it
    const msg = {
      ts: "1712870181770",
      fileName: SCRIPT_FILE_NAME,
      executionStatus: "finished",
      returnCode: "0",
      stdout: "script output",
      stderr: "script error",
      executionId: EXECUTION_ID,
    };
    const encoded_msg = protoEncodeCustomScriptStatusMessage(msg);
    await customCommands.onMessage(ROBOT_ID, encoded_msg);

    expect(await RobotCustomScript.countDocuments({})).to.be.equal(1);

    const doc = await RobotCustomScript.findOne({
      fileName: EXECUTION_ID,
      robotId: ROBOT_ID,
    });

    expect(doc).to.deep.include({
      executionId: EXECUTION_ID,
      executionStatus: "finished",
      executionStatusDetails: null,
      returnCode: "0",
      stdout: "script output",
      stderr: "script error",
      fileName: EXECUTION_ID,
      robotId: ROBOT_ID,
    });
  });

  it("Uses FileName as executionId if not provided", async () => {
    // Create test data and simulate receiving it
    const msg = {
      ts: "1712870181770",
      fileName: SCRIPT_FILE_NAME,
      executionStatus: "finished",
      returnCode: "0",
      stdout: "script output",
      stderr: "script error",
    };
    const encoded_msg = protoEncodeCustomScriptStatusMessage(msg);
    await customCommands.onMessage(ROBOT_ID, encoded_msg);

    expect(await RobotCustomScript.countDocuments({})).to.be.equal(1);

    const doc = await RobotCustomScript.findOne({
      fileName: SCRIPT_FILE_NAME,
      robotId: ROBOT_ID,
    });

    expect(doc).to.deep.include({
      executionId: SCRIPT_FILE_NAME,
      executionStatus: "finished",
      executionStatusDetails: null,
      returnCode: "0",
      stdout: "script output",
      stderr: "script error",
      fileName: SCRIPT_FILE_NAME,
      robotId: ROBOT_ID,
    });
  });

  it("Reports result to a different robot if specified (InOrbit Connect proxy robot feedback)", async () => {
    // Insert a the auxiliary document that will tell the module to report the result to a different robot.
    // See `web/imports/server/test/actions.test.js` -> "Runs a script action from a proxy and creates a feedback helper document"
    const aux_doc = {
      fileName: EXECUTION_ID,
      robotId: ROBOT_ID,
      executionId: EXECUTION_ID,
      executionStatus: "Executed from a proxy robot",
      executionStatusDetails: `Script execution triggered from IoC robot ${ROBOT_ID2}`,
      reportResultToId: ROBOT_ID2,
    };
    await RobotCustomScript.insertOne(aux_doc);

    // Create test data and simulate receiving it
    const msg = {
      ts: "1712870181770",
      fileName: SCRIPT_FILE_NAME,
      executionStatus: "finished",
      returnCode: "0",
      stdout: "script output",
      stderr: "script error",
      executionId: EXECUTION_ID,
    };
    const encoded_msg = protoEncodeCustomScriptStatusMessage(msg);
    await customCommands.onMessage(ROBOT_ID, encoded_msg);

    expect(
      await RobotCustomScript.countDocuments({
        fileName: EXECUTION_ID,
        robotId: ROBOT_ID,
      })
    ).to.be.equal(1); // The one inserted earlier
    expect(
      await RobotCustomScript.countDocuments({
        fileName: EXECUTION_ID,
        robotId: ROBOT_ID2,
      })
    ).to.be.equal(1);

    const doc = await RobotCustomScript.findOne({
      fileName: EXECUTION_ID,
      robotId: ROBOT_ID2,
    });

    expect(doc).to.deep.include({
      executionId: EXECUTION_ID,
      executionStatus: "finished",
      executionStatusDetails: null,
      returnCode: "0",
      stdout: "script output",
      stderr: "script error",
      fileName: EXECUTION_ID,
      robotId: ROBOT_ID2,
    });
  });
});
