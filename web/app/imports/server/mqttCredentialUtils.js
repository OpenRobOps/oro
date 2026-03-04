/**
 * Crypto utilities for MQTT credential management.
 *
 * - PBKDF2 hashing in mosquitto-go-auth format
 * - AES-256-GCM encryption/decryption for storing recoverable passwords
 * - Random credential generation
 */
import crypto from 'crypto';

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

/**
 * Generate a random credential string (base64url, no padding).
 * @param {number} byteLength - Number of random bytes (default 24 = 32 chars)
 * @returns {string}
 */
export function generateRandomCredential(byteLength = 24) {
  return crypto.randomBytes(byteLength).toString('base64url');
}
