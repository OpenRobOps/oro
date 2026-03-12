// NOTE (elvio.aruta98): disabled max-classes-per-file to avoid lot of linting errors
// in this legacy file. Don't replicate this in new files.
/* eslint-disable max-classes-per-file */
/**
 * Ingest-side MQTT manager
 */
import mqtt from 'mqtt';
import { loadSync } from 'protobufjs';
import moment from 'moment';
import fs from 'fs';
// ORO imports
import { COLLECTIONS } from '../shared/constants';
// import { Robot, Company } from './model';
// import AttributesManager from './attributes';
import RateLimiter from './rateLimiter';
// import {
//   VITAL_SPEED_LINEAR,
//   VITAL_SPEED_ANGULAR,
//   VITAL_DISTANCE_LINEAR,
//   VITAL_DISTANCE_ANGULAR,
//   VITAL_DISTANCE_LINEAR_SINCE,
//   VITAL_DISTANCE_ANGULAR_SINCE,
//   VITAL_AGENT_TIME_DIFF
// } from '../shared/attributes';
import MongoManager from '../mongo';
// import metricsProxy from '../shared/server/metrics';
// import {
//   measureMsgsCount,
//   measureMsgsSize,
//   measureActiveRobotsLastMinute,
//   measureBrokerUsagePercentage,
//   measureActiveRobotsLastHour,
//   tagKeySubtopic,
//   tagKeyRobotId,
//   tagKeyBrokerId
// } from './metrics/mqtt';

// Databags update topics. Same as in ingest/databags.js
const MQTT_ROSBAG_UPLOAD_TOPIC = 'ros/rosbag/upload';
const MQTT_DATABAG_UPLOAD_TOPIC = 'ros/databag/upload';

// Create instrumented/serializable class from protobuf definition

// TODO Create proto path properly
const protoRoot = loadSync(__dirname + '/../shared/oro.proto');

const RobotFilesUpdateMessage = protoRoot.lookupType('oro.RobotFilesUpdateMessage');
const OdometryDataMessage = protoRoot.lookupType('oro.OdometryDataMessage');
const Echo = protoRoot.lookupType('oro.Echo');

/**
 * Handles communication with a specific Mqtt broker
 */
class MqttBroker {
  constructor({ config, id, onConnection, onMessage }) {
    // TODO Validate config
    this.config = config;
    this.id = id;
    this.onConnection = onConnection;
    this.onMessage = onMessage;

    this.connected = false;

    this.start();

    // Keep a pointer to the top-level OroMqtt singleton instance
    this.topLevel = new OroMqtt();
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
    const brokerUrl = protocol + hostname + ':' + port;
    this.client = MqttBroker.connect(brokerUrl,
      { username, password, rejectUnauthorized }
    );
    console.log(`mqtt(${this.id}): connecting to ${brokerUrl}`);

    // Handle key indication of connection status with MQTT broker.
    // Uses the SystemStatus collection with key 'mqtt'.
    this.client.on('error', (msg) => {
      console.log(`mqtt(${this.id}): error! ${msg}`);
    });
    this.client.on('close', () => {
      this.connected = false;
      console.log(`mqtt(${this.id}): connection closed!`);
    });
    this.client.on('offline', () => {
      this.connected = false;
      console.log(`mqtt(${this.id}): offline!`);
    });
    this.client.on('reconnect', () => {
      console.log(`mqtt(${this.id}): reconnecting`);
    });

    this.client.on('connect', (connack) => {
      this.processConnection(connack);
      this.onConnection(this);
    });
    this.client.on('message', this.onMessage);
  };

  /**
   * Shut down MQTT connection.
   * Returns a promise to allow awaiting.
   */
  shutdown = () => {
    return new Promise((resolve, reject) => {
      this.client.end(false, () => {
        console.log(`mqtt(${this.id}): shutdown complete`);
        resolve();
      });
    });
  };

