/* eslint-disable max-classes-per-file */
/**
 * Application Server-side MQTT manager
 */
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import mqtt from 'mqtt';
import { loadSync } from 'protobufjs';
import moment from 'moment';
// ORO Imports
import { AsyncCache } from './simpleCache';
import { cleanNulls } from '../lib/util';
import { MqttLogins } from './collections';
import { Robots, RobotVitals } from '../lib/collections';

// Databags update topics. Same as in ingest/databags.js
const MQTT_ROSBAG_UPLOAD_TOPIC = 'ros/rosbag/upload';
const MQTT_DATABAG_UPLOAD_TOPIC = 'ros/databag/upload';

// Create instrumented/serializable class from protobuf definition
// Note: The resources file lives in a private folder; loaded via Meteor Assets API
const protoRoot = loadSync(Assets.absoluteFilePath('oro.proto'));
const Echo = protoRoot.lookupType('oro.Echo');
const CustomScriptCommandMessage = protoRoot.lookupType('oro.CustomScriptCommandMessage');
const CustomCommandRosMessage = protoRoot.lookupType('oro.CustomCommandRosMessage');
const TeleopGoCommand = protoRoot.lookupType('oro.TeleopGoCommand');

/**
 * Handles communication with a specific Mqtt broker
 */
class MqttBroker {
  constructor({ config, id, onConnection, onMessage, logging = true }) {
    // TODO Validate config
    this.logging = logging;
    this.config = config;
    this.id = id;
    this.onConnection = onConnection;
    this.onMessage = onMessage;

    this.connected = false;

    this.start();
  }

  /**
   * Creates an MQTT.js client instance and initiates connection.
   * Isolated to a separate method to facilitate unit testing.
   */
  static connect = (connection, options) => {
    if (options.rejectUnauthorized !== undefined && !options.rejectUnauthorized) {
      console.warn('MQTT Connection using rejectUnauthorized=false. Certificate validation disabled.');
    }
    return mqtt.connect(connection, options);
  };

  start = () => {
    const {
      protocol, hostname, port, username, password, rejectUnauthorized
    } = this.config;

    // Create MQTT.js client instance
    this.client = MqttBroker.connect(
      protocol + hostname + ':' + port,
      { username, password, rejectUnauthorized }
    );
    this.logging && console.log('mqtt(' + this.id + '): connecting');

    // Handle key indication of connection status with MQTT broker.
    // Uses the SystemStatus collection with key 'mqtt'.
    this.client.on('error', (msg) => {
      this.logging && console.log('mqtt(' + this.id + '): error!', msg);
    });
    this.client.on('close', () => {
      this.connected = false;
      this.logging && console.log('mqtt(' + this.id + '): connection closed!');
    });
    this.client.on('offline', () => {
      this.connected = false;
      this.logging && console.log('mqtt(' + this.id + '): offline!');
    });
    this.client.on('reconnect', () => {
      this.logging && console.log('mqtt(' + this.id + '): reconnecting');
    });

    this.client.on('connect', (connack) => {
      this.processConnection(connack);
      this.onConnection(this);
    });
    this.client.on('message', this.onMessage);
  };

  processConnection = (connack) => {
    this.connected = true;
    this.logging && console.log('mqtt(' + this.id + '): connected!', connack && connack.cmd);

    // Update connection time. This is used in the basics module to know when it is OK to
    // set a robot's updateStamp.
    this.connectTime = Date.now();
  };

  /**
   * Health reporting API. See server/health.js
   */
  reportHealth = async () => {
    // This health check relies on our own 'connected' flag (which may be unreliable) but also
    // on the self-reported 'connected' flag from MQTT.js client itself - which we should rely on.
    const ok = this.connected && this.client?.connected;
    return {
      status: ok ? COMPONENT_STATUS.UP : COMPONENT_STATUS.DOWN,
      componentId: this.id
    };
  };
}

// Singleton pattern through constructor
let instance;

/**
 * This class takes care of several things:
 *  - Keeps the list of brokers objects
 *  - Ping robots and listen echo messages from some robots
 *  - Send messages to robots to execute actions
 *
 * There is work in progress to split these functionality to have more classes
 * with less responsibilities each. MQTT credentials functionality was moved to
 * the `MqttAssignmentManager` class, that still depends on OroMqtt.
 */
