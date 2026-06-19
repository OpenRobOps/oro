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
 * UpstreamModule — bridges this ORO instance's local MQTT broker to an
 * "upstream" broker (another ORO or an InOrbit cloud), forwarding robot
 * telemetry as if each local robot were directly connected to upstream.
 *
 * Forwarding is primarily upstream (robot -> upstream telemetry). Downstream
 * delivery (upstream -> local robot) is currently limited to an allow-list of
 * commands (see DEFAULT_DOWNSTREAM_COMMANDS), republished onto the local broker so the
 * robot receives them as if sent locally.
 *
 * Per-robot credentials are required by the upstream protocol today; the
 * module therefore opens one MQTT client per mapped robot. When upstream
 * gains support for multi-robot credentials in the future, the per-robot
 * design is encapsulated in `UpstreamRobotClient` so the change stays
 * localized.
 * 
 * TODOs:
 *  - Filter for known topics (only forward msgs from robot)
 *  - Handle last will & testament state per robot for abrupt disconnections
 *  - Start accepting messages from upstream (e.g. commands)
 */
/* eslint-disable max-classes-per-file */
import mqtt from 'mqtt';
import axios from 'axios';
import https from 'https';
import MongoManager from '../../mongo';
import ThrottledLogger from '../../shared/throttledLogger';
import Cache from '../../shared/simpleCache';
import { COLLECTIONS } from '../../shared/constants';
import { encryptPassword, decryptPassword } from '../../shared/mqttCredentialCrypto';
import { VERSION } from '../../lib/version';

const COLLECTION_NAME = 'upstream_mqtt_credentials';
// Build-metadata suffix appended to a robot's agent version when its state is
// forwarded upstream, so upstream can tell the telemetry was relayed through
// this ORO instance (e.g. "0.48.0" -> "0.48.0+oro-1.2.3"). The '+oro-' marker
// also makes the stamp idempotent (see _stampStateVersion).
const AGENT_VERSION_ORO_MARKER = '+oro-';
const AGENT_VERSION_SUFFIX = `${AGENT_VERSION_ORO_MARKER}${VERSION}`;
const DEFAULT_DENY_SUBTOPICS = ['in_cmd', 'modules/set_state'];
// Translation table (forwarder seq -> upstream seq) lifetime. Comfortably above
// the server-side callback timeout (10s in app/imports/server/mqtt.js) so an
// entry never expires before the robot's echo could plausibly arrive.
const CALLBACK_TABLE_MAX_AGE_MS = 15 * 1000;
const CALLBACK_TABLE_MAX_SIZE = 10000;
// Default server->robot commands delivered downstream (upstream -> local robot),
// each republished onto the local broker under the local robot's topic.
//
// Operators can override this entirely via
// `modules.upstream.forwarding.downstreamCommands` in settings (see
// UpstreamRobotClient's `downstreamCommands` option). Each entry is
// `{ subtopic, acceptsPayloads?, awaitsEcho? }`:
//  - `acceptsPayloads` (optional) is a list of exact string payloads to allow on
//    that subtopic; when omitted, every payload on the subtopic is delivered.
//  - `awaitsEcho` (optional) marks commands sent with the server-side callback
//    mechanism (payload prefixed `<seq>|`). For those the forwarder rewrites the
//    seq and relays the robot's echo back upstream so the upstream server's
//    callback resolves (see _rewriteSeqForDownstream / _handleRobotEcho).
//
// This is deliberately an allow-list, not a whole subtree:
//  - `custom_command/` also carries robot->server feedback (e.g.
//    `custom_command/script/status`) which must keep flowing upstream and must
//    not be echoed back to the robot, so only the actual command subtopics are
//    listed.
//  - `in_cmd` is a single topic carrying many server->robot commands plus
//    echo/ping messages (sent as '<seq>|' by the callback mechanism). Only
//    `restart` and `get_state` are delivered by default (via `acceptsPayloads`);
//    sequence-number pings are recognized separately and relayed to the real
//    robot through the same seq-rewrite path. Other in_cmd commands (e.g.
//    load_module) are withheld by default because they would conflict with this
//    ORO instance's own agent management — an operator that owns both ends can
//    widen this via config.
//  - `modules/set_state` is intentionally NOT in the default set for the same
//    reason (it reconfigures local modules); add it via config to opt in.
//
// The robot never publishes these command topics, so anything seen on them by
// the upstream forwarder is our own downstream injection echoing off the local
// broker; the forwarder skips them to avoid a loop (and `in_cmd` is in the deny
// list as well).
const DEFAULT_DOWNSTREAM_COMMANDS = [
  // Custom commands / scripts
  { subtopic: 'custom_command/ros' },
  { subtopic: 'custom_command/script/command' },
  // Teleoperation
  { subtopic: 'ros/teleop/step', awaitsEcho: true },
  { subtopic: 'ros/teleop/go' },
  // Navigation & localization
  { subtopic: 'ros/loc/set_pose', awaitsEcho: true },
  { subtopic: 'ros/loc/nav_goal', awaitsEcho: true },
  { subtopic: 'ros/nav/goal_path' },
  { subtopic: 'ros/nav/goal_to_current_pose' },
  { subtopic: 'ros/loc/mapreq' },
  // Data capture uploads
  { subtopic: 'ros/rosbag/upload' },
  { subtopic: 'ros/databag/upload' },
  // Agent control: only the non-conflicting commands by default.
  { subtopic: 'in_cmd', acceptsPayloads: ['restart', 'get_state'] },
];