  processConnection = (connack) => {
    this.connected = true;
    console.log('mqtt(' + this.id + '): connected!', connack && connack.cmd);
    // Update connection time. This is used in the basics module to know when it is OK to
    // set a robot's updateStamp.
    this.connectTs = Date.now();
  };
}

// Singleton pattern through constructor
let instance;
export default class OroMqtt {
  constructor() {
    // Only construct an instance if it hasn't been done yet
    if (instance === undefined) {
      instance = this;
      this.init();
    }
    return instance;
  }

  // Actual construction should happen here
  init = () => {
    //
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
    this.callbacks._seq = 1;

    // Cache robotId to brokerId mappings to avoid database queries
    // this.cacheRobotToBroker = new AsyncCache({
    //   maxAge: moment.duration(1, 'hour').valueOf(),
    //   maxSize: 1000,
    //   createFunction: this.getMqttBrokerId
    // });
    this.cacheRobotToBroker = (robotId) => 'default';

    // HACK(adamantivm) Used to limit the number of odometry requests
    // per robot, as a performance alleviation. Saves the ts of the last
    // processed odometry entry for each robot.
    this._rateLimiterOdometry = new RateLimiter(10000); // max 0.1 Hz frequency

    // Vitals module configuration
    // this.attrMgr = new AttributesManager();

    // Create pointers to different necessary collections
    this.mongoManager = new MongoManager();
    this.robotAgentFiles = this.mongoManager.getCollection(COLLECTIONS.ROBOT_AGENT_FILES);
    this.robotVitals = this.mongoManager.getCollection(COLLECTIONS.ROBOT_VITALS);
    this.mqttLogins = this.mongoManager.getCollection(COLLECTIONS.MQTT_CREDENTIALS);
    this.mqttBrokerDetails = this.mongoManager.getCollection(COLLECTIONS.MQTT_BROKER_DETAILS);

    // Registered MQTT system topic listeners (not robot-specific)
    this._systemListeners = {};

    // TODO Clean-up. Move these listener implementations
    // to a constant or something else and leave the init method clean.

    // Registered MQTT robot topic listeners
    // Key: subtopic, value: callback
    // Callback signature: (robotId, payload)
    this._listeners = {
      // Process an echo response in case there are pending callbacks
      echo: [(robotId, msg) => {
        let topic, tsAgent, seq, rest;
        let echo = Echo.decode(msg);
        topic = echo.topic;
        // echo.payload contains the name of the OneOf protofile variable.
        let payload = echo[echo.payload];
        tsAgent = echo.timeStamp.toNumber();
        [seq, ...rest] = payload.split('|');

        tsAgent = Number.parseInt(tsAgent);
        seq = Number.parseInt(seq);

        if (!Number.isNaN(seq) && seq in this.callbacks) {
          this._callbackResponse(seq, robotId, tsAgent);
        }
      }],
      // TODO Move to its own ingest module
      logfiles_update: [async (robotId, msg) => {
        // Note (Flor_Grosso): log files are managed through in_cmd for now. Consider
        // moving this to its own module.
        let decodedMsg = RobotFilesUpdateMessage.decode(msg);
        decodedMsg.artifacts.forEach(async p => {
          const type = p.type;
          const fileName = p.name;
          // Size is received in bytes. Convert to kilobytes and store it.
          const size = p.size ? (p.size.toNumber() / 1024).toFixed(2) : 0;
          const storedInRobot = p.storedInRobot ? true : false;
          const uploading = p.uploading ? true : false;
          const url = p.url ? p.url : '0';
          const ts = p.ts && p.ts.toNumber();

          if (!storedInRobot && !uploading) {
            const log = await this.robotAgentFiles.findOne({
              type: type, fileName: fileName, robotId: robotId
            });
            // update a log to show as not in the robot, but has a url
            if (log && (log.url != '0')) {
              this.robotAgentFiles.updateOne({ fileName, robotId }, {
                $set: {
                  size,
                  storedInRobot,
                  uploading,
                  url: log.url,
                }
              });
              // Delete logs that were not uploaded or are not in the robot
            } else if (log) {
              this.robotAgentFiles.remove(log);
            }
          } else {
            this.robotAgentFiles.updateOne({
              fileName,
              robotId,
              type,
            }, {
              $set: {
                storedInRobot: true,
                size,
                uploading,
                url: url
              },
              $setOnInsert: { ts }
            }, {
              upsert: true
            });
          }
        });
      }]
    };
  };

