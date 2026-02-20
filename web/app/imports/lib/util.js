/**
 * Util functions
 */
import moment from 'moment';
import momentDurationFormatSetup from 'moment-duration-format';
import convert from 'convert-units';
import { isArray, isObject, isString, isBoolean, isEqual, isEmpty, isNumber } from 'lodash';

// moment-duration-format works as a plugin on top of moment package;
// it needs to modify the base `moment` lib. See:
// https://www.npmjs.com/package/moment-duration-format
momentDurationFormatSetup(moment);

const MILLIS_IN_DAY = 86400000;
const MILLIS_IN_HOUR = 3600000;
const MILLIS_IN_MIN = 60000;

const DATE_FORMAT_FULL = 'YYYY-MM-DD';
const DATE_FORMAT_RECENT = 'MM/DD';

/**
 * String used in CustomDataWidget to identify the values undefined
 */
const UNDEFINED_VALUE = '--';
/**
 * Applies values from defaults into obj, recursively, in place.
 *
 * It only goes recursively over objects, not arrays,
 * Strings or Numbers.
 *
 * Returns the resulting object with applied results (even though
 * it's also modified in place).
 */
const applyDefaults = (obj, defaults) => {
  for (const key in defaults) {
    if (key in obj) {
      if (isObject(obj[key]) && !isArray(obj[key])) {
        obj[key] = applyDefaults(obj[key], defaults[key]);
      }
    } else {
      obj[key] = defaults[key];
    }
  }
  return obj;
};

/**
 * Removes keys with null values from the given object recursively
 * It searches for any null value and deletes it from the object
 * returns the same object with the nulls removed.
 */
const cleanNulls = (obj) => {
  if (!isObject(obj)) {
    return obj;
  }
  Object.keys(obj).forEach((key) => {
    if (isObject(obj[key]) && !isArray(obj[key])) {
      obj[key] = cleanNulls(obj[key]);
    } else if (obj[key] === null) {
      delete obj[key];
    }
  });
  return obj;
};

/**
 * Simple function to capitalize the first letter of a string
 */
const capitalizeString = string => (string.charAt(0).toUpperCase() + string.slice(1));

/**
 * Flattens a given source object into dot notation, for key-by-key
 * insertion or modification in Mongo
 */
const toDotNotation = (source, prefix, target = {}) => {
  for (const key in source) {
    if (key) {
      const targetKey = prefix === undefined ? key : prefix + '.' + key;
      if (isObject(source[key]) && !isArray(source[key])) {
        toDotNotation(source[key], targetKey, target);
      } else {
        target[targetKey] = source[key];
      }
    }
  }
  return target;
};

/**
 * Like Object.assign, but it returns a value (object) only if any
 * of the fields did change -- Otherwise it will return null.
 * It replaces only the fields in 'keys' array.
 *
 * keys can contain strings (field names) or objects with
 * {field:string, fn:function}. In this case the function is applied
 * to source[obj.field].
 * If no keys are given (keys if false-ish), all keys in `source` object
 * are assigned (if distinct, of course)
 *
 * This is helpful during react components' getDerivedState(),
 * to avoid unnecessarily changing the state when new props are not
 * different from current state.
 *
 * Example:
 * target = {
 *   a: 1, b: 2, c: 3, d: "hello"
 * }
 * source = {
 *   a: 1, b: "2.5", c: "3.1", garbage: "ignored" }
 * }
 * keys = [ "a", // Simply assigned if different
 *          { field: "b", fn: Number },  // Parsed as Number before comparing
 *          { field: "c", fn: Number.parseFloat }, // Parsed with parseFloat before comparing
 *        ]
 * assignIfDistinct(target, source, keys) ==> { b: 2.5, c: 3.1 }
 *
 */
const assignIfDistinct = (target, source, keys) => {
  let changed = false;
  const ret = {};
  if (!keys) {
    keys = Object.keys(source);
  }
  keys.forEach((key) => {
    const field = key.field || key;
    const newVal = key.fn
      ? key.fn(source[field]) // there is a function to apply
      : source[field]; // simply take the field
    if (!isEqual(target[field], newVal)) {
      changed = true;
      ret[field] = newVal;
    }
  });
  return changed ? ret : null;
};

/**
 * Returns the number of keys with non-null values in configuration object `config`. It is used to
 * count the number of configured elements in our configuration objects, where nullified keys can
 * exist (and are thus not counted). Values `null` and `undefined` are not counted; but other falsy
 * values such as `0` and `false` ARE counted.
 *
 * For example:
 * ```
 * configKeysCount({ a: 1, b: 2, c: { x: null }, c: null, d: undefined, e: 0 }) == 3
 * ```
 */
const configKeysCount = config => (
  Object.keys(config || {}).reduce((acc, key) => (
    config[key] !== undefined && config[key] !== null ? acc + 1 : acc
  ), 0)
);

