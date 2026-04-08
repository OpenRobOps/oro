/**
 * Base class for message passing queues. It mostly wraps the AMQP client, some concepts and interfaces
 * are tied to AMQP.
 * 
 * TODO add subclass for AMQP.
 */
import path from 'path';
import { loadSync } from 'protobufjs';
// ORO imports
import { isString, isEqual, isObject } from 'lodash';
import { valuesMapToVariant } from '../../lib/util';

// Queue names
const QUEUES = {
    // A reserved 'system' queue where ingests and other parts of our system can send system msgs
    // (modules starting, etc)
    SYSTEM: 'system',
    // Channel used to send robot attributes information, including value updates
    ATTRIBUTES: 'attributes',
    POSES: 'robot-poses'
};

// TODO(herchu) Move some of these elsewhere (see comment in sendAttributesUpdate)
const protoRoot = loadSync(path.join(__dirname, './system.proto'));
const attributesUpdateMessage = protoRoot.lookupType('oro.system.AttributesUpdate');
const poseUpdateMessage = protoRoot.lookupType('oro.system.PoseUpdate');

/*
 * AMQP constants
 */
const EXCHANGE_DIRECT = 'direct';
const EXCHANGE_FANOUT = 'fanout';
const EXCHANGE_TOPIC = 'topic';
const EXCHANGE_HEADERS = 'headers';

/**
 * Object containing routing keys for various update types.
 */
const ROUTING_KEYS = {
    /**
     * Routing key for attribute value updates.
     * @type {string}
     */
    ATTRIBUTE_VALUE_UPDATES: 'update-values',
  
    /**
     * Function to build routing key for pose updates.
     * @type {Function}
     * @param {string} frameId
     * @returns {string} The routing key formatted as 'pose/<frameId>'.
     */
    POSE_UPDATES: (frameId) => `pose/${frameId}`
}

// Helper function to get a timestamp in microseconds
function getMicSecTime() {
    const hrTime = process.hrtime();
    return hrTime[0] * 1000000 + parseInt(hrTime[1] / 1000);
  }
  

class BaseWorkerQueues {
    constructor() {
        
    }

    async init({ logging = false}) {
        if (logging) {
            this.log = console.log;
        }
    }

    doSend(message, buffer, routingKey, options) {
        // TODO: Implement
        console.log('send', message, buffer, routingKey, options);
    }

    buildExchange = (name, type, options = null) => {
        throw new Error('buildExchange: Implemented by subclass');
    }

    buildExchangeDirect = (name, options = null) => (
        this.buildExchange(name, EXCHANGE_DIRECT, options || { durable: true })
    );

    buildExchangeTopic = (name, options = null) => (
        this.buildExchange(name, EXCHANGE_TOPIC, options || { durable: true })
    );

    buildExchangeFanout = (name, options = null) => (
        this.buildExchange(name, EXCHANGE_FANOUT, options || { durable: true })
    );

    buildExchangeHeaders = (name, options = null) => (
        this.buildExchange(name, EXCHANGE_HEADERS, options || { durable: true })
    );
    
    bindQueue = async (exchange, routingKey, queue, options = null) => {
        throw new Error('bindQueue: Implemented by subclass');
    }

  /**
   * Subscribes to messages from a given queue (by name). The callback will receive an object
   * `{ content, fields, properties }` unmodified from amqplib; where `content` is a Buffer.
   *
   * Normally clients will want to use subscribeJson or subscribeProto instead, as they parse
   * incoming messages.
   */
  subscribeRaw = async (queue, callback, noAck = true) => {
    throw new Error('subscribeRaw: Implemented by subclass');
  }

  /**
   * Subscribes to a queue, expecting messages encoded using protobuf. It uses `prototype` as the
   * protobuf class to decode messages.
   * Sends decoded objects to `callback` function.
   */
  subscribeProto = (queue, callback, prototype, noAck = true) => {
    this.subscribeRaw(queue, async (message) => {
      const { content, fields, properties } = message;
      let obj;
      try {
        const msg = prototype.decode(content);
        // Note that `msg` is a protobuf Message (type `prototype`) object from protobuf; this is
        // the type returned by decode() calls.
        // However, Messages are not convenient to our own code when we want to distinguish
        // a default value from an absent value. For example in attribute updates, the check
        // `"stringValue" in update` is true if the value is really `""` or if the value is absent.
        // So in order to distinguish which fields are present or not, we do a conversion
        // to a plain old JS object - see https://github.com/protobufjs/protobuf.js
        // Note that this could be an optional step - now it is always done since we never need
        // the original Message object in our code.
        obj = prototype.toObject(msg, { defaults: false });
        // TODO(herchu) Log parsing time t1-t0 in some metrics service
      } catch (e) {
        // TODO(herchu) Remove this logging or log only once in a while
        console.error(` [!] Error parsing protobuf payload: ${e.message}`, content.toString().substr(0, 30));
        return !noAck && this.doAck(message);
      }
      try {
        await callback(obj, fields, properties);
      } catch (e) {
        // TODO(herchu) Remove this logging or log only once in a while
        console.error(` [!] Error in protobuf callback: ${e.message}`, e);
      }
      return !noAck && this.doAck(message);
    }, noAck);
  };

