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
