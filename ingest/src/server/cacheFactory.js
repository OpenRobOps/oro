/**
 * Cache builder from a settings object. It exports a single builder function that returns
 * a new Cache object given a settings object. See buildCache()
 */
import { AsyncCache } from './simpleCache';
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
