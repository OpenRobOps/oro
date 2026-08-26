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
import { AdmittedRoster } from './roster';
import { IsoTelemetryIngester } from './ingestTelemetry';
import { IsoCommandRouter } from './commands';
import { COLLECTIONS } from '../../shared/constants';
import { CcsConverter } from '../iso21423/ccs';
import AttributesManager from '../attributes';

/**
 * Body of the fleet-wide identity-watch callback: warns once per uuid when an ISO IMR identity is
 * seen on the network but is not admitted. Extracted to a plain function so the `identity.id`
 * mapping (controller ruling R2 — NOT `identity.entityUuid`, which would silently disable this
 * warning for every unadmitted identity) has a direct unit test independent of a full `load()`.
 *
 * @param {Object} identity an `EntityIdentity` from `subscribeEntities`
 * @param {Object} deps
 * @param {Object} deps.roster the `AdmittedRoster`
 * @param {Set<string>} deps.seenUnadmitted uuids already warned about this process
 * @param {(name: string, data: Object) => void} deps.diagnostic `this._imrfm.ctx.diagnostic`
 * @param {(msg: string) => void} [deps.warn=console.warn]
 */
const handleUnadmittedIdentity = (identity, { roster, seenUnadmitted, diagnostic, warn = console.warn }) => {
  const uuid = String(identity.id || '').toLowerCase();
  if (!uuid || roster.isAdmitted(uuid) || seenUnadmitted.has(uuid)) return;
  seenUnadmitted.add(uuid);   // once per uuid per process — never a log flood
  diagnostic('iso-robot-not-admitted', { entityUuid: uuid });
  warn(
    `ISO 21423 robots: IMR ${uuid} is publishing on the ISO network but is not admitted. `
    + 'ORO is ignoring it. Admit it by applying an IsoRobot configuration object with '
    + `id "${uuid}" (see docs/iso21423-robots.md).`);
};

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
    this._converter = null;
    this._roster = null;
    this._ingester = null;
    this._commands = null;
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

      this._converter = CcsConverter.create(config.ccs, this._sdk);
      if (!this._converter.calibrated) {
        console.warn('ISO 21423 robots: pose ingestion and move commands are DISABLED — '
          + this._converter.reason);
        this._imrfm.ctx.diagnostic('ccs-uncalibrated', { reason: this._converter.reason });
      }

      this._roster = new AdmittedRoster({
        collection: this._mongo.getCollection(COLLECTIONS.ROBOTS),
        pollMs: config.rosterPollMs,
        logging: config.logging,
        onAdmit: async (uuid) => { await this._observe(uuid); },
        onRevoke: async (uuid) => { await this._unobserve(uuid); },
      });

      this._client.sdk = this._sdk;   // EntityFilter et al., for the ingester's per-robot filters

      this._ingester = new IsoTelemetryIngester({
        client: this._client,
        attributesManager: new AttributesManager(),   // singleton (src/server/attributes.js:65-66)
        robotsColl: this._mongo.getCollection(COLLECTIONS.ROBOTS),
        converter: this._converter,
        sources: config.attributeSources,
        roster: this._roster,
        logging: config.logging,
      });
      this._observe = (uuid) => this._ingester.observe(uuid);
      this._unobserve = (uuid) => this._ingester.unobserve(uuid);

      this._commands = new IsoCommandRouter({
        oroMqtt: this._oroMqtt,
        imrfm: this._imrfm,
        roster: this._roster,
        converter: this._converter,
        sdk: this._sdk,
        commandTopics: config.commandTopics,
        telemetry: this._ingester,      // for lastCcsPose (decision 15)
        logging: config.logging,
      });
      this._commands.register();
      if (!config.commandTopics.pause || !config.commandTopics.resume) {
        console.log('ISO 21423 robots: no pause/resume subtopics configured, so ISO pauseImr and '
          + 'resumeImr are only reachable through the cancel-nav fallback. Set '
          + 'iso21423.robots.commandTopics.pause/.resume to the subtopics your pauseRobot and '
          + 'resumeRobot ActionDefinitions publish to.');
      }

      // Fleet-wide identity watch: purely so an operator learns that a robot is on the network but
      // not admitted. ORO subscribes to no telemetry for it and sends it nothing (Gate 2).
      this._seenUnadmitted = new Set();
      await this._client.subscribeEntities(this._sdk.EntityFilter.ofType('IMR'), (identity) => {
        handleUnadmittedIdentity(identity, {
          roster: this._roster,
          seenUnadmitted: this._seenUnadmitted,
          diagnostic: (name, data) => this._imrfm.ctx.diagnostic(name, data),
        });
      });

      await this._roster.start();
    } catch (err) {
      console.error('ISO 21423 robots failed to connect:', err.message);
      this._client = null;
    }
    return this;
  };

  /** Closes the ISO client and therefore its MQTT session. Safe when the module never started. */
  shutdown = async () => {
    this._roster && this._roster.stop();
    if (this._ingester) await this._ingester.stop();
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
      admitted: this._roster ? this._roster.admittedIds().length : 0,
      observed: this._roster ? this._roster.admittedIds().length : 0,
      ccs: this._converter.calibrated ? 'calibrated' : 'uncalibrated',
    };
  };

  // Overwritten in load() once the ingester exists. Left as no-ops so `AdmittedRoster`'s
  // onAdmit/onRevoke callbacks (bound at construction, before the ingester exists) are always safe
  // to call even if `load()` fails after constructing the roster but before wiring the ingester.
  _observe = async (uuid) => {
  };

  _unobserve = async (uuid) => {
  };
}

export default IsoRobotsModule;
export { IsoRobotsModule, handleUnadmittedIdentity };
