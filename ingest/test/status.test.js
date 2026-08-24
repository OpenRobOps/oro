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
 * Unit tests for RobotStatusManager.evaluateStatus persistence.
 *
 * Regression: marking an alert open/closed used a whole-subdocument $set
 * ({ [attributeId]: { hasOpenAlert: true } }) that wiped the computed status
 * (value/ts/message/attributeValue), leaving widgets with "no data" for any
 * attribute that ever triggered an alert.
 */
import mongoUnit from "mongo-unit";
import { expect } from "chai";
import * as sinon from "sinon";
// ORO modules
import RobotStatusManager from "../src/server/status";
import AttributesManager from "../src/server/attributes";
import MongoManager from "../src/mongo";
import { COLLECTIONS } from "../src/shared/constants";

const ROBOT_ID = "r0";
const BATTERY_RULES = {
  batteryPercentage: [
    { functionName: "lessThan", status: 20, params: { min: 0.15 } },
    { functionName: "lessThan", status: 10, params: { min: 0.8 } },
  ],
};

describe("RobotStatusManager: status persistence on alert transitions", () => {
  let mgr;
  let statusColl;
  let sandbox;
  let peerClient;

  beforeEach(async () => {
    await mongoUnit.drop();
    statusColl = new MongoManager().getCollection(COLLECTIONS.ROBOT_STATUS);
    mgr = new RobotStatusManager();
    sandbox = sinon.createSandbox();
    // Bypass the config cache and attribute definitions; rules are the unit under test
    sandbox.stub(mgr._statusConfigCache, "get").resolves(BATTERY_RULES);
    // AttributesManager is a singleton with instance-bound methods; stub the instance
    sandbox.stub(new AttributesManager(), "getRobotVitalsConfig").resolves(undefined);
    peerClient = {
      createAlert: sinon.stub().resolves({}),
      resolveAlert: sinon.stub().resolves({}),
    };
    mgr.setPeerClient(peerClient);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it("keeps the computed status when an alert is triggered", async () => {
    await mgr.evaluateStatus(ROBOT_ID, { batteryPercentage: { value: 0.5 } });

    expect(peerClient.createAlert.calledOnce).to.equal(true);
    const doc = await statusColl.findOne({ _id: ROBOT_ID });
    const st = doc.batteryPercentage;
    expect(st.hasOpenAlert).to.equal(true);
    // The wipe bug left ONLY hasOpenAlert here
    expect(st.value).to.equal(10); // WARN
    expect(st.attributeValue).to.equal(0.5);
    expect(st.ts).to.be.a("number");
  });

  it("keeps the computed status when an alert is resolved", async () => {
    await mgr.evaluateStatus(ROBOT_ID, { batteryPercentage: { value: 0.5 } });
    await mgr.evaluateStatus(ROBOT_ID, { batteryPercentage: { value: 0.9 } });

    expect(peerClient.resolveAlert.calledOnce).to.equal(true);
    const doc = await statusColl.findOne({ _id: ROBOT_ID });
    const st = doc.batteryPercentage;
    expect(st.hasOpenAlert).to.equal(null);
    expect(st.value).to.equal(0); // OK
    expect(st.attributeValue).to.equal(0.9);
  });

  it("does not re-trigger the alert on every evaluation while values keep changing", async () => {
    await mgr.evaluateStatus(ROBOT_ID, { batteryPercentage: { value: 0.5 } });
    await mgr.evaluateStatus(ROBOT_ID, { batteryPercentage: { value: 0.5 } });

    // Same status, same value: no second alert. (With the wipe bug, the lost
    // status value made every evaluation look like a change.)
    expect(peerClient.createAlert.calledOnce).to.equal(true);
  });
});
