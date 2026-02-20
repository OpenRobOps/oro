/**
 * Time Utils
 * Contains various utility functions for the management of time information
 * accross the application's front end.
 */
import moment from 'moment';
import { useState, useEffect } from 'react';
import { isFinite } from 'lodash';
import PropTypes from 'prop-types';
// ORO Modules

const LIVE_TIME = 'live';

const MILLIS_IN_SECOND = 1000;
const MILLIS_IN_MINUTE = 60000;
const MILLIS_IN_HOUR = 3600000;
const MILLIS_IN_DAY = 86400000;
const MILLIS_IN_WEEK = 604800000;
const MILLIS_IN_MONTH = 2628000000;

const LABELS_SECOND = ['sec', 'sec', 's'];
const LABELS_MINUTE = ['min', 'min', 'm'];
const LABELS_HOUR = ['hour', 'hr', 'h'];
const LABELS_DAY = ['day', 'day', 'd'];
const LABELS_WEEK = ['week', 'wk', 'w'];
const LABELS_MONTH = ['month', 'mo', 'm'];
const LABELS_CUSTOM = ['custom', 'cst', 'c'];

const PERIOD_SECOND = 'sec';
const PERIOD_MINUTE = 'min';
const PERIOD_HOUR = 'hour';
const PERIOD_DAY = 'day';
const PERIOD_WEEK = 'week';
const PERIOD_MONTH = 'month';
const PERIOD_CUSTOM = 'custom';

const PERIODS = {
  [PERIOD_SECOND]: {
    timeframeSeconds: 1,
    intervalSeconds: 0.01,
    xAxisFormat: '%S'
  },
  [PERIOD_MINUTE]: {
    timeframeSeconds: 60,
    intervalSeconds: 1,
    xAxisFormat: '%M'
  },
  [PERIOD_HOUR]: {
    timeframeSeconds: 3600,
    intervalSeconds: 60,
    xAxisFormat: '%I:%M %p'
  },
  [PERIOD_DAY]: {
    timeframeSeconds: 86400,
    intervalSeconds: 1440,
    xAxisFormat: '%I:%M %p'
  },
  [PERIOD_WEEK]: {
    timeframeSeconds: 86400 * 7,
    intervalSeconds: 5760,
    xAxisFormat: '%m-%d %I %p'
  },
  [PERIOD_MONTH]: {
    timeframeSeconds: 86400 * 28,
    intervalSeconds: 5760 * 6,
    xAxisFormat: '%m-%d %I %p'
  }
};

const StartTsPropType = PropTypes.oneOfType([PropTypes.oneOf([LIVE_TIME]), PropTypes.number]);

/**
 * Gets the period arguments for rendering of timelines
 * utilizing a passed timeRangeMs.
 * It does not have the same checks as getPeriod, as it is
 * used for X axis of the timelines, not for calculations of timeframes and such
 * @param {Number} timeRangeMs
 * @returns PERIODS argument object
 */
function getPeriodPropsCopy(timeRangeMs) {
  let newPeriod;
  if (timeRangeMs <= MILLIS_IN_SECOND) {
    newPeriod = PERIOD_SECOND;
    // If second range is less than a minute
  } else if (timeRangeMs <= MILLIS_IN_MINUTE) {
    newPeriod = PERIOD_MINUTE;
    // If second range is less than an hour
  } else if (timeRangeMs <= MILLIS_IN_HOUR) {
    newPeriod = PERIOD_HOUR;
    // If second range is less than a day
  } else if (timeRangeMs <= MILLIS_IN_DAY) {
    newPeriod = PERIOD_DAY;
    // If second range is less than a week
  } else if (timeRangeMs <= MILLIS_IN_WEEK) {
    newPeriod = PERIOD_WEEK;
    // If second range is more than a week
  } else {
    newPeriod = PERIOD_MONTH;
  }
  return { ...PERIODS[newPeriod] };
}

const PAGE_LAST = 'last';
const PAGE_NEXT = 'next';
const PAGE_PREV = 'prev';

function isLive(endTs) {
  return (!endTs || endTs === LIVE_TIME);
}

/**
 * Computes the actual absolute start timestamp from a time range specification.
 * The timestamp can be simply the same `startTs` given as argument
 * for fixed time ranges, or "`timeRangeMs` ago" for live ranges.
 *
 * @param {number} startTs
 * @param {number} nowTs
 * @returns {Number} valid startTs value (timestamp)
 */
function getAbsoluteStartTs(startTs, timeRangeMs, nowTs) {
  if (!timeRangeMs) {
    throw Error(`getAbsoluteStartTs: called without necessary params timeRangeMs: ${timeRangeMs}`);
  }
  const nowTime = nowTs || Date.now();
  return isLive(startTs) ? (nowTime - timeRangeMs) : startTs;
}