// Action type/label values, mirroring app/imports/shared/actions.js ACTION_TYPES
// so the events written here read consistently alongside locally-executed ones.
const ACTION_TYPES = {
  RESTART_AGENT: 'RestartAgent',
  RUN_SCRIPT: 'RunScript',
  PUBLISH_TO_TOPIC: 'PublishToTopic',
};
// Event log module/type, mirroring app/imports/lib/events.js (EVENT_MODULES.ACTION,
// EVENT_TYPES.ACTION_EXECUTED). The event_log collection is shared with the app.
const EVENT_MODULE_ACTION = 'action';
const EVENT_TYPE_ACTION_EXECUTED = 'action.executed';
// Audit-log identity for commands that arrived over the upstream link rather
// than from a local user.
const UPSTREAM_USER_ID = 'upstream';
// After a permanent (HTTP 4xx) failure, don't hammer the upstream API.
const PERMANENT_FAILURE_RETRY_MS = 5 * 60 * 1000;
// Auth-failure refetch throttle, to avoid loops if upstream keeps rejecting
// the new credentials it just handed us.
const AUTH_RETRY_THROTTLE_MS = 5 * 60 * 1000;
// Transient backoff bounds
const TRANSIENT_BACKOFF_INITIAL_MS = 1000;
const TRANSIENT_BACKOFF_MAX_MS = 60 * 1000;

export default class UpstreamModule {
  constructor({ mqtt: oroMqtt, mqttConfig } = {}) {
    this._oroMqtt = oroMqtt;
    this._mqttConfig = mqttConfig;
    this._mongo = new MongoManager();
    this._robotClients = new Map();
  }

  /**
   * Load the module.
   * @param {object} settings - The `modules.upstream` block from ingest settings.
   */
  load = async (settings) => {
    if (!settings || !settings.enabled) {
      console.warn('UpstreamModule is disabled');
      return;
    }

    const {
      api,
      brokerOptions = {},
      robotMapping = [],
      forwarding = {},
      credentialEncryptionKey,
      logging = false,
    } = settings;

    if (!api?.baseUrl || !api?.apiKey) {
      console.error('[upstream] modules.upstream.api.baseUrl and api.apiKey are required; module not loaded');
      return;
    }
    if (!credentialEncryptionKey) {
      console.error('[upstream] modules.upstream.credentialEncryptionKey is required; module not loaded');
      return;
    }
    if (!this._mqttConfig?.brokers || !this._mqttConfig?.defaultBrokerId) {
      console.error('[upstream] local mqtt config is unavailable; module not loaded');
      return;
    }
    const localBrokerConfig = this._mqttConfig.brokers[this._mqttConfig.defaultBrokerId];
    if (!localBrokerConfig) {
      console.error(`[upstream] local broker config for defaultBrokerId=${this._mqttConfig.defaultBrokerId} not found`);
      return;
    }

    this._api = api;
    this._brokerOptions = brokerOptions;
    this._denySubtopics = new Set(forwarding.denyTopicSuffixes || DEFAULT_DENY_SUBTOPICS);
    // Optional operator override for the downstream command allow-list; when
    // absent each UpstreamRobotClient falls back to DEFAULT_DOWNSTREAM_COMMANDS.
    this._downstreamCommands = forwarding.downstreamCommands;
    this._publishRetained = forwarding.publishRetainedMessages !== false;
    this._credentialEncryptionKey = credentialEncryptionKey;
    this._logging = logging;
    this._localBrokerConfig = localBrokerConfig;
    this._credsColl = this._mongo.getCollection(COLLECTION_NAME);
    this._eventLogColl = this._mongo.getCollection(COLLECTIONS.EVENT_LOG);
    this._logger = new ThrottledLogger({ throttlingMs: 60 * 1000 });

    await this._credsColl.createIndex(
      { localRobotId: 1, apiBaseUrl: 1 },
      { unique: true }
    );

    if (!Array.isArray(robotMapping) || robotMapping.length === 0) {
      console.warn('[upstream] modules.upstream.robotMapping is empty; no robots will be forwarded');
      return;
    }

    for (const entry of robotMapping) {
      if (!entry?.localRobotId || !entry?.upstreamRobotId) {
        console.warn('[upstream] skipping malformed mapping entry', entry);
        continue;
      }
      const client = new UpstreamRobotClient({
        localRobotId: entry.localRobotId,
        upstreamRobotId: entry.upstreamRobotId,
        api: this._api,
        brokerOptions: this._brokerOptions,
        credentialEncryptionKey: this._credentialEncryptionKey,
        credsColl: this._credsColl,
        denySubtopics: this._denySubtopics,
        downstreamCommands: this._downstreamCommands,
        publishRetained: this._publishRetained,
        localBrokerConfig: this._localBrokerConfig,
        logging: this._logging,
        throttledLogger: this._logger,
        oroMqtt: this._oroMqtt,
        eventLogColl: this._eventLogColl,
      });
      this._robotClients.set(entry.localRobotId, client);
      client.start().catch((err) => {
        console.error(`[upstream] ${entry.localRobotId}: start failed: ${err && err.message}`);
      });
    }

    console.log(`[upstream] UpstreamModule loaded with ${this._robotClients.size} robot mapping(s); `
      + `upstream API=${this._api.baseUrl}`);
  };

