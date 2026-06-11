# Settings validation on webapp startup

**Date:** 2026-06-11
**Status:** Approved

## Problem

The app reads `Meteor.settings.mqtt.credentialEncryptionKey` and uses it as an
AES-256-GCM key (`app/imports/shared/mqttCredentialCrypto.js`). That requires a
**64-character hex string** (32 bytes). A malformed key is only discovered when
encryption/decryption is first attempted at runtime — well after the app has
started serving traffic — producing confusing failures. Other required mqtt
settings (`brokers`, `defaultBrokerId`) are only validated late inside
`mqtt.run()` mid-boot.

We want to validate the relevant settings up-front on startup and refuse to
continue if they are invalid.

## Goals

- Fail fast on startup if mqtt settings are missing or malformed.
- Report **all** validation failures in a single message so the operator can
  fix them in one pass.
- Keep validation logic pure and unit-testable.

## Non-goals

- The ingest service (separate process; already logs and skips on missing key).
- Full-schema validation of unrelated settings (oauth, smtp, etc.).

## Design

### New module: `app/imports/server/settingsValidation.js`

- `validateMqttSettings(settings)` — pure function. Takes a settings object,
  returns an array of human-readable error strings (empty array = valid). No
  Meteor dependency, so it is trivially unit-testable.
- `assertValidSettings()` — reads `Meteor.settings`, runs the validator, and
  **throws a single `Error`** whose message lists every failure. No-op when
  there are no errors.

### Validations

1. `settings.mqtt` is a non-null object.
2. `mqtt.credentialEncryptionKey` is a string matching `/^[0-9a-f]{64}$/i`
   (exactly 64 hex chars / 32 bytes — the AES-256-GCM key size). Distinct
   messages for "missing" vs. "wrong format".
3. `mqtt.brokers` is a non-empty object.
4. `mqtt.defaultBrokerId` is a non-empty string and is a key present in
   `mqtt.brokers`.

If `mqtt` itself is missing, validations 2–4 are skipped (they would all be
redundant noise).

### Wiring

Call `assertValidSettings()` as the first statement of `oroAppMain()` in
`app/server/main.js`, before migrations, credential seeding, and mqtt startup.
`oroAppMain` runs inside `Meteor.startup`, so a thrown error aborts boot and the
process exits — the app never serves traffic with invalid config.

## Testing

`app/imports/server/test/settingsValidation.test.js` (meteortesting:mocha,
chai), built with TDD:

- valid config → no errors
- missing `mqtt` → error
- missing / too-short / non-hex / wrong-length `credentialEncryptionKey` → error
- missing or empty `brokers` → error
- missing `defaultBrokerId` → error
- `defaultBrokerId` not present in `brokers` → error
- multiple problems → all reported together
