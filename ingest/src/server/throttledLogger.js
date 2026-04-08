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
}