  shutdown = async () => {
    await Promise.all(
      Array.from(this._robotClients.values()).map((c) => c.shutdown())
    );
    this._robotClients.clear();
  };

  reportHealth = async () => {
    const robots = Array.from(this._robotClients.entries()).map(([localRobotId, c]) => ({
      localRobotId,
      upstreamRobotId: c.upstreamRobotId,
      status: c.isConnected() ? 'UP' : 'DOWN',
      lastError: c.lastError || null,
    }));
    const allUp = robots.length > 0 && robots.every((r) => r.status === 'UP');
    return {
      componentId: 'upstream',
      status: allUp ? 'UP' : 'DOWN',
      robots,
    };
  };
}

/**
 * Per-robot bridge:
 *  - holds one MQTT client connected to the upstream broker (as the
 *    upstreamRobotId), and
 *  - holds a separate MQTT client connected to the local broker subscribed
 *    to `r/{localRobotId}/#`, so raw payloads + packet flags (retain/qos)
 *    can be republished untouched.
 */
export class UpstreamRobotClient {
  constructor({
    localRobotId,
    upstreamRobotId,
    api,
    brokerOptions,
    credentialEncryptionKey,
    credsColl,
    denySubtopics,
    downstreamCommands,
    publishRetained,
    localBrokerConfig,
    logging,
    throttledLogger,
    oroMqtt,
    eventLogColl,
  }) {
    this.localRobotId = localRobotId;
    this.upstreamRobotId = upstreamRobotId;
    this.lastError = null;

    this._api = api;
    this._brokerOptions = brokerOptions;
    this._credentialEncryptionKey = credentialEncryptionKey;
    this._credsColl = credsColl;
    this._denySubtopics = denySubtopics;
    // Allow-list of server->robot commands to deliver downstream. Falls back to
    // the built-in default when not provided via config (an explicit empty array
    // disables downstream command delivery entirely).
    this._downstreamCommands = downstreamCommands || DEFAULT_DOWNSTREAM_COMMANDS;
    this._publishRetained = publishRetained;
    this._localBrokerConfig = localBrokerConfig;
    this._logging = logging;
    this._logger = throttledLogger;
    // oroMqtt provides protobuf type lookup (lookupType); eventLogColl is the
    // shared `event_log` mongo collection. Both used by _logUpstreamCommand.
    this._oroMqtt = oroMqtt;
    this._eventLogColl = eventLogColl;

    this._upstreamClient = null;
    this._localClient = null;
    this._connected = false;
    // Latest retained message per upstream topic. The local broker delivers a
    // retained message only once (on subscribe), which can happen before the
    // upstream connection is ready, so we remember retained values here and
    // replay them whenever the upstream client (re)connects. See _forward and
    // _flushRetainedMessages.
    this._retainedMessages = new Map();
    // Callback seq translation for echo-awaiting commands forwarded downstream.
    // Forwarder seqs are NEGATIVE and decrement from -1; this can never collide
    // with the local ORO app's or the upstream server's positive `_seq++`
    // registries, so robot echoes carrying our seq are unambiguously ours and
    // everyone else's echoes are ignored. Entries expire (TTL) so a missing echo
    // never leaks. Key: String(fwdSeq) -> { upstreamSeq, subtopic }.
    this._fwdSeq = 0;
    this._callbackTable = new Cache({
      maxAge: CALLBACK_TABLE_MAX_AGE_MS,
      maxSize: CALLBACK_TABLE_MAX_SIZE,
    });
    this._lastAuthFetchTs = 0;
    this._authRefetchInFlight = false;
    this._shuttingDown = false;
  }

  isConnected = () => this._connected;

  start = async () => {
    const creds = await this._loadOrFetchCredentials();
    if (!creds) {
      // permanent failure or throttled; leave clients down. reportHealth will surface it.
      return;
    }
    this._openUpstreamClient(creds);
    this._openLocalSubscriber();
  };

  shutdown = async () => {
    this._shuttingDown = true;
    if (this._localClient) {
      try { this._localClient.end(true); } catch (e) { /* ignore */ }
    }
    if (this._upstreamClient) {
      try { this._upstreamClient.end(true); } catch (e) { /* ignore */ }
    }
  };

