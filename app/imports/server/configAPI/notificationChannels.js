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
 * A notification channel is a named delivery endpoint that incident definitions
 * route alerts to (via their per-level `notificationChannels`). The channel's
 * `metadata.id` is the operator-chosen *name* used in those references
 * (e.g. `ops-webhook`), while `spec.type` is the delivery mechanism — this phase,
 * always `webhook`. So a definition says `notificationChannels: ['ops-webhook']`
 * and this kind maps `ops-webhook` -> { type: webhook, url, secret }.
 *
 * Example:
 *   kind: NotificationChannel
 *   metadata: { id: ops-webhook }
 *   spec: { type: webhook, url: https://hooks.example.com/x, secret: '{{SECRET}}' }
 */
// ORO modules
import OroRoles from '../roles';
import {
  RESOURCE_SINGLETONS, ACCESS_LEVEL_CONFIGURE, isSystemUser
} from '../../shared/roles';
import {
  ValidationError, AuthorizationError,
  LIST_FORMAT_SHORT, LIST_FORMAT_FULL
} from '../../shared/configAPI';
import NotificationChannelsManager, {
  CHANNEL_TYPE_WEBHOOK, CHANNEL_TYPES
} from '../notificationChannelsManager';

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
  constructor(configApi, notificationChannelsManager = new NotificationChannelsManager()) {
    if (!configApi) {
      throw new Error('reference to configApi must be received');
    }
    this._configApi = configApi;
    this._manager = notificationChannelsManager;
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
      // Manager validates the channel spec (throws SchemaError) and persists it.
      await this._manager.upsertChannel({ id, spec });
    } else {
      // Null spec means suppress: remove the channel.
      await this._manager.removeChannel(id);
    }
  };

  clear = async ({ configObject, user }) => {
    if (!configObject.metadata) {
      throw new ValidationError('Configuration object must have metadata');
    }
    if (!isSystemUser(user) && !await new OroRoles().canAccessSystemElement(
      user._id,
      RESOURCE_SINGLETONS.INCIDENTS,
      ACCESS_LEVEL_CONFIGURE)) {
      throw new AuthorizationError('Unauthorized');
    }
    await this._manager.removeChannel(configObject.metadata.id);
  };

  list = async ({ id, user, format = LIST_FORMAT_SHORT }) => {
    if (!isSystemUser(user) && !await new OroRoles().hasRole(user._id)) {
      throw new AuthorizationError('Unauthorized');
    }
    const docs = await this._manager.listChannels({ id });
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
  channelToListItem,
  channelToConfigObject
};