/**
 * Builds an object renaming all keys from the original object according to a "map"
 * function. This `mapFn` tells the new key name given each original key (and can also discard
 * keys if return value is falsy). The return value is a _new_ object, the original `object`
 * is not modified.
 *
 * Note: If `mapFn` returns the same value multiple times for the original keys, the behavior
 * is undefined (it depends on the order the keys are processed, and will basically overwrite)
 * some values.
 *
 * Example use: To build a $set-like mongo update command with dot (nested) notation,
 * if we have:
 *     `source = { label: "x", value: 0 }`
 * and wanted to apply this as an updated within an object with key "abc123":
 *     `elementId = "abc123"`,
 * we can do:
 *     `update = renameKeys(key => "abc123." + key, source)`
 * obtaining:
 *     `source = { "abc123.label": "x", "abc123.value": 0 }`
 *
 * Inspired in object-rename-keys package:
 *   https://www.npmjs.com/package/object-rename-keys
 * and in this 30 seconds hack:
 *   https://medium.com/front-end-hacking/30-seconds-of-code-rename-many-object-keys-in-javascript-268f279c7bfa
 */
const renameKeys = (mapFn, object) => (
  Object.keys(object).reduce((acc, key) => {
    const newKey = mapFn(key);
    if (newKey) {
      acc[newKey] = object[key];
    }
    return acc;
  }, {})
);

/**
 * Validates all field values (mostly: numeric fields must
 * have a well formatted number string) and returns
 * a structure with the same fields as this.state, except
 * typed fields are already converted to their type.
 *
 * If there are errors, the return value will contain a field
 * '_errors_' whose keys are the filed names that did not parse.
 *
 * @arg values an object { key1: string1, key2: string2, ...}
 * @arg types an object { key1: Boolean, key2: Number, key3: function... }
 *      Accepted values are Number, Boolean or any custom parser function.
 *      For custom functions, a return of NaN or undefined is considered
 *      a parsing error.
 *      Any key not in types is assumed to be a String, not
 *      validated (just copied to the return value).
 */
const validateFormValues = (values, types) => {
  const errors = {};
  const parsedValues = {};
  for (const key in values) {
    if (key in types) {
      // NOTE: Number and Boolean are functions themselves, so these
      // 'if' go first
      if (types[key] === Number) {
        const value = Number.parseFloat(values[key]);
        if (Number.isNaN(value)) {
          errors[key] = true;
        } else {
          parsedValues[key] = value;
        }
      } else if (types[key] === Boolean) {
        parsedValues[key] = values[key] === true;
      } else if (typeof types[key] == 'function') {
        const value = types[key](values[key]);
        if (Number.isNaN(value) || value === undefined) {
          errors[key] = true;
        } else {
          parsedValues[key] = value;
        }
      } else {
        parsedValues[key] = values[key];
      }
    } else {
      parsedValues[key] = values[key];
    }
  }
  if (!isEmpty(errors)) {
    parsedValues._errors_ = errors;
  }
  return parsedValues;
};

/**
 * Splits an array of keys+values into an array elementList (with the keys)
 * and an object with { key: value } with all non-undefined values in the array
 *
 * Used for manipulation of various configuration using elementList and
 * elementValues schemas.
 *
 * Example: unzipKeyValuesList([
 *   { key: cpu, value: { source: "system" } },
 *   { key: hdd, value: undefined } ,
 *   { key: net, value: 42 }
 * ])
 *
 * will return:
 * {
 *   elementList: [ "cpu", "hdd", "net" ],
 *   elementValues: {
 *     cpu: { source: "system" },
 *     net: 42
 *   }
 * }
 */
const unzipKeyValueList = elementKeyValues => ({
  elementList: (elementKeyValues || []).map(kv => kv.key),
  elementValues: (elementKeyValues || []).reduce((acc, kv) => {
    if (kv.value !== undefined) {
      acc[kv.key] = kv.value;
    }
    return acc;
  }, {})
});

/**
 * Joins an array of strings (keys) elementList and an object with { key: value }
 * value mappings into a single array of objects with two fields, key and value.
 * Keys not appearing in the elementValues object will result in a { value: undefined }
 * field the returned array.
 *
 * Used for manipulation of various configuration using elementList and
 * elementValues schemas.
 *
 * Example: zipKeyValueList(
 *   [ "cpu", "hdd", "net" ],
 *   {
 *     cpu: { source: "system" },
 *     net: 42,
 *     ignored: "this one is not in elementList"
 *   }
 * )
 *
 * will return:
 *
 * [
 *   { key: cpu, value: { source: "system" } },
 *   { key: hdd, value: undefined } ,
 *   { key: net, value: 42 }
 * ]
 */
