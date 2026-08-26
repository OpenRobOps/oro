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
 * ISO 21423 ISO Robots module: ISO-native robots join ORO's fleet, with ORO acting as the IMRFM.
 *
 * Off unless `settings.iso21423.robots.enabled` is true. When on, `src/main.js` runs ingest in ISO
 * mode: the InOrbit-wire telemetry modules are not loaded at all (decision 1) and this module is
 * loaded in their place.
 *
 * ORO registers only its OWN IMRFM identity here. ISO robots are self-managed entities that
 * publish their own identities into their own namespaces, so ORO observes them (`subscribeEntities`
 * / `discover()`) and commands them (`sendRequest`) — it never publishes on their behalf and
 * claims no `manages` links (decision 7). That is also why this module uses `Iso21423Client`
 * directly rather than `FleetGateway`, which exists for the managed-entity pattern.
 *
 * The SDK is an OPTIONAL dependency and is imported dynamically inside `load()`; a static import
 * would turn a missing package into an ingest boot failure.
 */
import { validateConfig } from './config';

class IsoRobotsModule {
  /**
   * @param {Object} deps
   * @param {Object} deps.mongo the MongoManager singleton
   * @param {Object} deps.mqtt the OroMqtt singleton — used ONLY to receive ORO's agent-bound
   *   command topics and to publish the synthesized echo (Task 6). Never for ISO topics.
   * @param {Object} deps.workerQueue the InMemoryWorkerQueues instance
   */
  constructor({ mongo, mqtt, workerQueue }) {
    this._mongo = mongo;
    this._oroMqtt = mqtt;
    this._workerQueue = workerQueue;
    this._config = null;
    this._sdk = null;
    this._client = null;
    this._imrfm = null;
  }

  /**
   * Validates settings, loads the SDK, connects the client and registers ORO's IMRFM identity.
   * Never throws: any failure logs and leaves the module inert so ingest keeps serving.
   *
   * @param {Object|undefined} settings the whole `iso21423` block of settings.json
   * @param {Object} [opts] test-only overrides
   * @param {Object} [opts.transport] an MqttTransport to use instead of a real mqtt client
   * @returns {Promise<this>}
   */
  load = async (settings, opts = {}) => {
    const { config, errors } = validateConfig(settings, opts.oroMqttSettings);
    if (errors.length) {
      console.error('ISO 21423 robots: misconfigured, not starting:');
      errors.forEach((e) => console.error('  - ' + e));
      return this;
    }
    if (!config) {
      console.log('ISO 21423 robots is OFF');
      return this;
    }
    this._config = config;

    try {
      this._sdk = await import('@openrobops/iso21423');
    } catch (err) {
      console.error('ISO 21423 robots cannot start: @openrobops/iso21423 is not installed:',
        err.message);
      this._config = null;
      return this;
    }

    try {
      const { Iso21423Client, createMqttTransport } = this._sdk;
      this._client = await Iso21423Client.connect({
        transport: opts.transport || createMqttTransport(config.mqtt.url, {
          username: config.mqtt.username,
          password: config.mqtt.password,
          tls: config.mqtt.tls,
          reconnectPeriod: 5000,
        }),
        requestTimeoutMs: config.requestTimeoutMs,
      });
      // First operation on the client, so this arms the B.4 Last Will for ORO's IMRFM entity.
      // `manages` is deliberately left empty — see decision 7.
      this._imrfm = await this._client.registerSelfEntity({
        entityUuid: config.imrfmId,
        entityType: 'IMRFM',
        manufacturerName: config.manufacturerName,
        details: { platform: 'OpenRobOps', service: 'ingest', role: 'iso-robots' },
        capabilities: { provides: [], accepts: [] },
      });
      this._client.on('error', (err) => console.warn('ISO 21423 robots client error:', err.message));
      this._client.on('diagnostic', (d) => config.logging && console.log('ISO 21423 robots:', d));
      console.log(`ISO 21423 robots is ON: IMRFM ${config.imrfmId} at ${config.mqtt.url}`);
    } catch (err) {
      console.error('ISO 21423 robots failed to connect:', err.message);
      this._client = null;
    }
    return this;
  };

  /** Closes the ISO client and therefore its MQTT session. Safe when the module never started. */
  shutdown = async () => {
    if (!this._client) return;
    try {
      await this._client.close({ timeout: 5000 });
    } catch (err) {
      console.warn('ISO 21423 robots shutdown error:', err.message);
    }
    this._client = null;
  };

  /** Health snapshot in the shape `UpstreamModule.reportHealth` uses (`src/server/modules/upstream.js:253`). */
  reportHealth = async () => {
    if (!this._config) return { componentId: 'isoRobots', status: 'OFF' };
    if (!this._client) return { componentId: 'isoRobots', status: 'DOWN' };
    const health = this._client.health();
    return {
      componentId: 'isoRobots',
      status: health.connection === 'connected' ? 'UP' : 'DOWN',
      imrfmId: this._config.imrfmId,
      connection: health.connection,
      // Filled in by later tasks: `admitted` (Task 2), `ccs` (Task 3), `observed` (Task 4).
    };
  };
}

export default IsoRobotsModule;
export { IsoRobotsModule };
