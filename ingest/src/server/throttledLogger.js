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
 * Logger that suppresses messages repeated in less than a configurable threshold
 */
import Cache from './simpleCache';

/**
 * Logger that suppresses messages repeated in less than a configurable threshold
 */
export default class ThrottledLogger {
  /**
   * Initializes the logger
   *
   * @param {number} size Seen messages buffer size
   * @param {number} throttlingMs Supress a message if it has been seen less than
   * throttlingMs ms ago.
   */
  constructor({ size = 500, throttlingMs = 60 * 1000 }) {
    this._seenKeys = new Cache({
      maxSize: size,
      maxAge: throttlingMs,
      createFunction: () => ({ shouldLog: true })
    });
  }

  /**
   * Outputs a message
   * @param {string} message
   */
  log = (key, message) => {
    const seen = this._seenKeys.get(`log.${key}`);
    if (seen.shouldLog) {
      seen.shouldLog = false;
      console.log(message);
    }
  };

  /**
   * Outputs a message as an error
   * @param {string} message
   */
  error = (key, message) => {
    const seen = this._seenKeys.get(`error.${key}`);
    if (seen.shouldLog) {
      seen.shouldLog = false;
      console.error(message);
    }
  };

  /**
   * Outputs a message as a warning
   * @param {string} message
   */
  warning = (key, message) => {
    const seen = this._seenKeys.get(`warning.${key}`);
    if (seen.shouldLog) {
      seen.shouldLog = false;
      console.warn(message);
    }
  };

  /**
   * Alias for compatibility with `console` interface.
   */
  warn = this.warning;
}
