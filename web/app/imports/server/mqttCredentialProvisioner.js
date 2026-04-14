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
 */
import { Meteor } from 'meteor/meteor';
import { MqttLogins } from './collections';
import {
  hashPasswordPBKDF2,
  encryptPassword,
  generateRandomCredential,
} from './mqttCredentialUtils';

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
    acls: [{ topic: `r/${robotId}/#`, acc: 3 }],
    tsCreated: Date.now(),
  };

  await MqttLogins.insertAsync(doc);
  console.log(`Provisioned MQTT credentials for robotId=[${robotId}]`);
  return MqttLogins.findOneAsync({ robotId });
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
