import bodyParser from 'body-parser';
import { isString, pick } from 'lodash';
// ORO modules
import { MqttLogins } from './collections';
import { VALID_ID_REGEXP } from '../shared/constants';

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

  // Get the configuration for this robot and handle suspended credentials
  // let robotMqttConfig = await mqttAssignmentManager.getConfig({ robotId });
  // BEGIN FIXME use mqttAssignmentManager to get the configuration, not a simple lookup.
  // This is a partial implementation copied from MqttAssignmentManager.getRobotCurrentMqttConfig
  const login = await MqttLogins.findOneAsync({ robotId });
  const brokerDetails = Meteor.settings.mqtt.brokers[login?.brokerId];
  if (!login || !brokerDetails) {
    sendAndLog403(res, 'Robot credentials not found');
    return;
  }
  const robotMqttConfig = {
    // broker
    ...pick(
      brokerDetails,
      ['hostname', 'port', 'protocol', 'websocket_port', 'websocket_protocol']
    ),
    // login
    suspended: login.suspended,
    username: "username", //login.username, FIXME!
    password: "password", //login.password, FIXME!
  };
  console.warn(`TEMP: Returning HARDCODED MQTT credentials for robotId=[${robotId}]`);
  // END FIXME

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
