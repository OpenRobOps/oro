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
 * Server unit tests for per-user API keys: crypto helpers, input validation,
 * sanitization, expiration, and create/list/delete against a real user doc.
 */
import { Meteor } from 'meteor/meteor';
import { assert } from 'chai';
// ORO modules
import { hashApiKey, generateApiKeyPlaintext, API_KEY_PREFIX } from '../apiKeyCrypto';
import ApiKeysManager, {
  validateCreateInput, sanitizeKey, isExpired, expirationTsFromDays,
  MAX_API_KEYS_PER_USER, MAX_API_KEY_NAME_LENGTH,
} from '../apiKeysManager';
import { resetDatabase } from './setup';

if (!Meteor.isTest) {
  throw new Error('This is TEST code only');
}

const PEPPER = 'unit-test-pepper';

describe('apiKeyCrypto', () => {
  it('hashApiKey is deterministic and returns 64-char hex', () => {
    const h = hashApiKey('oro_secret', PEPPER);
    assert.match(h, /^[0-9a-f]{64}$/);
    assert.equal(h, hashApiKey('oro_secret', PEPPER));
  });

  it('hashApiKey depends on both input and pepper', () => {
    assert.notEqual(hashApiKey('a', PEPPER), hashApiKey('b', PEPPER));
    assert.notEqual(hashApiKey('a', PEPPER), hashApiKey('a', 'other-pepper'));
  });

  it('generateApiKeyPlaintext produces prefixed, unique keys', () => {
    const a = generateApiKeyPlaintext();
    const b = generateApiKeyPlaintext();
    assert.isTrue(a.startsWith(API_KEY_PREFIX));
    assert.isAbove(a.length, API_KEY_PREFIX.length + 20);
    assert.notEqual(a, b);
  });
});

describe('apiKeys helpers', () => {
  it('expirationTsFromDays: null/0 => never; positive => offset', () => {
    assert.isNull(expirationTsFromDays(null, 1000));
    assert.isNull(expirationTsFromDays(0, 1000));
    assert.equal(expirationTsFromDays(30, 1000), 1000 + 30 * 24 * 60 * 60 * 1000);
  });

  it('isExpired: null never expires; past expired; future not', () => {
    const now = 1_000_000;
    assert.isFalse(isExpired({ expirationTs: null }, now));
    assert.isTrue(isExpired({ expirationTs: now - 1 }, now));
    assert.isFalse(isExpired({ expirationTs: now + 1 }, now));
  });

  it('sanitizeKey never leaks keyHash and keeps client fields', () => {
    const s = sanitizeKey({
      id: 'k1', name: 'CI', keyHash: 'deadbeef', expirationTs: 5, lastUsedTs: 6, createdTs: 7, roleId: null,
    });
    assert.notProperty(s, 'keyHash');
    assert.deepEqual(s, {
      id: 'k1', name: 'CI', expirationTs: 5, lastUsedTs: 6, createdTs: 7, roleId: null,
    });
  });

  it('validateCreateInput rejects empty/whitespace/over-long names', () => {
    assert.throws(() => validateCreateInput({ name: '' }), /name is required/);
    assert.throws(() => validateCreateInput({ name: '   ' }), /name is required/);
    assert.throws(
      () => validateCreateInput({ name: 'x'.repeat(MAX_API_KEY_NAME_LENGTH + 1) }),
      /at most/
    );
  });

  it('validateCreateInput rejects bad expiration values', () => {
    assert.throws(() => validateCreateInput({ name: 'ok', expirationDays: -1 }), /Expiration/);
    assert.throws(() => validateCreateInput({ name: 'ok', expirationDays: 'soon' }), /Expiration/);
    // null and a positive number are fine
    assert.equal(validateCreateInput({ name: 'ok', expirationDays: null }), 'ok');
    assert.equal(validateCreateInput({ name: 'ok', expirationDays: 30 }), 'ok');
  });

  it('validateCreateInput trims and dedupes against ACTIVE keys only', () => {
    const now = 1_000_000;
    // duplicate active name is rejected
    assert.throws(
      () => validateCreateInput({ name: ' ci ', existingKeys: [{ name: 'ci', expirationTs: null }], now }),
      /already exists/
    );
    // an expired key with the same name does not block re-creation
    assert.equal(
      validateCreateInput({ name: 'ci', existingKeys: [{ name: 'ci', expirationTs: now - 1 }], now }),
      'ci'
    );
  });

  it('validateCreateInput enforces the per-user limit (active keys)', () => {
    const existingKeys = Array.from({ length: MAX_API_KEYS_PER_USER }, (_, i) => ({ name: `k${i}`, expirationTs: null }));
    assert.throws(() => validateCreateInput({ name: 'one-more', existingKeys }), /at most/);
  });
});

