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
 * DirectClient (Mqtt)
 *
 * Provides a direct MQTT connection to a robot for low-latency teleop.
 * Uses reference counting: grab an instance via `Mqtt.grabInstance(robotId)`,
 * and call `.release()` when done so the connection can be cleaned up.
 */
import React, { useState, useEffect } from 'react';
import objectHash from 'object-hash';
import { isObject, isArray, isEmpty, isString, flatMap } from 'lodash';
import mqtt from 'mqtt';
import protobuf from 'protobufjs';
// ORO Modules

// Mqtt client self-subscribes to 'echo' topic.
const ECHO_SUBTOPIC = 'echo';
// Time to wait before self-garbage-collect a Mqtt instance after the last observer of a robot
// has released it. It's long enough so we allow reloading screen, or even switch back to the same
// robot, and reuse the instance (and connection)
const GC_WAIT_MS = 5000;

// Error keys for for the logOnce-type logger
const ERROR_BAD_ROBOT = 'badRobot';
const ERROR_BAD_TOPIC = 'badTopic';

const instances = {};
// Helpers to access protobuf types only once per type
const _typeStrings = {};
/**
 * This method returns a protobuf message type object which can
 * encode/decode message, given a string with the protobuf type
 */
const getProtobufType = async (typeString) => {
  if (!('root' in _typeStrings)) {
    _typeStrings.root = await protobuf.load('/oro.proto');
  }
  if (!(typeString in _typeStrings)) {
    _typeStrings[typeString] = _typeStrings.root.lookupType('oro.' + typeString);
  }
  return _typeStrings[typeString];
};

/**
 * Class to handle MQTT communication.
 *
 * TODO Move to its own module.
 * TODO Generalize and merge with server-side code.
 */
const _mqttInstancesByRobotIds = {};
class MqttWrapper {
  constructor(robotIds) {
    this.init(robotIds);
  }

  /**
   * Constructs or reuses the instance to connect to a given robots given by `robotIds`. Note that
   * this class uses reference counting, so every call to `grabInstance` MUST have its corresponding
   * call to release().
   */
  static GrabInstance = (robotIds) => {
    if (isString(robotIds)) { // accept a string for a single robot
      robotIds = [robotIds];
    }
    // eslint-disable-next-line camelcase

    const robotIdsHash = objectHash(robotIds);
    if (!(robotIdsHash in _mqttInstancesByRobotIds)) {
      console.log('MqttWrapper: Created mqtt instance for robots ' + robotIds.join(',') + ' (' + robotIdsHash + ')');
      _mqttInstancesByRobotIds[robotIdsHash] = new MqttWrapper(robotIds);
    }
    const instance = _mqttInstancesByRobotIds[robotIdsHash];
    // wheter this was the first or subsequent call to grabInstance, add to reference counting
    instance._addReference();
    return instance;
  };

  /**
   * Tells this object it is being released; no longer used by a client. This simply decrements
   * reference counting until the object can be destroyed.
   */
  release = () => {
    this._removeReference();
  };

  /**
   * Adds a reference. Part of reference counting pattern. See class header!
   */
  _addReference = () => {
    this.refCount++;
  };

  /**
   * Removes a reference. Part of reference counting pattern. See class header!
   *
   * Instead of destroying the object immediately when no longer used, it will _delay_ a call
   * to 'garbage-collect itself', so they object can still be reused (e.g. when switching from
   * Nav Detail to Ground Control, many DirectClients are destroyed and ref count goes down to 0,
   * but then a map widget will likely add 1 more reference and so it is worth to keep the
   * connection alive).
   */
  _removeReference = () => {
    this.refCount--;
    if (!this.refCount) {
      setTimeout(this._garbageCollect, GC_WAIT_MS);
    }
  };

  _garbageCollect = () => {
    if (!this.refCount) {
      // Only delete the instance if the reference count is 0.
      // This is in case the reference count went up again (e.g.: quick switch back to same robots)
      // since the time when garbageCollect was scheduled.
      if (this._retryConnectionTimer) {
        // Remove the connection retry timer
        clearTimeout(this._retryConnectionTimer);
      }

      delete _mqttInstancesByRobotIds[this.robotIdsHash];
      if (this.client) {
        this.client.end(); // The converse of connect() is end(), not disconnect()
      }
      this.client = null;
      console.log('MqttWrapper: Disconnected and deleted instance for ' + this.robotIds.join(',') + ' (' + this.robotIdsHash + ')');
    }
  };