  /**
   * Start the manager.
   * This connects to all configured brokers, subscribes and starts
   * publishing messages.
   */
  run = (config) => {
    if (!config) {
      const msg = 'No mqtt configuration found in settings.json';
      console.error(msg);
      throw new Error(msg);
      return;
    }

    if (config.noDefaultListeners) {
      // NOTE(mike) Because of some design debt, by default this class configures some listeners in
      // the init() method.
      // Setting noDefaultListeners allows services to use a clean OroMqtt without any
      // listeners configured.
      this._listeners = {};
    }
    // TODO Move Odometry to its own module instead
    this.odometryEnabled = config.odometryEnabled;

    if (!(config.defaultBrokerId in config.brokers)) {
      const msg = `Default brokerId=[${config.defaultBrokerId}] not found in mqtt.brokers configuration`;
      console.error(msg);
      throw new Error(msg);
    }

    // Create an MQTT broker instance for each broker configuration
    this.brokers = {};
    for (const [instanceId, instanceConfig] of Object.entries(config.brokers)) {
      this.brokers[instanceId] = new MqttBroker({
        config: instanceConfig,
        id: instanceId,
        onConnection: this.processConnection,
        onMessage: this.processMessage
      });
    }
    // Keep a pointer to a default broker instance
    this.defaultBrokerId = config.defaultBrokerId;
  }

  /**
   * Shuts down all MQTT connections cleanly.
   * Presents a promise interface to allow awaiting.
   */
  shutdown = () => {
    const promises = Object.values(this.brokers).map(broker => broker.shutdown());
    this._activeRobotsTrackers.forEach(t => t.stop());
    return Promise.all(promises);
  };

  /**
   * Convenience method to extract more type from main protobuf definition file
   */
  lookupType = (message) => {
    return protoRoot.lookupType(message);
  };

  /**
   * Register a listener for a system topic, not robot-specific
   */
  registerSystemListener = (subtopic, callback) => {
    // TODO Sanity checks
    if (!(subtopic in this._systemListeners)) {
      this._systemListeners[subtopic] = [];
    }
    this._systemListeners[subtopic].push(callback);
    for (const broker of Object.values(this.brokers)) {
      if (broker.connected) {
        broker.client.subscribe(`system/${subtopic}`);
      }
    }
  };

  /**
   * Register a listener to a given MQTT robot-specific subtopic
   */
  registerListener = (subtopic, callback) => {
    // TODO Sanity checks
    if (!(subtopic in this._listeners)) {
      this._listeners[subtopic] = [];
    }
    this._listeners[subtopic].push(callback);
    for (const broker of Object.values(this.brokers)) {
      if (broker.connected) {
        broker.client.subscribe(`r/+/${subtopic}`);
      }
    }
  };

  /**
   * Publish a message in a given MQTT robot-specific subtopic
   *
   * @param options is an optional object for the mqtt module publish() function.
   *        This includes sending for example `{ qos: 1 }` for msgs that need
   *        guaranteed delivery.
   *        See https://www.npmjs.com/package/mqtt#mqttclientpublishtopic-message-options-callback
   */
  publish = async (robotId, subtopic, msg, callback, options = null) => {
    if (callback) {
      this._callbackSend(robotId, subtopic, msg, callback, 10000, options);
    } else {
      const broker = await this.getMqttBroker(robotId);
      broker.client.publish(`r/${robotId}/${subtopic}`, msg, options);
    }
  };

