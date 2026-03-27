import assert from "assert";

import '../imports/server/test/roles.test.js'
import '../imports/server/test/status.test.js'
import '../imports/server/test/actions.test.js'
import '../imports/server/test/locks.test.js'
import '../imports/server/test/configAPI/configAPIStatusDefinition.test.js'
import '../imports/server/test/configAPI/configAPIDashboards.test.js'

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