  init = async (robotIds) => {
    this.refCount = 0;
    this.robotIds = robotIds;
    this.robotIdsHash = objectHash(robotIds);
    // _listeners map *subtopics* (ej. "ros/loc/data") to callbacks. These are not the actual
    // MQTT topics: those are obtained by prepending the robotId 
    this._listeners = {};
    // Remember which errors have been logged to avoid spamming logs
    this._logOnceErrors = {};

    // RPC support
    // @see server/mqtt.js
    this.callbacks = {};
    this.callbacks._seq = 1;
    this.echoProtobufType = await getProtobufType('Echo');
    this.registerListener(ECHO_SUBTOPIC, (msg) => {
      try {
        const tsServerReceive = Date.now();
        let tsAgent;
        const echo = this.echoProtobufType.decode(msg);
        // echo.payload contains the name of the OneOf protofile variable.
        const payload = echo[echo.payload];
        // tsAgent = echo.timeStamp.toNumber();
        tsAgent = echo.timeStamp;
        let [seq] = payload.split('|');

        tsAgent = Number.parseInt(tsAgent, 10);
        seq = Number.parseInt(seq, 10);

        if (!Number.isNaN(seq) && seq in this.callbacks) {
          this._callbackResponse(seq, tsAgent, tsServerReceive);
        }
      } catch (err) {
        console.error('exception processing echo response from robotId: ' + robotId, err);
      }
    });

    await this._connectToMqttBroker();
  };

  registerListener = (subtopic, callback) => {
    if (!(subtopic in this._listeners)) {
      this._listeners[subtopic] = [];
      if (this.client) {
        // When already connected, subscribe to the topic right away. Method getTopic() adds the
        // robotId (it may be different from the robot requested by subscribers, when using proxies)
        for (const robotId of this.robotIds) {
          this.client.subscribe(this._getTopic(robotId, subtopic));
        }
      }
    }
    this._listeners[subtopic].push(callback);
  };

  // NOTE(adamantivm) This registration and unregistration mechanism is very
  // brittle, since it requires each callback to be a distinct, separate
  // function instance. Consider a more robust way of providing reference
  // to a given callback to unregister.
  unregisterListener = (subtopic, callback) => {
    if (!(subtopic in this._listeners)) {
      console.warn('attempt to unregister listener to non-registered topic: ' + subtopic);
      return;
    }
    const ix = this._listeners[subtopic].findIndex(c => c == callback);
    if (ix == -1) {
      console.warn('Couldn\'t find callback registered for topic: ' + subtopic);
      return;
    }
    this._listeners[subtopic].splice(ix, 1);
    if (this._listeners[subtopic].length == 0) {
      delete this._listeners[subtopic];
      if (this.client) {
        for (const robotId of this.robotIds) {
          this.client.unsubscribe(this._getTopic(robotId, subtopic));
        }
      }
    }
  };

  /**
   * @see server/mqtt.js
   */
  callbackSend = (subtopic, payload, callback, timeout = 10000) => {
    const callbackRegistry = this.callbacks;
    const seq = callbackRegistry._seq++;
    const tsServerSend = Date.now();
    const callbackState = { callback, tsServerSend };
    if (timeout != -1) {
      callbackState.timer = setTimeout(() => this._callbackTimeout(seq), timeout);
    }
    callbackRegistry[seq] = callbackState;
    this.client && this.client.publish('r/' + this.robotId + '/' + subtopic, String(seq) + '|' + payload);
  };

  /**
   * @see server/mqtt.js
   */
  _callbackTimeout = (seq) => {
    const callbackState = this.callbacks[seq];

    // Mark timer as triggered
    callbackState.timer = null;
    // And call as canceled
    callbackState.isCanceled = true;

    // Call callback with timeout error
    callbackState.callback(new Error('Timeout waiting for callback'), undefined);
  };

  /**
   * @see server/mqtt.js
   */
  _callbackResponse = (seq, tsAgent, tsServerReceive) => {
    const callbackState = this.callbacks[seq];

    const { tsServerSend } = callbackState;

    // Only call the callback if the request wasn't canceled (e.g.: timeout)
    if (!callbackState.isCanceled) {
      // NOTE(adamantivm) The signature of the returned function is:
      //  error, { tsServerReceive, tsServerSend, tsAgent }
      // This is in order to be compatible with a wrapAsync Meteor callback (now deprecated)
      callbackState.callback(undefined, { tsServerReceive, tsServerSend, tsAgent });
    }

    // If there was a timeout timer, get rid of it now
    if (callbackState.timer) {
      clearTimeout(callbackState.timer);
    }

    delete this.callbacks[seq];
  };

