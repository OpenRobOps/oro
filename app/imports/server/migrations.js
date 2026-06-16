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
 * Database migrations (percolate:migrations).
 *
 * This module only REGISTERS migrations via Migrations.add(); they are run by
 * `Migrations.migrateTo('latest')` at startup (see server/main.js). Import this
 * module before that call so the migrations are registered.
 */
import { Migrations } from 'meteor/percolate:migrations';
import ApiKeysManager from './apiKeysManager';

// v1: migrate the legacy single plaintext `services.oro.appKey` to the hashed
// per-user `services.oro.apiKeys` schema, then drop the plaintext. The migrated
// key keeps working unchanged (its hash is stored). Irreversible (the plaintext
// is intentionally not recoverable), so there is no `down`.
Migrations.add({
  version: 1,
  name: 'Migrate services.oro.appKey to hashed apiKeys',
  up: async () => {
    await new ApiKeysManager().migrateLegacyAppKeys();
  },
});
