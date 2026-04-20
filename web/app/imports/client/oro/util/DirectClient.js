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
 *
 * TODO: Implement full MQTT connection using the broker credentials from the ORO server.
 */
import React from 'react';

const instances = {};

class MqttInstance {
  constructor(robotId) {
    this.robotId = robotId;
    this._refCount = 0;
  }

  /**
   * Publish a protobuf-encoded message to a robot topic.
   * @param {string} subtopic - e.g. 'ros/teleop/go'
   * @param {object} message - plain object matching the proto schema
   * @param {string} typeName - protobuf type name, e.g. 'TeleopGoCommand'
   */
  publishProtobuf(subtopic, message, typeName) {
    // TODO: Implement protobuf encoding and MQTT publish
    console.warn('[DirectClient] publishProtobuf not yet implemented', subtopic, typeName, message);
  }

  release() {
    this._refCount -= 1;
    if (this._refCount <= 0) {
      delete instances[this.robotId];
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
export const useDirectClientMulti = (_config) => {
  return {};
};

/**
 * Hook stub — subscribes to a single MQTT topic for a single robot.
 * Returns null until MQTT is implemented.
 */
export const useDirectClient = (_config) => {
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

export const Mqtt = {
  /**
   * Returns a shared MqttInstance for the given robotId.
   * Increments the reference count each time it is called.
   */
  grabInstance(robotId) {
    if (!robotId) return null;
    if (!instances[robotId]) {
      instances[robotId] = new MqttInstance(robotId);
    }
    instances[robotId]._refCount += 1;
    return instances[robotId];
  }
};
