import bodyParser from 'body-parser';
import { Meteor } from 'meteor/meteor';
import { isString, pick } from 'lodash';
// ORO modules
import { MqttLogins } from './collections';
import { VALID_ID_REGEXP } from '../shared/constants';
import { decryptPassword } from './mqttCredentialUtils';
import { provisionRobotCredentials } from './mqttCredentialProvisioner';

function sendAndLog403(res, msg) {
  console.warn(`403: ${msg}`);
  res.writeHead(403);
  res.end(JSON.stringify({ error: msg }));
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
 *
 * TODO(herchu): This is a stub and does not handle creating credentials yet.
 */
// eslint-disable-next-line max-len, no-unused-vars
const mqttConfigEndpoint = (fromRobot = true, defaultApiKey = undefined) => async (req, res) => {
  // Validate request method and parameters
  if (req.method != 'POST') {
    // Unrecognized request method
    // For agent version 1.0.10 onwards, we use POST requests
    res.writeHead(404);
    res.end();
    return;
  }

  const { apiKey = defaultApiKey, robotId, credentialsId,
    hostname, agentVersion = '0.0.0' } = req.body;

  // Require a valid robotId (non-empty and without invalid characters)
  // This is the first validation for new robotIds - don't let invalid data enter our system
  if (!robotId || !isString(robotId) || !robotId.match(VALID_ID_REGEXP)) {
    res.writeHead(400);
    res.end();
    return;
  }

  if (!apiKey) { // Validate first. Even in local environments this must fail
    res.writeHead(400);
    res.end();
    return;
  }

  console.log(`Getting MQTT parameters for robotId=[${robotId}]`);

  // Get or lazily provision credentials for this robot
  const defaultBrokerId = Meteor.settings.mqtt.defaultBrokerId || 'local';
  let login = await MqttLogins.findOneAsync({ robotId });
  if (!login) {
    login = await provisionRobotCredentials(robotId, defaultBrokerId);
  }
  if (login.suspended) {
    sendAndLog403(res, `Robot credentials suspended for robotId=[${robotId}]`);
    return;
  }

  const brokerDetails = Meteor.settings.mqtt.brokers[login?.brokerId];
  if (!login || !brokerDetails) {
    sendAndLog403(res, 'Robot credentials not found');
    return;
  }

  let password;
  try {
    password = decryptPassword(login.encryptedPassword, encryptionKey);
  } catch (e) {
    console.error("Error decrypting password", e);
    sendAndLog403(res, `Error decrypting password for robotId=[${robotId}]`);
    return;
  }

  const encryptionKey = Meteor.settings.mqtt.credentialEncryptionKey;
  const robotMqttConfig = {
    ...pick(
      brokerDetails,
      ['hostname', 'port', 'protocol', 'websocket_port', 'websocket_protocol']
    ),
    suspended: login.suspended,
    username: login.username,
    password: decryptPassword(login.encryptedPassword, encryptionKey),
  };

  // If the robot is suspended, return 403
  if (robotMqttConfig && robotMqttConfig.suspended) {
    sendAndLog403(res, 'Attempt to access /mqtt_config: Robot credentials suspended');
    return;
  }

  // Send the configuration
  res.writeHead(200);
  res.end(JSON.stringify(robotMqttConfig));
};

WebApp.connectHandlers.use('/mqtt_config', httpHandleExceptions(mqttConfigEndpoint(true)));