/**
 * Calculate period of time (hour/day/week/etc) from a given timeRange in milliseconds
 * @param {Number} timeRangeMs
 * @returns {Array} Array of 2 values: [periodLabel, periodOptionsObject]
 * @periodLabel {String} a period label (hour, day, week, etc)
 * @periodOptions {Object} an object with reference to various options that are period specific
 * Example return:
 * [ 'hour', {
 *  timeframeHours: 1,
 *  intervalMins: 1,
 *  xAxisFormat: '%I:%M %p'
 * }]
 */
function getPeriod(timeRangeMs) {
  if (!timeRangeMs) {
    throw new Error('getPeriod: Missing parameter timeRangeMs');
  }
  let period = '';
  // For time ranges, we do some rounding to the closest time range,
  // if none of the time ranges are close enough to the custom time range
  // we utilize the "custom" period time range
  // 0.9 hours to 1.10 hours => rounded to 1hour
  // 0.9 seconds to 1.10 seconds => rounded to 1second
  if (timeRangeMs > MILLIS_IN_SECOND * 0.9
    && timeRangeMs < MILLIS_IN_SECOND * 1.1) {
    period = PERIOD_SECOND;
    // 0.9 minutes to 1.10 minutes => round to 1minute
  } else if (timeRangeMs > MILLIS_IN_MINUTE * 0.75
    && timeRangeMs < MILLIS_IN_MINUTE * 1.25) {
    period = PERIOD_MINUTE;
    // 0.9 hour to 1.10 hour => round to hour
  } else if (timeRangeMs > MILLIS_IN_HOUR * 0.75
    && timeRangeMs < MILLIS_IN_HOUR * 1.25) {
    period = PERIOD_HOUR;
    // 0.9 days to 1.10 days => round to Day
  } else if (timeRangeMs > MILLIS_IN_DAY * 0.9
    && timeRangeMs <= MILLIS_IN_DAY * 1.10) {
    period = PERIOD_DAY;
    // If minute range is less than a week
  } else if (timeRangeMs > MILLIS_IN_WEEK * 0.9
    && timeRangeMs <= MILLIS_IN_WEEK * 1.10) {
    period = PERIOD_WEEK;
    // 0.9 month to 1.10 month => round to Month
  } else if (timeRangeMs > MILLIS_IN_MONTH * 0.9
    && timeRangeMs <= MILLIS_IN_MONTH * 1.1) {
    period = PERIOD_MONTH;
    // time range out of defined ranges, using custom identifier
  } else {
    period = PERIOD_CUSTOM;
  }
  const periodArgs = getPeriodPropsCopy(timeRangeMs);
  return [period, periodArgs];
}

/**
 * Returns the periods interval in milliseconds.
 * @param {String} period label
 * @returns {Number} minutes corresponding to the period
 */
function getIntervalInMs(period) {
  switch (period) {
    case PERIOD_MONTH:
      return MILLIS_IN_MONTH;
    case PERIOD_WEEK:
      return MILLIS_IN_WEEK;
    case PERIOD_DAY:
      return MILLIS_IN_DAY;
    case PERIOD_HOUR:
      return MILLIS_IN_HOUR;
    case PERIOD_MINUTE:
      return MILLIS_IN_MINUTE;
    case PERIOD_SECOND:
      return MILLIS_IN_SECOND;
    case PERIOD_CUSTOM:
      // Period custom is not clickable, if it were by accident, set to default day period
      return MILLIS_IN_DAY;
    default:
      console.error(`getIntervalInMs: unrecognized period: ${period}`);
      return MILLIS_IN_HOUR;
  }
}

/**
 * Returns a timestamp equivalent of negative a day from now.
 * @param {*} nowTs, optional timestamp to be used as "now"
 * @returns timestamp of now - one day
 */
const getDefaultStartTs = nowTs => (
  moment(nowTs || undefined).subtract(1, 'days').valueOf()
);

/**
 * Default timerange constructor for the client.
 * @returns {Number} 1 day in milliseconds
 */
const getDefaultTimeRangeMs = () => moment.duration(1, 'days').valueOf();

/**
 * Calculate an endTs from nowTs, startTs, and timeRangeMs.
 * EndTs would be the ending point timestamp of the timeframe that is being
 * defined by startTs and timeRangeMs.
 * NowTs is required in case we are in live mode
 * @param {number} nowTs
 * @param {number} startTs
 * @param {number} timeRangeMs
 * @returns {number} endTs
 */
const getAbsoluteEndTs = (startTs, timeRangeMs, nowTs) => {
  if (isLive(startTs)) {
    if (!nowTs) {
      throw Error('Missing nowTs in getAbsoluteEndTs call.');
    }
    return nowTs;
  } else {
    if (!timeRangeMs) {
      throw Error('Missing timeRangeMs in getAbsoluteEndTs call.');
    }
    return startTs + timeRangeMs;
  }
};

/**
 * Prepares the time context variables for querying by verifying
 * values are numbers, have proper values, and if necessary utilize
 * default values
 * @param {String/Number} startTs can be live constant or number
 * @param {Number} timeRangeMs
 * @param {Number} nowTs
 * @returns {Object} {timeRangeMs, nowTs, startTs, endTs}
 */
