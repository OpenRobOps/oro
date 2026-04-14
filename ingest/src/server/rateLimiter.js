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
 * Simple object to allow rate limiting of incoming messages from agents.
 * It keeps a last-message-processed timestamp per source id (a robotId), and
 * returns `true` on an accepts() method at most once per minute (by default).
 *
 * See usage in localization mqtt module.
 *
 * TODO(herchu) Replace by a npm package e.g. limiter
 *
 */
import objectHash from 'object-hash';
import { isString } from 'lodash';

// Max update interval: one per minute by default
const MIN_DATA_INTERVAL = 1000 * 60;

class RateLimiter {
  constructor(minDataInterval = MIN_DATA_INTERVAL) {
    this._lastDataTsById = {};
    this._minDataInterval = minDataInterval
  }

  /**
   * Tells if an incoming messagefrom `fromId` should be processed, according
   * to a rate limiting policy.
   * If it returns `true`, it also updates an internal timestamp; so it will
   * not return true again until after a whole minute (or whatever min interval was
   * configured).
   */
  accepts = (fromId, now = Date.now()) => {
    const key = isString(fromId) ? fromId : objectHash(fromId);
    if (!(key in this._lastDataTsById)
        || (now - this._lastDataTsById[key]) >= this._minDataInterval) {
      // First messge, or timer expired. Accept it and update timestamp
      this._lastDataTsById[key] = now;
      return true;
    }
    return false;
  };

  /**
   * Forgets a last-seen timestamp from `fromId`, so that next message will
   * forcefully be accepted.
   */
  reset = (fromId) => {
    const key = isString(fromId) ? fromId : objectHash(fromId);
    delete this._lastDataTsById[key];
  };
}

export default RateLimiter;
