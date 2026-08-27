/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Facility CCS calibration, shared by both ISO directions.
 *
 * Reference points give the same physical landmark's coordinates in two frames — the ORO map
 * frame (what ORO stores and what its navigation stack consumes) and the facility CCS (what ISO
 * 21423 messages carry). A least-squares rigid fit over ≥3 pairs (ISO Clause 4) produces ONE
 * transform; this class exposes it in both directions so a facility is calibrated once:
 *
 *   - `toLocationPoint` / `toOrientation` — ORO map → CCS, for telemetry ORO publishes outward
 *     and for nothing else (the ISO Upstream direction, Plan 5).
 *   - `fromCcsPoint` / `fromCcsYaw` — CCS → ORO map, for telemetry ORO ingests from ISO robots
 *     and for `move` targets it sends them (the ISO Robots direction).
 *
 * Reference points can also live in `settings.iso21423.ccs` when no operator-managed transform
 * exists yet: `create()` fits a transform from those points alone. `load()` is the preferred
 * entry point — it prefers a `map` entry in the `spatial_transformations` collection
 * (`app/imports/lib/collections.js:808-828`), the one Mongo home shared with the
 * SpatialTransformation ConfigAPI kind and the Navigation widget, falling back to `create()` and
 * seeding that collection from it when calibrated.
 */

/** True for a well-formed 3x3 `aTb.m` — three rows of three finite numbers. */
const isValidMatrix = (m) => Array.isArray(m) && m.length === 3
  && m.every((row) => Array.isArray(row) && row.length === 3 && row.every(Number.isFinite));

class CcsConverter {
  /**
   * @param {string|null} ccsId
   * @param {Object|null} transform a RigidTransform2D, or null when uncalibrated
   * @param {Object} geometry the SDK's geometry functions
   * @param {string|null} reason why calibration failed, or null
   */
  constructor(ccsId, transform, geometry, reason) {
    this.ccsId = ccsId;
    this.calibrated = transform !== null;
    this.reason = reason;
    this._t = transform;
    this._inverse = transform ? geometry.invertTransform(transform) : null;
    this._geo = geometry;
  }

  /**
   * Fits the ORO-map → CCS transform from configured reference points.
   *
   * Returns an UNCALIBRATED converter (never throws) when `ccs.id` is missing, fewer than 3
   * usable pairs are configured, or `fitTransform` rejects them. Callers warn once and degrade:
   * inbound telemetry drops pose, outbound `move` is refused. Publishing or accepting a pose whose
   * frame is unknown is worse than having no pose.
   *
   * @param {{id: string|null, referencePoints: Array}} ccsConfig the shared `iso21423.ccs` block
   * @param {Object} geometry `{ fitTransform, applyTransform, invertTransform, transformYaw }`
   * @returns {CcsConverter}
   */
  static create(ccsConfig, geometry) {
    const { id, referencePoints } = ccsConfig || {};
    if (!id) {
      return new CcsConverter(null, null, geometry,
        'iso21423.ccs.id is not set; poses cannot name a coordinate system');
    }
    const points = referencePoints || [];
    const usable = points.filter((p) => p
      && p.map && Number.isFinite(p.map.x) && Number.isFinite(p.map.y)
      && p.ccs && Number.isFinite(p.ccs.x) && Number.isFinite(p.ccs.y));
    if (usable.length !== points.length) {
      return new CcsConverter(id, null, geometry,
        'iso21423.ccs.referencePoints: every entry needs numeric map.{x,y} and ccs.{x,y}');
    }
    if (usable.length < 3) {
      return new CcsConverter(id, null, geometry,
        'iso21423.ccs.referencePoints: at least 3 pairs are required (ISO Clause 4), '
        + `got ${usable.length}`);
    }
    try {
      const t = geometry.fitTransform(usable.map((p) => p.map), usable.map((p) => p.ccs));
      return new CcsConverter(id, t, geometry, null);
    } catch (err) {
      return new CcsConverter(id, null, geometry,
        `fitTransform rejected the reference points: ${err.message}`);
    }
  }

