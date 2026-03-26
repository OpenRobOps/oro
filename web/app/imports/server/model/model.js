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
    // TODO Sanity checks
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

  existsAsync = async () => {
    try {
      await this._fetchAsync();
      return true;
    } catch (e) {
      return false;
    }
  };
}