const zipKeyValueList = (elementList, elementValues) => (
  (elementList || []).map(key => (
    {
      key,
      value: elementValues && elementValues[key]
    }
  ))
);

/*
 * Converts any elementList/elementValues-style pair into a regular
 * object with { key: value } for each of the keys from `elementList`
 * and their corresponding values in `elementValues`.
 *
 * Note that this is easily accomplished by subObject from this module;
 * but it's added here for clarity and possibly moving all key/value handling
 * functions to its own module.
 *
 * Example:
 *
 * ```
 * keyValueListToObject({
 *   elementList: [ "first", "second", "missing" ],
 *   elementValues: {
 *     first: 1,
 *     second: { value: 2 },
 *     extra: "will be ignored"
 *   }
 * })
 * ```
 *
 * returns:
 *
 * ```
 *   { first: 1, second: { value: 2 }, missing: undefined }
 * ```
 *
 * @param {object} arg The argument is expected to have two (optional)
 *   keys: elementList and elementValues. The first one defaults to
 *   an empty array, and the second one defaults to an empty object.
 */
const keyValueListToObject = ({ elementList, elementValues }) => (
  (isArray(elementList) ? elementList : []).reduce((acc, key) => {
    acc[key] = elementValues && elementValues[key];
    return acc;
  }, {})
);

/**
 * Converts any elementList/elementValues-style pair into a regular
 * list { _id: key, ...values } for each of the keys from `elementList`
 * and their corresponding `values` in `elementValues`.
 *
 * This is just a convenience function to parse elementList/Values
 * objects, and similar to its sister function `keyValueListToObject`,
 * but aimed to return the values preserving the order in the source
 * `elementList`.
 *
 * Example:
 *
 * ```
 * keyValueListToList({
 *   elementList: [ "first", "second", "missing" ],
 *   elementValues: {
 *     first: { label: `comes first` },
 *     second: { value: 2 },
 *     extra: { notKey: "will be ignored" }
 *   }
 * })
 * ```
 *
 * returns the list:
 * ```
 * [
 *   { _id: 'first', label: 'comes first' },
 *   { _id: 'second', value: 2 },
 *   { _id: 'missing' }
 * ]
 * ```
 */
const keyValueListToList = ({ elementList, elementValues }) => (
  (elementList || []).map(key => ({ ...elementValues[key], _id: key }))
);

/**
 * Returns a unique name based on `baseName`, not existing in an array of `existingNames`.
 *
 * For example,
 *
 * ```
 * newName('New document', ['hello', 'New document'])
 * ```
 * returns 'New document (1)'
 *
 * (and later calls, if adding the new names to `existingNames`, will increment the number)
 */
const generateNewName = (baseName, existingNames) => {
  // Make sure input is an array (if given) so no 'fake' array object for which includes()
  // returns always true can hang the ill-written while loop below.
  if (existingNames && !isArray(existingNames)) {
    throw Error('existingNames must be an array (or null)');
  }
  if (!existingNames || !existingNames.includes(baseName)) {
    return baseName;
  }
  let counter = 1;
  while (counter < existingNames.length + 1) {
    const name = `${baseName} (${counter})`;
    if (!existingNames.includes(name)) {
      return name;
    }
    counter++;
  }
  console.error(`could not obtain a new name from base name ${baseName}`);
  return baseName;
};

/**
 * Formats a number and adds the decimal separator and the thousands separator,
 * according to the locale of the browser.
 * @param {number} value - The number to format.
 * @param {number} precision - Maximum number of fraction digits to display.
 * @returns {string} - The formatted number.
 */
const formatNumber = (value, precision) => {
  const options = {};
  if (precision !== undefined && precision !== false) {
    options.maximumFractionDigits = precision;
    options.minimumFractionDigits = 0; // Allow fewer digits if not needed
  }
  // Use navigator.language if available (browser), otherwise fallback to 'en-US'
  // needed in app-server unit tests
  const locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US';
  return new Intl.NumberFormat(locale, options).format(value);
};

/**
 * Formats a time (duration) value into a human readable string.
 * It receives a `value` and a `unit` ('s', 'h', 'minutes' etc)
 * and returns an object `{ values, units, str }` where `values` and
 * `units` are non-empty arrays of numbers and strings (respectively),
 * with same number of elements. For example [2, 13] and ['h', 'm'].
 * For convenience, an already formatted string is also returned in the
 * 'str' element.
 *
 * This is a helper function or `formatWithUnit()`, but it can also
 * be used independently.
 *
 * Simple example:
 * `(0.005, 'ms')` => `{ values: [5], units: ['ms'], str: '5ms' }`
 *
 * Larger values use "days, hours, minutes, seconds" format:
 * `(10000, 's')` => `{values: [2, 46], units: ['h','m'], str: '2h 46m' }
 *
 * NOTE: Also copied to ingest/lib/util.js.
 */
