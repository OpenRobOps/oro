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
 * Unit tests for the Robot Events module.
 */
import mongoUnit from "mongo-unit";
import { expect } from "chai";
import * as sinon from "sinon";
// ORO modules
import MqttMock from "./mocks/mqtt";
import RobotEventsModule from "../src/server/modules/events";
import { COLLECTIONS } from "../src/shared/constants";
import MongoManager from "../src/mongo";

const ROBOT_ID = "r0";
const CUSTOM_FIELD = "0";
const TS = 1712870181770;

describe("RobotEventsModule: incoming event messages processing", () => {
  let RobotKeyValues;
  let events;
  let mqtt;
  let sandbox;
  let handleEvents;

  const protoEncodeCustomDataMessage = (msg) =>
    mqtt.lookupType("oro.CustomDataMessage").encode(msg).finish();

  beforeEach(async () => {
    await mongoUnit.drop();
    RobotKeyValues = new MongoManager().getCollection(
      COLLECTIONS.ROBOT_KEY_VALUES
    );
    mqtt = new MqttMock();
    events = new RobotEventsModule({ mqtt, mongo: new MongoManager() });
    events.load();
    sandbox = sinon.createSandbox();
    // Stub the AttributesManager: its pipeline is tested in attributes.test.js
    handleEvents = sandbox.stub(events._attrMgr, "handleEvents");
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("Relays key/value events to the attributes manager", async () => {
    const msg = protoEncodeCustomDataMessage({
      customField: CUSTOM_FIELD,
      ts: String(TS),
      keyValuePayload: {
        pairs: [
          { key: "battery", value: "0.9", ts: String(TS) },
          { key: "mission", value: "waiting", ts: "0" }, // no per-pair ts
        ],
      },
    });
    await events.onEvent(ROBOT_ID, msg);

    expect(handleEvents.calledOnce).to.equal(true);
    const [source, pairs, ts] = handleEvents.firstCall.args;
    expect(source).to.deep.equal({ robotId: ROBOT_ID, customField: CUSTOM_FIELD });
    expect(ts).to.equal(TS);
    // Pairs with ts == 0 must not carry a ts field
    expect(pairs).to.deep.equal([
      { key: "battery", value: "0.9", ts: TS },
      { key: "mission", value: "waiting" },
    ]);
  });

  it("Updates the last-seen keys snapshot in the db", async () => {
    const msg = protoEncodeCustomDataMessage({
      customField: CUSTOM_FIELD,
      ts: String(TS),
      keyValuePayload: {
        pairs: [
          { key: "battery", value: "0.9", ts: String(TS) },
          { key: "robotId", value: "hacked", ts: String(TS) }, // reserved: must be ignored
        ],
      },
    });
    await events.onEvent(ROBOT_ID, msg);

    const doc = await RobotKeyValues.findOne({ _id: ROBOT_ID });
    expect(doc.battery).to.deep.equal({ value: "0.9", ts: TS });
    expect(doc.robotId).to.equal(undefined);
  });

  it("Ignores unsupported payload types", async () => {
    const msg = protoEncodeCustomDataMessage({
      customField: CUSTOM_FIELD,
      ts: String(TS),
      imagePayload: Buffer.from("not an event"),
    });
    await events.onEvent(ROBOT_ID, msg);

    expect(handleEvents.called).to.equal(false);
    expect(await RobotKeyValues.findOne({ _id: ROBOT_ID })).to.equal(null);
  });
});
