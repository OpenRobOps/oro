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
 * Cache builder from a settings object. It exports a single builder function that returns
 * a new Cache object given a settings object. See buildCache()
 */
import { AsyncCache } from '../shared/simpleCache';
import { isEmpty } from 'lodash';

// Settings fields
const FIELD_TYPE = 'type';
// Constants for "type" field
const CACHE_TYPE_MEMORY = 'memory';
const CACHE_TYPES = {
  [CACHE_TYPE_MEMORY]: AsyncCache
};

/**
 * Builds a new Cache. It returns a Cache implementation depending on `settings.type`.
 * If settings is null or an empty object (also allowed), it returns null meaning "no cache".
 * If settings is not empty, its `type` must be one of the CACHE_TYPE_* constants.
 * All other fields from settings are passed to the cache class constructor
 * (e.g. maxAge or maxSize for the memory cache).
 *
 * Caches built from this builder are assumed to be async (since they could depend on external
 * services) and the default, "memory" implementation is our @inorbit/simple-cache's AsyncCache.
 */
const buildCache = (settings) => {
  if (!settings || isEmpty(settings)) {
    return null;
  }
  const { [FIELD_TYPE]: type, ...options } = settings;
  if (!(type in CACHE_TYPES)) {
    throw new Error(`Invalid cache type: ${type}`);
  }
  return new CACHE_TYPES[type](options);
};

export default buildCache;
export {
  CACHE_TYPE_MEMORY
};