const formatDuration = (value, unit) => {
  // Conditions below, as well as convert-units package, don't work
  // well with negative values. So take this case apart
  const sign = Math.sign(value);
  value *= sign;
  const duration = moment.duration(value, unit);
  // For very short times, allow convert-units to display it
  // (it can display seconds, millis, nanos)
  if (duration.isValid() && duration.asSeconds() <= 60) {
    const { val, unit: u } = convert(value).from(unit).toBest();
    // Edge case: For TOO small units (10us!), conversion still leaves decimal points
    // such as 10.0000002 or 99.99999999
    const ival = Math.round(val);
    return { values: [ival * sign], units: [u], str: String(ival) + u };
  } else {
    // Represent the day/hours/minutes/etc as a single string
    // (there's no way to directly represent it in a
    // { value, unit } format) and return it
    let tokens = duration.format('d[d] h[h] m[m] s[s]', {
      trim: 'both'
    }).split(' ');
    // if we get something with too much 'precision' (components)
    // e.g. "1d 2h 3m 4s",
    if (tokens.length > 2) {
      tokens = tokens.slice(0, 2);
    }
    // We replace non-digits with empty strings, so we can parse the number
    // and get the correct values. For example, for numbers greater than 999, like 1250, we get
    // 1,250, so we need to replace the comma with an empty string.
    const values = tokens.map(t => parseInt(t.substr(0, t.length - 1).replace(',', ''), 10));
    // `value` can be a string (e.g. "11d 6h") so apply the sign carefully
    if (sign < 0) {
      values[0] *= -1;
      tokens[0] = '-' + tokens[0];
    }
    const units = tokens.map(t => t.substr(t.length - 1));
    return { values, units, str: tokens.join(' ') };
  }
};

/**
 * Formats a time interval given a start and end timestamps (which can be
 * any data type that moment() can parse).
 * It display times and durations depending on the length of the interval,
 * and whether it spans through multiple days or if it starts and ends in
 * the same day.
 * Returns an object with several optional fields:
 * {
 *   start: <formatted start string>
 *   end: <formatted start string>
 *   duration: <formatted start string>
 *   str: a concatenation of 'start - end (duration)'
 * }
 * Note that `str` field can be constructed from the others with almost no
 * logic; this is simply a shortcut for callers to avoid manipulating returned
 * strings.
 */
const formatTimeInterval = (startTs, endTs) => {
  const ret = {};
  const fullFormat = 'YYYY-MM-DD HH:mm';
  const shortFormat = 'HH:mm';
  const start = moment(startTs);
  const end = moment(endTs);
  if (start.isValid() && end.isValid()) {
    // do proper formatting of time difference
    const diff = end.diff(start, 's');
    const { str } = formatDuration(diff, 's');
    ret.duration = str;
    const endFormat = start.clone().startOf('day').isSame(end.clone().startOf('day'))
      ? shortFormat // show only the time if the assist ends the same day
      : fullFormat; // date and time for start value (could should date if it is not today() too)
    ret.start = start.format(fullFormat);
    ret.end = end.format(endFormat);
    ret.str = `${ret.start} - ${ret.end} (${ret.duration})`;
  } else if (start.isValid()) {
    ret.start = 'YYYY/MM/DD HH:mm';
    ret.str = ret.start;
  }
  return ret;
};

/**
 * Formats a date. Recent dates only get a month and day, e.g. "Sep 13"; while dates in different
 * years are formatted as a full format "YYYY-MM-DD".
 */
const formatDate = (ts, now = Date.now()) => {
  const m = moment(ts);
  if (!m.isValid()) {
    return UNDEFINED_VALUE;
  }
  const nowYear = moment(now).startOf('year');
  const sameYear = nowYear.isSame(m.clone().startOf('year'));
  return m.format(sameYear ? DATE_FORMAT_RECENT : DATE_FORMAT_FULL);
};

/**
 * Formats a *date* interval given by two timestamps. The time of day is ignored. Also since
 * this function is used to represent date periods, a range { X, X + 1 day } is represented
 * by a short label (day "X") instead of a range ("X - Y") even if the timestamp "X + 1 day"
 * belongs, strictly, to the next day.
 *
 * @return {object} With different fields, all formatted strings:
 *   str: The date range formated, such as "Sep 13" or "Aug 24 - Sep 13"
 *   start: Thes start portion of the range; same format as `str`
 *   end: Thes start portion of the range; same format as `str`
 *   duration: A representation of the duration e.g. "5d"
 */
