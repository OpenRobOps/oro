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
 * Queue with a maximum capacity (oldest entry evicted on push) and optional
 * timestamp-based expiration.
 */

const DEFAULT_TIMESTAMP_FIELD = 'ts';
const MAX_CAPACITY = 20;

const removeOldestEntry = (entries) => {
  entries.splice(0, 1)[0];
};

export default class SizedQueue {
  constructor({ expirationTimeMs, timestampField, maxCapacity }) {
    this.expirationTimeMs = expirationTimeMs;
    this.expirationModeEnabled = this.expirationTimeMs && this.expirationTimeMs > 0;
    this.timestampField = timestampField || DEFAULT_TIMESTAMP_FIELD;
    this.capacity = maxCapacity || MAX_CAPACITY;
    this.entries = [];
  }

  getItemTimestamp = item => item[this.timestampField];

  isANonExpiredItem = item => this.now - this.getItemTimestamp(item) < this.expirationTimeMs;

  /**
   * Returns a ref to the queue's internal array (mutations affect the queue).
   * Expired items are evicted before returning when expirationTimeMs is set.
   */
  getValues = (now = Date.now()) => {
    this.now = now;
    if (this.expirationModeEnabled && this.entries.length > 0) {
      this.entries = this.entries.filter(this.isANonExpiredItem);
    }
    return this.entries;
  };

  push = (value) => {
    if (value && (!this.expirationModeEnabled
      || (this.expirationModeEnabled && typeof this.getItemTimestamp(value) === 'number'))) {
      if (this.entries.length >= this.capacity) {
        removeOldestEntry(this.entries);
      }
      this.entries.push(value);
    }
  };
}
