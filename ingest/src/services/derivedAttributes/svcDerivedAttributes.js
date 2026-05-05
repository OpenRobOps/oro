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

import { isObject, isString } from 'lodash';
import { loadSync } from 'protobufjs';
import path from 'path';
// ORO modules
import ThrottledLogger from '../../shared/throttledLogger';
import RobotDerivedAttributesDataProvider from './dataProvider';
import Cache from '../../server/simpleCache';
import RobotDerivedAttributesProcessor from './processor';
import cacheBuilder from '../../server/cacheFactory';

// Protobuf messages
const protoRoot = loadSync(path.join(__dirname, '../../server/queues/system.proto'));
const AttributesUpdate = protoRoot.lookupType('oro.system.AttributesUpdate');


class DerivedAttributesService {
    constructor({  }) {
      // Initialize data provider singleton. It's not used here but imported by
      // the different derived attrs functions
      this._dataProvider = new RobotDerivedAttributesDataProvider();
      // Some stats to print to console and export them to the configured monitoring backends,
      // showing how the service is running
      this._throttledLogger = new ThrottledLogger({
        size: 500,
        throttlingMs: 60 * 1000
      });
      // Logging and handling of slow derived attributes computations
      // this._slowMsgThresholdMs = jobParams.slowMsgThresholdMs;
      // this._slowDerivedAttributeWarningThresholdMs = jobParams.slowDerivedAttributeWarningThresholdMs;
      // this._slowDerivedAttributeSkipThresholdMs = jobParams.slowDerivedAttributeSkipThresholdMs;
      // this._skipSlowDerivedAttributeForMs = jobParams.skipSlowDerivedAttributeForMs;
  
      if (this._slowDerivedAttributeSkipThresholdMs && this._skipSlowDerivedAttributeForMs) {
        // Configure cache to track attributes to be skipped. The cache contains only attributes
        // that are being skipped, so 1000 seems to be a good size.
        this._derivedAttributesSkipCache = new Cache({
          maxSize: 1000,
          maxAge: this._skipSlowDerivedAttributeForMs
        });
      }
      // Build a cache (used to avoid re-evaluating functions in expressions), if enabled in settings
      const cacheSettings = { type: 'memory' }; // TODO make this configurable
      this._cache = cacheBuilder(cacheSettings);
      console.log('Using cache from:', cacheSettings, this._cache?.constructor?.name);
    }
  
    async init({ workerQueue = null }) {
      if (!workerQueue) {
        throw new Error('Worker queue is required');
      }
      // TODO make these constants configurable
      this.exchangeName = 'attributes';
      this.routingKey = 'update-values';
      this.queueName = 'derived-attributes';
      this._workerQueues = workerQueue;
      if (this._workerQueues) {
        this.subscribe();
      }
      // await this._dataProvider.init({
      //   timeseriesApi: new TimeseriesApi(this._settings.timeseriesHttpApi)
      // });
    //   this.peerHttpServer().addPostHandler(EVAL_EXPRESSION_API_PATH, this.handleEvalApi);
    }
  
    /**
     * Starts subscriptions to amqp queues
     */
    subscribe = () => {
      // If this service starts before ingest, build the exchange before attempting to bind the queue
      // (otherwise it fails and it would require retries logic)
      this._workerQueues.buildExchangeDirect(this.exchangeName);
      // Now bind the exchange to our own queue, and subscribe a listener for messages
      this._workerQueues.bindQueue(this.exchangeName, this.routingKey, this.queueName, { durable: true });
      // NOTE: Adding 'noACK = false' activates the manual ack mode for the consumer
      // this will allow to ack every message that the service is processing and re-queue
      // those messages that for unknown reasons the service couldn't process
      this._workerQueues.subscribeProto(
        this.queueName,
        this.processAttributesUpdate,
        AttributesUpdate,
        false
      );
    };
  
