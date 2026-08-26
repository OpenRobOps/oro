// Apache License Version 2.0, January 2004

/**
 * Deterministic ISO 21423 entity UUIDs, derived from a stable name.
 *
 * Shared by both ISO directions, though only the Upstream direction currently needs it: ORO robot
 * ids are operator-chosen strings (`app/imports/lib/collections.js:36-67`) while every ISO entity
 * is addressed by UUID in its topic path, so Plan 5 derives one per robot. The ISO Robots
 * direction has no need — an ISO robot's uuid IS its ORO robot id there (see that plan's
 * decision 4).
 *
 * Deriving (RFC 4122 §4.3, version 5 / SHA-1) keeps the uuid stable across restarts — retained ISO
 * topics keep addressing the same entity — and avoids both a Mongo write and a dependency on the
 * `uuid` package.
 */
import { createHash } from 'crypto';

import { UUID_RE } from './sharedConfig';

/**
 * Derives the version-5 UUID of `name` within `namespaceUuid`.
 *
 * @param {string} name a stable name, e.g. an ORO robot id
 * @param {string} namespaceUuid a UUID string
 * @returns {string} lowercase canonical UUID with version 5 and the RFC 4122 variant bits
 * @throws {Error} if `namespaceUuid` is not a UUID string
 */
const deriveEntityUuid = (name, namespaceUuid) => {
  if (typeof namespaceUuid !== 'string' || !UUID_RE.test(namespaceUuid)) {
    throw new Error(
      `deriveEntityUuid: namespace must be a UUID (got ${JSON.stringify(namespaceUuid)})`);
  }
  const nsBytes = Buffer.from(namespaceUuid.replace(/-/g, ''), 'hex');
  const digest = createHash('sha1')
    .update(nsBytes)
    .update(Buffer.from(String(name), 'utf8'))
    .digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = bytes.toString('hex');
  return [
    hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20, 32),
  ].join('-');
};

export { deriveEntityUuid };