const formatDateInterval = (startTs, endTs, now = Date.now()) => {
  if (!startTs) {
    return { str: UNDEFINED_VALUE };
  }
  if (!endTs || endTs - startTs <= MILLIS_IN_DAY) {
    return {
      str: formatDate(startTs, now),
      duration: startTs == endTs ? '-' : '1d'
    };
  }
  const start = moment(startTs);
  let end = moment(endTs);
  if (!start.isValid() || !end.isValid()) {
    return { str: UNDEFINED_VALUE };
  }
  const diff = end.diff(start, 's');
  const { str: duration } = formatDuration(diff, 's');
  const ret = { duration };
  if (end.isSame(end.clone().startOf('day'))) {
    // If the end of the interval is exactly the start of a day, we do not actually show that day
    end = end.subtract(1, 'day');
  }
  const nowYear = moment(now).startOf('year');
  const sameYear = nowYear.isSame(start.clone().startOf('year'))
    && nowYear.isSame(end.clone().startOf('year'));
  if (sameYear) {
    ret.start = start.format(DATE_FORMAT_RECENT);
    ret.end = end.format(DATE_FORMAT_RECENT);
    ret.str = `${ret.start}-${ret.end}`;
  } else {
    ret.start = start.format(DATE_FORMAT_FULL);
    ret.end = end.format(DATE_FORMAT_FULL);
    ret.str = `${ret.start}-${ret.end}`;
  }
  ret.duration = duration;
  return ret;
};

/**
 * Formats a timestamp (which can be any data type that moment() can parse).
 *
 * Returns a date string formatted as '<day> at HH:mm:ss', where the day can be
 * either 'today', 'yesterday' or YYYY/MM/DD if it's none of those.
 * For example:
 *  'Today at 11:34:23'
 *  'Yesterday at 5:49:21'
 *  '21/11/1990 at 12:35:16'
 */
const formatTime = (ts, now = moment()) => {
  const time = moment(ts);
  const yesterday = moment().subtract(1, 'day');
  // Formats time in custom format
  // EX: Today at 1:00:00, yesterday at 4:00:00, 2019/04/12 12:43:12
  if (time.isSame(now, 'day')) {
    return time.format('[Today at] HH:mm:ss');
  } else if (time.isBefore(now, 'day') && time.isAfter(yesterday, 'day')) {
    return time.format('[Yesterday at] HH:mm:ss');
  } else {
    return time.format('YYYY/MM/DD [at] HH:mm:ss');
  }
};

/**
 * Formats a timestamp (which can be any data type that moment() can parse), with granularity
 * according to a time window within it will be shown.
 *
 * For example, in a very short time window (less than 1 minute) the formatted time will contain
 * fractional seconds (millis) in addition to minutes and seconds. In larger time windows,
 * it will add the hour of the day; and in even larger (multiple days) it will also include
 * the date.
 *
 * If the time window (defined by minTs, maxTs) is not known, it defaults to the behavior
 * of formatTime().
 */
const formatTimeInRange = (ts, minTs, maxTs, now = moment()) => {
  if (!minTs || !maxTs) { // if no range is known, default to formatTime()
    return formatTime(ts);
  }
  const timeWindow = maxTs - minTs;
  const time = moment(ts);
  if (timeWindow <= MILLIS_IN_MIN) { // Very short time window, include milliseconds
    return time.format('HH:mm:ss.SSS');
  } else if (timeWindow <= MILLIS_IN_HOUR) { // Short time window, but no date necessary
    return time.format('HH:mm:ss');
  } else {
    return formatTime(ts, now);
  }
};

/**
 * Converts between quantities in different units, returning a new value with
 * the most suitable unit. The number of fractional digits is controlled through `precision`
 * argument.
 *
 * It returns an object with { value, unit, values, units }, where:
 *  - value and unit: Are the value (string or number) and an optional
 *    unit to display.
 *  - values and units: If the value must be parsed into multiple elements,
 *    e.g. "16m 45s", then an array `values` contains each of those values
 *    [16, 45] and `units` contains the units ['m', 's'].
 * While the return value is redundant, it is kept for simplicity (we have
 * too many uses of the value+unit case) and backwards compatibility
 * (the value+unit use was earlier).
 *
 * If a conversion fails (e.g. the given unit isn't supported), then the original
 * value and unit are returned.
 *
 * @arg value: number to scale.
 * @arg unit: string representing the incoming units. For supported units please
 * check here: https://github.com/ben-ng/convert-units
 * @arg precision How many (max) fractional digits are left in the output. NOTE: This replaces
 *   and old `shouldRound` argument: No longer used, except when precision==false which disables
 *   rounding.
 * @arg displayUnit: string representing the unit to display. If not provided,
 *   the original unit is used.
 *
 * Examples:
 * formatWithUnit(200, 's', true) => { value: 3.3, unit: 'min' }
 * formatWithUnit(0.005, 'm') = >{ value: 5, unit: 'mm' }
 * formatWithUnit(1000, 's') => { value: '16m 40s', unit: '', values: [16,40], units: ['m','s'] }
 * formatWithUnit(1000, 'm', 2, 'ft') => { value: 3280.84, unit: 'ft' }
 *
 * TODO(herchu) Make AttributeValueFormatter use *number formatting* function (since it is in
 * a /shared dir, move this function and its dependencies there too)
 */
