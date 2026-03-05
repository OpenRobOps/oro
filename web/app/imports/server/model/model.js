/**
 * Superclass for model objects with generic functionality.
 *
 * NOTE: These type of objects are intended to only have logic and
 * no data. All the data should be always backed by the collection and
 * be read and written back any time it is used.
 * In other words. DON'T ADD ANY STATE TO THESE OBJECTS.
 *
 * NOTE 2: Do NOT extend this with generic ODM functionality. The proper
 * way to do it will be adopting a proper ODM to replace all this.
 */
export default class Model {
  /**
   * Constructor, intended to be used only internally.
   * It takes the ID of the MongoDB document object that backs this
   * object as a parameter.
   */
  constructor(objectId, collection) {
    // TODO(adamantivm) Sanity checks
    this._id = objectId;
    this._coll = collection;
  }

  /**
   * Return this object's id
   */
  getId = () => (
    this._id
  );

  /**
   * Convenience method to do sanity checks on methods
   */
  _checkValid = () => {
    if (!this._id) {
      throw new Error('Invalid object, missing ID');
    }
  };

  /**
   * Convenience method to fetch the robot document from
   * the database while doing some specific checks.
   * fields is an optional parameter. If provided, it should
   * be in the format used by mongo to filter which fields are
   * requested.
   *
   * NOTE: Async version of _fetch() (newer)
   */
  _fetchAsync = async (fields) => {
    const doc = fields
      ? await this._coll.findOneAsync(this._id, { fields })
      : await this._coll.findOneAsync(this._id);
    if (!doc) {
      const badId = this._id;
      this._id = undefined;
      throw new Error('Object not found on database! ID = ' + badId);
    }
    return doc;
  };

  /**
   * Gets a "last happened" timestamp for a given `namespace` and `actionId`.
   * See Companies field `lastTs` in collections module.
   *
   * When not set, it just returns undefined.
   *
   * Example:
   * new Company("abcd").getLastTsAsync('email', 'email:newInvoiceOwed')
   */
  getLastTsAsync = async (namespace, actionId) => {
    if (!namespace || !actionId) {
      throw new Error('Namespace and actionId are required');
    }
    const doc = await this._fetchAsync({ [['lastTs', namespace, actionId].join('.') ]: 1, _id: 0 });
    return doc.lastTs && doc.lastTs[namespace] && doc.lastTs[namespace][actionId];
  };

  /**
   * Updates a "last happened" timestamp for a given `namespace` and `actionId` to `ts`.
   * If `ts` is not given, it defaults to "now".
   * See Companies field `lastTs` in collections module.
   *
   * Example,
   * new Company("abcd").setLastTsAsync('email', 'email:newInvoiceOwed', now)
   */
  setLastTsAsync = async (namespace, actionId, ts = Date.now()) => {
    if (!namespace || !actionId) {
      throw new Error('Namespace and actionId are required');
    }
    await this._coll.updateAsync({ _id: this._id }, { $set: {
      [['lastTs', namespace, actionId].join('.') ]: ts
    }});
  };

  /**
   * Tells if at least `durationMs` has elapsed since last time an action was
   * marked as happened (or true, if the action never happened).
   *
   * Wrapper for getLastTsAsync and the logic for checking null-ness and comparing timestamps.
   *
   * @see getLastTsAsync and setLastTsAsync.
   *
   * Example,
   * new Company("abcd").setLastTsAsync('email', 'email:newInvoiceOwed')
   * ... Zzzzz ...
   * new Company("abcd").isElapsedTsAsync('email', 'email:newInvoiceOwed', 1000)
   * // returns true if over 1s has elapsed since last invoice email was sent.
   *
   */
  isElapsedTsAsync = async (namespace, actionId, durationMs) => {
    if (!namespace || !actionId) {
      throw new Error('Namespace and actionId are required');
    }
    if (durationMs < 0) {
      throw new Error('durationMs cannot be negative');
    }
    if (!durationMs) {
      return true; // If duration = 0, always return true (used when timestamps are simply disabled)
    }
    const lastTs = await this.getLastTsAsync(namespace, actionId);
    return !lastTs || lastTs + durationMs < Date.now();
  };
}
