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
 * ApiKeysManager: server logic for per-user API keys (personal access tokens).
 *
 * Each user owns a list of keys stored at `services.oro.apiKeys`. Only a
 * peppered hash of each key is persisted (see apiKeyCrypto); the plaintext is
 * returned exactly once, at creation. Authentication against these keys lives
 * in rest_api.js.
 *
 * This manager exposes the Meteor methods the API keys Settings tab talks to.
 * It follows the personal-access-token model: every method operates only on the
 * calling user's own keys (this.userId); any registered user (one with a role)
 * may manage their own keys — no admin permission is required.
 */
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import OroRoles from './roles';
import EventLog from './eventLog/eventLogger';
import { EVENT_SETTINGS_SECTION_NAMES, EVENT_TYPES } from '../lib/events';
import { hashApiKey, generateApiKeyPlaintext } from './apiKeyCrypto';

// Where the per-user key list lives. Under `services`, which existing
// publications strip, so key material is hidden from clients by default.
const API_KEYS_FIELD = 'services.oro.apiKeys';
const MAX_API_KEYS_PER_USER = 20;
const MAX_API_KEY_NAME_LENGTH = 64;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whether a key is past its expiration. Keys with no expirationTs never expire.
 */
const isExpired = (key, now = Date.now()) => Boolean(key?.expirationTs && key.expirationTs < now);

/**
 * Project a stored key to the safe shape sent to clients: never the keyHash
 * (or any secret), only display metadata. `roleId` is reserved for a future
 * "restrict a key to a role" feature and is always null in v1.
 */
const sanitizeKey = key => ({
  id: key.id,
  name: key.name,
  expirationTs: key.expirationTs ?? null,
  lastUsedTs: key.lastUsedTs ?? null,
  createdTs: key.createdTs ?? null,
  roleId: key.roleId ?? null,
});

/**
 * Convert a requested expiration in days to an absolute epoch-ms timestamp.
 * A null/0/undefined value means "no expiration".
 */
const expirationTsFromDays = (expirationDays, now = Date.now()) => (
  expirationDays ? now + (expirationDays * DAY_MS) : null
);

/**
 * Validate API key creation input against the user's existing keys. Throws a
 * Meteor.Error on any problem; returns the trimmed name on success.
 *
 * @param {Object} args
 * @param {string} args.name Requested key name
 * @param {?number} args.expirationDays Days until expiration, or null = never
 * @param {Array} args.existingKeys The user's current stored keys
 * @param {number} [args.now] Reference time (testable)
 * @returns {string} the trimmed, validated name
 */
const validateCreateInput = ({
  name, expirationDays, existingKeys = [], now = Date.now(),
}) => {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (!trimmed) {
    throw new Meteor.Error('api-key-invalid-name', 'API key name is required');
  }
  if (trimmed.length > MAX_API_KEY_NAME_LENGTH) {
    throw new Meteor.Error(
      'api-key-invalid-name',
      `API key name must be at most ${MAX_API_KEY_NAME_LENGTH} characters`
    );
  }
  if (expirationDays !== null && expirationDays !== undefined
    && (typeof expirationDays !== 'number' || !Number.isFinite(expirationDays) || expirationDays <= 0)) {
    throw new Meteor.Error(
      'api-key-invalid-expiration',
      'Expiration must be a positive number of days, or null for no expiration'
    );
  }
  // Only active (non-expired) keys count toward the name-uniqueness and limit
  // checks; expired keys are inert and can be re-created or left to be revoked.
  const activeKeys = existingKeys.filter(k => !isExpired(k, now));
  if (activeKeys.some(k => k.name === trimmed)) {
    throw new Meteor.Error('api-key-duplicate-name', `An active API key named "${trimmed}" already exists`);
  }
  if (activeKeys.length >= MAX_API_KEYS_PER_USER) {
    throw new Meteor.Error('api-key-limit', `You can have at most ${MAX_API_KEYS_PER_USER} active API keys`);
  }
  return trimmed;
};