  /**
   * Subscribes to a queue, expecting messages in JSON format,
   * and sends decoded objects to `callback` function.
   */
  subscribeJson = (queue, callback, noAck = true) => {
    this.subscribeRaw(queue, async (message) => {
      const { content, fields, properties } = message;
      let obj;
      try {
        obj = JSON.parse(content.toString());
        // TODO(herchu) Log parsing time t1-t0 in some metrics service
      } catch (e) {
        const str = (content && content.toString()) || '';
        // TODO(herchu) Remove this logging or log only once in a while
        console.error(` [!] Error parsing JSON payload: ${e.message} (${str.substr(0, 30)})`);
        return !noAck && this.channel && this.channel.ack(message);
      }
      try {
        await callback(obj, fields, properties);
      } catch (e) {
        console.error(` [!] Error in JSON callback: ${e.message}`, e);
      }
      return !noAck && this.doAck(message);
    }, noAck);
  };

  doAck = (message) => {
    throw new Error('doAck: Implemented by subclass');
  }

  /**
   * Publishes a message to an outgoing queue (aka. exchange).
   */
  doSend = (queue, buffer, routingKey, options) => {
    throw new Error('doSend: Implemented by subclass');
  };

  /**
   * Wrapper of console.log(), to be replaced only if logging is enabled
   */
  // eslint-disable-next-line class-methods-use-this
  log = () => {};
}



/**
 * Class to represent individual message queues; instantiated with a name (the amqp queue name).
 *
 * This is a convenience class so throughout our system we keep reference to MessageQueue objects.
 * Calls to sendJson() on this object simply relay on the main WorkerQueue object to send the
 * message to the queue that this object represents.
 * 
 * Constants and methods defined here correspond to the creation of messages from ingest service
 * (e.g. attributes updates).
 *
 * NOTE on RabbitMQ internals: While this class is seen as a message _queue_, it wraps an amqp
 * _exchange_, which later sends its messages to a queue.
 */
class OutMessageQueue {
    constructor(owner, name, options) {
      this.name = name;
      this.owner = owner;
      this.options = { ...options }; // make a copy of queue options, for later validation
    }
  
    /**
     * Generic call to sends a message to the queue, serializing the payload in JSON format.
     */
    sendJson = async (object, routingKey, options) => {
      const t0 = getMicSecTime();
      const buf = Buffer.from(JSON.stringify(object));
      const t1 = getMicSecTime();
      this.owner.log(`sendJson ${buf.length} bytes, ${t1 - t0}us`);
      return this.owner.doSend(this.name, buf, routingKey, options);
    };
  
    /**
     * Generic call to sends a message to the queue, serializing the payload using protobuf, with
     * `prototype` message class.
     */
    sendProto = async (object, prototype, routingKey, options) => {
      const t0 = getMicSecTime();
      const binaryPayload = prototype.encode(object).finish();
      const t1 = getMicSecTime();
      this.owner.log(`sendProto ${binaryPayload.length} bytes, ${t1 - t0}us`);
      return this.owner.doSend(this.name, binaryPayload, routingKey, options);
    };
  
    /**
     * Sends out an attribute values update to the outgoing queue.
     * NOTE(herchu) Consider moving this method to a more specific subclass or helper object (this
     * logic is not part of WorkerQueue)
     * @param {string} robotId
     * @param {object} attrValues - An object containing attribute values to update.
     * @param {number} ts - Optional, if present overrides the ts of the attrValues
     * @throws Will throw an error if `robotId` is not provided.
     * @throws Will throw an error if `attrValues` is not an object.
     * @returns {Promise} The result of the message queue send operation.
     */
    sendAttributesUpdate = async (robotId, attrValues, ts = 0) => {
      if (!robotId) {
        throw new Error('robotId is not provided');
      }
      if (!isObject(attrValues)) {
        throw new Error('attrValues must be an object');
      }
      if (ts) {
        for (const key in attrValues) {
          if (key in attrValues && !attrValues[key].ts) {
            attrValues[key].ts = ts;
          }
        }
      }
      const object = {
        robotId,
        attributes: valuesMapToVariant(attrValues)
      };
      return this.sendProto(
        object,
        attributesUpdateMessage,
        ROUTING_KEYS.ATTRIBUTE_VALUE_UPDATES
      );
    };
  
    /**
     * Sends a pose update message to the message queue.
     * @param {string} robotId
     * @param {object} pose - An object containing pose data to update.
     * @param {number} ts - Optional, if present overrides the ts of the pose
     * @throws Will throw an error if `robotId` is not provided
     * @throws Will throw an error if `pose` is not an object.
     * @returns {Promise} The result of the message queue send operation.
     */
    sendPoseUpdate = async (robotId, pose, ts = 0) => {
      if (!robotId) {
        throw new Error('robotId is not provided');
      }
      if (!isObject(pose)) {
        throw new Error('pose must be an object');
      }
      if (ts && !pose.ts) {
        pose.ts = ts;
      }
      const { frameId } = pose;
      const object = {
        robotId,
        ...pose
      };
      // Send the message using the pose message queue
      return this.sendProto(
        object,
        poseUpdateMessage,
        ROUTING_KEYS.POSE_UPDATES(frameId)
      );
    };
  
    /** *
     * Returns the options initially used to create the channel. Used by WorkerQueue just to validate
     * we do not attempt to create a channel twice, with different (conflicting) options.
     */
    getOptions = () => this.options;
}

export { 
    QUEUES,
    BaseWorkerQueues,
    OutMessageQueue,
}