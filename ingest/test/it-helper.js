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
 * Helper initialization code to launch an in-memory mongodb instance
 * (mongo-unit) and initialize our MongoManager connecting to it.
 *
 * Adapted from:
 * https://www.toptal.com/nodejs/integration-and-e2e-tests-nodejs-mongodb
 */
import prepare from 'mocha-prepare';
import mongoUnit from 'mongo-unit';
// NOTE+HACK(herchu) Do NOT do
//     import MongoManager from '../src/mongo';
// here: This file is loaded by mocha with "--require": meaning the file loads ONCE,
// while every other file (the test files, specs) are re-loaded and evaluated every time a file
// changes. Since we use singletons (particularly MongoManager from here), then the module
// import and initialization of MongoManager must happen for *for every new module loaded*:
// For this reason doing an `import` on top of this file does not work, and we need to do a
// "dynamic" require() every time this code runs (see prepare() code below).
// Note that with the regular import, tests run ok *just once*, but not in `--watch` mode.
// To test this out, add a `this.rnd = Math.random();` to MongoManager constructor and do
// a console log of `mongoMgr.rnd` in prepare() and in test cases -- and verify the instance on
// the tests are different every time, while the instance used in prepare() in this file is always
// the same.
// Thanks, Mocha. This is fun.

prepare(done => mongoUnit.start().then(async testMongoUrl => {
  console.info("Initializing mongo with url", testMongoUrl);
  // HACK(herchu): Dynamically importing mongoManager to reload it every time. See comment above.
  try {
    const { default: MongoManager } = require('../src/mongo');
    const mongoMgr = new MongoManager();
    await mongoMgr.init({
      url: testMongoUrl
    });
    done();
  } catch (error) {
    console.error("Failed to initialize mongo-unit. If this was about libcrypto, you need to install libssl1.1. See .github/workflows/test.yml for details.");
    console.error("Error initializing mongo", error);
    done(error);
  }
  run();
}))