let instance;
class ApiKeysManager {
  constructor() {
    // Singleton Pattern
    if (instance === undefined) {
      instance = this;
    }
    // eslint-disable-next-line no-constructor-return
    return instance;
  }

  init = async () => {
    Meteor.methods({
      'apiKeys.create': this._meteorCreate,
      'apiKeys.list': this._meteorList,
      'apiKeys.delete': this._meteorDelete,
    });
    await this._ensureIndexes();
  };

  // Index the hashed key so authentication lookups are O(1). Sparse because most
  // user docs have no apiKeys; non-unique because it is a multikey over an array.
  // eslint-disable-next-line class-methods-use-this
  _ensureIndexes = async () => {
    try {
      await Meteor.users.rawCollection().createIndex(
        { 'services.oro.apiKeys.keyHash': 1 },
        { sparse: true }
      );
    } catch (e) {
      console.error('Failed to create API key index', e);
    }
  };

  /**
   * Create a new API key for a user. Returns the plaintext key EXACTLY ONCE;
   * only its hash is stored. The caller is responsible for authorization.
   *
   * @param {Object} args
   * @param {string} args.userId Owner of the new key
   * @param {string} args.name Key name
   * @param {?number} args.expirationDays Days until expiration (null = never)
   * @param {Object} [args.user] User authoring the change (for audit logging)
   * @returns {Object} { id, key, name, expirationTs } — `key` is the plaintext
   */
  // eslint-disable-next-line class-methods-use-this
  createApiKey = async ({
    userId, name, expirationDays, user,
  }) => {
    const targetUser = await Meteor.users.findOneAsync({ _id: userId });
    if (!targetUser) {
      throw new Meteor.Error(`User not found: ${userId}`);
    }
    const existingKeys = targetUser.services?.oro?.apiKeys || [];
    const now = Date.now();
    const cleanName = validateCreateInput({
      name, expirationDays, existingKeys, now,
    });
    const plaintext = generateApiKeyPlaintext();
    const keyDoc = {
      id: Random.id(),
      name: cleanName,
      keyHash: hashApiKey(plaintext),
      expirationTs: expirationTsFromDays(expirationDays, now),
      lastUsedTs: null,
      createdTs: now,
      roleId: null, // RESERVED: future "restrict key to a role <= user's role"
    };
    await Meteor.users.updateAsync({ _id: userId }, { $push: { [API_KEYS_FIELD]: keyDoc } });
    new EventLog().logSetting({
      settingGroupName: EVENT_SETTINGS_SECTION_NAMES.API_KEYS,
      settingName: `Created API key "${cleanName}"`,
      eventType: EVENT_TYPES.SETTING_ADDED,
      user: user || targetUser,
    });
    return {
      id: keyDoc.id, key: plaintext, name: cleanName, expirationTs: keyDoc.expirationTs,
    };
  };

  /**
   * List a user's keys as sanitized metadata (never the hash/plaintext), most
   * recently created first.
   */
  // eslint-disable-next-line class-methods-use-this
  listApiKeys = async ({ userId }) => {
    const targetUser = await Meteor.users.findOneAsync(
      { _id: userId },
      { fields: { 'services.oro.apiKeys': 1 } }
    );
    const keys = targetUser?.services?.oro?.apiKeys || [];
    return keys
      .map(sanitizeKey)
      .sort((a, b) => (b.createdTs || 0) - (a.createdTs || 0));
  };

  /**
   * Revoke (delete) one of a user's keys by id.
   */
  // eslint-disable-next-line class-methods-use-this
  deleteApiKey = async ({ userId, id, user }) => {
    const targetUser = await Meteor.users.findOneAsync({ _id: userId });
    if (!targetUser) {
      throw new Meteor.Error(`User not found: ${userId}`);
    }
    const keys = targetUser.services?.oro?.apiKeys || [];
    const target = keys.find(k => k.id === id);
    if (!target) {
      throw new Meteor.Error('api-key-not-found', `API key not found: ${id}`);
    }
    await Meteor.users.updateAsync({ _id: userId }, { $pull: { [API_KEYS_FIELD]: { id } } });
    new EventLog().logSetting({
      settingGroupName: EVENT_SETTINGS_SECTION_NAMES.API_KEYS,
      settingName: `Deleted API key "${target.name}"`,
      eventType: EVENT_TYPES.SETTING_REMOVED,
      user: user || targetUser,
    });
    return true;
  };