  /**
   * Returns the complete MQTT topic given a subtopic; obtained by prepending the topic prefix
   * (normally 'r/<robotId>') to the rest ("subtopic").
   *
   * @param {string} robotId The robot ID
   * @param {string} subtopic The subtopic after the robot prefix, e.g. "ros/loc/data"
   * @returns The complete MQTT topic, e.g. "r/robot1234/ros/loc/data"
   */
  _getTopic = (robotId, subtopic) => (
    'r/' + robotId + '/' + subtopic
  );

  /**
   *
   * @param {string} topic The MQTT topic ("r/<robotId>/...")
   * @param {Buffer} msg Raw message
   * @param {string} robotId RobotId for which the subscription was made. Note that topic SHOULD
   *  start with "r/<robotId>"
   * @returns
   */
  _handleMessage = (topic, msg) => {
    const topicParts = topic.split('/');
    const robotId = topicParts.length > 1 ? topicParts[1] : null;
    if (!robotId || topicParts[0] != 'r') {
      if (!(ERROR_BAD_TOPIC in this._logOnceErrors)) {
        console.error('Message callback from bad topic (LOGGED ONCE)', topic);
        this._logOnceErrors[ERROR_BAD_TOPIC] = Date.now();
      }
      return; // ignore message
    }
    if (!this.robotIds || !this.robotIds.includes(robotId)) {
      if (!(ERROR_BAD_ROBOT in this._logOnceErrors)) {
        console.error('Message callback from bad robot (LOGGED ONCE)', topic);
        this._logOnceErrors[ERROR_BAD_ROBOT] = Date.now();
      }
      return; // ignore message
    }
    const topicPrefix = 'r/' + robotId + '/';
    const subtopic = topic.substring(topicPrefix.length);
    if (subtopic in this._listeners) {
      this._listeners[subtopic].forEach((listener) => {
        try {
          // Invoke callback
          listener(msg, robotId);
        } catch (e) {
          console.error('Exception on listener for MQTT topic: ' + subtopic, e);
        }
      });
    }
  };

  /**
   * Returns a list of topics, for all current subscribers (subtopic) and all robotIds
   * we are listening to.
   */
  _getAllTopics = () => (
    flatMap(Object.keys(this._listeners).map(subtopic => (
      this.robotIds.map(robotId => this._getTopic(robotId, subtopic))
    )))
  )

  _handleConnection = () => {
    this._connected = true;
    this._logOnceErrors = {}; // reset logged errors
    // Subscribe to all MQTT topics for which we have listeners right away. Obtain the actual
    // MQTT topic adding the robotId to subtopics (keys of this._listeners)
    const topics = this._getAllTopics();
    console.log(`DirectClient: Connection established`);
    if (this.client && topics.length) {
      this.client.subscribe(topics, err => { 
        if (err) {
          console.error(`DirectClient: Error subscribing to topics: ${topics.join(', ')}`, err); 
        } else {
          console.log(`DirectClient: Subscribed to topics: ${topics.join(', ')}`);
        }
      });
    }
  };

  /**
   * Connect to the MQTT broker associated with a robot.
   * If any exception is thrown during while fetching the MQTT credentials
   * (including the case where the robot has no credentials) or why establishing
   * the connection, then another to attempt to connect will be made in 15 seconds.
   *    Connection attempts will be repeated until no exception is thrown or
   * the MqttBroker is garbage collected (_garbageCollect).
   *
   * @param {String} robotId the robot's id
   */
  async _connectToMqttBroker() {
    try {
      // NOTE: ts is used to generate the MQTT config token (or it should! encryption
      // was disabled in the server for now; crypto-browserify is not working here)
      const ts = Date.now();
      const tokens = await Meteor.callAsync('mqttConfig', { robotIds: this.robotIds, ts });
      if (!tokens.length) {
        throw new Error(`Couldn't get MQTT config for robots ${this.robotIds}`);
      } else if (tokens.length > 1) {
        throw new Error(`Multiple MQTT configs found for robots ${this.robotIds}. NOT IMPLEMENTED`);
      }
      const config = tokens[0];
      const protocol = config.websocket_protocol;
      const port = config.websocket_port;
      const credentials = { username: config.username, password: config.password };
      // If the server returns a config with a non-default mqtt topic prefix, use it: This
      // encapsulates the case of proxy robots (where the topic and messages this client
      // receives will be coming from a different robot)
      this.client = mqtt.connect(protocol + config.hostname + ':' + port, {
        ...credentials,
        reconnectPeriod: 0, // Disable automatic reconnect; we handle retries ourselves
      });
      this.client.on('connect', this._handleConnection);
      this.client.on('close', () => { console.log("DirectClient: Connection closed"); });
      this.client.on('message', (topic, msg) => this._handleMessage(topic, msg));
      this.client.on('error', (err) => {
        // Stop retrying on auth failures — credentials won't change without a new config fetch
        console.log("DirectClient: Error", err);
        if (err.message && err.message.includes('Not authorized')) {
          console.warn(`MqttWrapper: Not authorized for robot ${this.robotIds}, stopping retries`);
          if (this.client) {
            this.client.end();
            this.client = null;
          }
        }
      });
      console.info(`Successfully created MQTT client for robot ${this.robotIds}`);
    } catch (e) {
      console.error('Exception setting up data connection will retry in 15 seconds', e);
      this._retryConnectionTimer = setTimeout(() => this._connectToMqttBroker(), 15 * 1000);
    }
  }
}

