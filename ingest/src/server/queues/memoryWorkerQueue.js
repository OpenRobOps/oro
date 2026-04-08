/**
 * In-memory implementation of the WorkerQueues interface.
 * 
 * This implementation allows to run the queue-based infrastructure in a single process, for simplicity of deployment.
 * It is recommended anyway that deployments use the RabbitMQ implementation, and separate the ingest
 * service from other services such as derived-attributes: this allows scaling them independently.
 * 
 * While it mimics RabbitMQ's API (and AMQP concepts), the implementation is quite limited as it does not support
 * every feature (e.g. exchange types, message acknoledgements). But for a small number of messages running in a 
 * single process, this implementation is enough. 
 * 
 * Also note that it DOES add some overhead as messages are still serialized/deserialized through protobuf in most
 * cases, but this is minimal and acceptable for our use case.
 * 
 * For comments on the interfaces see @BaseWorkerQueues
 */
import { isString, isEqual } from 'lodash';
// ORO modules
import { BaseWorkerQueues, OutMessageQueue } from './messageQueue';

class InMemoryWorkerQueues extends BaseWorkerQueues {
    constructor() {
        super();
        console.log('InMemoryWorkerQueues constructor');
        this.queues = {
            // map from queue name to { 
            //   callbacks: [] //  list of subscribers (callback functions)
            // }
        }
        this.exchanges = {}
        this.bindings = {
            // map from exchange name to a map from routing key to a list of queue objects
        }
    }

    buildExchange = (exchangeName, type, options = null) => {
        if (!isString(exchangeName)) {
          throw new Error('Exchange name must be a string');
        }
        if (!isString(type)) {
          throw new Error('Exchange type must be a string');
        }
        console.log(`Building exchange ${exchangeName} of type ${type}`);
        if (this.exchanges[exchangeName]) {
          // queue already exists. This is ok as long as we are attempting to recreate with SAME options
          if (!isEqual(options, this.exchanges[exchangeName].getOptions())) {
            throw new Error(`WorkerQueue: Error recreating queue ${exchangeName} with different options`);
          }
        } else {
          // For now we are only using 'direct' exchanges.
          this.exchanges[exchangeName] = new OutMessageQueue(this, exchangeName, options);
        }
        return this.exchanges[exchangeName];
    };


    /**
     * Publishes a message to an outgoing queue (aka. exchange).
     */
    doSend = (exchange, buffer, routingKey, options) => {
        if (!this.exchanges[exchange]) {
            throw new Error(`doSend: Exchange ${exchange} does not exist`);
        }
        if (!this.bindings[exchange]) {
            // No one listens for this exchange. 
            // TODO add a (throttled) warning?
            return;
        }
        // list of queues bound to this exchange through this routing key
        const bindings = this.bindings[exchange]?.[routingKey];
        // for all queues bound to this exchange, collect their callbacks
        const allCallbacks = bindings && bindings.reduce((acc, queue) => {
            const callbacks = this.queues[queue]?.callbacks;
            if (callbacks) {
                acc.push(...callbacks);
            }
            return acc;
        }, []);
        const subscribersCount = allCallbacks.length;
        this.log(`publishing ${buffer.length} bytes with ${routingKey} to ${exchange}; calling ${subscribersCount} callbacks`);
        // TODO delay this call (or just not await it?)
        for (const callback of allCallbacks) {
            try {
                callback({ content: buffer }); // missing to send: { fields, properties }
            } catch (error) {
                console.error(`Error calling queue ${queue} callback: ${error}`);
            }
        }
    };

    subscribeRaw = async (queueName, callback, noAck = true) => {
        console.log("subscribeRaw: subscribe to queue", queueName);
        if (!this.queues[queueName]) {
            throw new Error(`Queue ${queueName} does not exist`);
        }
        this.queues[queueName].callbacks.push(callback);
    }

    bindQueue = async (exchange, routingKey, queue, options = null) => {
        console.log(`bindQueue: bind exchange ${exchange}->${queue} queue with routing key "${routingKey}"`);
        if (!this.bindings[exchange]) {
            // "queue" does not exist, create it
            this.bindings[exchange] = {};
        }
        if (!this.bindings[exchange][routingKey]) {
            // "queue" does not exist, create it
            this.bindings[exchange][routingKey] = [];
        }
        this.bindings[exchange][routingKey].push(queue);
        // create the "queue", simply a list of callbacks as subscribers
        if (!this.queues[queue]) {
            this.queues[queue] = {
                callbacks: []
            };
        }
    }

    doAck = (message) => {
        // Ignore
    }
}

export default InMemoryWorkerQueues;