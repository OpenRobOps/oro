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
 * MQTT Credential Provisioner
 *
 * Handles creating and managing MQTT credentials in the mqtt_credentials collection.
 * 
 * Credentials are tied to the monquitto-go-auth format: 
 * https://github.com/iegomez/mosquitto-go-auth#mongodb
 */
import { Meteor } from 'meteor/meteor';
import { groupBy, pick } from 'lodash';
import crypto from 'crypto';
// ORO modules
import { MqttLogins } from './collections';
import {
  hashPasswordPBKDF2,
  encryptPassword,
  generateRandomCredential,
  decryptPassword,
} from './mqttCredentialUtils';
import OroRoles, { ACCESS_LEVEL_VIEW } from './roles';

// MQTT access levels for auth plugin. Taken from https://github.com/iegomez/mosquitto-go-auth#mongodb
const MOSQ_ACL_NONE = 0x00
const MOSQ_ACL_READ = 0x01
const MOSQ_ACL_WRITE = 0x02
const MOSQ_ACL_SUBSCRIBE = 0x04
const UI_CREDS_EXPIRATION_MS = 1000 * 60 * 60; // 1 hour
const UI_CREDS_VALIDITY_MS = UI_CREDS_EXPIRATION_MS / 2; // reuse creds if they are at valid for at least half of the expiration time

/**
 * Provision MQTT credentials for a robot. Idempotent — skips if credentials
 * already exist for the given robotId.
 *
 * @param {string} robotId
 * @param {string} brokerId - Broker identifier (e.g. "local")
 * @returns {Object} The mqtt_credentials document
 */
export async function provisionRobotCredentials(robotId, brokerId) {
  const existing = await MqttLogins.findOneAsync({ robotId });
  if (existing) {
    return existing;
  }

  const encryptionKey = Meteor.settings.mqtt.credentialEncryptionKey;
  const username = generateRandomCredential(16);
  const plaintextPassword = generateRandomCredential(24);

  const doc = {
    robotId,
    brokerId,
    username,
    password: hashPasswordPBKDF2(plaintextPassword),
    encryptedPassword: encryptPassword(plaintextPassword, encryptionKey),
    superuser: false,
    acls: [{ topic: `r/${robotId}/#`, acc: MOSQ_ACL_READ | MOSQ_ACL_WRITE }],
    tsCreated: Date.now(),
  };

  await MqttLogins.insertAsync(doc);
  console.log(`Provisioned MQTT credentials for robotId=[${robotId}]`);
  return MqttLogins.findOneAsync({ robotId });
}

/**
 * Provision MQTT credentials to access multiple robots at the same time
 * (normally read-only). 
 * already exist for the given robotId.
 *
 * @param {string} robotId
 * @param {string} brokerId - Broker identifier (e.g. "local")
 * @returns {Object} The mqtt_credentials document
 */
export async function provisionMultiRobotUICredentials({ robotIds, userId, expirationMs = UI_CREDS_EXPIRATION_MS }) {
  const existing = await MqttLogins.findOneAsync({ 
    robotIds,
    expiresAt: { $gt: new Date(Date.now() + UI_CREDS_VALIDITY_MS) }
  });
  if (existing) {
    // Note: This check only works for 1 credential (no multiple brokers)
    console.log(`Reusing existing MQTT credentials for ${robotIds.length} robots`);
    return [existing];
  }
  console.log(`Provisioning MQTT credentials for ${robotIds.length} robots`);

  const existingCreds = await MqttLogins.find({ robotId: { $in: robotIds }, suspended: { $exists: false } }).fetchAsync();
  const byBrokerId = groupBy(existingCreds, 'brokerId');
  if (Object.keys(byBrokerId).length > 1) {
    throw new Error('Multiple brokers are needed to connect to these robots. NOT IMPLEMENTED');
  }
  const brokerId = Object.keys(byBrokerId)[0];

  const encryptionKey = Meteor.settings.mqtt.credentialEncryptionKey;
  const username = generateRandomCredential(16);
  const plaintextPassword = generateRandomCredential(24);

  // MOSQ_ACL_* appear to be bitmasks, but combining them does not work... So giving access 
  // to Subscribe + Read looks like this, duplicating all entries:
  const acls = robotIds.map(robotId => ({ topic: `r/${robotId}/#`, acc: MOSQ_ACL_SUBSCRIBE }))
    .concat(robotIds.map(robotId => ({ topic: `r/${robotId}/#`, acc: MOSQ_ACL_READ })))
  const doc = {
    robotIds,
    brokerId,
    meteorUserId: userId,
    username,
    password: hashPasswordPBKDF2(plaintextPassword),
    encryptedPassword: encryptPassword(plaintextPassword, encryptionKey),
    superuser: false,
    acls, // TODO FIXME access_subscribe?
    tsCreated: Date.now(),
    expiresAt: Date.now() + expirationMs
  };
  await MqttLogins.insertAsync(doc);
  console.log(`Provisioned MQTT (multi)credentials for robotIds=[${robotIds}]`);
  return [doc];
}

