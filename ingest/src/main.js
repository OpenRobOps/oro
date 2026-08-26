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
 * Ingest service entry point
 *
 * This file is the entry point for the Ingest service.
 * It will take care of configuring and orchestrating all
 * the different managers and modules.
 */
import fs from 'fs';
import path from 'path';
import moment from 'moment';
// ORO imports
import MongoManager from './mongo';
// import StorageManager from './storage';
import OroMqtt from './server/mqtt';
// import { RedisManager } from './shared/redis';
import PeerClient from './server/peer';
// import EventTracker from './shared/tracking';
// import WorkerQueue from './server/messageQueue';
import { anonymizeUri } from './lib/util';
import { VERSION } from './lib/version';
// import ObjectsManager from './server/objectsManager';
import AttributesManager from './server/attributes';
import InMemoryWorkerQueues from './server/queues/memoryWorkerQueue';
import DerivedAttributesService from './services/derivedAttributes/svcDerivedAttributes';

import {
  BasicsModule,
  SystemModule,
  RobotLocalizationModule,
//   DataBagsModule,
//   AlertsModule,
  DiagnosticsModule,
//   StatesModule,
//   RosoutModule,
  CustomDataModule,
//   RosMonitorModule,
  CustomCommandsModule,
  RobotEventsModule,
//   ImagesModule,
//   GpsModule,
  UpstreamModule,
} from './server/modules';
import IsoRobotsModule from './server/isoRobots';
import { isoModeEnabled } from './server/isoRobots/config';

// Read settings from configuration file
// TODO Allow passing configuration file path from an environment variable
const settings = JSON.parse(fs.readFileSync(path.join(__dirname, '/../settings.json')));

const signals = {
  SIGHUP: 1,
  SIGINT: 2,
  SIGTERM: 15
};

// Keep pointers to managers and modules in order to allow
// shutdown and other state management operations.
let mongo;
let redis;
let storage;
let mqtt;
let peerClient;
let metrics;
let queue;
let objectsManager;
let attributesManager;
let upstreamModule;
let isoRobots;

