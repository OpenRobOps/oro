/**
 * Simple Cache module, which can store values on arbitrary keys (including
 * object keys), supporting a maximum size and an optional expiration (in
 * milliseconds).
 *
 * NOTE: This is not a super efficient module; it is meant to store a few elements
 * (honoring expiration though), with arbitrary keys -- for which there are
 * no npm packages that I could find. See notes on _compact()
 *
 * TODO Generalize constructor to automatically detect if an async
 * create function is being passed as a parameter and return an AsyncCache in
 * that case.
 */
import objectHash from 'object-hash';

const DEFAULT_MAX_SIZE = 1000; // default cache max size
const DEFAULT_MAX_AGE_MS = 10000; // 10s max object age by default

class Cache {
  constructor(opts = {}) {
    this._cache = {};
    this._size = 0;
    this._maxSize = Math.max(1, (opts && opts.maxSize) || DEFAULT_MAX_SIZE);
    this._maxAgeMs = Math.max(1, (opts && opts.maxAge) || DEFAULT_MAX_AGE_MS);

    // If a create function is provided, then use it to automatically return
    // and cache values when there are cache misses
    if (opts.createFunction) {
      this._missFunction = (key) => {
        const value = opts.createFunction(key);
        if (value) {
          this.set(key, value);
        }
        return value;
      };
    } else {
      this._missFunction = () => {};
    }
  }

  /**
   * Gets an element from the cache. Note that expiration is checked only
   * while an element is retrieved, so at this point the element age
   * is checked and an existing contents may be ignored (expired) and not
   * returned.
   *
   * If a key is not in the cache, or if the element stored there is already
   * expired, it returns undefined.
   */
  get(key) {
    const hash = key && objectHash(key);
    const now = Date.now();
    const cached = this._cache[hash];
    if (!cached) { // no such key
      return this._missFunction(key);
    }
    const age = now - cached.ts;
    if (this._maxAgeMs && age > this._maxAgeMs) { // too old
      this._unset(hash);
      return this._missFunction(key);
    }
    return cached.value;
  }

  /**
   * Stores an element in the cache.
   *
   * The key can be any value, including objects; it will be hashed.
   * Storing an element in an existing hash will overwrite the previous value
   *
   * The value can be anything, but note that storing `undefined` one cannot
   * later distinguish if a key exists, if it was expired, or if its stored
   * value was indeed undefined (See get())
   */
  set(key, value) {
    const hash = key && objectHash(key);
    const now = Date.now();
    if (!(hash in this._cache)) {
      this._size++;
    }
    this._cache[hash] = {
      ts: now,
      value
    };
    // Do not compact immediately if size is greater than threshold;
    // this is expensive: do it after it gets 30% past the limit
    if (this._size >= this._maxSize * 1.3) {
      this._compact();
    }
  }

  /**
   * Removes an element from the cache. If the key is not in the cache, this
   * is a no-op.
   */
  unset(key) {
    const hash = key && objectHash(key);
    this._unset(hash);
  }

  /**
   * Flushes out all entries and resets the cache to its initial state
   */
  reset() {
    this._cache = {};
    this._size = 0;
  }

  /**
   * Returns the number of elements currently in cache. Note that some
   * of these may be expired already; so this is an estimate (max bound)
   */
  size() {
    return this._size;
  }

  /**
   * Private method to unset (discard) an element from the cache.
   */
  _unset(hash) {
    if (hash in this._cache) {
      this._size--;
      delete this._cache[hash];
    }
  }

  /**
   * Compacts the cache by discarding older elements so that only maxSize
   * elements are retained.
   *
   * This is a relatively expensive call (it needs to sort and iterate over
   * all keys) so it is only called after the size grows _well over_ maxSize.
   */
  _compact() {
    if (this._size <= this._maxSize) {
      return; // ignore
    }
    // sort keys by age to delete the oldest ones
    const keys = Object.keys(this._cache).map(
      hash => ({ hash, ts: this._cache[hash].ts })
    ).sort((a, b) => (a.ts - b.ts));
    // determine number of elements to delete, and simply to _unset on them
    const toDelete = this._size - this._maxSize;
    for (let ix = 0; ix < toDelete; ix++) {
      this._unset(keys[ix].hash);
    }
  }
}

/**
 * A version of Cache which provides an async interface to get.
 *
 * This version of Cache must be used if the miss function / createFunction
 * itself is asynchronous.
 */
class AsyncCache extends Cache {
  constructor(opts = {}) {
    super(opts);
    if (opts.createFunction) {
      this._missFunction = async (key) => {
        const value = await opts.createFunction(key);
        if (value) {
          this.set(key, value);
        }
        return value;
      }
    }
  }
  async get(key) {
    return super.get(key);
  }
}

export { AsyncCache };
export default Cache;
