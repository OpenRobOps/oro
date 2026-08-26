// Apache License Version 2.0, January 2004

/**
 * Which ISO robots ORO accepts data from.
 *
 * Admission is not automatic (Gate 2): an ISO robot is admitted exactly when an ORO `robots`
 * document exists whose `_id` equals the robot's ISO entity uuid. An operator creates that
 * document through the `IsoRobot` config-API kind; deleting it revokes admission. There is no
 * separate `approved` flag — the `robots` collection is already ORO's fleet roster, and a second
 * boolean would be a second source of truth (decision 6).
 *
 * Documents whose `_id` is not a UUID are ignored: those are ordinary wire robots, which cannot
 * be ISO entities (decision 4 makes the ISO uuid the ORO id, so the converse holds).
 *
 * Poll-and-diff rather than a Mongo change stream: change streams need a replica set, and
 * ingest's test harness (`test/it-helper.js`) runs a standalone `mongod`.
 */
import { UUID_RE } from '../iso21423/sharedConfig';

class AdmittedRoster {
  /**
   * @param {Object} opts
   * @param {Object} opts.collection the `robots` collection
   * @param {number} [opts.pollMs=30000] refresh interval
   * @param {(uuid: string, doc: Object) => Promise<void>} opts.onAdmit
   * @param {(uuid: string) => Promise<void>} opts.onRevoke
   * @param {boolean} [opts.logging=false]
   */
  constructor({ collection, pollMs = 30000, onAdmit, onRevoke, logging = false }) {
    this._coll = collection;
    this._pollMs = pollMs;
    this._onAdmit = onAdmit;
    this._onRevoke = onRevoke;
    this._logging = logging;
    this._admitted = new Set();
    this._timer = null;
  }

  /** Runs one refresh, then polls. The timer is unref'd so it never holds the process open. */
  start = async () => {
    await this.refresh();
    this._timer = setInterval(() => {
      this.refresh().catch(
        (err) => console.warn('ISO 21423 robots: roster refresh failed:', err.message));
    }, this._pollMs);
    if (this._timer.unref) this._timer.unref();
  };

  /** Stops polling. Admitted robots stay admitted — a poll timer is not an authority. */
  stop = () => {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  };

  /**
   * One diff pass over the `robots` collection.
   *
   * A failing `onAdmit` (e.g. a subscription the broker denied) leaves the robot UNadmitted, so
   * the next pass retries it once the ACL lands — the same retry shape Plan 5's roster uses.
   *
   * @returns {Promise<{admitted: string[], revoked: string[]}>} what actually changed
   */
  refresh = async () => {
    const docs = await this._coll.find({}, { projection: { _id: 1, name: 1 } }).toArray();
    const wanted = new Map();
    for (const doc of docs) {
      const id = String(doc._id).toLowerCase();
      if (UUID_RE.test(id)) wanted.set(id, doc);
    }

    const admitted = [];
    const revoked = [];

    for (const [uuid, doc] of wanted) {
      if (this._admitted.has(uuid)) continue;
      try {
        await this._onAdmit(uuid, doc);
        this._admitted.add(uuid);
        admitted.push(uuid);
      } catch (err) {
        console.warn(`ISO 21423 robots: failed to admit ${uuid}: ${err.message}`);
      }
    }

    for (const uuid of [...this._admitted]) {
      if (wanted.has(uuid)) continue;
      try {
        await this._onRevoke(uuid);
      } catch (err) {
        console.warn(`ISO 21423 robots: failed to revoke ${uuid}: ${err.message}`);
      }
      this._admitted.delete(uuid);
      revoked.push(uuid);
    }

    if (this._logging && (admitted.length || revoked.length)) {
      console.log(`ISO 21423 robots: roster +${admitted.length} -${revoked.length}`);
    }
    return { admitted, revoked };
  };

  /** Whether ORO accepts data from, and sends requests to, this ISO entity uuid. Case-insensitive. */
  isAdmitted = (uuid) => this._admitted.has(String(uuid).toLowerCase());

  /** Currently admitted ISO entity uuids, sorted for stable logging and assertions. */
  admittedIds = () => [...this._admitted].sort();
}

export { AdmittedRoster };