async function run() {
  console.log('---------------------------------------------------------');
  console.log(`Ingest v${VERSION} starting`);
  console.log('Ingest service starting at ' + moment().format());

  console.log('MQTT is ON at ' + settings.mqtt.hostname);
  console.log('MongoDB is ON: ' + anonymizeUri(settings.mongo.url));
  console.log('Peer API is ON: ' + settings.peerClient.url);
  console.log('Profiler is ' + (settings.profiler?.enabled ? 'ON' : 'OFF'));
  console.log('Objects Manager ' + (settings.objectsManager?.enabled ? 'ON' : 'OFF'));
  console.log('Upstream is ' 
    + (settings.upstream?.enabled ? 'ON: ' + settings.upstream.api?.baseUrl : 'OFF'));
  // Per module settings
  const moduleSettings = settings.modules || {};

  mongo = new MongoManager();
  await mongo.init(settings.mongo);

  mqtt = new OroMqtt(); // Created but not yet started (connected)
  // UpstreamModule is disabled by default. When enabled it forwards local
  // robot telemetry to an upstream MQTT broker (another ORO / InOrbit).
  // This module is started earlier and we attempt to wait for connection so that any incoming mqtt message
  // (including retained messages; robot states) are forwarded immediately upon connecting our local mqtt broker.
  if (isoModeEnabled(settings) && settings.upstream?.enabled) {
    console.warn('UpstreamModule (InOrbit forwarder) is enabled but ingest is in ISO 21423 mode; '
      + 'it will forward nothing. Disable settings.upstream, or disable iso21423.robots.');
  }
  if (settings.upstream?.enabled) {
    upstreamModule = new UpstreamModule({ mqtt, mqttConfig: settings.mqtt });
    await upstreamModule.load(settings.upstream);
  }

  // Create queues
  queue = new InMemoryWorkerQueues();
  await queue.init({
    // logging: true 
  });
  await new AttributesManager().init({ workerQueue: queue });
  // Only start processing after all database
  // connections are active
  // await new WorkerQueue().init(settings.queue);
  // redis = new RedisManager();
  // await redis.init(settings.redis);
  // storage = new StorageManager();
  // await storage.init(settings.storage);
  peerClient = new PeerClient();
  await peerClient.init(settings.peerClient);
  // await new EventTracker().init(settings.pendo);
  // objectsManager = new ObjectsManager();
  // await objectsManager.init(settings.objectsManager);

  // TODO Separate init from run and make sure the service
  // is considered ready (including readiness probe) when connection
  // to MQTT has succeeded.
  const isoMode = isoModeEnabled(settings);

  // ISO mode (decision 1): this deployment's robots speak ISO 21423, not the InOrbit wire
  // protocol, so none of the protobuf telemetry modules would ever receive a message. Everything
  // protocol-agnostic stays: Mongo, the worker queues, AttributesManager, DerivedAttributesService
  // and PeerClient are all loaded above and below this block, untouched.
  //
  // `odometryEnabled: false` drops OroMqtt's unconditional `r/+/ros/odometry/+` subscription
  // (src/server/mqtt.js:302, :402-404) — an ISO deployment has no such publisher.
  //
  // NOTE: `noDefaultListeners` (src/server/mqtt.js:291-297) is deliberately NOT passed. It would
  // also drop the built-in `echo` listener, and IsoRobotsModule *synthesizes* echoes so the app's
  // publishAsync round trip completes (decision 9). The `logfiles_update` listener is harmless
  // dead weight in ISO mode; dropping it would need a third flag in mqtt.js and is not worth it.
  mqtt.run({ ...settings.mqtt, ...(isoMode ? { odometryEnabled: false } : {}) });

  // // Initialize profiler
  // profiler = new Profiler({
  //   mqtt,
  //   settings: settings.profiler
  // }).load();

  if (isoMode) {
    console.log('Ingest is in ISO 21423 mode: InOrbit wire-protocol modules are NOT loaded');
    isoRobots = new IsoRobotsModule({ mongo, mqtt, workerQueue: queue });
    await isoRobots.load(settings.iso21423, { oroMqttSettings: settings.mqtt });
  } else {
    new BasicsModule(mqtt).load();
    new SystemModule(mqtt).load();
    new CustomDataModule({ mqtt, mongo }).load();
    new RobotEventsModule({ mqtt, mongo }).load();
    new DiagnosticsModule(mqtt).load(moduleSettings.diagnostics);
    new CustomCommandsModule(mqtt).load();

    await new RobotLocalizationModule({
      mqtt,
      objectsManager,
      workerQueue: queue
    }).load(moduleSettings.robotLocalization);
  }
  // new DataBagsModule(mqtt, timeseriesApi).load(moduleSettings.databags);
  // new AlertsModule(mqtt).load();
  // new StatesModule(mqtt).load(moduleSettings.states);
  // new RosoutModule(mqtt).load();
  // new RosMonitorModule(mqtt).load();
  // new CustomCommandsModule(mqtt).load();
  // new GpsModule(mqtt).load();

  // if (moduleSettings.images && moduleSettings.images.enabled) {
  //   // This module is not enabled by default, it must be explicitly enabled via settings
  //   console.log('ImagesModule is enabled');
  //   new ImagesModule(mqtt, objectsManager, timeseriesApi).load(moduleSettings.images);
  // } else {
  //   console.warn('ImagesModule is disabled');
  // }

  const derivedAttributesService = new DerivedAttributesService({});
  await derivedAttributesService.init({ workerQueue: queue });

  // registerMetricsViews('ingest');
  console.log('Ingest service ready for business');
  console.log('---------------------------------------------------------');

  // Write out readiness probe file. This is used by the k8s deployment
  // to confirm the service is up and open for business.
  // fs.writeFileSync('/tmp/ready', 'ready');
}

async function shutdown() {
  console.log('---------------------------------------------------------');
  console.log('Ingest service shutdown initiated at ' + moment().format());
  // Shutdown all modules cleanly
  upstreamModule && await upstreamModule.shutdown();
  isoRobots && await isoRobots.shutdown();
  mqtt && await mqtt.shutdown();
  storage && await storage.shutdown();
  mongo && await mongo.shutdown();
  redis && await redis.shutdown();
  queue && await queue.shutdown();
  console.log('Ingest service shutdown complete at ' + moment().format());
  console.log('---------------------------------------------------------');
}

let shuttingDown = false;
// Trap all shutdown signals to allow for graceful shutdown
Object.keys(signals).forEach((signal) => {
  process.on(signal, async () => {
    // HACK(adamantivm) Avoid triggering shutdown more than once.
    // This happens due to multiple quirks of the way process signals
    // are handed over between Docker, NPM, babel and node.
    if (shuttingDown) {
      console.warn('Ignoring duplicate shutdown request');
      return;
    }
    shuttingDown = true;

    console.log(`process received a ${signal} signal`);
    await shutdown();
    console.log('Killing now');
    process.exit(128 + signals[signal]);
  });
});

run();
