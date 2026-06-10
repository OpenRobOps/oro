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
 * AES-256-GCM encryption/decryption for storing recoverable passwords in MongoDB.
 *
 * Source of truth used by both the app server and the ingest service. Ingest
 * picks this up via `ingest/import.sh` which copies it into
 * `ingest/src/shared/` at build/dev-start time.
 */
import crypto from 'crypto';

/**
 * Encrypt a plaintext password with AES-256-GCM.
 * @param {string} plaintext - The password to encrypt
 * @param {string} keyHex - 64-char hex string (32 bytes)
 * @returns {string} "<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 */
export function encryptPassword(plaintext, keyHex) {
  const key = Buffer.from(keyHex, 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt an AES-256-GCM encrypted password.
 * @param {string} encryptedPayload - "<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 * @param {string} keyHex - 64-char hex string (32 bytes)
 * @returns {string} The decrypted plaintext password
 */
export function decryptPassword(encryptedPayload, keyHex) {
  const [ivHex, authTagHex, ciphertextHex] = encryptedPayload.split(':');
  const key = Buffer.from(keyHex, 'hex');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(ciphertext) + decipher.final('utf8');
}