  _loadOrFetchCredentials = async () => {
    const row = await this._credsColl.findOne({
      localRobotId: this.localRobotId,
      apiBaseUrl: this._api.baseUrl,
    });

    if (row) {
      if (
        row.tsLastPermanentFailure
        && Date.now() - row.tsLastPermanentFailure < PERMANENT_FAILURE_RETRY_MS
      ) {
        this.lastError = row.lastErrorMsg || 'permanent fetch failure (throttled)';
        console.warn(`[upstream] ${this.localRobotId}: skipping; ${this.lastError}`);
        return null;
      }
      if (row.encryptedPassword) {
        try {
          const password = decryptPassword(row.encryptedPassword, this._credentialEncryptionKey);
          return { ...row, password };
        } catch (e) {
          console.warn(`[upstream] ${this.localRobotId}: stored creds failed to decrypt, refetching`);
        }
      }
    }
    return this._fetchAndStoreCredentials();
  };

  _fetchAndStoreCredentials = async () => {
    let backoff = TRANSIENT_BACKOFF_INITIAL_MS;
    while (!this._shuttingDown) {
      try {
        const fetched = await this._postMqttConfig();
        const now = Date.now();
        const encryptedPassword = encryptPassword(fetched.password, this._credentialEncryptionKey);
        const doc = {
          localRobotId: this.localRobotId,
          upstreamRobotId: this.upstreamRobotId,
          apiBaseUrl: this._api.baseUrl,
          brokerHostname: fetched.hostname,
          brokerPort: fetched.port,
          brokerProtocol: fetched.protocol,
          username: fetched.username,
          encryptedPassword,
          tsUpdated: now,
        };
        await this._credsColl.updateOne(
          { localRobotId: this.localRobotId, apiBaseUrl: this._api.baseUrl },
          {
            $set: doc,
            $setOnInsert: { tsCreated: now },
            $unset: { tsLastPermanentFailure: '', lastErrorMsg: '' },
          },
          { upsert: true }
        );
        console.log(`[upstream] ${this.localRobotId}: credentials fetched and stored (upstreamRobotId=${this.upstreamRobotId})`);
        return { ...doc, password: fetched.password };
      } catch (e) {
        if (e.permanent) {
          this.lastError = e.message;
          console.error(`[upstream] ${this.localRobotId}: permanent failure fetching credentials: ${e.message}`);
          await this._credsColl.updateOne(
            { localRobotId: this.localRobotId, apiBaseUrl: this._api.baseUrl },
            {
              $set: {
                localRobotId: this.localRobotId,
                upstreamRobotId: this.upstreamRobotId,
                apiBaseUrl: this._api.baseUrl,
                tsLastPermanentFailure: Date.now(),
                lastErrorMsg: e.message,
              },
              $setOnInsert: { tsCreated: Date.now() },
            },
            { upsert: true }
          );
          return null;
        }
        console.warn(`[upstream] ${this.localRobotId}: transient fetch error: ${e.message}; retrying in ${backoff}ms`);
        await sleep(backoff);
        backoff = Math.min(backoff * 2, TRANSIENT_BACKOFF_MAX_MS);
      }
    }
    return null;
  };

  _postMqttConfig = async () => {
    const url = new URL('/mqtt_config', this._api.baseUrl).toString();
    try {
      const res = await axios.post(
        url,
        {
          apiKey: this._api.apiKey,
          robotId: this.upstreamRobotId,
          hostname: this.localRobotId,
          agentVersion: `oro-upstream-forwarder/${process.env.npm_package_version || '0.0.0'}`,
        },
        {
          timeout: 10000,
          // Mirror MQTT TLS verification behavior for the HTTPS call when the
          // operator has explicitly opted out of cert validation upstream.
          httpsAgent: this._brokerOptions?.rejectUnauthorized === false
            ? new https.Agent({ rejectUnauthorized: false })
            : undefined,
        }
      );
      const { hostname, port, protocol, username, password } = res.data || {};
      if (!hostname || !port || !protocol || !username || !password) {
        const err = new Error(`Incomplete /mqtt_config response: ${JSON.stringify(res.data)}`);
        err.permanent = true;
        throw err;
      }
      return { hostname, port, protocol, username, password };
    } catch (e) {
      if (e.permanent) throw e;
      if (e.response) {
        const status = e.response.status;
        const body = typeof e.response.data === 'string' ? e.response.data : JSON.stringify(e.response.data);
        const err = new Error(`HTTP ${status} from /mqtt_config: ${body}`);
        err.permanent = status === 400 || status === 403 || status === 404;
        throw err;
      }
      const err = new Error(`Network error calling /mqtt_config: ${e.message}`);
      err.permanent = false;
      throw err;
    }
  };