    /**
     * Callback from the message queue to process a set of attribute updates.
     */
    processAttributesUpdate = async ({ robotId, attributes: attributeValues }) => {
      const t0 = Date.now();
      if (!robotId || !isObject(attributeValues)) {
        if (this.logging) {
          console.error('Error processing incoming attributes update: missing fields');
        }
        return;
      }
      // TODO(herchu): in a near future, keep these attributes processors around so they can cache
      // configurations and attribute values
      // See TODO in handleEvalApi()
      const processor = new RobotDerivedAttributesProcessor({
        robotId,
        cache: this._cache,
        throttledLogger: this._throttledLogger
      });
      const stats = await processor.processUpdate(attributeValues);
      this._processUpdateStats(robotId, stats);
      const durationMs = Date.now() - t0;
      if (Number.isFinite(this._slowMsgThresholdMs)
        && durationMs > this._slowMsgThresholdMs) {
        this._throttledLogger.warning(robotId, `SLOW: Processing update for robot ${robotId} took ${durationMs}ms`);
      }
    };
  
    /**
     * Processes stats from a processUpdate() call. These stats include processing time for each
     * derived attribute. This method's main responsiblity is keeping track of slow derived attributes
     * and deciding if their processing should be skipped.
     * @param {string} robotId
     * @param {object} stats The format is { attributeId: { processingTimeMs } }
     */
    _processUpdateStats = (robotId, stats) => {
      if (!stats) {
        return;
      }
      // eslint-disable-next-line guard-for-in
      for (const attributeId in stats) {
        const {
          processingTimeMs,
        } = stats[attributeId] || {};
  
        if (Number.isFinite(this._slowDerivedAttributeWarningThresholdMs)
          && processingTimeMs > this._slowDerivedAttributeWarningThresholdMs) {
          // Report warnings about slow processing
          this._throttledLogger.warning(
            `${robotId}-${attributeId}`,
            `SLOW: Processing derived attribute ${attributeId} for robot ${robotId} took ${processingTimeMs}ms`
          );
        }
  
        if (Number.isFinite(this._slowDerivedAttributeSkipThresholdMs)
          && processingTimeMs > this._slowDerivedAttributeSkipThresholdMs
          && this._derivedAttributesSkipCache) {
          // Add attribute to set to be skipped for the next this._skipSlowDerivedAttributeForMs
          // because of slowness
          this._throttledLogger.error(
            `skip: ${attributeId}`,
            `Skipping processing of ${attributeId} for the following ${this._skipSlowDerivedAttributeForMs}ms`
          );
          this._derivedAttributesSkipCache.set(`${attributeId}`, true);
        }
      }
    };
  
    /**
     * HTTP API handler for POST on /api/v1/eval.
     * Implements endpoints callback to evaluate expressions.
     */
    handleEvalApi = async (req, res, server) => {
      const { body } = req;
      const { expression, robotId, attributes } = body;
      if (!isString(robotId) || !isString(expression)) {
        return this.writeResponse(res, false, 'invalid input values');
      }
      // If attributes are sent to the API for the eval
      // the handler maps them to the known structure for the service
      // { attrId: { value, ts }, ... }
      // TODO: Implement sending a ts in the request to override the ts of the eval and use
      // a user-defined ts, for now using date.now to avoid a "null"
      const ts = Date.now();
      const fixedAttributes = {};
      if (attributes) {
        Object.keys(attributes).forEach((attrId) => {
          fixedAttributes[attrId] = {
            value: attributes[attrId],
            ts
          };
        });
      }
      // TODO: in a near future, keep these attributes processors around so they can cache
      // configurations and attribute values
      // See TODO in DerivedAttributesService.processAttributesUpdate()
      const processor = new RobotDerivedAttributesProcessor({
        robotId,
        cache: this._cache,
        throttledLogger: new ThrottledLogger({}) // a new logger will log any error; it's just used for 1 call
      });
      try {
        const result = await processor.evaluateAdHocSafeExpression({
          expression,
          attributes: fixedAttributes
        });
        return server.writeResponse(res, true, JSON.stringify(result));
      } catch (e) {
        return server.writeResponse(res, false, e.message);
      }
    };
  }
  
  export default DerivedAttributesService;
  