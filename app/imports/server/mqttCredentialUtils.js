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
 * Crypto utilities for MQTT credential management.
 *
 * - PBKDF2 hashing in mosquitto-go-auth format
 * - AES-256-GCM encryption/decryption (re-exported from shared so ingest can
 *   use the same implementation via ingest/import.sh)
 * - Random credential generation
 */
import crypto from 'crypto';

export { encryptPassword, decryptPassword } from '../shared/mqttCredentialCrypto';

const PBKDF2_ALGORITHM = 'sha512';
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_SALT_BYTES = 16;
const PBKDF2_KEY_BYTES = 64;

/**
 * Hash a plaintext password in mosquitto-go-auth PBKDF2 format.
 * Returns: "PBKDF2$sha512$100000$<salt_b64>$<hash_b64>"
 */
export function hashPasswordPBKDF2(plaintext) {
  const salt = crypto.randomBytes(PBKDF2_SALT_BYTES);
  const hash = crypto.pbkdf2Sync(
    plaintext, salt, PBKDF2_ITERATIONS, PBKDF2_KEY_BYTES, PBKDF2_ALGORITHM
  );
  return `PBKDF2$${PBKDF2_ALGORITHM}$${PBKDF2_ITERATIONS}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

/**
 * Generate a random credential string (base64url, no padding).
 * @param {number} byteLength - Number of random bytes (default 24 = 32 chars)
 * @returns {string}
 */
export function generateRandomCredential(byteLength = 24) {
  return crypto.randomBytes(byteLength).toString('base64url');
}