const formatWithUnit = (value, unit, options = {}) => {
  const { displayUnit, precision = 2 } = options;
  let shouldRound = true;
  if (precision === false) {
    shouldRound = false; // skip any precision adjustment
  } else if (precision === true) {
    precision == 0; // when true, perform hard rounding to 0 digits precision
  }
  // create a temporary function to round and format the resulting number (after unit conversion)
  const roundFn = (v) => {
    if (!shouldRound || !Number.isFinite(v)) return formatNumber(v);
    const rounded = Number(v.toFixed(precision));
    return formatNumber(rounded, precision);
  };
  // If the unit is null or undefined, return just the value (rounded to requested precision)
  if (unit == undefined) {
    value = roundFn(value);
    return { value };
  }
  const ret = { value, unit };
  // If displayUnit is provided check if it is supported, if so, convert the value
  // to match the provided unit
  if (displayUnit
    && unit !== displayUnit
    && convert().from(unit).possibilities().includes(displayUnit)) {
    const val = convert(value).from(unit).to(displayUnit);
    ret.value = roundFn(val);
    ret.unit = displayUnit;
  } else if (convert().possibilities().includes(unit)) {
    const converter = convert(value).from(unit);
    if (converter?.origin?.measure == 'time') {
      // If the value expressed is time (rather: duration),
      // then use special formatting to get "days, hours, minutes, seconds"
      // since the convert-unit library does not handle that.
      const { values, units, str } = formatDuration(value, unit);
      ret.values = values;
      ret.units = units;
      if (values.length > 1) {
        // not representable as a single { value, unit }, the unit is
        // lost and merged to the value as a string - unless the caller
        // can use { values, units } instead of { value, unit }
        ret.value = str; // str is already formatted by formatDuration
        ret.unit = '';
      } else {
        [ret.value] = values;
        [ret.unit] = units;
      }
    } else if (converter?.origin?.measure !== 'speed') {
      // Auto-change unit except if it speed (for km/h, m/s you will
      // want to keep your unit and not let convert-units decide for
      // you, which happens to always convert small values to m/s)
      // We are excluding "kanna" because it is a rarely used unit that we don't want to convert.
      // This is a workaround and should be removed when we design and implement
      // real support for units and preferences:
      // https://docs.google.com/document/d/14jTVHhfQXxJT_qq-tFO717JFof0MKXzLjQgAXVRkKbI
      const { val: convVal, unit: convUnit } = converter.toBest({ exclude: ['kanna'] });
      ret.value = roundFn(convVal);
      ret.unit = convUnit;
    }
  }
  // Apply rounding to final values
  if (shouldRound) {
    ret.value = isNumber(ret.value) ? roundFn(ret.value) : ret.value;
    if (isArray(ret.values)) {
      ret.values.forEach((v, ix) => {
        if (isNumber(v)) {
          ret.values[ix] = roundFn(v);
        }
      });
    }
  }
  return ret;
};

/**
 * Returns a string with the formatted value of the attribute passed in the argument
 *
 * If attribute is undefined or attribute.value is undefined it returns '--'
 * If attribute.value is a boolean it returns a string with 'true' or 'false'
 * If attribute.value is a string it returns the same string. (Empty strings are returned
 * as empty strings)
 * If attribute value is a number it returns the number with the unit attached if passed
 * If attribute value is an array it returns the array as a string
 * If attribute value is an object it returns the object as a string
 *
 * @param {object} attribute: object with property value: { value: 'some value'}.
 * @param {string} attributeUnit (optional): string representing the incoming units. For supported
 * units check here: https://github.com/ben-ng/convert-units
 *
 * @deprecated See IO-7189 Remove this function. Use AtributteValueFormatter
 */
const formatAttributeValue = (attribute, attributeUnit, precision) => {
  let formattedValue = '--';
  if (attribute) {
    let attributeValue = attribute.value;
    if (attributeValue === undefined) {
      formattedValue = '--';
    } else if (isBoolean(attributeValue)) {
      formattedValue = '' + attributeValue;
    } else if (isString(attributeValue)) {
      formattedValue = attributeValue;
    } else if (isArray(attributeValue) || isObject(attributeValue)) {
      formattedValue = JSON.stringify(attributeValue);
    } else {
      if (attributeUnit === '%') {
        attributeValue *= 100; // scale percentage; and let the next function round it if required
      }
      // eslint-disable-next-line prefer-const
      let { value, unit } = formatWithUnit(
        attributeValue,
        attributeUnit,
        { precision }
      );
      formattedValue = `${value}${unit ? ` ${unit}` : ''}`;
    }
  }
  return formattedValue;
};

