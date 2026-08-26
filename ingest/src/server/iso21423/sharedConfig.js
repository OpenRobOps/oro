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
 * Settings shared by ORO's two ISO 21423 directions.
 *
 * `settings.iso21423` carries only what describes the FACILITY rather than either direction: the
 * uuid namespace, the CCS calibration, and the log switch. Each direction then has its own subtree
 * — `iso21423.robots` (ISO Robots, this plan) and `iso21423.upstream` (ISO Upstream, Plan 5) —
 * carrying its own `enabled` flag, its own `broker` AND its own credential.
 *
 * The broker is deliberately NOT shared (decision 13): the two directions talk to two different
 * brokers. ISO Robots uses ORO's own broker, which IS the ISO broker its robots connect to;
 * ISO Upstream connects OUT to an upstream facility-owned broker. Putting `broker` in the shared
 * block would imply one endpoint serves both, which is the exception rather than the rule.
 *
 * Pure: no I/O, no logging, no throwing. Reports every problem in one pass, following
 * `app/imports/server/settingsValidation.js`.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** RFC 4122 "name-based, SHA-1" default namespace (the DNS namespace), used when none is configured. */
const DEFAULT_UUID_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

/**
 * The ISO attribute-source convention: the ORO attribute ids that carry each ISO telemetry
 * concept. Plan 5 READS these attributes to publish ISO telemetry; this plan WRITES them from
 * inbound ISO telemetry. One table, both directions, so a deployment that renames an attribute
 * renames it once.
 *
 * Values are the real ORO attribute ids from `src/shared/attributes.js:39-60`.
 */
const DEFAULT_ATTRIBUTE_SOURCES = {
  online: 'agentOnline',
  pose: 'pose',
  speedLinear: 'speedLinear',
  speedAngular: 'speedAngular',
  batteryPercentage: 'batteryPercentage',
  batteryVoltage: 'batteryVoltage',
  batteryIsCharging: 'batteryIsCharging',
};

/**
 * Ingest's own broker endpoint, as an `iso21423.robots.broker` default: in ISO mode ORO's broker IS
 * the ISO broker its robots connect to (decision 13). Exported because only the ISO Robots
 * direction defaults this way — ISO Upstream must name its upstream broker explicitly.
 */
const brokerFromOroMqtt = (oroMqtt) => {
  const brokers = (oroMqtt && oroMqtt.brokers) || {};
  const broker = brokers[(oroMqtt && oroMqtt.defaultBrokerId) || 'local'];
  if (!broker || !broker.hostname) return {};
  // `settings.mqtt.brokers.<id>` shape: { protocol: 'mqtt://', hostname, port, … }
  // (`ingest/settings.json`, rendered by `terraform/main.tf:124-137`).
  return { url: `${broker.protocol || 'mqtt://'}${broker.hostname}:${broker.port || 1883}` };
};

/**
 * Validates and defaults the facility-level keys of `settings.iso21423`.
 *
 * @param {Object|undefined} raw the `iso21423` block, possibly absent
 * @returns {{shared: Object, errors: string[]}} `shared` is always populated (defaults on error)
 *   so a caller can keep validating its own keys and report everything at once
 */
const parseShared = (raw) => {
  const block = raw || {};
  const errors = [];
  const requireUuid = (value, name) => {
    if (typeof value !== 'string' || !UUID_RE.test(value)) {
      errors.push(`iso21423.${name} must be a UUID string (got ${JSON.stringify(value)})`);
      return null;
    }
    return value.toLowerCase();
  };

  const uuidNamespace = block.uuidNamespace === undefined
    ? DEFAULT_UUID_NAMESPACE
    : (requireUuid(block.uuidNamespace, 'uuidNamespace') || DEFAULT_UUID_NAMESPACE);

  const ccs = { id: null, name: 'facility', referencePoints: [], ...(block.ccs || {}) };
  if (ccs.id !== null && ccs.id !== undefined) {
    ccs.id = requireUuid(ccs.id, 'ccs.id');
  } else {
    ccs.id = null;
  }
  if (!Array.isArray(ccs.referencePoints)) {
    errors.push('iso21423.ccs.referencePoints must be an array');
    ccs.referencePoints = [];
  }

  return {
    shared: { uuidNamespace, ccs, logging: block.logging === true },
    errors,
  };
};

export { parseShared, brokerFromOroMqtt, UUID_RE, DEFAULT_UUID_NAMESPACE, DEFAULT_ATTRIBUTE_SOURCES };
