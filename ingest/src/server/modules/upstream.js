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
 * commands (see DOWNSTREAM_COMMANDS), republished onto the local broker so the
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
import { encryptPassword, decryptPassword } from '../../shared/mqttCredentialCrypto';

const COLLECTION_NAME = 'upstream_mqtt_credentials';
const DEFAULT_DENY_SUBTOPICS = ['in_cmd', 'modules/set_state'];
// Server->robot commands delivered downstream (upstream -> local robot), each
// republished onto the local broker under the local robot's topic.
//
// This is deliberately an allow-list, not a whole subtree:
//  - `custom_command/` also carries robot->server feedback (e.g.
//    `custom_command/script/status`) which must keep flowing upstream and must
//    not be echoed back to the robot, so only the actual command subtopics are
//    listed.
//  - `in_cmd` is a single topic carrying many server->robot commands plus
//    echo/ping messages (sent as '<seq>|' by the callback mechanism). For now
//    only the agent-restart command is delivered; `acceptsPayload` filters out
//    echoes and every other in_cmd command.
//
// The robot never publishes these command topics, so anything seen on them by
// the upstream forwarder is our own downstream injection echoing off the local
// broker; the forwarder skips them to avoid a loop (and `in_cmd` is in the deny
// list as well).
const DOWNSTREAM_COMMANDS = [
  { subtopic: 'custom_command/ros' },
  { subtopic: 'custom_command/script/command' },
  { subtopic: 'in_cmd', acceptsPayload: (payload) => payload.toString() === 'restart' },
];
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
    this._publishRetained = forwarding.publishRetainedMessages !== false;
    this._credentialEncryptionKey = credentialEncryptionKey;
    this._logging = logging;
    this._localBrokerConfig = localBrokerConfig;
    this._credsColl = this._mongo.getCollection(COLLECTION_NAME);
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
        publishRetained: this._publishRetained,
        localBrokerConfig: this._localBrokerConfig,
        logging: this._logging,
        throttledLogger: this._logger,
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
    publishRetained,
    localBrokerConfig,
    logging,
    throttledLogger,
  }) {
    this.localRobotId = localRobotId;
    this.upstreamRobotId = upstreamRobotId;
    this.lastError = null;

    this._api = api;
    this._brokerOptions = brokerOptions;
    this._credentialEncryptionKey = credentialEncryptionKey;
    this._credsColl = credsColl;
    this._denySubtopics = denySubtopics;
    this._publishRetained = publishRetained;
    this._localBrokerConfig = localBrokerConfig;
    this._logging = logging;
    this._logger = throttledLogger;

    this._upstreamClient = null;
    this._localClient = null;
    this._connected = false;
    // Latest retained message per upstream topic. The local broker delivers a
    // retained message only once (on subscribe), which can happen before the
    // upstream connection is ready, so we remember retained values here and
    // replay them whenever the upstream client (re)connects. See _forward and
    // _flushRetainedMessages.
    this._retainedMessages = new Map();
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

    if (!this._upstreamClient || !this._connected) {
      // Remember retained values so they survive an upstream that isn't connected
      // yet (or has reconnected); they are replayed in _flushRetainedMessages.
      if (packet.retain) {
        if (payload && payload.length > 0) {
          console.log("retained message", upstreamTopic, payload)
          this._retainedMessages.set(upstreamTopic, { payload, qos });
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
      this._publishToUpstream(upstreamTopic, payload, qos, !!packet.retain);
    }
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
    if (upstreamTopic.endsWith("/state")) { // debug this topic only for online/offline states
      console.log("publishToUpstream", new Date() , retain, upstreamTopic, upstreamTopic.endsWith("/state") ? String(payload) : "")
    }
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

  // eslint-disable-next-line class-methods-use-this
  _downstreamCommandFor = (subtopic) => DOWNSTREAM_COMMANDS.find((c) => c.subtopic === subtopic);

  _isDownstreamCommandSubtopic = (subtopic) => !!this._downstreamCommandFor(subtopic);

  /**
   * Subscribe the upstream client to the server->robot command topics we
   * deliver downstream. Invoked on every upstream 'connect' (subscriptions do
   * not survive a reconnect with a fresh clientId/session).
   */
  _subscribeUpstreamCommands = () => {
    const subtopics = [...new Set(DOWNSTREAM_COMMANDS.map((c) => c.subtopic))];
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
   * Only the allow-listed commands are delivered (see DOWNSTREAM_COMMANDS),
   * subject to each command's optional payload filter; everything else
   * (including in_cmd echoes) is ignored.
   */
  _handleUpstreamMessage = (topic, payload, packet) => {
    if (this._logging) console.log("[upstream] handleUpstreamMessage", topic, String(payload))
    const prefix = `r/${this.upstreamRobotId}/`;
    if (!topic.startsWith(prefix)) return;
    const subtopic = topic.substring(prefix.length);
    const command = this._downstreamCommandFor(subtopic);
    if (!command) return;
    if (command.acceptsPayload && !command.acceptsPayload(payload)) return;
    if (!this._localClient) {
      this._logger.warn(
        `upstream-cmd-no-local-${this.localRobotId}`,
        `[upstream] ${this.localRobotId}: local client unavailable; dropping command '${subtopic}'`
      );
      return;
    }
    const localTopic = `r/${this.localRobotId}/${subtopic}`;
    if (this._logging) {
      console.log(`[upstream] ${this.localRobotId}: delivering upstream command '${subtopic}' to robot`);
    }
    this._logUpstreamCommand(topic, payload);
    // Commands are transient: never retained on the local broker.
    this._localClient.publish(localTopic, payload, { qos: packet.qos || 0, retain: false }, (err) => {
      if (err) {
        this._logger.warn(
          `upstream-cmd-publish-fail-${this.localRobotId}`,
          `[upstream] ${this.localRobotId}: publish command to ${localTopic} failed: ${err.message}`
        );
      }
    });
  };


  _logUpstreamCommand = (topic, payload) => {
    // Log event. Use the Id of the robot that called the action
    // await new EventLog().logExecutedAction(new Robot(robotId), action, user, eventLogArguments);
    console.log("logUpstreamCommand", topic, String(payload))

    // this._logEvent(`command-executed-remote`, this.localRobotId, { commandTopic: topic, commandPayload: payload.toString() });
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
