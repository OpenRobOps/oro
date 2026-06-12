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
 * Startup validation of `Meteor.settings`.
 *
 * The app uses `mqtt.credentialEncryptionKey` as an AES-256-GCM key (see
 * `imports/shared/mqttCredentialCrypto.js`), which requires a 64-character hex
 * string (32 bytes). A malformed key — or missing broker configuration — would
 * otherwise only surface at runtime, well after the app has started serving
 * traffic. We validate up-front and refuse to continue if anything is wrong.
 */
import { Meteor } from 'meteor/meteor';
import Validator from 'fastest-validator';

// The credential encryption key must be exactly 64 hex chars (32 bytes for
// AES-256-GCM), matching what mqttCredentialCrypto.js expects.
const HEX_KEY_PATTERN = /^[0-9a-f]{64}$/i;

const mqttSchema = {
  // Only validate the keys we care about; ignore unrelated mqtt settings.
  $$strict: false,
  credentialEncryptionKey: {
    type: 'string',
    pattern: HEX_KEY_PATTERN,
    messages: {
      required: 'mqtt.credentialEncryptionKey is required',
      string: 'mqtt.credentialEncryptionKey must be a string',
      stringPattern:
        'mqtt.credentialEncryptionKey must be a 64-character hex string (32 bytes for AES-256-GCM)',
    },
  },
  brokers: {
    type: 'object',
    minProps: 1,
    messages: {
      required: 'mqtt.brokers is required',
      object: 'mqtt.brokers must be an object',
      objectMinProps: 'mqtt.brokers must define at least one broker',
    },
  },
  defaultBrokerId: {
    type: 'string',
    empty: false,
    messages: {
      required: 'mqtt.defaultBrokerId is required',
      string: 'mqtt.defaultBrokerId must be a string',
      stringEmpty: 'mqtt.defaultBrokerId must not be empty',
    },
  },
};

const mqttValidator = new Validator().compile(mqttSchema);

/**
 * Validate the `mqtt` section of the application settings.
 *
 * Pure function (no Meteor dependency) so it can be unit-tested directly.
 *
 * @param {object} settings - The settings object (e.g. `Meteor.settings`).
 * @returns {string[]} Human-readable error messages; empty array means valid.
 */
export function validateMqttSettings(settings) {
  const mqtt = settings && settings.mqtt;
  if (!mqtt || typeof mqtt !== 'object') {
    return ['mqtt settings section is required'];
  }

  const result = mqttValidator(mqtt);
  const errors = result === true ? [] : result.map((e) => e.message);

  // Cross-field check: the default broker must be one of the configured
  // brokers. Only meaningful once both fields are individually valid.
  if (
    typeof mqtt.defaultBrokerId === 'string' &&
    mqtt.defaultBrokerId &&
    mqtt.brokers &&
    typeof mqtt.brokers === 'object' &&
    !(mqtt.defaultBrokerId in mqtt.brokers)
  ) {
    errors.push(
      `mqtt.defaultBrokerId "${mqtt.defaultBrokerId}" is not defined in mqtt.brokers`
    );
  }

  return errors;
}

/**
 * Validate `Meteor.settings` on startup and throw if anything is invalid.
 *
 * Reports every problem in a single error so an operator can fix them all in
 * one pass. Intended to be called at the very start of server startup so a
 * misconfigured deployment fails fast and never serves traffic.
 *
 * @throws {Error} if the settings are invalid.
 */
export function assertValidSettings() {
  const errors = validateMqttSettings(Meteor.settings || {});
  if (errors.length > 0) {
    throw new Error(
      `Invalid application settings — refusing to start:\n  - ${errors.join('\n  - ')}`
    );
  }
}
