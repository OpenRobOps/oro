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
 * Configuration API implementation for Notification Channels.
 *
 * A notification channel is a named delivery endpoint (this phase: webhook only)
 * that incident definitions route alerts to via their `notificationChannels`
 * field. Channels are global and keyed by their metadata id, stored in the
 * NotificationChannels collection with _id === id.
 *
 * This handler only manages channel configuration; delivering alerts to channels
 * is handled by the alerts distribution listener.
 */
import Validator from 'fastest-validator';
// ORO modules
import OroRoles from '../roles';
import {
  RESOURCE_SINGLETONS, ACCESS_LEVEL_CONFIGURE, isSystemUser
} from '../../shared/roles';
import {
  SchemaError, ValidationError, AuthorizationError,
  LIST_FORMAT_SHORT, LIST_FORMAT_FULL
} from '../../shared/configAPI';
import { NotificationChannels } from '../../lib/alerts';

// For now webhook is the only channel supported, but can add more channels here in the future.
const CHANNEL_TYPE_WEBHOOK = 'webhook';
const CHANNEL_TYPES = [CHANNEL_TYPE_WEBHOOK];

// Optional per-channel secret is sent as `Authorization: Bearer <secret>` by the
// webhook client. The real value is kept out of committed YAML (env/secret
// substitution at apply time) — that is operational, not part of this schema.
const NotificationChannelSpecApplySchema = {
  $$strict: true,
  type: { type: 'enum', values: CHANNEL_TYPES },
  url: { type: 'url' },
  secret: { type: 'string', optional: true, empty: false }
};

const notificationChannelSpecValidator =
  new Validator().compile(NotificationChannelSpecApplySchema);

/**
 * Converts a config object into the stored channel document. Returns a full
 * replacement document (no $-operators) so that fields dropped on update — e.g. a
 * removed `secret` — are actually removed rather than left stale.
 */
const configObjectToChannel = (configObject) => {
  const { spec } = configObject;
  const doc = { type: spec.type, url: spec.url };
  if (spec.secret !== undefined) { doc.secret = spec.secret; }
  return doc;
};

/** Converts a stored channel into a LIST_FORMAT_SHORT list item. */
const channelToListItem = (doc) => ({
  id: doc._id,
  label: doc._id,
  suppressed: false
});

/** Converts a stored channel into a LIST_FORMAT_FULL config object. */
const channelToConfigObject = (doc) => ({
  metadata: { id: doc._id },
  apiVersion: 'v0.1',
  spec: {
    type: doc.type,
    url: doc.url,
    ...(doc.secret !== undefined ? { secret: doc.secret } : {})
  }
});

export default class NotificationChannelsConfigAPIHandler {
  constructor(configApi) {
    if (!configApi) {
      throw new Error('reference to configApi must be received');
    }
    this._configApi = configApi;
  }

  // Channels are individual config elements (one per id), not a single global object.
  isGlobalConfig = () => false;

  apply = async ({ configObject, user }) => {
    if (!configObject.metadata) {
      throw new ValidationError('Configuration object must have metadata');
    }
    if (!isSystemUser(user) && (
      !await new OroRoles().canAccessSystemElement(
        user._id,
        RESOURCE_SINGLETONS.INCIDENTS,
        ACCESS_LEVEL_CONFIGURE))) {
      throw new AuthorizationError('Unauthorized');
    }
    const { spec } = configObject;
    const id = configObject.metadata.id;
    if (spec) {
      const validation = notificationChannelSpecValidator(spec);
      if (validation !== true) {
        throw new SchemaError((validation.length && validation[0].message) || 'Invalid schema');
      }
      const doc = configObjectToChannel(configObject);
      await NotificationChannels.updateAsync({ _id: id }, doc, { upsert: true });
    } else {
      // Null spec means suppress: remove the channel.
      await NotificationChannels.removeAsync({ _id: id });
    }
  };

  clear = async ({ configObject, user }) => {
    if (!configObject.metadata) {
      throw new ValidationError('Configuration object must have metadata');
    }
    if (!await new OroRoles().canAccessSystemElement(
      user._id,
      RESOURCE_SINGLETONS.INCIDENTS,
      ACCESS_LEVEL_CONFIGURE)) {
      throw new AuthorizationError('Unauthorized');
    }
    await NotificationChannels.removeAsync({ _id: configObject.metadata.id });
  };

  list = async ({ id, user, format = LIST_FORMAT_SHORT }) => {
    if (!isSystemUser(user) && !await new OroRoles().hasRole(user._id)) {
      throw new AuthorizationError('Unauthorized');
    }
    const docs = id
      ? [await NotificationChannels.findOneAsync({ _id: id })].filter(Boolean)
      : await NotificationChannels.find({}).fetchAsync();
    if (format === LIST_FORMAT_SHORT) {
      return docs.map(channelToListItem);
    } else if (format === LIST_FORMAT_FULL) {
      return docs.map(channelToConfigObject);
    }
    throw new ValidationError(`Invalid format ${format}`);
  };
}

export {
  CHANNEL_TYPE_WEBHOOK,
  CHANNEL_TYPES,
  configObjectToChannel,
  channelToListItem,
  channelToConfigObject
};
