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
 * Single source of truth for the app's runtime version.
 *
 * Reads the version field from app/package.json, which the release pipeline
 * keeps in sync with the released git tag (see .github/workflows/release.yml).
 * Bundled by Meteor into both the client and server, so the value is available
 * everywhere (startup log, UI, MQTT messages).
 */
import pkg from '../../package.json';

export const VERSION = pkg.version;
