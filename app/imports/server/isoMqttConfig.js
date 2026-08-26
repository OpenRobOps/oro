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
 * Gate 1 of ISO 21423 robot onboarding: broker credentials.
 *
 * A deliberate sibling of `/mqtt_config` (`http_apis.js:57-137`) with one difference that is the
 * whole point: **it does not create the robot document.** Being able to publish on the broker and
 * being part of ORO's fleet are two separate decisions here — the second is Gate 2, the `IsoRobot`
 * config-API kind. This implements the standing TODO at `http_apis.js:84-85`.
 *
 * Auth is ORO's existing fleet-wide `Meteor.settings.robotApiKeys` shared secret, unchanged. It is
 * not a per-robot key; that is acceptable because the ACLs issued here are scoped to a single
 * entity's own ISO namespace and admission is gated separately.
 */
import { Meteor } from 'meteor/meteor';
import { pick } from 'lodash';

import { MqttLogins } from './collections';
import { Robots } from '../lib/collections';
import {
  hashPasswordPBKDF2, encryptPassword, generateRandomCredential, decryptPassword,
} from './mqttCredentialUtils';

/**
 * Thrown when credentials are requested for a robot that has not been admitted (Gate 2).
 * Carries the uuid so the endpoint can build one actionable message in one place.
 */
export class NotAdmittedError extends Error {
  constructor(entityUuid) {
    super(`ISO robot ${entityUuid} is not admitted to this fleet. Apply an IsoRobot configuration `
      + `object with metadata.id = ${entityUuid} (POST /api/configuration/apply) before requesting `
      + 'credentials. See docs/iso21423-robots.md.');
    this.entityUuid = entityUuid;
    this.notAdmitted = true;
  }
}

/** `mosquitto-go-auth` access constants (mirrors `mqttCredentialProvisioner.js:39-42`). */
const MOSQ_ACL_READ = 0x01;
const MOSQ_ACL_WRITE = 0x02;
const MOSQ_ACL_SUBSCRIBE = 0x04;

/** ISO 21423 protocol namespace; must match the SDK's `ROOT_NAMESPACE`. */
const ROOT_NAMESPACE = '/ISO_21423/v1';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The ACL grants an ISO robot needs.
 *
 * Read+write+subscribe on its own entity subtree — identity, status, telemetry and the
 * `request/<uuid>` topics addressed to it all live under the same `#` — plus read+subscribe on the
 * fleet-wide identity wildcard, which the SDK subscribes unconditionally to build its entity
 * catalog.
 *
 * One entry per access bit rather than an OR'd `acc`: `mqttCredentialProvisioner.js:112-115`
 * documents that combining the MOSQ_ACL_* bits "does not work" and duplicates entries for
 * subscribe+read, while `:71` OR's read|write into 3. One entry per bit is the only form both
 * paths accept.
 *
 * A robot that must ORIGINATE requests to the IMRFM needs an extra write grant on
 * `/ISO_21423/v1/IMRFM/<imrfmId>/request/#`; that is not granted here, deliberately.
 *
 * @param {string} entityUuid the robot's ISO entity uuid
 * @returns {Array<{topic: string, acc: number}>} deterministic order
 */
export function isoAclsFor(entityUuid) {
  const own = `${ROOT_NAMESPACE}/IMR/${entityUuid}/#`;
  return [
    { topic: own, acc: MOSQ_ACL_READ },
    { topic: own, acc: MOSQ_ACL_WRITE },
    { topic: own, acc: MOSQ_ACL_SUBSCRIBE },
    { topic: `${ROOT_NAMESPACE}/+/+/identity`, acc: MOSQ_ACL_READ },
    { topic: `${ROOT_NAMESPACE}/+/+/identity`, acc: MOSQ_ACL_SUBSCRIBE },
  ];
}

/**
 * Creates (or returns) the broker credential for one ISO robot.
 *
 * Idempotent and non-rotating, exactly like `provisionRobotCredentials`
 * (`mqttCredentialProvisioner.js:54-78`): the password is stored twice — hashed for the broker's
 * auth plugin and AES-encrypted so this endpoint can hand the plaintext back on every call.
 *
 * @param {string} entityUuid used as the `robotId` key, since an ISO robot's uuid IS its ORO id
 * @param {string} brokerId which `Meteor.settings.mqtt.brokers` entry it should connect to
 * @returns {Promise<Object>} the `mqtt_credentials` document
 */
export async function provisionIsoRobotCredentials(entityUuid, brokerId) {
  // Gate 2 before Gate 1 (decision 14): never mint credentials for a uuid nobody admitted.
  // `robotApiKeys` is fleet-wide, so without this an apiKey holder could squat any ISO namespace.
  if (!await Robots.findOneAsync({ _id: entityUuid }, { projection: { _id: 1 } })) {
    throw new NotAdmittedError(entityUuid);
  }
  const existing = await MqttLogins.findOneAsync({ robotId: entityUuid });
  if (existing) return existing;

  const encryptionKey = Meteor.settings.mqtt.credentialEncryptionKey;
  const plaintextPassword = generateRandomCredential(24);
  const doc = {
    robotId: entityUuid,
    brokerId,
    username: generateRandomCredential(16),
    password: hashPasswordPBKDF2(plaintextPassword),
    encryptedPassword: encryptPassword(plaintextPassword, encryptionKey),
    superuser: false,
    acls: isoAclsFor(entityUuid),
    tsCreated: Date.now(),
  };
  await MqttLogins.insertAsync(doc);
  return doc;
}

/**
 * Builds the `POST /iso_mqtt_config` handler.
 *
 * Responses mirror `/mqtt_config` field for field so an integrator who knows one knows the other.
 * Errors are `{ error: "<msg>" }`, matching `http_apis.js:29-33`.
 */
export function isoMqttConfigEndpoint() {
  return async (req, res) => {
    const send = (status, body) => {
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (req.method !== 'POST') return send(404, { error: 'Not found' });

    const { apiKey, entityUuid } = req.body || {};
    if (typeof entityUuid !== 'string' || !UUID_RE.test(entityUuid)) {
      return send(400, { error: 'entityUuid must be a UUID string' });
    }
    const uuid = entityUuid.toLowerCase();

    const apiKeys = Meteor.settings.robotApiKeys;
    if (!Array.isArray(apiKeys)) {
      return send(403, { error: 'Adding robots is not allowed in this server' });
    }
    if (!apiKey || !apiKeys.includes(apiKey)) {
      return send(403, { error: 'Invalid apiKey' });
    }

    const defaultBrokerId = Meteor.settings.mqtt.defaultBrokerId || 'local';
    let login;
    try {
      login = await provisionIsoRobotCredentials(uuid, defaultBrokerId);
    } catch (e) {
      if (e.notAdmitted) return send(403, { error: e.message });
      throw e;
    }
    if (login.suspended) {
      return send(403, { error: `Robot credentials suspended for entityUuid=[${uuid}]` });
    }
    const brokerDetails = Meteor.settings.mqtt.brokers[login.brokerId];
    if (!brokerDetails) {
      return send(403, { error: 'Robot credentials not found' });
    }

    let password;
    try {
      password = decryptPassword(login.encryptedPassword, Meteor.settings.mqtt.credentialEncryptionKey);
    } catch (e) {
      return send(403, { error: 'Robot credentials could not be read' });
    }

    return send(200, {
      ...pick(brokerDetails,
        ['hostname', 'port', 'protocol', 'websocket_port', 'websocket_protocol']),
      username: login.username,
      password,
    });
  };
}