export default class OroMqtt {
  constructor(logging = true) {
    // Only construct an instance if it hasn't been done yet
    if (instance === undefined) {
      instance = this;
      this.init(logging);
    }
    // eslint-disable-next-line no-constructor-return
    return instance;
  }

  /**
   * Actual construction should happen here
   */
  init = (logging) => {
    this.logging = logging;
    // Hash set of callbacks
    // Each callback entry includes:
    //  - callback: callback function to execute on MQTT call return
    //  - robotId: ID of the robot this callback was originally set to
    //  - tsServerSend: Server timestamp in ms when the message was sent
    //      to the agent
    //  - timer: If present, the setTimeout timer to trigger response timeouts
    //  - isCanceled: If present and set to true, it means this call has
    //      either been canceled or its response timed out
    this.callbacks = {};
    // TODO Make starting _seq number unique to avoid collision between
    // echo responses to different service instanes (including ping services).
    this.callbacks._seq = 1;

    // Keep track of robots for which we specifically register to receive
    // echo commands.
    // - echoRobots is a hash where key is robotId and value is the number of
    //   subscriptions. When it goes to zero, the subscription can be ended
    //   and the key deleted from the hash.
    //   If a given robotId is in this.echoRobots that means that the app-server
    //   is subscribed to r/${robotId}/echo, even if this.echoRobots[robotId] = 0.
    //   After clean-up, subscription is ended and this.echoRobots[robotId] deleted.
    // - echoTimers contains a pointer to unsubscribe clean-up timers, in case
    //   a new subscription is requested, then the clean-up unsubscription
    //   can be cancelled.
    this.echoRobots = {};
    this.echoTimers = {};
0
    // Cache robotId to brokerId mappings to reduce database queries
    // This cache is short-lived (15s) because robots could disconnect and
    // then appear in another broker
    this.cacheRobotToBroker = new AsyncCache({
      maxAge: moment.duration(15, 'seconds').valueOf(),
      maxSize: 1000,
      createFunction: this._getMqttBrokerId
    });

    // TODO Clean-up. Move these listener implementations
    // to a constant or something else and leave the init method clean.

    // Registered MQTT topic listeners
    // Key: subtopic, value: callback
    // Callback signature: (robotId, payload)
    //
    // NOTE: By far and large most listeners will likely go
    // into the ingest service and not here. Please consult before
    // adding any new listeners.
    this._listeners = {
      // Process an echo response in case there are pending callbacks
      echo: async (robotId, msg) => {
        const robot = await Robots.findOneAsync(robotId);
        if (!robot) {
          this.logging && console.warn('Echo received from unknown robot ID: ' + robotId);
          return;
        }
        let tsAgent;
        let seq;
        const echo = Echo.decode(msg);
        // echo.payload contains the name of the OneOf protofile variable.
        const payload = echo[echo.payload];
        tsAgent = echo.timeStamp;
        [seq] = payload.split('|');

        tsAgent = Number.parseInt(tsAgent, 10);
        seq = Number.parseInt(seq, 10);

        if (!Number.isNaN(seq) && seq in this.callbacks) {
          this._callbackResponse(seq, robotId, tsAgent);
        }
      },
    };
  };

  /**
   * Start the manager.
   * This connects to all configured brokers, subscribes and starts
   * publishing messages.
   */
  run = (config) => {
    // TODO Configuration validation
    if (!config) {
      const msg = 'No mqtt configuration found in settings.json';
      this.logging && console.error(msg);
      throw new Error(msg);
    }
    if (!config.brokers || !config.defaultBrokerId) {
      const msg = 'Obsolete MQTT configuration found. Please migrate to new multi-broker format. See https://inorbit.atlassian.net/browse/IO-747';
      this.logging && console.error(msg);
      throw new Error(msg);
    }
    if (!(config.defaultBrokerId in config.brokers)) {
      const msg = `Default brokerId=[${config.defaultBrokerId}] not found in mqtt.brokers configuration`;
      this.logging && console.error(msg);
      throw new Error(msg);
    }

    // Create an MQTT broker instance for each broker configuration
    this.brokers = {};
    for (const [instanceId, instanceConfig] of Object.entries(config.brokers)) {
      this.brokers[instanceId] = new MqttBroker({
        logging: this.logging,
        config: instanceConfig,
        id: instanceId,
        onConnection: this.processConnection,
        onMessage: this.processMessage
      });
    }
    // Keep a pointer to a default broker instance
    this.defaultBrokerId = config.defaultBrokerId;
  };