describe('ApiKeysManager create/list/delete', () => {
  let originalSettings;
  let userId;
  const manager = new ApiKeysManager();

  beforeEach(async () => {
    await resetDatabase();
    originalSettings = Meteor.settings;
    Meteor.settings = { ...Meteor.settings, mqtt: { credentialEncryptionKey: PEPPER } };
    userId = await Meteor.users.insertAsync({ profile: { name: 'Tester' }, userRoles: ['admin'] });
  });

  afterEach(() => {
    Meteor.settings = originalSettings;
  });

  it('create returns the plaintext once and stores only the hash', async () => {
    const result = await manager.createApiKey({ userId, name: 'CI key', expirationDays: 30 });
    assert.isTrue(result.key.startsWith(API_KEY_PREFIX));
    assert.equal(result.name, 'CI key');
    assert.isNumber(result.expirationTs);

    const user = await Meteor.users.findOneAsync({ _id: userId });
    const stored = user.services.oro.apiKeys;
    assert.lengthOf(stored, 1);
    assert.equal(stored[0].keyHash, hashApiKey(result.key, PEPPER));
    assert.notProperty(stored[0], 'key'); // plaintext is never persisted
    assert.isNull(stored[0].lastUsedTs);
    assert.isNull(stored[0].roleId);
  });

  it('list returns sanitized metadata (no hash), newest first', async () => {
    await manager.createApiKey({ userId, name: 'first', expirationDays: null });
    await manager.createApiKey({ userId, name: 'second', expirationDays: null });
    const list = await manager.listApiKeys({ userId });
    assert.lengthOf(list, 2);
    list.forEach(k => assert.notProperty(k, 'keyHash'));
    assert.equal(list[0].name, 'second'); // newest first
  });

  it('delete removes a key by id and rejects unknown ids', async () => {
    const { id } = await manager.createApiKey({ userId, name: 'temp', expirationDays: null });
    await manager.deleteApiKey({ userId, id });
    assert.lengthOf(await manager.listApiKeys({ userId }), 0);
    let threw = false;
    try {
      await manager.deleteApiKey({ userId, id: 'does-not-exist' });
    } catch (e) {
      threw = true;
    }
    assert.isTrue(threw, 'deleting an unknown id should throw');
  });

  it('a created key hashes back to the stored value (auth lookup works)', async () => {
    const { key } = await manager.createApiKey({ userId, name: 'lookup', expirationDays: null });
    const user = await Meteor.users.findOneAsync({ 'services.oro.apiKeys.keyHash': hashApiKey(key, PEPPER) });
    assert.isOk(user, 'should find the user by the hashed key');
    assert.equal(user._id, userId);
  });
});

describe('ApiKeysManager migrateLegacyAppKeys', () => {
  let originalSettings;
  const manager = new ApiKeysManager();

  beforeEach(async () => {
    await resetDatabase();
    originalSettings = Meteor.settings;
    Meteor.settings = { ...Meteor.settings, mqtt: { credentialEncryptionKey: PEPPER } };
  });

  afterEach(() => {
    Meteor.settings = originalSettings;
  });

  it('converts a legacy appKey to a hashed apiKey and drops the plaintext', async () => {
    const legacyKey = 'legacy-plaintext-key';
    const uid = await Meteor.users.insertAsync({
      profile: { name: 'Legacy' }, userRoles: ['viewer'], services: { oro: { appKey: legacyKey } },
    });

    const count = await manager.migrateLegacyAppKeys();
    assert.equal(count, 1);

    const user = await Meteor.users.findOneAsync({ _id: uid });
    assert.isUndefined(user.services.oro.appKey, 'plaintext appKey should be removed');
    assert.lengthOf(user.services.oro.apiKeys, 1);
    const [migratedKey] = user.services.oro.apiKeys;
    assert.equal(migratedKey.keyHash, hashApiKey(legacyKey, PEPPER));
    assert.equal(migratedKey.name, 'Migrated key');
    // The original key still authenticates via the normal hashed lookup.
    const found = await Meteor.users.findOneAsync({ 'services.oro.apiKeys.keyHash': hashApiKey(legacyKey, PEPPER) });
    assert.equal(found?._id, uid);
  });

  it('is idempotent (re-running migrates nothing new)', async () => {
    await Meteor.users.insertAsync({
      profile: { name: 'Legacy' }, userRoles: ['viewer'], services: { oro: { appKey: 'k' } },
    });
    assert.equal(await manager.migrateLegacyAppKeys(), 1);
    assert.equal(await manager.migrateLegacyAppKeys(), 0);
  });

  it('leaves users without a legacy appKey untouched', async () => {
    const uid = await Meteor.users.insertAsync({ profile: { name: 'NoKey' }, userRoles: ['viewer'] });
    assert.equal(await manager.migrateLegacyAppKeys(), 0);
    const user = await Meteor.users.findOneAsync({ _id: uid });
    assert.isUndefined(user.services?.oro?.apiKeys);
  });
});