  _openUpstreamClient = (creds) => {
    const url = `${creds.brokerProtocol}${creds.brokerHostname}:${creds.brokerPort}`;
    const clientOptions = {
      username: creds.username,
      password: creds.password,
      // A unique clientId avoids the upstream forcefully disconnecting us if
      // someone else (e.g. the real robot) connects with the same identity.
      // The robotId remains the auth identity; clientId is broker-level only.
      clientId: `oro-upstream-${this.upstreamRobotId}-${process.pid}-${Date.now()}`,
      reconnectPeriod: 5000,
      ...this._brokerOptions,
    };
    if (this._logging) {
      console.log(`[upstream] ${this.localRobotId}: connecting upstream to ${url} as ${creds.username}`);
    }
    this._upstreamClient = mqtt.connect(url, clientOptions);

    this._upstreamClient.on('connect', () => {
      this._connected = true;
      this.lastError = null;
      if (this._logging) {
        console.log(`[upstream] ${this.localRobotId}: upstream connected (as ${this.upstreamRobotId})`);
      }
      this._subscribeUpstreamCommands();
      this._flushRetainedMessages();
    });
    this._upstreamClient.on('message', (topic, payload, packet) => {
      this._handleUpstreamMessage(topic, payload, packet);
    });
    this._upstreamClient.on('close', () => {
      this._connected = false;
      if (this._logging) console.log(`[upstream] ${this.localRobotId}: upstream closed`);
    });
    this._upstreamClient.on('offline', () => {
      this._connected = false;
      if (this._logging) console.log(`[upstream] ${this.localRobotId}: upstream offline`);
    });
    this._upstreamClient.on('error', (e) => {
      this.lastError = e.message;
      console.warn(`[upstream] ${this.localRobotId}: upstream error: ${e.message}`);
      // MQTT 3.1.1 CONNACK error codes 4 (bad credentials) and 5 (not authorized).
      // mqtt.js exposes these as err.code on the error event.
      if (e.code === 4 || e.code === 5) {
        this._maybeRefetchOnAuthFailure();
      }
    });
  };

  _maybeRefetchOnAuthFailure = () => {
    if (this._authRefetchInFlight) return;
    const now = Date.now();
    if (now - this._lastAuthFetchTs < AUTH_RETRY_THROTTLE_MS) {
      this._logger.warn(
        `upstream-auth-throttle-${this.localRobotId}`,
        `[upstream] ${this.localRobotId}: upstream auth failed; refetch throttled (next attempt in `
          + `${Math.ceil((AUTH_RETRY_THROTTLE_MS - (now - this._lastAuthFetchTs)) / 1000)}s)`
      );
      return;
    }
    this._lastAuthFetchTs = now;
    this._authRefetchInFlight = true;
    this._refetchAndReconnect()
      .catch((err) => console.error(`[upstream] ${this.localRobotId}: refetch failed: ${err && err.message}`))
      .finally(() => { this._authRefetchInFlight = false; });
  };

  _refetchAndReconnect = async () => {
    console.log(`[upstream] ${this.localRobotId}: refetching upstream credentials after auth failure`);
    await this._credsColl.deleteOne({
      localRobotId: this.localRobotId,
      apiBaseUrl: this._api.baseUrl,
    });
    if (this._upstreamClient) {
      try { this._upstreamClient.end(true); } catch (e) { /* ignore */ }
      this._upstreamClient = null;
    }
    const fresh = await this._fetchAndStoreCredentials();
    if (!fresh || this._shuttingDown) return;
    this._openUpstreamClient(fresh);
  };

  _openLocalSubscriber = () => {
    const {
      protocol, hostname, port, username, password, rejectUnauthorized,
    } = this._localBrokerConfig;
    const url = `${protocol}${hostname}:${port}`;
    this._localClient = mqtt.connect(url, {
      username,
      password,
      rejectUnauthorized,
      clientId: `oro-upstream-fwd-${this.localRobotId}-${process.pid}-${Date.now()}`,
      reconnectPeriod: 5000,
    });
    this._localClient.on('connect', () => {
      const topic = `r/${this.localRobotId}/#`;
      this._localClient.subscribe(topic, { qos: 0 }, (err) => {
        if (err) {
          console.error(`[upstream] ${this.localRobotId}: local subscribe failed: ${err.message}`);
        } else if (this._logging) {
          console.log(`[upstream] ${this.localRobotId}: subscribed locally to ${topic}`);
        }
      });
    });
    this._localClient.on('error', (e) => {
      console.warn(`[upstream] ${this.localRobotId}: local client error: ${e.message}`);
    });
    this._localClient.on('message', (topic, payload, packet) => {
      this._forward(topic, payload, packet);
    });
  };