  /**
   * Like `create`, but the shared `spatial_transformations` system document is the source of
   * truth: a `map → <ccs.id>` entry there wins over `settings.iso21423.ccs.referencePoints`.
   * When only settings are available and they calibrate, the fitted matrix is written to that
   * document so the SpatialTransformation ConfigAPI kind, the Navigation widget and this
   * converter all read one transform. An existing `map` entry for another frame is left alone.
   *
   * Like `create`, this NEVER throws or rejects: a `spatial_transformations` read/write failure,
   * or a malformed stored matrix, is logged and degrades to the settings-only path instead of
   * aborting the caller's startup.
   *
   * @param {{id: string|null, referencePoints: Array}} ccsConfig
   * @param {Object} geometry
   * @param {import('mongodb').Collection} transformsColl the `spatial_transformations` collection
   * @returns {Promise<CcsConverter>}
   */
  static async load(ccsConfig, geometry, transformsColl) {
    const { id } = ccsConfig || {};
    const query = { entityType: 'system', entityId: '0' };
    let doc = null;
    try {
      doc = await transformsColl.findOne(query);
    } catch (err) {
      console.warn(
        `ISO 21423 CCS: could not read spatial_transformations (${err.message}); using settings`);
    }
    const entry = doc && doc.transformations && doc.transformations.map;
    if (id && entry && entry.frameId === id) {
      const m = entry.aTb && entry.aTb.m;
      if (isValidMatrix(m)) {
        const t = { rotation: Math.atan2(m[1][0], m[0][0]), tx: m[0][2], ty: m[1][2] };
        return new CcsConverter(id, t, geometry, null);
      }
      console.warn('ISO 21423 CCS: spatial_transformations map entry has a malformed matrix; '
        + 'using settings');
    }
    const converter = CcsConverter.create(ccsConfig, geometry);
    if (converter.calibrated && !entry) {
      const { rotation, tx, ty } = converter._t;
      const c = Math.cos(rotation); const s = Math.sin(rotation);
      try {
        await transformsColl.updateOne(query, {
          $set: { 'transformations.map': { frameId: id, aTb: { m: [[c, -s, tx], [s, c, ty], [0, 0, 1]] } } },
        }, { upsert: true });
      } catch (err) {
        console.warn(`ISO 21423 CCS: could not seed spatial_transformations (${err.message})`);
      }
    }
    return converter;
  }

  /**
   * ORO map pose (metres) → ISO `LocationPoint` in the facility CCS.
   * `z` is always 0 — ORO robots report 2D poses only.
   * @throws {Error} when uncalibrated
   */
  toLocationPoint = (pose) => {
    this._assertCalibrated();
    const { x, y } = this._geo.applyTransform(this._t, { x: pose.x, y: pose.y });
    return { ccsId: this.ccsId, x, y, z: 0 };
  };

  /**
   * ORO map `theta` (radians) → ISO `Orientation`.
   * `pitch`/`roll` are always 0 — ORO models planar orientation only.
   * @throws {Error} when uncalibrated
   */
  toOrientation = (pose) => {
    this._assertCalibrated();
    return { yaw: this._geo.transformYaw(this._t, pose.theta || 0), pitch: 0, roll: 0 };
  };

  /**
   * ISO `LocationPoint` → ORO map frame. The point's own `ccsId` is NOT checked here; callers
   * that care (a `move` target from a foreign CCS) check it and reject with their own reason code.
   * @returns {{x: number, y: number}}
   * @throws {Error} when uncalibrated
   */
  fromCcsPoint = (locationPoint) => {
    this._assertCalibrated();
    return this._geo.applyTransform(
      this._inverse, { x: locationPoint.x, y: locationPoint.y });
  };

  /** ISO yaw (radians, CCS) → ORO map `theta`. @throws {Error} when uncalibrated */
  fromCcsYaw = (yaw) => {
    this._assertCalibrated();
    return this._geo.transformYaw(this._inverse, yaw || 0);
  };

  _assertCalibrated = () => {
    if (!this.calibrated) {
      throw new Error(`ISO 21423 CCS is uncalibrated: ${this.reason}`);
    }
  };
}

export { CcsConverter };