function prepareTimeVarsForQuery(startTs, timeRangeMs, nowTs) {
  if (!timeRangeMs) {
    timeRangeMs = getDefaultTimeRangeMs();
  }
  if (!isFinite(timeRangeMs)) {
    console.error('prepareTimeVarsForQuery: timeRangeMs was not a number', timeRangeMs);
    timeRangeMs = getDefaultTimeRangeMs();
  }
  if (!isFinite(nowTs)) {
    console.error('prepareTimeVarsForQuery: nowTs was not a number', nowTs);
    nowTs = Date.now();
  }

  startTs = getAbsoluteStartTs(startTs, timeRangeMs, nowTs);

  const endTs = getAbsoluteEndTs(startTs, timeRangeMs, nowTs);

  return {
    timeRangeMs, nowTs, startTs, endTs
  };
}

/**
 * Prepares the time context variables for querying by verifying
 * values are numbers, have proper values, and if necessary utilize
 * default values.
 *
 * This function is similar to prepareTimeVarsForQuery, except it is "optimized" for widgets that
 * work source data from Publications, and support "Live" mode: If the query is live (see isLive()
 * for startTs) then it returns a fixed startTs and NO endTs; and these will not change even if
 * nowTs changes (which normally happens, from NowTimeContext). This allows subscribing to an open
 * time range, and let Meteor find new elements as they appear. It may be slightly inaccurate if
 * a window is left open for a long time (e.g. more elements than the strictly requested could
 * remain minimongo, the oldest ones) but this is much better than recreating subscriptions; and
 * the client code should always filter elements from a subscription anyway.
 *
 * It is a hook, not a regular function, since it keeps internal state (useState).
 *
 * @param {String/Number} startTs can be live constant or number
 * @param {Number} timeRangeMs
 * @param {Number} nowTs
 * @returns {Object} { timeRangeMs, nowTs, startTs, endTs }
 */
const useTimeVarsForLiveQuery = (startTs, timeRangeMs, nowTs, maxLookbackHours = 0) => {
  const [timeRange, setTimeRange] = useState({});

  useEffect(() => {
    const startTsCapped = maxLookbackHours
      ? Math.max(
        Number.isFinite(startTs) ? startTs : 0,
        nowTs - maxLookbackHours * MILLIS_IN_HOUR
      )
      : startTs;
    if (!isLive(startTs)) {
      // If there is a fixed timeframe, just use it and behave like prepareTimeVarsForQuery.
      setTimeRange(prepareTimeVarsForQuery(startTsCapped, timeRangeMs, nowTs));
    } else {
      // When there is no startTs, this is a "live" widget. Decide an initial startTs as of now,
      // leave endTs open (no end), and *do not change startTs* anymore, even when nowTs changes
      const { startTs: calcStartTs } = prepareTimeVarsForQuery(startTsCapped, timeRangeMs, nowTs);
      setTimeRange({ startTs: calcStartTs, endTs: undefined });
    }
  }, [startTs, timeRangeMs]);

  return timeRange;
};


/**
 * Given a startTime (startTs) value, makes sure it is a number or the live constant
 * @param {Number/String} startTime can either be "live", a string number or a number.
 * @returns either "live" or a number value timestamp
 */
function validateStartTime(startTime) {
  if (startTime === LIVE_TIME || startTime === undefined) {
    return LIVE_TIME;
  } else {
    const numberStartTime = Number(startTime);
    if (!isFinite(numberStartTime)) {
      console.error('validateStartTime: invalid start time value, using default', startTime);
      return getDefaultStartTs();
    }
    return numberStartTime;
  }
}

export {
  // functions
  isLive,
  getAbsoluteStartTs,
  getPeriod,
  getDefaultStartTs,
  getDefaultTimeRangeMs,
  getDefaultTimeRangeMsForTC,
  getAbsoluteEndTs,
  validateStartTime,
  prepareTimeVarsForQuery,
  useTimeVarsForLiveQuery,
  getIntervalInMs,
  // constants
  LIVE_TIME,
  LABELS_CUSTOM,
  LABELS_DAY,
  LABELS_HOUR,
  LABELS_MINUTE,
  LABELS_MONTH,
  LABELS_SECOND,
  LABELS_WEEK,
  MILLIS_IN_DAY,
  MILLIS_IN_HOUR,
  MILLIS_IN_MINUTE,
  MILLIS_IN_MONTH,
  MILLIS_IN_SECOND,
  MILLIS_IN_WEEK,
  PERIODS,
  PERIOD_SECOND,
  PERIOD_MINUTE,
  PERIOD_HOUR,
  PERIOD_DAY,
  PERIOD_WEEK,
  PERIOD_MONTH,
  PERIOD_CUSTOM,
  PAGE_LAST,
  PAGE_NEXT,
  PAGE_PREV,
  StartTsPropType,
};