  /**
   * Publish a message in a given MQTT robot-specific subtopic
   *
   * @param options is an optional object for the mqtt module publish() function.
   *        This includes sending for example `{ qos: 1 }` for msgs that need
   *        guaranteed delivery.
   *        See https://www.npmjs.com/package/mqtt#mqttclientpublishtopic-message-options-callback
   */
  publish = async (robotId, subtopic, msg, options = null) => {
    const broker = await this.getMqttBroker(robotId);
    if (broker) {
      console.log(`publish: Publish ${subtopic} to robot ${robotId}`, msg);
      broker.client.publish('r/' + robotId + '/' + subtopic, msg, options);
    } else {
      // TODO A throttled log functionality should be extracted somewhere else
      // to avoid repeating this over and over.
      // Math.random() < 0.01 ~1% of the times
      // FIXME- add rate limiter
      Math.random() < 0.01 && console.warn(`Trying to publish message for robot \
${robotId} but robot has no broker (These messages are throttled)`);
    }
  };

  /**
   * Publish a message and return a Promise that resolves when the echo is received.
   * Uses the same echo/timeout semantics as the callback-based publish (10s default timeout).
   * Payload is handled as in _callbackSend: string payload with seq prefix added internally.
   *
   * @param {string} robotId - Robot ID
   * @param {string} subtopic - MQTT subtopic (e.g. 'in_cmd', 'ros/loc/...')
   * @param {string} msg - Application payload (seq prefix is added internally)
   * @param {Object|null} options - Optional mqtt publish options (e.g. { qos: 1 })
   * @returns {Promise<{ tsServerReceive: number, tsServerSend: number, tsAgent: number }>}
   *   Resolves with timings when echo is received; rejects on timeout or error.
   */
  publishAsync = async (robotId, subtopic, msg, options = null, timeout = 10000) => {
    return new Promise((resolve, reject) => {
      this._callbackSend(robotId, subtopic, msg, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      }, timeout, options);
    });
  };

  /**
   * Publish a protobuf message in a given MQTT robot-specific subtopic
   *
   * @param options: See publish()
   */
  publishProtobuf = async (robotId, subtopic, msg, protoMsg, options = null) => {
    const binaryPayload = protoMsg.encode(msg).finish();
    await this.publish(robotId, subtopic, binaryPayload, options);
  };

  /**
   * Called when a connection is established with the MQTT broker
   */
  processConnection = Meteor.bindEnvironment(async (mqttInstance) => {
    // re-establish subscriptions:
    const topics = [];
    // Subscribe registered listeners only for robots we're listening to
    for (const robotId in this.echoRobots) {
      if (await this.getMqttBroker(robotId) == mqttInstance) {
        // Subscribes only if the robot is using the broker mqttInstance
        for (const subtopic in this._listeners) {
          topics.push(`r/${robotId}/${subtopic}`);
        }
      }
    }
    mqttInstance.client.subscribe(topics);
  });

  /**
   * Process an incoming MQTT topic and route to the appropriate
   * module.
   */
  processMessage = Meteor.bindEnvironment(async (topic, msg, packet) => {
    const comps = topic.split('/');
    if (comps.length > 2 && comps[0] == 'r') {
      const subtopic = topic.substring(topic.indexOf('/', 2) + 1);

      const robotId = comps[1];
      if (!(await this.getMqttBroker(robotId))) {
        // If the robot is not assigned to a broker, we don't know it. Silently drop the message
        // FIXME add a THROTTLED console warn
        return;
      }
      // See if we have a listener for this subtopic
      if (subtopic in this._listeners) {
        try {
          this._listeners[subtopic](robotId, msg, packet);
        } catch (err) {
          console.error('Exception MQTT message', err);
        }
      } else {
        console.warn('Attempt to process message with no listener for topic: ' + topic);
      }
    }
  });

  /**
   * Subscribe to echo messages from this robot
   */
  _echoStart = async (robotId) => {
    if (robotId in this.echoRobots) {
      this.echoRobots[robotId]++;
      if (robotId in this.echoTimers) {
        Meteor.clearTimeout(this.echoTimers[robotId]);
        delete this.echoTimers[robotId];
      }
    } else {
      const broker = await this.getMqttBroker(robotId);
      if (broker) {
        // Only subscribe if the robot is assigned to a broker
        broker.client.subscribe(`r/${robotId}/echo`);
        this.echoRobots[robotId] = 1;
      }
    }
  };

  /**
   * Stop listening to echo messages for this robot
   */
  _echoEnd = (robotId) => {
    if (robotId in this.echoRobots) {
      this.echoRobots[robotId]--;
      // Wait five seconds before unsubscribing to avoid quick unsub/resub
      this.echoTimers[robotId] = Meteor.setTimeout(async () => {
        if (this.echoRobots[robotId] == 0) {
          const broker = await this.getMqttBroker(robotId);
          if (broker) {
            // Only unsubscribe if we know the robot's broker
            broker.client.unsubscribe(`r/${robotId}/echo`);
          }
          delete this.echoRobots[robotId];
          delete this.echoTimers[robotId];
        }
      }, 5000);
    } else {
      // TODO A throttled log functionality should be extracted somewhere else
      // to avoid repeating this over and over.
      // Math.random() < 0.01 ~1% of the times
      Math.random() < 0.01 && console.warn(`Call to _echoEnd for unregistered robotId=${robotId} (These messages are throttled)`);
    }
  };

  /**
   * Sends a message and sets up a callback, including a timeout to wait for a
   * response.
   * Timeout default value is 10 seconds. In order to prevent a timeout,
   * use a value of -1.
   *
   * The callback should be a function with the form function(error, results).
   *
   * Results will be an object with three properties:
   * - tsServerSend: server timestamp when the msg was sent
   * - tsServerReceive: server timestamp when the echo was received
   * - tsAgent: timestamp reported by the agent when the echo was sent
   *
   * This method currently only supports text payload.
   *
   * TODO Switch appropriate topics to protobuf.
   *
   * @param options: See publish()
   */
  _callbackSend = async (robotId, subtopic, payload, callback, timeout = 10000, options = null) => {
    await this._echoStart(robotId);
    const callbackRegistry = this.callbacks;
    const seq = callbackRegistry._seq++;
    const tsServerSend = Date.now();
    const callbackState = { callback, robotId, tsServerSend };
    if (timeout != -1) {
      callbackState.timer = Meteor.setTimeout(() => this._callbackTimeout(seq), timeout);
    }
    callbackRegistry[seq] = callbackState;
    await this.publish(robotId, subtopic, String(seq) + '|' + payload, options);
  };

  /**
   * Called internally when a request with callback times out
   */
  _callbackTimeout = (seq) => {
    const callbackState = this.callbacks[seq];
    if (!callbackState) {
      return;
    }
    this._echoEnd(callbackState.robotId);

    // Mark timer as triggered
    callbackState.timer = null;
    // And call as canceled
    callbackState.isCanceled = true;

    // Call callback with timeout error (if callback was provided)
    if (typeof callbackState.callback === 'function') {
      callbackState.callback(new Meteor.Error('Timeout waiting for callback'), undefined);
    } else {
      console.warn(`_callbackTimeout: No callback provided for seq ${seq}, robotId ${callbackState.robotId}`);
    }
  };

  /**
   * Called internally when a response is received from a robot
   */
  _callbackResponse = (seq, robotId, tsAgent) => {
    const callbackState = this.callbacks[seq];
    if (!callbackState) {
      return;
    }

    const tsServerReceive = Date.now();
    const { tsServerSend } = callbackState;

    // This is only a precaution, we've never seen it so far.
    if (robotId != callbackState.robotId) {
      console.warn(`Discarding call to callback originally set for a different robotId ${JSON.stringify({ robotId, seq, callbackState })}`);
      return;
    }

    this._echoEnd(callbackState.robotId);

    // Only call the callback if the request wasn't canceled (e.g.: timeout)
    // and callback was provided
    if (!callbackState.isCanceled && typeof callbackState.callback === 'function') {
      // NOTE The signature of the returned function is:
      //  error, { tsServerReceive, tsServerSend, tsAgent }
      // This is in order to be compatible with a wrapAsync Meteor callback
      callbackState.callback(undefined, { tsServerReceive, tsServerSend, tsAgent });
    } else if (!callbackState.isCanceled) {
      // Only warn if not canceled, canceled requests are expected to not call back
      console.warn(`_callbackResponse: No callback provided for seq ${seq}, robotId ${robotId}`);
    }

    // If there was a timeout timer, get rid of it now
    if (callbackState.timer) {
      Meteor.clearTimeout(callbackState.timer);
    }

    delete this.callbacks[seq];
  };

  /**
   * Internal method used by robot-to-broker cache to resolve a brokerId given a
   * robotId. If the robot is not in any broker, returns undefined.
   */
  // eslint-disable-next-line class-methods-use-this
  _getMqttBrokerId = async (robotId) => (
    (await MqttLogins.findOneAsync({ robotId }))?.brokerId
  );

  /**
   * Returns the MQTT instance corresponding to a particular robot.
   * If the robot is not in any broker, returns undefined.
   */
  getMqttBroker = async (robotId) => {
    // Resolve brokerId from robotId with getMqttBrokerId via cache.
    const brokerId = await this.cacheRobotToBroker.get(robotId);
    return this.brokers[brokerId];
  };

  /**
   * Return a MqttBroker instance by Broker id.
   */
  getMqttBrokerById = brokerId => this.brokers[brokerId];

  /**
   * Send a ping to an agent and execute the callback with timings included
   * when the agent responds via echo.
   *
   * The callback should be a function with the form function(error, results).
   *
   * Results will be an object with three properties:
   * - tsServerSend: server timestamp when the msg was sent
   * - tsServerReceive: server timestamp when the echo was received
   * - tsAgent: timestamp reported by the agent when the echo was sent
   *
   * All timestamps are in milliseconds.
   *
   * TODO Implement timeout in case of no response
   * TODO Generalize this as an MQTT RPC mechanism
   * TODO Generalize this to measure RTT on existing messages
   */
  ping = async ({ robotId }, callback) => {
    await this._callbackSend(robotId, 'in_cmd', '', callback);
  };

  // Clears the retained state message for a given robot
  // TODO Make this a 'clear robot retained topics' action
  // Make retained topic registration modular so that it can be iterated
  // here easily.
  clearRobotState = async ({ robotId }) => {
    await Promise.all([
      this.publish(robotId, 'state', null, { retain: true }),
      // TODO Implement this through a proper hook with the localization module
      // This is a hack to reduce the number of lingering retained topics for the moment.
      this.publish(robotId, 'ros/loc/map2', null, { retain: true }),
      this.publish(robotId, 'ros/loc/config/0', null, { retain: true }),
      this.publish(robotId, 'ros/loc/config/1', null, { retain: true })
    ]);
  };

  // Sends a message to request a robot agent update
  triggerAgentUpdate = async ({ robotId }) => {
    await this.publish(robotId, 'in_cmd', 'update');
  };

  // Sends a message to request a robot agent restart
  triggerAgentRestart = async ({ robotId }) => {
    await this.publish(robotId, 'in_cmd', 'restart');
  };

  // Sends a message to request a robot agent files
  // TODO (Flor_Grosso): generalize for other file types
  getAgentFiles = async ({ robotId, type }) => {
    if (type == 'log') {
      await this.publish(robotId, 'in_cmd', 'send_logfiles');
    } else {
      console.warn('Can\'t get updates for file type ' + type);
    }
  };

  // Changes module state with given command
  setModuleState = async ({ robotId, moduleName, newState }) => {
    // HACK (Pisti) Due to the null values that help prevent the application of
    // defaults to configurations, we have to do some cleaning of this
    // configuration for the ros image agentlet
    if (moduleName == 'RosImageAgentlet' && newState.cameras_config) {
      cleanNulls(newState);
    }

    // Send the module name as a state key/value pair
    newState.module_name = moduleName;
    await this.publish(robotId, 'modules/set_state', JSON.stringify(newState), { qos: 1 });
  };

  loadModule = async ({ robotId, moduleName, runlevel }) => {
    await this.publish(robotId, 'in_cmd', 'load_module|' + moduleName + '|' + runlevel, { qos: 1 });
  };

  unloadModule = async ({ robotId, moduleName }) => {
    await this.publish(robotId, 'in_cmd', 'unload_module|' + moduleName, { qos: 1 });
  };

  startUploadRosbag = async ({ robotId, fileName, type }) => {
    const payload = '|' + Date.now() + '|' + fileName;
    // for backwards compatibility the default topic is the rosbag's one
    const topic = type == 'databag' ? MQTT_DATABAG_UPLOAD_TOPIC : MQTT_ROSBAG_UPLOAD_TOPIC;
    await this.publish(robotId, topic, payload);
  };

  // TODO (Flor_Grosso): generalize this for other file types
  startUploadAgentFile = async ({ robotId, fileName, type }) => {
    if (type == 'log') {
      await this.publish(robotId, 'in_cmd', 'upload_agent_log|' + fileName);
    } else {
      console.warn('File type ' + type + ' is not supported for uploads');
    }
  };

  teleopStep = async ({ robotId, direction, tsHint }, callback) => {
    // provide server time if tsHint is undefined
    if (!tsHint) {
      console.warn('No tsHint received, providing server time instead');
      // TODO (PISTI) ADD ESTIMATED RTT FOR THE ROBOT
      tsHint = Date.now();
    }
    const payload = tsHint + '|' + direction;
    await this._callbackSend(robotId, 'ros/teleop/step', payload, callback);
  };

  // TODO (elvio): This method uses publishProtobuf and does not support timing/RTT measurement
  continuousGoTeleop = async ({ robotId, linearVelocity, angularVelocity, tsHint }) => {
    // Don't waste resources sending no-movement commands
    if (linearVelocity == 0 && angularVelocity == 0) {
      return;
    }
    // provide server time if tsHint is undefined
    if (!tsHint) {
      const robotVitals = await RobotVitals.findOneAsync({ _id: robotId });
      // use avgRtt values, if they are not available, use a 500ms delay guess
      const avgRtt = robotVitals?.sysNetRtt?.avg || 500;
      tsHint = Date.now() + avgRtt;
    }
    const payload = {
      tsHint,
      linearVelocity,
      angularVelocity
    };
    await this.publishProtobuf(robotId, 'ros/teleop/go', payload, TeleopGoCommand);
  };

  // Sends a custom command to the agent
  sendCustomCommand = async ({ robotId, cmd }) => {
    const newCommand = {
      cmd,
      ts: Date.now(),
    };
    await this.publishProtobuf(robotId, 'custom_command/ros', newCommand, CustomCommandRosMessage);
  };

  /**
   * Sends a custom script execution request to the agent.
   *
   * Returns a unique-per-robot execution ID that can be used
   * to identify this execution instance.
   */
  sendCustomScript = async ({ robotId, fileName, scriptParams }) => {
    const newScript = {
      fileName,
      ts: Date.now(),
      run: scriptParams.run,
      argOptions: scriptParams.argOptions,
      scriptContents: scriptParams.fileContent
    };

    // Create a unique-by-robot ID to track execution
    const executionId = Random.id(4);
    // Send the created executionId to the agent for tracking
    newScript.executionId = executionId;
    // Send the message to the robot
    await this.publishProtobuf(robotId, 'custom_command/script/command', newScript, CustomScriptCommandMessage);

    return executionId;
  };

  getDefaultBroker = () => this.brokers[this.defaultBrokerId];
}

export { MqttBroker };
