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
 * Server unit tests for startup settings validation.
 */
import { Meteor } from 'meteor/meteor';
import { assert } from 'chai';
// ORO modules
import { validateMqttSettings, assertValidSettings } from '../settingsValidation';

// Just make sure this is not getting loaded in dev/prod
if (!Meteor.isTest) {
  throw new Error('This is TEST code only');
}

// A minimal, valid settings object for the mqtt block.
const validSettings = () => ({
  mqtt: {
    credentialEncryptionKey: 'a'.repeat(64),
    defaultBrokerId: 'local',
    brokers: {
      local: { hostname: 'localhost', port: 1883 },
    },
  },
});

describe('validateMqttSettings', () => {
  it('returns no errors for a valid configuration', () => {
    assert.deepEqual(validateMqttSettings(validSettings()), []);
  });

  it('accepts an uppercase hex encryption key', () => {
    const settings = validSettings();
    settings.mqtt.credentialEncryptionKey = 'A'.repeat(64);
    assert.deepEqual(validateMqttSettings(settings), []);
  });

  it('errors when mqtt is missing', () => {
    const errors = validateMqttSettings({});
    assert.lengthOf(errors, 1);
    assert.match(errors[0], /mqtt/);
  });

  it('errors when the encryption key is missing', () => {
    const settings = validSettings();
    delete settings.mqtt.credentialEncryptionKey;
    const errors = validateMqttSettings(settings);
    assert.isTrue(errors.some((e) => /credentialEncryptionKey/.test(e)));
  });

  it('errors when the encryption key is too short', () => {
    const settings = validSettings();
    settings.mqtt.credentialEncryptionKey = 'a'.repeat(32);
    const errors = validateMqttSettings(settings);
    assert.isTrue(errors.some((e) => /credentialEncryptionKey/.test(e)));
  });

  it('errors when the encryption key is too long', () => {
    const settings = validSettings();
    settings.mqtt.credentialEncryptionKey = 'a'.repeat(65);
    const errors = validateMqttSettings(settings);
    assert.isTrue(errors.some((e) => /credentialEncryptionKey/.test(e)));
  });

  it('errors when the encryption key is not hex', () => {
    const settings = validSettings();
    settings.mqtt.credentialEncryptionKey = 'z'.repeat(64);
    const errors = validateMqttSettings(settings);
    assert.isTrue(errors.some((e) => /credentialEncryptionKey/.test(e)));
  });

  it('errors when brokers is missing', () => {
    const settings = validSettings();
    delete settings.mqtt.brokers;
    const errors = validateMqttSettings(settings);
    assert.isTrue(errors.some((e) => /brokers/.test(e)));
  });

  it('errors when brokers is empty', () => {
    const settings = validSettings();
    settings.mqtt.brokers = {};
    const errors = validateMqttSettings(settings);
    assert.isTrue(errors.some((e) => /brokers/.test(e)));
  });

  it('errors when defaultBrokerId is missing', () => {
    const settings = validSettings();
    delete settings.mqtt.defaultBrokerId;
    const errors = validateMqttSettings(settings);
    assert.isTrue(errors.some((e) => /defaultBrokerId/.test(e)));
  });

  it('errors when defaultBrokerId is not present in brokers', () => {
    const settings = validSettings();
    settings.mqtt.defaultBrokerId = 'missing';
    const errors = validateMqttSettings(settings);
    assert.isTrue(errors.some((e) => /defaultBrokerId/.test(e)));
  });

  it('reports multiple problems together', () => {
    const settings = {
      mqtt: {
        credentialEncryptionKey: 'nope',
        brokers: {},
      },
    };
    const errors = validateMqttSettings(settings);
    assert.isAtLeast(errors.length, 2);
  });
});

describe('assertValidSettings', () => {
  let originalSettings;

  beforeEach(() => {
    originalSettings = Meteor.settings;
  });

  afterEach(() => {
    Meteor.settings = originalSettings;
  });

  it('does not throw when settings are valid', () => {
    Meteor.settings = validSettings();
    assert.doesNotThrow(() => assertValidSettings());
  });

  it('throws when settings are invalid', () => {
    Meteor.settings = { mqtt: { brokers: {} } };
    assert.throws(() => assertValidSettings(), /credentialEncryptionKey/);
  });
});