/**
 * HOC stub — wraps a component with MQTT live data props.
 * Until MQTT is fully implemented, the wrapped component receives no extra props from this HOC.
 * @param {React.ComponentType} WrappedComponent
 * @param {Object} _config - { cacheKeys, subs } — ignored in stub
 */
/**
 * Hook stub — subscribes to multiple MQTT topics for multiple robots.
 * Returns an empty object until MQTT is implemented.
 * @param {Object} _config - { robotIds, topics } — ignored in stub
 */
const useDirectClientMulti = ({ robotIds, subtopic, typeString, decodeFunc }) => {
  const [data, setData] = useState({});

  useEffect(() => {
    // We need these two variables in this scope so that we can also have them
    // accessible in the start and stop functions
    let mqttInstance; // mqtt instance to connect to multiple robots
    let cb;
    let cancelled = false;

    // Since initialization code uses async/await, in order to use that inside
    // an effect, we must first create an async function and then call it.
    const start = async () => {
      const type = await getProtobufType(typeString);
      // If the effect was stopped already, don't proceed with the subscriptions
      if (cancelled) {
        return;
      }

      mqttInstance = MqttWrapper.GrabInstance(robotIds);
      cb = (msg, robotId) => {
        if (cancelled) {
          return;
        }
        let decodedMsg;
        if (type) {
          // protobuf-decode it
          decodedMsg = type.decode(msg);
        } else {
          // msg is a Uint8Array, convert to string
          // but do not decode it, pass it just as received it
          decodedMsg = msg.toString();
        }
        const update = decodeFunc(decodedMsg);
        if (!update) {
          // Ignore - filtered out by the decodeFunc
        } else if (!isObject(update) || isArray(update)) {
          console.warn('Non-object type returned from decodeFunc');
        } else if (!isEmpty(update)) {
          setData({ [robotId]: update });
        }
      };
      mqttInstance.registerListener(subtopic, cb);
    };

    // Make sure to unsubscribe and release MQTT instances on tear down or robotIds changes
    function stop() {
      cancelled = true;
      if (mqttInstance) {
        mqttInstance.unregisterListener(subtopic, cb);
        mqttInstance.release();
        mqttInstance = null;
      }
    }

    if (robotIds && isArray(robotIds) && robotIds.length > 0) {
      start();
    } else {
      console.warn('useDirectClientMulti called with an empty or missing robotIds parameter');
    }

    return stop;
    // NOTE If a new array instance with the same values is provided, this will trigger
    // the effect to re-run. This has a serious side-effect implication (creation of unnecessary
    // MQTT instance registrations) and for that reason we serialize the array for the purposes of
    // computing the dependency.
    // In general this is not a good practice, since it masks unnecessary re-renders with different
    // instances of the same arrays, but in this case we opt for the extra defensiveness to avoid
    // serious memory leaks.
  }, [robotIds, subtopic]);

  return data;
};

/**
 * Hook stub — subscribes to a single MQTT topic for a single robot.
 * Returns null until MQTT is implemented.
 */
export const useDirectClient = (_config) => {
  console.error("useDirectClient NOT IMPLEMENTED (use useDirectClientMulti instead)", _config);
  return null;
};

export const withDirectClient = (WrappedComponent, _config) => {
  const WithDirectClient = (props) => {
    // eslint-disable-next-line react/jsx-props-no-spreading
    return React.createElement(WrappedComponent, props);
  };
  WithDirectClient.displayName = `WithDirectClient(${WrappedComponent.displayName || WrappedComponent.name || 'Component'})`;
  return WithDirectClient;
};

export {
  MqttWrapper,
  useDirectClientMulti,
}