  _forward = (topic, payload, packet) => {
    const prefix = `r/${this.localRobotId}/`;
    if (!topic.startsWith(prefix)) return;
    const subtopic = topic.substring(prefix.length);
    if (subtopic === 'echo') {
      // The robot's Echo responses are not telemetry to forward as-is; route them
      // so we can relay upstream only the ones answering commands we forwarded
      // (see _handleRobotEcho).
      this._handleRobotEcho(payload);
      return;
    }
    if (this._denySubtopics.has(subtopic)) {
      this._logger.log(
        `upstream-deny-${subtopic}`,
        `[upstream] ${this.localRobotId}: dropping server-side topic '${subtopic}' (in deny list)`
      );
      return;
    }
    if (this._isDownstreamCommandSubtopic(subtopic)) {
      // Server->robot command we deliver downstream; the robot never publishes
      // it, so anything seen here is our own injection echoing off the local
      // broker. Never forward it upstream (would loop back to us).
      return;
    }
    const upstreamTopic = `r/${this.upstreamRobotId}/${subtopic}`;
    const qos = packet.qos || 0;

    // Stamp the robot's online/state message with this forwarder's version.
    const outPayload = subtopic === 'state' ? this._stampStateVersion(payload) : payload;

    if (!this._upstreamClient || !this._connected) {
      // Remember retained values so they survive an upstream that isn't connected
      // yet (or has reconnected); they are replayed in _flushRetainedMessages.
      if (packet.retain) {
        if (outPayload && outPayload.length > 0) {
          this._retainedMessages.set(upstreamTopic, { payload: outPayload, qos });
        } else {
          // An empty retained payload clears the retained value (MQTT semantics).
          this._retainedMessages.delete(upstreamTopic);
        }
      } else {
        this._logger.warn(
          `upstream-disconnected-${this.localRobotId}`,
          `[upstream] ${this.localRobotId}: upstream not connected; dropping '${subtopic}'`
          + `${packet.retain ? ' (retained value buffered)' : ''}`
        );
      }
      return;
    } else {
      this._publishToUpstream(upstreamTopic, outPayload, qos, !!packet.retain);
    }
  };

  /**
   * Append a build-metadata suffix to the agent version inside a robot 'state'
   * payload before it is forwarded upstream. The state payload is the
   * pipe-delimited string "online|apiKey|agentVersion|hostname" (see
   * BasicsModule.onState). Only the version field (index 2) is touched, and only
   * when it is present, non-empty, and not already stamped — so empty/offline
   * (LWT) states and retained replays pass through unchanged. Returns the
   * original payload when there is nothing to stamp.
   */
  _stampStateVersion = (payload) => {
    if (!payload || payload.length === 0) return payload;
    const parts = payload.toString().split('|');
    const version = parts[2];
    if (!version || version.includes(AGENT_VERSION_ORO_MARKER)) return payload;
    parts[2] = `${version}${AGENT_VERSION_SUFFIX}`;
    return Buffer.from(parts.join('|'));
  };

  /**
   * Replay all buffered retained messages to upstream. Invoked on every
   * upstream 'connect' so that retained values delivered locally before the
   * upstream link was ready (or lost across an upstream restart) are not lost.
   */
  _flushRetainedMessages = () => {
    if (!this._retainedMessages.size) {
      return
    };
    if (this._logging) {
      console.log(`[upstream] ${this.localRobotId}: replaying ${this._retainedMessages.size} `
        + 'retained message(s) upstream: ' + [...this._retainedMessages.keys()].join(', '));
    }
    for (const [upstreamTopic, { payload, qos }] of this._retainedMessages) {
      this._publishToUpstream(upstreamTopic, payload, qos, true);
    }
  };

  _publishToUpstream = (upstreamTopic, payload, qos, retain) => {
    const publishOptions = {
      qos,
      retain: this._publishRetained ? retain : false,
    };
    this._upstreamClient.publish(upstreamTopic, payload, publishOptions, (err) => {
      if (err) {
        this._logger.warn(
          `upstream-publish-fail-${this.localRobotId}`,
          `[upstream] ${this.localRobotId}: publish to ${upstreamTopic} failed: ${err.message}`
        );
      }
    });
  };

  _downstreamCommandFor = (subtopic) => this._downstreamCommands.find((c) => c.subtopic === subtopic);

  _isDownstreamCommandSubtopic = (subtopic) => !!this._downstreamCommandFor(subtopic);

  /**
   * Subscribe the upstream client to the server->robot command topics we
   * deliver downstream. Invoked on every upstream 'connect' (subscriptions do
   * not survive a reconnect with a fresh clientId/session).
   */
  _subscribeUpstreamCommands = () => {
    const subtopics = [...new Set(this._downstreamCommands.map((c) => c.subtopic))];
    for (const subtopic of subtopics) {
      const topic = `r/${this.upstreamRobotId}/${subtopic}`;
      // qos 1: commands matter; don't silently lose them on a flaky link.
      this._upstreamClient.subscribe(topic, { qos: 1 }, (err) => {
        if (err) {
          console.error(`[upstream] ${this.localRobotId}: upstream subscribe to ${topic} failed: ${err.message}`);
        } else if (this._logging) {
          console.log(`[upstream] ${this.localRobotId}: subscribed upstream to ${topic}`);
        }
      });
    }
  };

