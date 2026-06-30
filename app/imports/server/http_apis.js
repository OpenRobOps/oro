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

import bodyParser from 'body-parser';
import { Meteor } from 'meteor/meteor';
import { isString, isArray, pick } from 'lodash';
// ORO modules
import { MqttLogins } from './collections';
import { VALID_ID_REGEXP } from '../shared/constants';
import { decryptPassword } from './mqttCredentialUtils';
import { provisionRobotCredentials } from './mqttCredentialProvisioner';
import AgentManager from './agentManager';
import AlertsManager from './alertsManager';
import Robot from './model/robot';

function sendAndLogError(res, msg, endpoint, httpStatus) {
  console.warn(`HTTP ${endpoint || 'api'} error [${httpStatus}]: ${msg}`);
  res.writeHead(httpStatus);
  res.end(JSON.stringify({ error: msg }));
}

function sendAndLog403(res, msg, endpoint='api') {
  sendAndLogError(res, msg, endpoint, 403);
}

// Middlewares to parse the request body from content-type application/json or x-www-form-urlencoded
// Replaces old Meteor's pbastowski:body-parser
WebApp.connectHandlers.use(bodyParser.json());
WebApp.connectHandlers.use(bodyParser.urlencoded());

const httpHandleExceptions = handler => Meteor.bindEnvironment(async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (e) {
    console.warn(e);
    res.writeHead(500);
    res.end();
  }
});

/**
 * Provide MQTT configuration to agents.
 */
const mqttConfigEndpoint = (fromRobot = true, defaultApiKey = undefined) => async (req, res) => {
  // Validate request method and parameters
  if (req.method != 'POST') {
    // Unrecognized request method
    return sendAndLogError(res, 'Unrecognized request method', 'mqtt_config', 404);
  }

  const { apiKey = defaultApiKey, robotId, credentialsId,
    hostname, agentVersion = '0.0.0' } = req.body;

  // Require a valid robotId (non-empty and without invalid characters)
  // This is the first validation for new robotIds - don't let invalid data enter our system
  if (!robotId || !isString(robotId) || !robotId.match(VALID_ID_REGEXP)) {
    return sendAndLogError(res, 'Invalid robotId', 'mqtt_config', 400);
  }

  // Validate API key. Even in local environments this must fail
  const apiKeys = Meteor.settings.robotApiKeys;
  if (!apiKey) {
    return sendAndLogError(res, 'Invalid apiKey', 'mqtt_config', 400);
  } else if (!isArray(apiKeys)) {
    return sendAndLogError(res, 'Adding robots is not allowed in this server', 403);
  } else if (!apiKeys.includes(apiKey)) {
    return sendAndLogError(res, 'Invalid apiKey', 'mqtt_config', 403);
  }

  console.log(`Getting MQTT parameters for robotId=[${robotId}]`);
  // Check if this robot exists. Add it if it does not. 
  // TODO: In the future this could be configurable; ie. robots not to be added automatically
  const robotExists = await new Robot(robotId).existsAsync();
  if (!robotExists) {
    console.log(`Robot not found for robotId=[${robotId}]. Adding it.`);
    await Robot.createAsync({ 
      robotId, 
      name: hostname, // mqttconfig API does not define a robot name; so we default to hostname
      agentVersion,
      hostname
    });
  }

  // Get or lazily provision credentials for this robot
  const defaultBrokerId = Meteor.settings.mqtt.defaultBrokerId || 'local';
  let login = await MqttLogins.findOneAsync({ robotId });
  if (!login) {
    console.log(`Provisioning new credentials for robotId=[${robotId}]`);
    login = await provisionRobotCredentials(robotId, defaultBrokerId);
  }
  if (login.suspended) {
    sendAndLog403(res, `Robot credentials suspended for robotId=[${robotId}]`, 'mqtt_config');
    return;
  }

  const brokerDetails = Meteor.settings.mqtt.brokers[login?.brokerId];
  if (!login || !brokerDetails) {
    sendAndLog403(res, 'Robot credentials not found', 'mqtt_config');
    return;
  }

  let password;
  try {
    const encryptionKey = Meteor.settings.mqtt.credentialEncryptionKey;
    password = decryptPassword(login.encryptedPassword, encryptionKey);
  } catch (e) {
    console.error("Error decrypting password", e);
    sendAndLog403(res, `Error decrypting password for robotId=[${robotId}]`, 'mqtt_config');
    return;
  }

  const robotMqttConfig = {
    ...pick(
      brokerDetails,
      ['hostname', 'port', 'protocol', 'websocket_port', 'websocket_protocol']
    ),
    username: login.username,
    password
  };

  // Send the configuration
  res.writeHead(200);
  res.end(JSON.stringify(robotMqttConfig));
};