  /**
   * Publish a protobuf message in a given MQTT robot-specific subtopic
   */
  publishProtobuf = async (robotId, subtopic, msg, protoMsg, options = null) => {
    const binaryPayload = protoMsg.encode(msg).finish();
    return this.publish(robotId, subtopic, binaryPayload, null, options);
  };

  /**
   * Called when a connection is established with the MQTT broker
   */
  processConnection = (mqttInstance) => {
    // Re-establish subscriptions:
    const topics = [];
    // TODO Move Odometry to its own module instead
    if (this.odometryEnabled) {
      topics.push('r/+/ros/odometry/+');
    }
    // Subscribe registered listeners
    for (const subtopic in this._listeners) {
      topics.push(`r/+/${subtopic}`);
    }
    // Subscribe to system listeners
    for (const subtopic in this._systemListeners) {
      topics.push(`system/${subtopic}`);
    }

    mqttInstance.client.subscribe(topics);
  };

  /**
   * Records metrics measurements for a processed message.
   *
   * @param topic MQTT message's topic
   * @param msg MQTT message
   */
  _handleMsgMetrics = async (topic, msg, packet = {}) => {

    console.warn('handleMsgMetrics IGNORED', topic);

    // Extract robotId from topic
    // const match = topic.match(/r\/(?<robotId>[^/]*)\//);
    // const robotId = match && match.groups && match.groups.robotId;
    // // Takes a topic like "a/b/c/d/e" and return "c/d/e"
    // const subtopic = topic.substring(topic.indexOf('/', 2) + 1);

    // const tags = [];
    // // If the subtopic is not empty use it as the value for the tag `tagKeySubtopic`
    // subtopic && tags.push([{ key: tagKeySubtopic, value: subtopic }]);
    // // If robotId is known, also add it to metrics as tags
    // robotId && tags.push([{ key: tagKeyRobotId, value: robotId }]);

    // metricsProxy.record(measureMsgsCount, 1, tags.length ? tags : undefined);
    // if (msg && msg.length) {
    //   metricsProxy.record(measureMsgsSize, msg.length, tags);
    // }
  };

  /**
   * Reports a metric about the percentage of usage of the Ingest capacity
   *
   * @param {object} measure
   * @param {array} robotIds Set of active robots
   */
  _reportIngestCapacityUsageMetric = async (measure, robotIds) => {
    const maxCapacity = Number(await this.getBrokerMaxCapacity());
    const robotsCount = robotIds.size;
    if (Number.isNaN(maxCapacity) || !maxCapacity) {
      return;
    }
    const brokerUsagePercentage = (robotsCount / maxCapacity) * 100;
    metricsProxy.record(
      measure,
      brokerUsagePercentage,
      [{ key: tagKeyBrokerId, value: this.defaultBrokerId }]
    );
  };