  /**
   * Deliver a message received from upstream down to the local robot, by
   * republishing it onto the local broker under the local robot's topic.
   * Only the allow-listed commands are delivered (see this._downstreamCommands),
   * subject to each command's optional payload filter; everything else is
   * ignored.
   *
   * Echo-awaiting commands (`awaitsEcho` entries, plus the in_cmd ping) have their
   * `<seq>|` prefix rewritten to a forwarder-local negative seq so the robot's
   * echo can be routed back to the upstream server (see _rewriteSeqForDownstream
   * and _handleRobotEcho). All other commands are forwarded verbatim.
   */
  _handleUpstreamMessage = (topic, payload, packet) => {
    if (this._logging && !topic.endsWith('/in_cmd')) {
      console.log("[upstream] handleUpstreamMessage", topic, String(payload))
    }
    const prefix = `r/${this.upstreamRobotId}/`;
    if (!topic.startsWith(prefix)) return;
    const subtopic = topic.substring(prefix.length);

    const command = this._downstreamCommandFor(subtopic);
    if (!command) return;

    // The in_cmd ping is a bare '<seq>|' the upstream server uses to probe the
    // robot's round-trip latency. It is delivered (rewritten) regardless of the
    // in_cmd `acceptsPayloads` allow-list, which only governs literal commands
    // like restart/get_state.
    const isInCmdPing = subtopic === 'in_cmd' && /^\d+\|$/.test(payload.toString());
    if (!isInCmdPing && command.acceptsPayloads
        && !command.acceptsPayloads.includes(payload.toString())) {
      return;
    }
    if (!this._localClient) {
      this._logger.warn(
        `upstream-cmd-no-local-${this.localRobotId}`,
        `[upstream] ${this.localRobotId}: local client unavailable; dropping command '${subtopic}'`
      );
      return;
    }

    // Rewrite the callback seq for echo-awaiting commands (and the ping); forward
    // everything else (protobuf commands, restart/get_state) verbatim.
    const localPayload = (command.awaitsEcho || isInCmdPing)
      ? this._rewriteSeqForDownstream(subtopic, payload)
      : payload;

    const localTopic = `r/${this.localRobotId}/${subtopic}`;
    if (this._logging) {
      console.log(`[upstream] ${this.localRobotId}: delivering upstream command '${subtopic}' to robot`);
    }
    this._logUpstreamCommand(topic, payload);
    // Commands are transient: never retained on the local broker.
    this._localClient.publish(localTopic, localPayload, { qos: packet.qos || 0, retain: false }, (err) => {
      if (err) {
        this._logger.warn(
          `upstream-cmd-publish-fail-${this.localRobotId}`,
          `[upstream] ${this.localRobotId}: publish command to ${localTopic} failed: ${err.message}`
        );
      }
    });
  };

  /**
   * Rewrite the leading sequence number of an echo-awaiting command's payload
   * into a forwarder-local NEGATIVE seq, recording `fwdSeq -> { upstreamSeq,
   * subtopic }` in the translation table so the robot's echo can be routed back to
   * the upstream server (see _handleRobotEcho).
   *
   * The upstream payload is the string '<upstreamSeq>|<rest>' (the upstream seq is
   * always a positive integer). Negative forwarder seqs can never collide with the
   * positive registries on either server, so the robot's echo of our seq is
   * unambiguously ours. If the payload is not positive-seq-prefixed (defensive),
   * it is returned unchanged so a mismarked command is still delivered verbatim.
   *
   * @returns the (possibly rewritten) payload to publish to the robot.
   */
  _rewriteSeqForDownstream = (subtopic, payload) => {
    const text = payload.toString();
    const idx = text.indexOf('|');
    if (idx <= 0 || !/^\d+$/.test(text.slice(0, idx))) {
      // Not a positive seq-prefixed payload; nothing to map, forward as-is.
      return payload;
    }
    const upstreamSeq = text.slice(0, idx);
    const rest = text.slice(idx + 1);
    const fwdSeq = --this._fwdSeq; // -1, -2, -3, ...
    this._callbackTable.set(String(fwdSeq), { upstreamSeq, subtopic });
    return `${fwdSeq}|${rest}`;
  };

  /**
   * Handle an Echo published by the robot on the local broker.
   *
   * The robot echoes back every command it receives, including the seq prefix
   * verbatim. We forwarded echo-awaiting commands (and the in_cmd ping) downstream
   * with a forwarder-local NEGATIVE seq recorded in the translation table; so an
   * echo whose seq is in the table is one of ours: translate it back to the
   * upstream server's original '<upstreamSeq>|<rest>' and publish a fresh Echo
   * upstream so its callback registry resolves the sequence. Echoes carrying any
   * other seq (this ORO instance's own positive-seq commands) are ignored.
   *
   * Best-effort: guarded against a missing protobuf lookup / disconnected
   * upstream, and any failure is logged (throttled) rather than thrown.
   */
  _handleRobotEcho = (payload) => {
    if (!this._upstreamClient || !this._connected) return;
    if (!this._oroMqtt || typeof this._oroMqtt.lookupType !== 'function') return;
    try {
      const EchoType = this._oroMqtt.lookupType('oro.Echo');
      const echo = EchoType.decode(payload);
      // The echoed payload lives in the oneof; echo.payload holds the name of the
      // populated field. Only string payloads carry the '<seq>|...' prefix.
      const echoed = echo[echo.payload];
      if (typeof echoed !== 'string') return;
      const idx = echoed.indexOf('|');
      if (idx < 0) return;
      const echoedSeq = echoed.slice(0, idx);
      const entry = this._callbackTable.get(echoedSeq);
      if (!entry) return; // not a seq we forwarded (e.g. local ORO's own); ignore
      this._callbackTable.unset(echoedSeq);
      const rest = echoed.slice(idx + 1);
      // Rebuild '<upstreamSeq>|<rest>' so the upstream server matches its sequence.
      // Preserve the robot's own timestamp so upstream sees the real agent timing.
      const message = EchoType.create({
        timeStamp: echo.timeStamp,
        topic: `r/${this.upstreamRobotId}/${entry.subtopic}`,
        stringPayload: `${entry.upstreamSeq}|${rest}`,
      });
      const buffer = EchoType.encode(message).finish();
      const echoTopic = `r/${this.upstreamRobotId}/echo`;
      this._upstreamClient.publish(echoTopic, buffer, { qos: 0 }, (err) => {
        if (err) {
          this._logger.warn(
            `upstream-echo-fail-${this.localRobotId}`,
            `[upstream] ${this.localRobotId}: echo publish to ${echoTopic} failed: ${err.message}`
          );
        }
      });
    } catch (e) {
      this._logger.warn(
        `upstream-echo-${this.localRobotId}`,
        `[upstream] ${this.localRobotId}: failed to relay robot echo: ${e && e.message}`
      );
    }
  };