WebApp.connectHandlers.use('/mqtt_config', httpHandleExceptions(mqttConfigEndpoint(true)));


/**
 * Peer API (Inter-component API) / robot-initiated commands
 *
 * Used by the ingest component to report an incoming command
 * request from a robot.
 *
 * Parameters:
 *
 * Authentication:
 *
 * - peerKey:   String, shared secret peer key, must correspond to the peer key
 *              configured for this server instance
 *
 * Identification:
 *
 * - robotId:   ID of the robot requesting the provided command
 *
 * Payload:
 *
 * - command:   Command string
 *
 */
WebApp.connectHandlers.use('/peer/robot/command', Meteor.bindEnvironment(async (req, res) => {
  if (req.method != 'POST') {
    console.warn('/peer/robot/command, Unrecognized request method: ' + req.method);
    res.writeHead(400);
    res.end();
    return;
  }

  // Fetch parameters from the message body
  const {
    peerKey,
    robotId,
    command
  } = req.body;

  // TODOSanity checks (e.g: required params)
  // TODO Confirm it's a valid robotId

  // Check peerKey against settings
  // TODO More realistic security here
  if (peerKey != Meteor.settings.peerKey) {
    console.warn('Invalid peer key provided');
    res.writeHead(400);
    res.end();
    return;
  }

  try {
    // TODO Move to a command process module or manager
    switch (command) {
      case 'resend_modules':
        console.info(`mqtt: robotId=${robotId} requested all modules reload.`, { labels: { robotId } });
        // TODO Consider unifying loaded state, runlevel and state configuration.
        await new AgentManager().resendModules(robotId);
        break;
      case 'update_modules':
        console.info(`mqtt: updating module states for robotId=${robotId}.`);
        await new AgentManager().updateModuleStates(robotId);
        break;
      default:
        console.warn(`Unknown command received from robotId=${robotId} : ${command}`, { labels: { robotId } });
    }

    res.writeHead(200);
    res.end();
  } catch (e) {
    console.warn(e);
    res.writeHead(400);
    res.end();
  }
}));

// Receives alert create/resolve requests from ingest (peer) and turns them into incidents.
WebApp.connectHandlers.use('/peer/alerts', Meteor.bindEnvironment(async (req, res) => {
  if (req.method != 'POST') {
    console.warn('/peer/alerts, Unrecognized request method: ' + req.method);
    res.writeHead(400);
    res.end();
    return;
  }
  const {
    peerKey, resolve, robotId, triggerId, name, level, message,
    attributeValue, formattedValue, source, alias, ts = Date.now()
  } = req.body || {};

  if (!(peerKey && robotId && ((name && message) || resolve))) {
    console.warn('/peer/alerts, Missing parameter');
    res.writeHead(400);
    res.end();
    return;
  }
  if (peerKey != Meteor.settings.peerKey) {
    console.warn('/peer/alerts, Invalid peer key provided');
    res.writeHead(400);
    res.end();
    return;
  }

  try {
    if (resolve) {
      await new AlertsManager().resolveAlert({ robotId, triggerId, alias, ts });
    } else {
      const event = { name, level, message, attributeValue, formattedValue };
      await new AlertsManager().createAlert({ robotId, triggerId, event, source, alias, ts });
    }
    res.writeHead(200);
    res.end();
  } catch (e) {
    console.warn(e);
    res.writeHead(400);
    res.end();
  }
}));