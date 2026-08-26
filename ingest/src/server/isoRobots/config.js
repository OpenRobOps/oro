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
 * Settings validation for the ISO Robots direction (`settings.iso21423.robots`, plus the shared
 * `settings.iso21423` keys). Pure — no I/O, no throwing.
 *
 * Scope note: this validates the settings FILE. Which robots ORO actually accepts is not a
 * setting — it is the set of admitted robot documents (Task 2, Task 8).
 */
import {
  parseShared, brokerFromOroMqtt, UUID_RE, DEFAULT_ATTRIBUTE_SOURCES,
} from '../iso21423/sharedConfig';

/** ORO subtopics whose agent-bound commands this module translates (decision 10). */
const DEFAULT_COMMAND_TOPICS = {
  // Published by the seeded NavigateTo action (`app/imports/server/modules/nav2d.js:82-95`).
  navGoal: 'ros/loc/nav_goal',
  // Published by the seeded CancelNavGoal action (`nav2d.js:69-71`).
  cancelNav: 'ros/nav/goal_to_current_pose',
  // Published by every PublishToTopic ActionDefinition (`app/imports/server/mqtt.js:698-703`,
  // protobuf oro.CustomCommandRosMessage). Forwarded to the robot as an OpenRobOps-format
  // `customCommand` request, except `dock`/`dock=<id>` which become the native ISO `dock`.
  customCommand: 'custom_command/ros',
  // Deployment-defined: whatever subtopic this deployment's pauseRobot/resumeRobot
  // ActionDefinitions publish to. Null means "this deployment has no pause action", and
  // pauseImr/resumeImr are simply never issued.
  pause: null,
  resume: null,
};

/**
 * The one predicate `src/main.js` branches on to choose ISO mode.
 *
 * Deliberately does not validate: a deployment that has switched itself into ISO mode must not
 * silently fall back to loading InOrbit-wire modules because of a typo elsewhere in the block.
 * `validateConfig` reports the typo; the mode is already decided.
 *
 * @param {Object} settings the whole parsed settings.json
 * @returns {boolean}
 */
const isoModeEnabled = (settings) => Boolean(settings?.iso21423?.robots?.enabled === true);

/**
 * Validates and defaults `settings.iso21423` for this direction.
 *
 * @param {Object|undefined} raw the `iso21423` block
 * @param {Object} [oroMqtt] ingest's `settings.mqtt`, from which `robots.broker` defaults —
 *   ORO's broker IS this direction's ISO broker (decision 13)
 * @returns {{config: Object|null, errors: string[]}} `config` is null when disabled (empty
 *   `errors`) or invalid (non-empty `errors`)
 */
const validateConfig = (raw, oroMqtt) => {
  const robots = (raw && raw.robots) || {};
  if (robots.enabled !== true) {
    return { config: null, errors: [] };
  }
  const errors = [];
  const { shared, errors: sharedErrors } = parseShared(raw);
  errors.push(...sharedErrors);

  let imrfmId = null;
  if (typeof robots.imrfmId !== 'string' || !UUID_RE.test(robots.imrfmId)) {
    errors.push(
      `iso21423.robots.imrfmId must be a UUID string (got ${JSON.stringify(robots.imrfmId)})`);
  } else {
    imrfmId = robots.imrfmId.toLowerCase();
  }

  // This direction's broker is ORO's own (decision 13), so it defaults from ingest's settings.
  // The credential never defaults: the ISO session needs its own broker user for its own ACLs.
  const broker = { url: undefined, tls: {}, ...brokerFromOroMqtt(oroMqtt), ...(robots.broker || {}) };
  const mqtt = { ...broker, ...(robots.mqtt || {}) };
  if (typeof mqtt.url !== 'string' || !mqtt.url) {
    errors.push('iso21423.robots.broker.url is required, and ingest\'s own settings.mqtt did not '
      + 'supply a usable default (e.g. "mqtt://localhost:1883")');
  }

  // Docking stations in ORO's map frame, keyed by the id operators use in `dock=<id>` commands.
  const docks = {};
  for (const [id, p] of Object.entries(robots.docks || {})) {
    if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) {
      errors.push(`iso21423.robots.docks.${id} needs numeric x and y (ORO map frame)`);
    } else {
      docks[id.toLowerCase()] = { x: p.x, y: p.y };
    }
  }

  if (errors.length) return { config: null, errors };

  return {
    config: {
      enabled: true,
      imrfmId,
      manufacturerName: robots.manufacturerName || 'OpenRobOps',
      mqtt: {
        url: mqtt.url,
        tls: mqtt.tls || {},
        username: mqtt.username,
        password: mqtt.password,
        clientId: mqtt.clientId,
      },
      uuidNamespace: shared.uuidNamespace,
      ccs: shared.ccs,
      logging: shared.logging,
      rosterPollMs: Number.isFinite(robots.rosterPollMs) ? robots.rosterPollMs : 30000,
      requestTimeoutMs: Number.isFinite(robots.requestTimeoutMs) ? robots.requestTimeoutMs : 30000,
      commandTopics: { ...DEFAULT_COMMAND_TOPICS, ...(robots.commandTopics || {}) },
      docks,
      attributeSources: { ...DEFAULT_ATTRIBUTE_SOURCES, ...(robots.attributeSources || {}) },
    },
    errors: [],
  };
};

export { validateConfig, isoModeEnabled, DEFAULT_COMMAND_TOPICS };