  /**
   * Best-effort: record an event-log entry for a command that arrived from
   * upstream and was delivered to the local robot, mirroring what the Meteor
   * app (app/imports/server/actions.js) logs via EventLog.logExecutedAction
   * when a command is executed locally.
   *
   * The payload is decoded with the protobuf type appropriate to the topic.
   * Unknown topics, decode failures, or a missing event-log collection are all
   * handled gracefully (the command delivery itself must never be blocked by
   * logging).
   */
  _logUpstreamCommand = async (topic, payload) => {
    try {
      const prefix = `r/${this.upstreamRobotId}/`;
      const subtopic = topic.startsWith(prefix) ? topic.slice(prefix.length) : topic;

      let type;
      let label;
      let args;
      switch (subtopic) {
        case 'custom_command/ros': {
          // Publish-to-topic: CustomCommandRosMessage { ts, cmd }.
          const msg = this._decodeCommand('oro.CustomCommandRosMessage', payload);
          type = ACTION_TYPES.PUBLISH_TO_TOPIC;
          label = 'Publish to topic';
          args = { message: msg?.cmd };
          break;
        }
        case 'custom_command/script/command': {
          // Run-script: CustomScriptCommandMessage { ts, file_name, arg_options, ... }.
          const msg = this._decodeCommand('oro.CustomScriptCommandMessage', payload);
          type = ACTION_TYPES.RUN_SCRIPT;
          label = 'Run script';
          args = {
            fileName: msg?.fileName,
            args: msg?.argOptions,
            executionId: msg?.executionId,
          };
          break;
        }
        case 'in_cmd': {
          // Plain-string command; only 'restart' is delivered downstream.
          if (payload.toString() === 'restart') {
            type = ACTION_TYPES.RESTART_AGENT;
            label = 'Restart agent';
            args = {};
          }
          break;
        }
        default:
          // Not a known command topic; nothing to log.
          break;
      }

      if (!type) return;
      await this._writeExecutedActionEvent({ subtopic, type, label, args });
    } catch (e) {
      this._logger.warn(
        `upstream-log-cmd-${this.localRobotId}`,
        `[upstream] ${this.localRobotId}: failed to log upstream command on '${topic}': ${e && e.message}`
      );
    }
  };

  // Decode a protobuf command payload. Best-effort: returns null (and warns) if
  // the protobuf lookup is unavailable or decoding fails, so the action is
  // still logged even when its arguments can't be recovered.
  _decodeCommand = (typeName, payload) => {
    if (!this._oroMqtt || typeof this._oroMqtt.lookupType !== 'function') {
      return null;
    }
    try {
      return this._oroMqtt.lookupType(typeName).decode(payload);
    } catch (e) {
      this._logger.warn(
        `upstream-decode-${this.localRobotId}-${typeName}`,
        `[upstream] ${this.localRobotId}: failed to decode ${typeName}: ${e && e.message}`
      );
      return null;
    }
  };

  // Insert an ACTION_EXECUTED event into the shared event_log collection. The
  // document shape mirrors app/imports/server/eventLog/meteorDbEventStore:
  // common fields at top-level, module-specific fields nested under `eventData`.
  _writeExecutedActionEvent = async ({ subtopic, type, label, args }) => {
    if (!this._eventLogColl) return;
    const actionId = `upstream:${type}`;
    const action = {
      actionId,
      type,
      label,
      context: { robotId: this.localRobotId },
      // Provenance: this command arrived over the upstream link.
      source: 'upstream',
      upstreamRobotId: this.upstreamRobotId,
      commandTopic: subtopic,
      elementValues: args || {},
    };
    await this._eventLogColl.insertOne({
      module: EVENT_MODULE_ACTION,
      eventType: EVENT_TYPE_ACTION_EXECUTED,
      userId: UPSTREAM_USER_ID,
      userName: 'Upstream',
      robotId: this.localRobotId,
      ts: Date.now(),
      eventData: {
        actionId,
        type,
        label,
        action,
      },
    });
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