  /**
   * Process an incoming MQTT topic and route to the appropriate module.
   *
   * This is the initial callback from mqtt client.
   * @param packet contains the raw packet flags: { retain, qos, dup, length }
   *    (as well as topic and payload which are also in the first arguments for
   *    convenience). These flags are sent to listeners in case they care about
   *    qos or retain flags.
   */
  processMessage = async (topic, msg, packet) => {
    this._handleMsgMetrics(topic, msg, packet);
    const comps = topic.split('/');

    // System message
    if (comps.length > 1 && comps[0] == 'system') {
      const subtopic = topic.substring(topic.indexOf('/', 2) + 1);
      if (subtopic in this._systemListeners) {
        try {
          await Promise.all(this._systemListeners[subtopic].map(callback => callback(msg)));
        } catch (err) {
          console.error('Exception processing MQTT system message', err);
        }
      }
      // Robot message
    } else if (comps.length > 2 && comps[0] == 'r') {
      const robotId = comps[1];

      // See if we have a listener for this subtopic
      const subtopic = topic.substring(topic.indexOf('/', 2) + 1);
      if (subtopic in this._listeners) {
        try {
          await Promise.all(this._listeners[subtopic].map(
            callback => callback(robotId, msg, packet)
          ));
        } catch (err) {
          console.error('Exception processing MQTT message', err);
          if (String(err).includes('MongoError')) {
            console.error('It is likely connection to MongoDB has been CLOSED\
                           or LOST. Ingest service needs to be restarted');
            // Remove /tmp/ready file to signal to k8s that the container is
            // not healthy when running inside a Pod.
            fs.unlinkSync('/tmp/ready');
          }
        }

        // ---------------------------------------------------------
        // NOTE: All the code below should be migrated to modules or
        // at least listeners.
        // Please, don't add more MQTT processing code here, instead
        // look at how e.g.: 'server/modules/localization.js' does it
        // ---------------------------------------------------------

        // TODO: (Pisti): Odometry should be separated into 2 data streams:
        // a low frequency stream that goes into Robot vitals (vitals module)
        // a high frequency stream, used for teleoperating that includes speed data
        // This will require changes on the agent and the mqtt topics
        // It's an odometry message
      } else if (comps[2] == 'ros' && comps[3] == 'odometry') {
        const robotVitalsCfg = await this.attrMgr.getRobotVitalsConfig(robotId);
        // It's an odometry DATA message
        if (comps[4] == 'data') {
          // Decode the protobuf message
          // Rate limiter note: Message de-serialization is currently done before rate-limiting, to
          // account for batch-processing modes where the timestamp depends on the message
          // and not the current time - See IO-5895
          const decodedMsg = OdometryDataMessage.decode(msg);
          const ts = decodedMsg.ts.toNumber();
          // HACK(adamantivm) If ts is zero it means this is an invalid odometry message
          // which can be skipped.
          // TODO Fix agent to avoid sending invalid odometry messages
          if (ts == 0) {
            return;
          }
          // HACK(adamantivm) Limit the rate of odometry distance updates to 0.1Hz
          const useDistance = this._rateLimiterOdometry.accepts(robotId, ts);

          // Get previous odometry before anything else (used for preprocessing attribute values
          // and store correct, computed value)
          const prevOdom = useDistance && await this.attrMgr.getRobotAttributeValues(robotId,
            [VITAL_DISTANCE_LINEAR_SINCE, VITAL_DISTANCE_ANGULAR_SINCE]);
          const lastDistanceLinear = useDistance && prevOdom[VITAL_DISTANCE_LINEAR_SINCE],
            lastDistanceAngular = useDistance && prevOdom[VITAL_DISTANCE_ANGULAR_SINCE];

          const odometryUpdates = {};
          const distanceLinear = decodedMsg.linearDistance;
          const distanceAngular = decodedMsg.angularDistance;
          const tsStart = decodedMsg.tsStart.toNumber();

          // TODO(herchu) These two blocks might be generalized to a 'save these pair
          // of attrbutes, one of which is accumulator and the other is a delta'-type of thing.
          // ONLY IF distance odometry data is handled by system updates
          if (useDistance && robotVitalsCfg.isBuiltinVital(VITAL_DISTANCE_LINEAR)) {
            // Always save this last snapshot with the tsStart
            odometryUpdates[VITAL_DISTANCE_LINEAR_SINCE] = {
              value: distanceLinear,
              params: { tsStart }
            };
            if (lastDistanceLinear
              && lastDistanceLinear.params
              && lastDistanceLinear.params.tsStart == tsStart) {
              // Keep accumulating distance; data from same agent run.
              const delta = distanceLinear - lastDistanceLinear.value;
              // Calculate elapsed time with a tenth of a seconds precision
              // This is necessary since currently sometimes odometry can be published
              // at 2Hz. Rounding per seconds will not be enough, and using milliseconds is
              // overkill.
              const elapsedSeconds = Math.round((ts - lastDistanceLinear.ts) / 100) / 10;
              odometryUpdates[VITAL_DISTANCE_LINEAR] = {
                value: delta,
                params: { elapsedSeconds }
              };
            } // else: Cannot compute delta; start over. Save only the '_SINCE' attribute ()
          }
          // ONLY IF distance odometry data is handled by system updates
          if (useDistance && robotVitalsCfg.isBuiltinVital(VITAL_DISTANCE_ANGULAR)) {
            // Always save this last snapshot with the tsStart
            odometryUpdates[VITAL_DISTANCE_ANGULAR_SINCE] = {
              value: distanceAngular,
              params: { tsStart }
            };
            if (lastDistanceAngular
              && lastDistanceAngular.params
              && lastDistanceAngular.params.tsStart == tsStart) {
              // Keep accumulating distance; data from same agent run.
              const delta = distanceAngular - lastDistanceAngular.value;
              // Calculate elapsed time with a tenth of a seconds precision
              // This is necessary since currently sometimes odometry can be published
              // at 2Hz. Rounding per seconds will not be enough, and using milliseconds is
              // overkill.
              const elapsedSeconds = Math.round((ts - lastDistanceAngular.ts) / 100) / 10;
              odometryUpdates[VITAL_DISTANCE_ANGULAR] = {
                value: delta,
                params: { elapsedSeconds }
              };
            } // else: Cannot compute delta; start over. Save only the '_SINCE' attribute ()
          }
          // TODO (Pisti): As mentioned above, the speed parsing and odometry parsing should
          // be separated. Eventually, speed data should go straight to the client and skip
          // the server due to its high frequency of messages.
          if (decodedMsg.speedAvailable) {
            let agentTimeDelta = 0;
            try {
              let robotVitalsDoc = await this.robotVitals.findOne({ _id: robotId });
              // Only if the user has ever teleoped the robot
              // there will be data on sysNetAgentTimeDelta.value.
              // Otherwise, there will be data gathered by ping.js
              // TODO Remove this check when rttManager is replaced by ping
              if (robotVitalsDoc && robotVitalsDoc.sysNetAgentTimeDelta) {
                agentTimeDelta = robotVitalsDoc.sysNetAgentTimeDelta.value;
              } else {
                robotVitalsDoc = await this.attrMgr.getRobotAttributeValues(
                  robotId,
                  [VITAL_AGENT_TIME_DIFF]
                );
                agentTimeDelta = robotVitalsDoc[VITAL_AGENT_TIME_DIFF];
              }
              // prevent a breaking error if Vitals are not available yet
            } catch (e) {
              console.log('Time delta for robot: ' + robotId + ' unavailable: ' + e);
            }
            // Save data to vitals
            const tsAgent = decodedMsg.ts.toNumber() + agentTimeDelta;
            odometryUpdates[VITAL_SPEED_LINEAR] = {
              value: decodedMsg.linearSpeed.toFixed(3),
              params: { tsAgent }
            };
            odometryUpdates[VITAL_SPEED_ANGULAR] = {
              value: decodedMsg.angularSpeed.toFixed(3),
              params: { tsAgent }
            };
          }
          // Finally send all updates to be saved (and cascaded to status updates, ...)
          this.attrMgr.handleSystemUpdates(
            robotId,
            odometryUpdates,
            ts,
            { status: true }
          );
        }
      }
      // --------------------------------------------------------------
      // NOTE: Please don't add more if stanzas here, instead implement
      // a listener
      // --------------------------------------------------------------
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
   */
  _callbackSend = (robotId, subtopic, payload, callback, timeout = 10000, options = null) => {
    const callbackRegistry = this.callbacks;
    const seq = callbackRegistry._seq++;
    const tsServerSend = Date.now();
    const callbackState = { callback, robotId, tsServerSend };
    if (timeout != -1) {
      callbackState.timer = setTimeout(() => this._callbackTimeout(seq), timeout);
    }
    callbackRegistry[seq] = callbackState;
    this.publish(robotId, subtopic, String(seq) + '|' + payload, null, options);
  };

  /**
   * Called internally when a request with callback times out
   */
  _callbackTimeout = (seq) => {
    const callbackState = this.callbacks[seq];
    if (!callbackState) {
      return;
    }

    // Mark timer as triggered
    callbackState.timer = null;
    // And call as canceled
    callbackState.isCanceled = true;

    // Call callback with timeout error
    callbackState.callback(new Error('Timeout waiting for callback'), undefined);
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
    const tsServerSend = callbackState.tsServerSend;

    // This is only a precaution, we've never seen it so far.
    if (robotId != callbackState.robotId) {
      console.warn(
        'Discarding call to callback originally set for a different robotId',
        { robotId, seq, callbackState }
      );
      return;
    }

    // Only call the callback if the request wasn't canceled (e.g.: timeout)
    if (!callbackState.isCanceled) {
      // NOTE The signature of the returned function is:
      //  error, { tsServerReceive, tsServerSend, tsAgent }
      // This is in order to be compatible with a wrapAsync Meteor callback
      callbackState.callback(undefined, { tsServerReceive, tsServerSend, tsAgent });
    }

    // If there was a timeout timer, get rid of it now
    if (callbackState.timer) {
      clearTimeout(callbackState.timer);
    }

    delete this.callbacks[seq];
  };

  /**
   * Internal method used by robot-to-broker cache to resolve a brokerId given a
   * robotId.
   * If there are log-in credentials for a robotId, the brokerId from there is used,
   * otherwise, the default broker is returned.
   */
  getMqttBrokerId = async (robotId) => {
    const login = await this.mqttLogins.findOne({ robotId });
    return login?.brokerId | this.defaultBrokerId;
  };

  /**
   * Returns the MQTT instance corresponding to a particular robot.
   */
  getMqttBroker = async (robotId) => {
    // Resolve brokerId from robotId with getMqttBrokerId via cache.
    let brokerId = await this.cacheRobotToBroker.get(robotId);
    if (!(brokerId in this.brokers)) {
      console.error(`Broker instance for brokerId=[${brokerId}], requested for `
        + `robotId=[${robotId}] not found. Falling back to brokerId=[${brokerId}]`);
      brokerId = this.defaultBrokerId;
    }
    return this.brokers[brokerId];
  };

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
  ping = ({ robotId }, callback) => {
    this._callbackSend(robotId, 'in_cmd', '', callback);
  };

  // Clears the retained state message for a given robot
  // TODO Make this a 'clear robot retained topics' action
  // Make retained topic registration modular so that it can be iterated
  // here easily.
  clearRobotState = ({ robotId }) => {
    this.publish(robotId, 'state', null, null, { retain: true });
  };

  // Gets the maximum capacity of the broker (defined as defaultBrokerId for the instance)
  // This function is cached to avoid hitting too much the database
  // (max capacity doesn't change frenquently)
  getBrokerMaxCapacity = async () => {
    try {
      const brokerDetails = await this.mqttBrokerDetails.findOne({ _id: this.defaultBrokerId });
      return brokerDetails?.maxCapacity;
    } catch (error) {
      console.error('Error retrieving broker max capacity:', error);
    }
  };

  /**
   * Send an upload rosbag request to some robot.
   *
   * @param {string} robotId Id of robot where rosbag is stored
   * @param {string} fileName name of rosbag to upload
   */
  startUploadRosbag = ({ robotId, fileName, type }) => {
    const payload = '|' + Date.now() + '|' + fileName;
    // for backwards compatibility the default topic is the rosbag's one
    const topic = type == 'databag' ? MQTT_DATABAG_UPLOAD_TOPIC : MQTT_ROSBAG_UPLOAD_TOPIC;
    this.publish(robotId, topic, payload);
  };
}

// export {
  // measureMsgsCount,
  // measureMsgsSize,
  // tagKeySubtopic,
  // tagKeyBrokerId
// };
