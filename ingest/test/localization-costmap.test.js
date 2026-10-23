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
 * Unit test for costmap image post-processing in the Robot Localization module.
 */
import { expect } from "chai";
import * as sinon from "sinon";
import { Jimp, JimpMime, rgbaToInt } from "jimp";
import MqttMock from "./mocks/mqtt";
import RobotLocalizationModule from "../src/server/modules/localization";

describe("RobotLocalizationModule: costmap", () => {
  let loc;
  let mqtt;
  let sandbox;
  let doUpdate;

  beforeEach(async () => {
    mqtt = new MqttMock();
    loc = new RobotLocalizationModule({ mqtt });
    await loc.load();
    sandbox = sinon.createSandbox();
    sandbox.stub(loc.uiPreferencesCfgCache, "get").resolves({
      map: { costmap: { gradientEndColor: [10, 20, 30], alphaValue: 1, isAlphaGradient: true } }
    });
    doUpdate = sandbox.stub(loc, "_doUpdate").resolves();
  });

  afterEach(() => sandbox.restore());

  it("colorizes the greyscale costmap and keeps unknown cells transparent", async () => {
    // 2x1 greyscale costmap: cell 0 is a known obstacle (254), cell 1 is unknown (alpha 0)
    const src = new Jimp({ width: 2, height: 1 });
    src.setPixelColor(rgbaToInt(254, 254, 254, 255), 0, 0);
    src.setPixelColor(rgbaToInt(0, 0, 0, 0), 1, 0);
    const pixels = await src.getBuffer(JimpMime.png);
    const msg = mqtt.lookupType("oro.MapMessage").encode({
      width: 2, height: 1, pixels, x: 1, y: 2, theta: 0.5, resolution: 0.05, ts: 1712870181770
    }).finish();

    await loc.onCostmap("r0", msg);

    expect(doUpdate.calledOnce).to.equal(true);
    const [robotId, updates, subobject, ts] = doUpdate.firstCall.args;
    expect(robotId).to.equal("r0");
    expect(subobject).to.equal("costmap");
    expect(ts).to.equal(1712870181770);
    expect(updates).to.include({ width: 2, height: 1, ts: 1712870181770 });
    const out = await Jimp.read(Buffer.from(updates.data, "base64"));
    expect(Array.from(out.bitmap.data.subarray(0, 4))).to.deep.equal([10, 20, 30, 254]);
    expect(out.bitmap.data[7]).to.equal(0);
  });
});
