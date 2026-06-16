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
 * Crypto helpers for per-user API keys.
 *
 * API keys are stored ONE-WAY: only a peppered HMAC-SHA256 of the key plaintext
 * is persisted (never the plaintext itself, and never a reversible ciphertext).
 * The hash is deterministic so it can be indexed and looked up directly during
 * authentication; the pepper (a server-side secret) means a database leak alone
 * cannot verify or forge keys.
 */
import crypto from 'crypto';
import { Meteor } from 'meteor/meteor';
import { generateRandomCredential } from './mqttCredentialUtils';

// Prefix on every generated key. Aids human identification and secret scanning.
const API_KEY_PREFIX = 'oro_';

/**
 * The server-side pepper used to hash API keys. Reuses the MQTT credential
 * encryption key (already required and validated at startup), falling back to
 * the peer key. Throws if neither is configured so authentication fails closed
 * rather than silently accepting unverifiable keys.
 *
 * @returns {string} the pepper secret
 */
const apiKeyPepper = () => {
  const pepper = Meteor.settings?.mqtt?.credentialEncryptionKey || Meteor.settings?.peerKey;
  if (!pepper) {
    throw new Error(
      'API key pepper missing: set mqtt.credentialEncryptionKey (or peerKey) in Meteor settings'
    );
  }
  return pepper;
};

/**
 * Deterministic, one-way hash of an API key plaintext.
 *
 * @param {string} plaintext The API key value
 * @param {string} [pepper] The pepper secret (defaults to apiKeyPepper())
 * @returns {string} lowercase hex HMAC-SHA256 digest (64 chars)
 */
const hashApiKey = (plaintext, pepper = apiKeyPepper()) => (
  crypto.createHmac('sha256', pepper).update(String(plaintext)).digest('hex')
);

/**
 * Generate a new API key plaintext. Shown to the user exactly once at creation;
 * only its hash is ever stored.
 *
 * @returns {string} e.g. "oro_<32 base64url chars>"
 */
const generateApiKeyPlaintext = () => `${API_KEY_PREFIX}${generateRandomCredential(24)}`;

export {
  API_KEY_PREFIX,
  apiKeyPepper,
  hashApiKey,
  generateApiKeyPlaintext,
};
