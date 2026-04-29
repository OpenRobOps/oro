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

import { isObject } from 'lodash';

// Reg exp to capture argument names of the form "argument[subKey]"
// see parseArgs
const SUB_KEY_REGEXP = /^(.+)\[(.+)\]$/;

/**
 * Helper function for getUrlParams and getUrlHashParams. It parses
 * a string of the form 'key1=a&key2=b&key3&key4[field]=4' into an object
 *
 * { key: 'a', key2: 'b', key3: null, key4: { field: 4 } }.
 *
 */
const parseArgs = (valuesString) => {
  const params = {};
  (valuesString || '').split('&').forEach((kvp) => {
    const [k, v] = kvp.split('=');
    if (v === undefined) {
      // no '==' sign. Set value = null
      params[k] = null;
    } else {
      const match = k.match(SUB_KEY_REGEXP);
      if (match) {
        // a sub-key field of the form 'key[subkey]'
        const [, k2, subkey] = match;
        if (!isObject(params[k2])) {
          params[k2] = {};
        }
        params[k2][subkey] = v;
      } else {
        // A key=value pair
        params[k] = v;
      }
    }
  });
  return params;
};

/**
 * Method to extract URL params from a full URL.
 */
const getUrlParams = (url, ignoreHash) => {
  let cleanUrl = url;

  if (ignoreHash) {
    const hashParts = (url || '').split('#');
    if (hashParts.length > 1) {
      cleanUrl = hashParts[0];
    }
  }
  const parts = (cleanUrl || '').split('?');
  return parts.length == 1 ? {} : parseArgs(parts[1]);
};

/**
 * Method to extract URL anchor params from a full URL.
 * For example, from 'http://xxx?yyy#z=1&w'
 * it returns `{ z: 1, w: undefined }`.`
 */
const getUrlHashParams = (url) => {
  const parts = (url || '').split('#');
  return parts.length == 1 ? {} : parseArgs(parts[1]);
};

/**
 * Method to turn params object to url param string
 */
const toUrlParamString = (params) => {
  const paramArr = [];
  for (const key in params) {
    if (params[key] === undefined) {
      paramArr.push(key);
    } else {
      paramArr.push(key + "=" + params[key]);
    }
  }
  return ("?" + paramArr.join("&"));
};

/**
 * UrlParams represents the hash arguments that store options for any visualization
 * to make it URL-addressable.
 * It supports parsing a query/hash string into an internal object (simply a key-values
 * dictionary) and vice-versa.
 *
 * It supports some niceties wrt. how we handle URL arguments, in different forms:
 *  - "arg=value" transforms to { arg: value } in the values object.
 *  - "arg" transforms to { arg: null } in the values object. NOTE that therefore,
 *    null is not a supported value.
 *  - "arg[key]=value&arg[key2]=value2" can group multiple options for the same argument,
 *    and would transform into a nested object `{ arg: { key: value, key2: value } }`.
 *
 * There are plenty of getters/setters, the internal `values` object should never be
 * sed directly.
 */
class UrlParams {
  constructor(values = {}) {
    this.values = values;
  }

  static FromHashString(hashString) {
    return new UrlParams(getUrlHashParams(hashString));
  }

  /**
   * Sets an argument. Note that `value` arg has some special values:
   *  - `null` will be represented as simply "&key" in the resulting url
   *  - `undefined` is to to _unset_ the value (remove it from the object).
   */
  set(key, value) {
    if (value === undefined) {
      // the special value `undefined` is to _unset_ keys
      delete this.values[key];
    } else {
      this.values[key] = value;
    }
  }

  /**
   * Unsets an argument. Equivalent to calling `set(key, undefined)`.
   */

  unset(key) {
    delete this.values[key];
  }

  /**
   * Gets the value of an argument.
   */
  get(key) {
    return this.values[key];
  }

  /**
   * Returns the first (or any) key-value pair for an nested hash param.
   * For example, if url included "key[cpuLoad]=123", then it
   * will return [cpuLoad, 123]. If `key` is not in the url params, or it
   * is not a nested property (object), it returns [undefined], (Yes: A one-
   * element array, because the return value is meant to be de-structured via
   * array syntax).
   */
  getFirst(key) {
    const objectValue = this.values[key];
    if (isObject(objectValue)) {
      /* eslint-disable no-restricted-syntax */
      for (const [subkey, value] of Object.entries(objectValue)) {
        return [subkey, value];
      }
    }
    return [undefined];
  }

  /**
   * Returns the number of parsed URL params
   */
  size() {
    return Object.keys(this.values).length;
  }

  /*
   * Converts the URL params in this object to a query/hash string. It
   * optionally prefixes with `prefix` value. So it can be used to build
   * query param strings ("?params...") or hash params ("#params...").
   *
   * The arguments are always sorted lexicographically, so the order is
   * deterministic (and URL changes can reliably be determined).
   *
   * See the class definition for the syntax of the generated string.
   */
  toString(prefix = '') {
    const arr = [];
    const { values } = this;
    Object.keys(values).sort().forEach((k) => {
      if (values[k] === null) {
        arr.push(k);
      } else if (isObject(values[k])) {
        const obj = values[k];
        Object.keys(obj).sort().forEach((j) => {
          arr.push(`${k}[${j}]=${obj[j]}`);
        });
      } else {
        arr.push(k + '=' + values[k]);
      }
    });
    return prefix + arr.join('&');
  }

  toQueryString() {
    return this.toString('?');
  }

  toHashString() {
    return this.toString('#');
  }
}

export {
  getUrlParams, getUrlHashParams, toUrlParamString, parseArgs, UrlParams
};