  /**
   * One-shot migration of the legacy single plaintext key at
   * `services.oro.appKey` to the hashed `services.oro.apiKeys` schema. For each
   * user that still has an appKey, a key entry is added with its HMAC hash (so
   * the SAME key keeps working via the normal hashed lookup) and the plaintext
   * field is removed. Idempotent: re-running skips users already migrated.
   *
   * @returns {Promise<number>} how many users were migrated
   */
  // eslint-disable-next-line class-methods-use-this
  migrateLegacyAppKeys = async () => {
    const users = await Meteor.users.find(
      { 'services.oro.appKey': { $exists: true, $ne: null } },
      { fields: { 'services.oro.appKey': 1, 'services.oro.apiKeys': 1 } }
    ).fetchAsync();
    const now = Date.now();
    let migrated = 0;
    for (const user of users) {
      const appKey = user.services?.oro?.appKey;
      if (!appKey) {
        continue;
      }
      const keyHash = hashApiKey(appKey);
      const alreadyMigrated = (user.services?.oro?.apiKeys || []).some(k => k.keyHash === keyHash);
      // Always drop the plaintext; only add a key entry if not already present.
      const update = { $unset: { 'services.oro.appKey': '' } };
      if (!alreadyMigrated) {
        update.$push = {
          [API_KEYS_FIELD]: {
            id: Random.id(),
            name: 'Migrated key',
            keyHash,
            expirationTs: null,
            lastUsedTs: null,
            createdTs: now,
            roleId: null,
          },
        };
      }
      // eslint-disable-next-line no-await-in-loop
      await Meteor.users.updateAsync({ _id: user._id }, update);
      migrated += 1;
    }
    if (migrated) {
      console.log(`apiKeys migration: migrated ${migrated} legacy appKey(s) to hashed apiKeys`);
    }
    return migrated;
  };

  // --- Meteor method wrappers (personal-access-token model) ----------------
  // `this` is the Meteor method invocation context (this.userId), NOT the
  // manager — mirroring usersManager. Any registered user may manage their OWN
  // keys; we only require that they have a role (i.e. are not a pending user).

  // eslint-disable-next-line class-methods-use-this
  async _meteorCreate({ name, expirationDays } = {}) {
    if (!this.userId || !await new OroRoles().hasRole(this.userId)) {
      throw new Meteor.Error('not-authorized', 'You must be a registered user to manage API keys');
    }
    return new ApiKeysManager().createApiKey({
      userId: this.userId, name, expirationDays, user: await Meteor.userAsync(),
    });
  }

  // eslint-disable-next-line class-methods-use-this
  async _meteorList() {
    if (!this.userId || !await new OroRoles().hasRole(this.userId)) {
      throw new Meteor.Error('not-authorized', 'You must be a registered user to manage API keys');
    }
    return new ApiKeysManager().listApiKeys({ userId: this.userId });
  }

  // eslint-disable-next-line class-methods-use-this
  async _meteorDelete(id) {
    if (!this.userId || !await new OroRoles().hasRole(this.userId)) {
      throw new Meteor.Error('not-authorized', 'You must be a registered user to manage API keys');
    }
    return new ApiKeysManager().deleteApiKey({
      userId: this.userId, id, user: await Meteor.userAsync(),
    });
  }
}

export default ApiKeysManager;
export {
  validateCreateInput,
  sanitizeKey,
  isExpired,
  expirationTsFromDays,
  MAX_API_KEYS_PER_USER,
  MAX_API_KEY_NAME_LENGTH,
  API_KEYS_FIELD,
};