/**
 * Seed master (superuser) credentials from Meteor.settings on startup.
 * Upserts so it's safe to call on every boot.
 */
export async function seedMasterCredentials() {
  const masterCreds = Meteor.settings.mqtt?.masterCredentials;
  if (!masterCreds) {
    console.warn('No mqtt.masterCredentials in settings — skipping master seed');
    return;
  }

  const { username, password } = masterCreds;
  if (await MqttLogins.findOneAsync({ username })) {
    // Credentials already seeded; skip
    return;
  }
  const hashedPassword = hashPasswordPBKDF2(password);

  await MqttLogins.upsertAsync(
    { username },
    {
      $set: {
        password: hashedPassword,
        superuser: true,
        acls: [],
      },
      $setOnInsert: {
        username,
        tsCreated: Date.now(),
      },
    }
  );

  console.log(`Seeded master MQTT credentials for username=[${username}]`);
}

/**
 * Returns MQTT credentials to view a set of robots. 
 * These credentials are used from the browser and should be considered less secure than
 * those provisioned for robots. So they are limited to view access, and also are transient
 * (they expire).
 * 
 * On success, it returns a list of credentials. Each of them encrypted with 
 * convertMqttConfigToToken (a weak encryption just to avoid sending credentials in the clear).
 * 
 * When decrypted, credentials are of the form:
 *  { 
 *    hostname, port, protocol, websocket_port, websocket_protocol // broker info
 *    robotIds // which robotIds this credential give access to
 *  }
 * where the robotIds are the list of robots accessible by those credentials. 
 * Normally there will be only one element in the return value.
 * If multiple brokers are needed to connect to, there will be multiple credentials in the list.
 */
Meteor.methods({
  async 'mqttConfig'({ 
    robotIds, 
    ts // used to generate the secret word
  }) {
    if (!Array.isArray(robotIds) || robotIds.length === 0) {
      throw new Meteor.Error('Missing robotIds');
    }
    if (!ts) {
      throw new Meteor.Error('Missing ts');
    }
    // Checking permissions
    if (!await new OroRoles().canAccessRobots(this.userId, robotIds, ACCESS_LEVEL_VIEW)) {
      throw new Meteor.Error('User not authorized to get mqtt access to these robots.');
    }
    const credentials = await provisionMultiRobotUICredentials({
      robotIds, 
      userId: this.userId,
    });
    const encryptionKey = Meteor.settings.mqtt.credentialEncryptionKey;
    const uiCredentials = credentials.map(({ robotIds, brokerId, username, encryptedPassword }) => {
      const brokerDetails = Meteor.settings.mqtt.brokers[brokerId];
      if (!brokerDetails) {
        return null;
      }
      return {
        ...pick(brokerDetails, ['hostname', 'port', 'protocol', 'websocket_port', 'websocket_protocol']),
        username,
        password: decryptPassword(encryptedPassword, encryptionKey),
        robotIds,
      };
    }).filter(Boolean);

    // TODO do a soft encryption of the credentials (using a secret derived from (robotIds, userId, ts),
    // to avoid sending credentials in the clear. 
    // We need to resolve using crypto (or crypto-browserify) in the browser, which does not seem to
    // work without some polyfills that rspack should be adding. When we fix that, we can reimplement
    // decryptMqttTokenConfig() and other related functions
    return uiCredentials;
  }
});