/**
 * Permits the use of async/await with `Array.forEach()`.
 * Awaits for the async callback to return for all elements in the array before returning the
 * resolved promise for the function asyncForEach.
 *
 * @param {Array} array - The array to perform the callback on each element
 * @param {Function} callback - The callback to perform on each element of the array
 */
const asyncForEach = async (array, callback) => {
  for (let index = 0; index < array.length; index++) {
    // eslint-disable-next-line no-await-in-loop
    await callback(array[index], index, array);
  }
};

/**
 * Flattens an array of objects (if objects have nested objects inside)
 *
 * @param {Array} arr1 - Array to be flattened
 *
 * @returns Flattened, concatentated array of Object values
 */
const flattenDeepObj = arr1 => arr1.reduce((acc, val) => (typeof val == 'object'
  ? acc.concat(flattenDeepObj(Object.values(val)))
  : acc.concat(val)), []);

/**
 * Point-sets a property within an object. The property may contain dots to
 * represent object nesting, much like MongoDB's field naming works (e.g. $set).
 * When nested properties are indicated, sub-objects will be created as
 * necessary, _even replacing existing properties_.
 *
 * Examples:
 *
 * For example `propSet(obj, 'color', 'red')` is simply equivalent to doing:
 *    obj['color'] = 'red'
 * But using nesting, we can do `propSet(o, 'button.size', 5)` is _roughly_
 * equivalent to: `obj['button']['size'] = 5. But it behaves differently
 * depending on what `obj` initially contains:
 *
 * propSet({ color: 'red' }, 'button.size', 5) = { button: { size: 5, color: 'red' }}
 * propSet({ button: { label: 'x', size: 10 } }, 'button.size', 5) =
 *    { button: { label: 'x', size: 5 }}
 * propSet({ button: 'none', other: 'ignored' }, 'button.size', 5) =
 *    { button: { size: 5 }, other: 'ignored'}  // note: 'none' was lost!
 *
 * @param object Must be a non-null object, and will be modified in place
 * @param property Is a string, that may or may not contain dots '.'
 * @param value Any value, including null or undefined
 * @return Nothing
 */
const propSet = (object, property, value) => {
  if (!isString(property)) {
    throw new Error('property must be a string');
  }
  if (!isObject(object)) {
    throw new Error('object must be an object');
  }
  const chain = property.split('.');
  for (let i = 0; i < chain.length; i++) {
    const prop = chain[i];
    if (i == chain.length - 1) { // last element
      object[prop] = value;
    } else {
      // not the last element. Must enter into nested object fields, or create them
      if (!isObject(object[prop])) {
        object[prop] = {};
      }
      object = object[prop]; // enter nested object
    }
  }
};

/**
 * Safe method to get a value from a nested property on a given object.
 * Property must be specified using dot notation.
 * If the property or any subproperty in the path to it is missing, then
 * defaultValue (if provided) or undefined  is returned.
 *
 * @deprecated Prefer lodash.get()
 */
const propGet = (object, property, defaultValue = undefined) => {
  if (!isString(property)) {
    throw new Error('property must be a string');
  }
  if (!isObject(object)) {
    throw new Error('object must be an object');
  }
  const chain = property.split('.');
  const result = chain.reduce((acc, el) => acc && acc[el], object);
  return result === undefined ? defaultValue : result;
};

/**
 * Expanded propGet function that receives an array of properties
 * and returns a value of the object.
 * It uses the propGet dot notation to find the value in the object
 * It returns the value of the first property with value found in the object
 * (or default value if provided)
 *
 * Example:
 * propGetAnyInList({ a: 1, b: 2, c: 3 }, ['d', 'c']) => 3
 * propGetAnyInList({ a: 1, b: 2, c: 3 }, [b]) => 2
 * propGetAnyInList({ a: 1, b: 2, c: 3 }, [d]) => undefined
 * propGetAnyInList({ a: 1, b: 2, c: 3 }, [a, c]) => 1
 */
const propGetAnyInList = (object, properties, defaultValue = undefined) => {
  let value = defaultValue;
  if (properties) {
    for (const property of properties) {
      const readValue = propGet(object, property); // Read the property from object
      if (readValue != null) { // if exist break the loop with the readValue in value
        value = readValue;
        break;
      }
    }
  }
  return value;
};

/**
 * Gets a property from an object: similar to simply doing `object[property]`.
 * In case `property` is not in `object`, or `object`` is not an Object (sic),
 * it returns `defaultValue`.
 */
const fieldGet = (object, field, defaultValue) => (
  isObject(object) && (field in object) ? object[field] : defaultValue
);

/**
 * Validates an email string to check if it is a valid email address.
 *
 * @param {String} email - The email string to validate upon
 *
 * @returns {Boolean} valid
 */
