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

import assert from "assert";

import '../imports/server/test/roles.test.js'
import '../imports/server/test/states.test.js'
import '../imports/server/test/status.test.js'
import '../imports/server/test/actions.test.js'
import '../imports/server/test/locks.test.js'
import '../imports/server/test/settingsValidation.test.js'
import '../imports/server/test/accountsHooks.test.js'
import '../imports/server/test/users.test.js'
import '../imports/server/test/apiKeys.test.js'
import '../imports/server/test/configAPI/configAPIStatusDefinition.test.js'
import '../imports/server/test/configAPI/configAPIDashboards.test.js'
import '../imports/server/test/configAPI/configAPIActionDefinitions.test.js'
import '../imports/server/test/configAPI/configAPIModuleState.test.js'
import '../imports/server/test/timeseries/timeseriesStore.test.js'
import '../imports/server/test/timeseries/timeseriesManager.test.js'

describe("app", function () {
  it("package.json has correct name", async function () {
    const { name } = await import("../package.json");
    assert.strictEqual(name, "app");
  });

  if (Meteor.isClient) {
    it("client is not server", function () {
      assert.strictEqual(Meteor.isServer, false);
    });
  }

  if (Meteor.isServer) {
    it("server is not client", function () {
      assert.strictEqual(Meteor.isClient, false);
    });
  }
});
