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
 * NotificationChannelsManager
 *
 * Owns notification channels: named delivery endpoints that incident definitions
 * route alerts to. This phase supports webhook channels only. The manager holds
 * the channel validation and persistence; the Config API handler
 * (configAPI/notificationChannels) is a thin layer that authenticates and
 * delegates here, mirroring how StatusDefinition -> RobotStatusManager and
 * DataSourceDefinition -> AttributesManager are wired.
 */
import Validator from 'fastest-validator';
import { NotificationChannels } from '../lib/alerts';
import { SchemaError } from '../shared/configAPI';

// Webhook is the only self-contained channel type this phase. Slack / OpsGenie /
// Google Chat / email depend on an external integrations service and are deferred.
const CHANNEL_TYPE_WEBHOOK = 'webhook';
const CHANNEL_TYPES = [CHANNEL_TYPE_WEBHOOK];

// A channel's spec. The optional per-channel `secret` is sent by the webhook
// client as `Authorization: Bearer <secret>`; the real value is kept out of
// committed YAML (env/secret substitution at apply time).
const CHANNEL_SPEC_SCHEMA = {
  $$strict: true,
  type: { type: 'enum', values: CHANNEL_TYPES },
  url: { type: 'url' },
  secret: { type: 'string', optional: true, empty: false }
};

const channelSpecValidator = new Validator().compile(CHANNEL_SPEC_SCHEMA);

let instance;
export default class NotificationChannelsManager {
  constructor() {
    // Singleton pattern (mirrors the other managers).
    if (instance === undefined) {
      instance = this;
    }
    // eslint-disable-next-line no-constructor-return
    return instance;
  }

  /**
   * Validates a channel spec, throwing SchemaError if it is not a well-formed
   * (webhook) channel. Returns true when valid.
   */
  validateChannelSpec = (spec) => {
    const validation = channelSpecValidator(spec || {});
    if (validation !== true) {
      throw new SchemaError((validation.length && validation[0].message) || 'Invalid channel spec');
    }
    return true;
  };

  /**
   * Creates or replaces a channel. Validates first (no write on invalid spec).
   * Uses a full-document replacement so a field dropped on update — e.g. a
   * removed `secret` — is actually removed rather than left stale.
   */
  upsertChannel = async ({ id, spec }) => {
    this.validateChannelSpec(spec);
    const doc = { type: spec.type, url: spec.url };
    if (spec.secret !== undefined) { doc.secret = spec.secret; }
    await NotificationChannels.updateAsync({ _id: id }, doc, { upsert: true });
  };

  /** Removes a channel by id. */
  removeChannel = async (id) => {
    await NotificationChannels.removeAsync({ _id: id });
  };

  /** Lists stored channels; pass { id } to fetch a single one. */
  listChannels = async ({ id } = {}) => (
    id
      ? [await NotificationChannels.findOneAsync({ _id: id })].filter(Boolean)
      : NotificationChannels.find({}).fetchAsync()
  );
}

export { CHANNEL_TYPE_WEBHOOK, CHANNEL_TYPES };