const isEmailValid = email => (
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
);

/**
 * ES6, async version of a sleep() function
 */
const sleep = sleepMillis => (
  new Promise((resolve) => {
    setTimeout(resolve, sleepMillis);
  })
);

// Return the label to use for an option in a 'select' control. Options should have the form
// { value, label }, but as they may come from data sources a best-guess may be necessary to
// select the appropriate field.
// This function uses the `label` field, or the `value` field, or entire option itself if it is
// a string. If everything fails, it casts the entire option to a string.
// The result is always a String.
const getOptionLabel = (option) => {
  if (isObject(option)) {
    return String(option.label || option.value);
  } else if (isString(option)) {
    return option;
  } else {
    return String(option);
  }
};

// Return the value to use for an option in a 'select' control. Options should have the form
// { value, label }, but as they may come from data sources a best-guess may be necessary to
// select the appropriate field.
// This function uses the `value` field, or the entire option itself as the value
const getOptionValue = (option) => {
  if (isObject(option)) {
    return option.value;
  } else {
    return option;
  }
};

/**
 * Checks whether the given value is a valid URL
 *
 * @param {*} value
 * @return {*}
 */
function validateUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol == 'http:' || url.protocol == 'https:';
  } catch (e) {
    // ignore
  }
  return false;
}

/**
 * Converts the provided number to a timestamp in milliseconds.
 * If the argument is less than 120000000000 it's assumed to be a timestamp in seconds, so it's
 * scaled to milliseconds.
 * If the argument is greater than 120000000000000 it's assumed to be a timestamp in microseconds,
 * so it's scaled to milliseconds.
 *
 * @param {number} ts
 * @returns {number}
 */
const toTimestampMilliseconds = (ts) => {
  if (!Number.isFinite(ts)) {
    return undefined;
  }
  // TODO(mike) revisit this code in the year 5772
  // ts in milliseconds 120000000000 = 1973-10-20
  // ts in seconds 120000000000 = 5772-08-24

  // ts in milliseconds 120000000000000 = 5772-08-24
  // ts in microseconds 120000000000000 = 1973-10-20
  if (ts < 120000000000) {
    // ts seems to be in seconds
    return Math.round(ts * 1000);
  }
  if (ts > 120000000000000) {
    // ts seems to be in microseconds
    return Math.round(ts / 1000);
  }
  // ts seems to be in milliseconds
  return Math.round(ts);
};

/**
 * Group duplicate elements in a list based on a specified comparison function.
 * @param {Array} list - The list of elements to process.
 * @param {Function} callback - A function used to compare elements for equality.
 * @returns {Array} - The list with duplicated elements grouped
 * Example:
 * If the list is:
 * [{ step: 1, index: 0}, { step: 2, index: 3}, { step: 1, index: 5}]
 * is going to return:
 * [{ step: 1, index: [0,5]}, { step: 2, index: [3]}]
 */
function groupDuplicateElements(list, callback) {
  for (let i = 0; i < list.length; i++) {
    // Change index to be an array containing the current index
    list[i].index = [list[i].index];
    for (let j = i + 1; j < list.length;) {
      if (callback(list[i], list[j])) {
        // Add the index of the duplicate element to the index array
        list[i].index.push(list[j].index);
        // Remove the duplicate element at index j
        list.splice(j, 1);
      } else {
        j++;
      }
    }
  }
  return list;
}

/**
 * Checks if all characters in `defaultString` are included in `stringA`
 * @param {string} stringA - The string to check within
 * @param {string} defaultString - The string whose characters need to be included in `stringA`
 * @returns {boolean}
 */
const isIncluded = (stringA, defaultString) => {
  const stringASet = new Set(stringA);
  const defaultStringSet = new Set(defaultString);
  return [...defaultStringSet].every(char => stringASet.has(char));
};

export {
  applyDefaults,
  cleanNulls,
  assignIfDistinct,
  subObject,
  configKeysCount,
  renameKeys,
  validateFormValues,
  toDotNotation,
  zipKeyValueList,
  unzipKeyValueList,
  keyValueListToObject,
  keyValueListToList,
  generateNewName,
  formatWithUnit,
  formatDuration,
  formatTime,
  formatTimeInRange,
  formatTimeInterval,
  formatDate,
  formatDateInterval,
  asyncForEach,
  flattenDeepObj,
  propSet,
  propGet,
  propGetAnyInList,
  fieldGet,
  isEmailValid,
  capitalizeString,
  sleep,
  getOptionLabel,
  getOptionValue,
  validateUrl,
  formatAttributeValue,
  UNDEFINED_VALUE,
  toTimestampMilliseconds,
  mapByIdToArray,
  groupDuplicateElements,
  isIncluded,
  formatNumber
};
