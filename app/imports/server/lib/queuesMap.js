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
 * Thin wrapper that builds SizedQueues lazily, keyed by some id.
 * All queues share the same configuration.
 */
import SizedQueue from './sizedQueue';

export default class QueuesMap {
  constructor(config) {
    this.config = config;
    this.queues = {};
  }

  get = (id) => {
    if (!this.queues[id]) {
      this.queues[id] = new SizedQueue(this.config);
    }
    return this.queues[id];
  };
}
