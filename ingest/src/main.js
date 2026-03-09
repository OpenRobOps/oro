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
// import metricsProxy from './shared/server/metrics';
// import { registerMetricsViews } from './metricsDefinitions';
// import WorkerQueue from './server/messageQueue';
import { anonymizeUri } from './lib/util';
// import ObjectsManager from './server/objectsManager';
// import EventLog from './shared/server/eventLogger';

import {
  BasicsModule,
  SystemModule,
//   RobotLocalizationModule,
//   DataBagsModule,
//   AlertsModule,
//   DiagnosticsModule,
//   StatesModule,
//   RosoutModule,
  CustomDataModule,
//   RosMonitorModule,
//   CustomCommandsModule,
//   RobotEventsModule,
//   ImagesModule,
//   GpsModule,
} from './server/modules';

// Read settings from configuration file
// TODO Allow passing configuration file path from an environment variable
const settings = JSON.parse(fs.readFileSync(path.join(__dirname, '/../config/settings.json')));

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
async function run() {
  console.log('---------------------------------------------------------');
  console.log('Ingest service starting at ' + moment().format());
  console.log('Current version is ' + process.env.npm_package_version);

  console.log('MQTT is ON at ' + settings.mqtt.hostname);
  console.log('MongoDB is ON: ' + anonymizeUri(settings.mongo.url));
  console.log('Peer API is ON: ' + settings.peerClient.url);
  console.log('Profiler is ' + (settings.profiler?.enabled ? 'ON' : 'OFF'));
  console.log('Objects Manager ' + (settings.objectsManager?.enabled ? 'ON' : 'OFF'));

  // Only start processing after all database
  // connections are active
  // Create metrics before mqtt and other modules that could use it
  // queue = new WorkerQueue();
  // await new WorkerQueue().init(settings.queue);
  // metricsProxy.init(settings.metrics);
  mongo = new MongoManager();
  await mongo.init(settings.mongo);
  // redis = new RedisManager();
  // await redis.init(settings.redis);
  // storage = new StorageManager();
  // await storage.init(settings.storage);
  peerClient = new PeerClient();
  await peerClient.init(settings.peerClient);
  mqtt = new OroMqtt();
  // await new EventTracker().init(settings.pendo);
  // objectsManager = new ObjectsManager();
  // await objectsManager.init(settings.objectsManager);

  // // TODO(bz): When modes are migrated fully to dynamic collections, EventLog won't be needed here
  // // anymore
  // new EventLog().init(settings.eventLog);

  // TODO Separate init from run and make sure the service
  // is considered ready (including readiness probe) when connection
  // to MQTT has succeeded.
  mqtt.run(settings.mqtt);

  // // Initialize profiler
  // profiler = new Profiler({
  //   mqtt,
  //   settings: settings.profiler
  // }).load();

  // Per module settings
  // const moduleSettings = settings.modules || {};

  // Initialize modules
  new BasicsModule(mqtt).load();
  new SystemModule(mqtt).load();
  new CustomDataModule({ mqtt, mongo }).load();
  // new DiagnosticsModule(mqtt).load(moduleSettings.diagnostics);

  // await new RobotLocalizationModule({
  //   mqtt,
  //   objectsManager,
  //   workerQueue: queue
  // }).load(moduleSettings.robotLocalization);
  // new DataBagsModule(mqtt, timeseriesApi).load(moduleSettings.databags);
  // new AlertsModule(mqtt).load();
  // new StatesModule(mqtt).load(moduleSettings.states);
  // new RosoutModule(mqtt).load();
  // new RosMonitorModule(mqtt).load();
  // new CustomCommandsModule(mqtt).load();
  // new RobotEventsModule(mqtt).load();
  // new GpsModule(mqtt).load();

  // if (moduleSettings.images && moduleSettings.images.enabled) {
  //   // This module is not enabled by default, it must be explicitly enabled via settings
  //   console.log('ImagesModule is enabled');
  //   new ImagesModule(mqtt, objectsManager, timeseriesApi).load(moduleSettings.images);
  // } else {
  //   console.warn('ImagesModule is disabled');
  // }

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
