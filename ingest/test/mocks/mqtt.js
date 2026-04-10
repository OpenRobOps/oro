/**
 * Mock class for ../../server/mqtt.js InOrbitMqtt
 */
import assert from 'assert';
import { loadSync } from 'protobufjs';

/**
 * Mock class for ../../server/mqtt.js InOrbitMqtt
 */
export default class MqttMock {
  constructor() {
    this._protoRoot = loadSync('src/shared/oro.proto');
    this._publishedProtobuf = {};
    this._publishedProtobufCounts = {};
  }

  registerListener() {}

  lookupType(message) {
    return this._protoRoot.lookupType(message);
  }

  publishProtobuf(robotId, topic, msg) {
    console.log(`* mqtt#publishProtobuf(${robotId}, ${topic})`);
    // Save the last published msg
    this._publishedProtobuf[robotId] = this._publishedProtobuf[robotId] || {};
    this._publishedProtobuf[robotId][topic] = msg;
    // Count number of published messages per topic
    this._publishedProtobufCounts[robotId] = this._publishedProtobufCounts[robotId] || {};
    this._publishedProtobufCounts[robotId][topic] = this._publishedProtobufCounts[robotId][topic] || 0;
    this._publishedProtobufCounts[robotId][topic]++;
  }

  /**
   * Asserts that the last message for the `robotId` and `topic` published
   * using `publishProtobuf` matches `msg`.
   *
   * @param {String} robotId
   * @param {String} topic
   * @param {Object} msg Expected message
   * @param {String} errorMessage
   */
  assertPublishedProtobuf(robotId, topic, msg) {
    assert.ok(this._publishedProtobuf[robotId], `no message has been
      published for robotId = ${robotId} and topic = ${topic}`);
    assert.deepEqual(this._publishedProtobuf[robotId][topic], msg, `message
      published for robotId = ${robotId} and topic = ${topic} does not match expected`);
  }

  /**
   * Asserts that the last message for the `robotId` and `topic` published
   * using `publishProtobuf` matches `msg`.
   *
   * @param {String} robotId
   * @param {String} topic
   * @param {Object} expected number of
   * @param {String} errorMessage
   */
  assertPublishedProtobufCount(robotId, topic, count, msg) {
    assert.equal(
      (this._publishedProtobufCounts[robotId] && this._publishedProtobufCounts[robotId][topic]) || 0,
      count,
      `messages published to [${topic}] for robot [${robotId}] does not match!`
    );
  }
}
