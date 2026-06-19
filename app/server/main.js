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
 * Main ORO app entry point
 *
 */

import { Meteor } from 'meteor/meteor';
import { v4 as uuidv4 } from 'uuid';
// This must happen before any collection.attachSchema() in our managers
// See https://github.com/Meteor-Community-Packages/meteor-collection2/tree/master?tab=readme-ov-file#import-using-static-imports
import 'meteor/aldeed:collection2/static';
// ORO modules
import AgentManager from '../imports/server/agentManager';
import DashboardsManager from '../imports/server/dashboards';
import SearchManager from '../imports/server/searchManager';
import StatusManager from '../imports/server/status';
import { registerAccountsHooks } from '../imports/server/accountsHooks';
import { configureOAuth } from '../imports/server/oauthConfig';
import UsersManager from '../imports/server/usersManager';
import ApiKeysManager from '../imports/server/apiKeysManager';
// Registers database migrations (Migrations.add) before migrateTo() runs below.
import '../imports/server/migrations';
import '../imports/server/publications';
import ConfigAPI from '../imports/server/configAPI/configAPI';
import OroRoles from '../imports/server/roles';
import AttributesManager from '../imports/server/attributes';
import { CoreHttpApis } from '../imports/server/http_apis';
import { seedMasterCredentials } from '../imports/server/mqttCredentialProvisioner';
import { addApiRoute } from '../imports/server/rest_api';
import OroMqtt from '../imports/server/mqtt';
import ActionsEngine from '../imports/server/actions';
import LockManager from '../imports/server/lock';
import AuditLogManager from '../imports/server/eventLog/auditLogManager';
import TimeSeriesManager from '../imports/server/timeseries';
import {
  // RobotLocalizationModule,
  ImagesModule,
  Navigation2DModule,
} from '../imports/server/modules';
import { bootstrapConfigData } from './bootstrapConfig';
import { assertValidSettings } from '../imports/server/settingsValidation';
import EventLog from '../imports/server/eventLog/eventLogger';
import DbEventStore from '../imports/server/eventLog/meteorDbEventStore';
import { VERSION } from '../imports/shared/version';

// Register accounts hooks at module level — before any login attempt
registerAccountsHooks();

// Module object to keep App Server instance-level variables.
// - serverId: Unique ID representing this App Server instance
const instanceValues = {};

// Pointers to instantiated app-server side modules
// TODO Expose this through a proper interface
const moduleInstances = {};

// code to run on server at startup
// Ignore the `new SomeManager()` with side effects to init modules:
/* eslint-disable no-new */
const oroAppMain = async () => {
  console.log(`App v${VERSION} starting`);

  // Validate critical settings before doing anything else. Throws (aborting
  // startup) if e.g. the credential encryption key is missing or malformed.
  assertValidSettings();

  // Set-up instance ID
  instanceValues.serverId = process.env.POD_ID || uuidv4();
  console.log('Application Server Starting: serverId: ' + instanceValues.serverId);

  // Database migrations:
  // Unlocks control for database to migrate
  Migrations.unlock();
  // Migrate database to desired version. Awaited so migrations complete before
  // the rest of startup (and so the try/catch below actually catches errors).
  try {
    await Migrations.migrateTo('latest');
  } catch (e) {
    // If there is an exception in migrateTo(), it can be because of the situation
    // explained above (future migration) or in our migration code itself.
    // Warn about the first one, but fail on the other.
    if (e.message.match(/Can\'t find migration/)) {
      console.warn('***************************************************************************************');
      console.warn('*** Running on a _future_ migration. This may be wrong! Please update this app ASAP ***');
      console.warn(`** Exception message: ${e.message} **`);
      console.warn('***************************************************************************************');
    } else {
      throw e;
    }
  }

  // Seed master MQTT credentials
  await seedMasterCredentials();
  // Configure OAuth providers from settings
  await configureOAuth();
  // Configure SMTP for passwordless email login
  if (Meteor.settings.smtp?.url) {
    process.env.MAIL_URL = Meteor.settings.smtp.url;
  }

  // Start event logger
  // TODO make this configurable
  const eventStore = new DbEventStore({});
  await new EventLog().init({ eventStore });
  await new AuditLogManager().init({ eventStore });
  await new TimeSeriesManager().init();

  // Start MQTT client
  const mqtt = new OroMqtt();
  mqtt.run(Meteor.settings.mqtt);

  await new AgentManager().init({ serverId: instanceValues.serverId });
  // Pre-create SOME modules - the ones required to initialize any manager
  moduleInstances.Navigation2DModule = new Navigation2DModule();
  moduleInstances.ImagesModule = new ImagesModule();
  // TODO add and initialize modules
  await new DashboardsManager().init();
  await new SearchManager().init();
  await new StatusManager().init();
  await new AttributesManager().init();
  await new OroRoles().createDefaultRoles();
  await new UsersManager().init();
  await new ApiKeysManager().init();
  await new LockManager().init();
  const configApi = await new ConfigAPI().init({});
  await new ActionsEngine().init({
    mqtt,
    nav2d: moduleInstances.Navigation2DModule,
    images: moduleInstances.ImagesModule,
  });

  // Bootstrap default configuration data
  await bootstrapConfigData(configApi);

  // Load and start modules
  // moduleInstances.RobotLocalizationModule.load();
  moduleInstances.Navigation2DModule.load();  

  // Customize the passwordless login-token email
  Accounts.emailTemplates.sendLoginToken = {
    subject: () => 'Your OpenRobOps login code',
    text: (user, url, { sequence }) =>
      `Hi!\n\nYour OpenRobOps login code is: ${sequence}\n\nIf you didn't request this, you can safely ignore this email.\n`,
  };
};

// GET /logout — serves a tiny page that clears Meteor auth tokens and redirects
// to "/". Works independently of the React app, useful when no Logout button is
// reachable in the UI.
WebApp.connectHandlers.use('/logout', (req, res, next) => {
  if (req.method !== 'GET') return next();
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(
    '<html><body>Logging out&hellip;' +
    '<script>' +
    "localStorage.removeItem('Meteor.loginToken');" +
    "localStorage.removeItem('Meteor.loginTokenExpires');" +
    "localStorage.removeItem('Meteor.userId');" +
    "window.location.replace('/');" +
    '</script></body></html>'
  );
});

// Allow CORS for configured origins in settings
const { allowedOrigins } = Meteor.settings;
const allowedHeaders = Meteor.settings.allowedHeaders || [];
if (Array.isArray(allowedOrigins)) {
  // eslint-disable-next-line prefer-arrow-callback
  WebApp.rawConnectHandlers.use(function (req, res, next) {
    // Only one origin is permitted in this header. The server must return the origin for the specific client making the request.
    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Origin
    const { origin } = req.headers;
    if (allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }

    // For a pre-flight request, we only need to determine
    // which are the allowed headers and respond, with no further processing.
    // Reference for allowing headers: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Headers
    // Reference for pre-flight requests: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS#Preflighted_requests
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Headers', allowedHeaders.join(', '));
      res.writeHead(200);
      res.end();
    }
    return next();
  });
}

// Run main entry point unless we're running a unit test
if (!Meteor.isTest) {
  Meteor.startup(async () => {
    await oroAppMain();
  });
} else {
  console.log('Running unit tests, skipping execution of Meteor.startup method');
}

export { moduleInstances };

