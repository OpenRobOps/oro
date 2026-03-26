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
 **/
export default class Model {
  /**
   * Constructor, intended to be used only internally.
   * It takes the ID of the MongoDB document object that backs this
   * object as a parameter.
   */
  constructor(objectId, collection) {
    // TODO Sanity checks
    this._id = objectId;
    this._coll = collection
  }

  /**
   * Convenience method to do sanity checks on methods
   */
  _checkValid = () => {
    if (!this._id) {
      throw new Error("Invalid object, missing ID");
    }
  }

  /**
   * Convenience method to fetch the robot document from
   * the database while doing some specific checks.
   * projection is an optional parameter. If provided, it should
   * be in the format used by mongo to filter which fields are
   * requested.
   */
  _fetch = async (projection) => {
    const doc = projection ?
      await this._coll.findOne({ _id: this._id }, { projection }) :
      await this._coll.findOne({ _id: this._id });
    if (!doc) {
      const badId = this._id;
      this._id = undefined;
      throw new Error("Object not found on database! ID = " + badId);
    }
    return doc;
  }

  /**
   * Gets a "last happened" timestamp for a given `namespace` and `actionId`.
   * See Companies field `lastTs` in collections module.
   *
   * When not set, it just returns undefined.
   *
   * Example:
   *   getLastTs('error', 'connectionError')
   */
  getLastTs = (namespace, actionId) => {
    if (!namespace || !actionId) {
      throw new Error("Namespace and actionId are required");
    }
    const doc = this._fetch({ [['lastTs', namespace, actionId].join('.') ]: 1 });
    return doc.lastTs && doc.lastTs[namespace] && doc.lastTs[namespace][actionId];
  }

  /**
   * Updates a "last happened" timestamp for a given `namespace` and `actionId` to `ts`.
   * If `ts` is not given, it defaults to "now".
   * See Companies field `lastTs` in collections module.
   *
   * Example,
   * new Company("abcd").setLastTs('email', 'email:newInvoiceOwed', now)
   */
  setLastTs = (namespace, actionId, ts = Date.now()) => {
    if (!namespace || !actionId) {
      throw new Error("Namespace and actionId are required");
    }
    this._coll.updateOne({ _id: this._id }, { $set: {
      [['lastTs', namespace, actionId].join('.') ]: ts
    }});
  }

  /**
   * Tells if at least `durationMs` has elapsed since last time an action was
   * marked as happened (or true, if the action never happened).
   *
   * Wrapper for getLastTs and the logic for checking null-ness and comparing timestamps.
   *
   * @see getLastTs and setLastTs.
   *
   * Example,
   * new Company("abcd").setLastTs('email', 'email:newInvoiceOwed')
   * ... Zzzzz ...
   * new Company("abcd").isElapsedTs('email', 'email:newInvoiceOwed', 1000)
   * // returns true if over 1s has elapsed since last invoice email was sent.
   *
   */
  isElapsedTs = (namespace, actionId, durationMs) => {
    if (!namespace || !actionId) {
      throw new Error("Namespace and actionId are required");
    }
    if (durationMs < 0) {
      throw new Error("durationMs cannot be negative");
    }
    if (!durationMs) {
      return true; // If duration is 0, always return true (used when timestamps are simply disabled)
    }
    const lastTs = this.getLastTs(namespace, actionId);
    return !lastTs || lastTs + durationMs < Date.now();
  }

  /**
   * Fetches the raw DB document
   * @returns {object}
   */
  fetchDoc = async () => {
    this._checkValid();
    return this._fetch();
  };
}
