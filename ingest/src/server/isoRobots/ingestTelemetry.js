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
 * Ingests ISO 21423 telemetry into ORO's ordinary attributes pipeline.
 *
 * Everything an ISO robot publishes lands in `AttributesManager.saveAttributeValues`
 * (`src/server/attributes.js:267`) — the same funnel ORO's own protobuf modules reach. That call
 * resolves the robot's vitals config, parses values by declared type, persists to `attr_values`
 * and cascades to status evaluation and the `attributes`/`robot-poses` exchanges
 * (`attributes.js:363-390`). The result is that an ISO robot is indistinguishable from a wire
 * robot for every downstream consumer: the UI, derived attributes, incidents, and the ISO Upstream
 * direction's own telemetry tap.
 *
 * Deliberately NOT `handleSystemUpdates` (`attributes.js:216`): its source filter at `:227-229`
 * protects wire robots from cross-source overwrites and would silently drop ISO values for any
 * attribute a deployment maps from elsewhere.
 *
 * Which ORO attribute id carries which ISO concept is `config.attributeSources` — the shared
 * convention the ISO Upstream direction reads by. No id is hardcoded below.
 */

/** ISO operating states that mean "ORO cannot hear from this robot" (B.4 will included). */
import { CUSTOM_DATA_RESOURCE, ISO_CUSTOM_FIELD, parseCustomData } from '../iso21423/customData';

const OFFLINE_STATES = new Set(['OFFLINE', 'LOST_CONNECTION']);
const KV_RESERVED_KEYS = new Set(['robotId', '_id']);   // as in modules/customData.js

/** ORO path ids for the ISO path resources: "0" matches the id the InOrbit ROS2 agent uses for nav2 `/plan`. */
const ISO_PATH_IDS = { globalPlan: '0', localTrajectory: '1' };
/** Minimum interval between `localization.paths.<id>` writes per robot and path (latest wins). */
const ISO_PATH_MIN_MS = 1000;

/**
 * Maps an ISO status message's `states` array onto ORO's online concept.
 *
 * An absent or empty array is treated as online: the robot published something, so it is present;
 * ISO permits a status with no notable states.
 *
 * @param {string[]|undefined} states
 * @returns {{online: boolean}}
 */
const mapStatus = (states) => ({
  online: !(states || []).some((s) => OFFLINE_STATES.has(s)),
});

class IsoTelemetryIngester {
  /**
   * @param {Object} opts
   * @param {Object} opts.client the Iso21423Client (null in unit tests)
   * @param {Object} opts.attributesManager the AttributesManager singleton
   * @param {Object} opts.robotsColl the `robots` collection
   * @param {Object} opts.converter a CcsConverter; uncalibrated suppresses pose and paths
   * @param {Object} opts.sources `config.attributeSources`
   * @param {Object} [opts.roster] an AdmittedRoster; when given, a callback for a uuid it no
   *   longer admits is a no-op — a safety net for a subscription that outlived a failed
   *   `unsubscribe()` on revoke. Optional: unit tests construct without it.
   * @param {boolean} [opts.logging=false]
   */
  constructor({
    client, attributesManager, robotsColl, keyValuesColl = null, localizationColl = null,
    converter, sources, roster, logging = false,
  }) {
    this._client = client;
    this._attrs = attributesManager;
    this._robots = robotsColl;
    this._keyValues = keyValuesColl;   // robot_key_values, feeding the UI's Key-Values widget
    this._localization = localizationColl;   // localization, feeding the Navigation widget
    this._converter = converter;
    this._sources = sources;
    this._roster = roster;
    this._logging = logging;
    this._subs = new Map();        // uuid -> Subscription[]
    this._lastCcsPoint = new Map();  // uuid -> the last ISO LocationPoint seen, unconverted
    this._lastCcsYaw = new Map();    // uuid -> the last ISO yaw seen, unconverted
    this._warnedFootprint = new Set();   // uuids already warned about a malformed imrFootprint
    this._pathTimers = new Map();    // `${uuid}/${pathId}` -> { timer, next }
    this._pathLastWrite = new Map();   // `${uuid}/${pathId}` -> ts of the last write
  }

  /**
   * The robot's last known position **in its original CCS frame**, exactly as it arrived, or
   * undefined if no odometry has been seen. Used by the cancel-nav translation to send the robot
   * to where it already is (decision 15) with no transform in the path.
   */
  lastCcsPose = (uuid) => {
    const locationPoint = this._lastCcsPoint.get(uuid);
    if (!locationPoint) return undefined;
    return { locationPoint, yaw: this._lastCcsYaw.get(uuid) || 0 };
  };

  /** True when a roster was given and no longer admits this uuid. No roster means never revoked. */
  _isRevoked = (uuid) => Boolean(this._roster) && !this._roster.isAdmitted(uuid);

  /**
   * Subscribes to one admitted robot's status, odometry, battery and paths.
   *
   * Per-robot rather than one fleet-wide wildcard, so revoking a robot actually stops the traffic
   * (ND-17: the SDK unsubscribes on the last listener) instead of merely filtering it in ORO.
   *
   * The seven subscribes settle independently: if any rejects, every subscription that DID
   * succeed is unsubscribed before rethrowing, so a failed `observe()` leaves nothing behind for
   * the roster's retry to pile duplicate handlers onto.
   *
   * @param {string} uuid the robot's ISO entity uuid, which is also its ORO robot id
   */
  observe = async (uuid) => {
    if (this._subs.has(uuid)) return;
    const { EntityFilter } = this._client.sdk;
    const filter = EntityFilter.entity(uuid);
    const results = await Promise.allSettled([
      this._client.subscribeResource('status', filter,
        (ev) => this.onStatus(ev.entityUuid, ev.message)),
      this._client.subscribeResource('odometry', filter,
        (ev) => this.onOdometry(ev.entityUuid, ev.message)),
      this._client.subscribeResource('batteryStatus', filter,
        (ev) => this.onBattery(ev.entityUuid, ev.message)),
      this._client.subscribeResource(CUSTOM_DATA_RESOURCE, filter,
        (ev) => this.onCustomData(ev.entityUuid, ev.message)),
      this._client.subscribeEntities(filter, (identity) => this.onIdentity(uuid, identity)),
      this._client.subscribeResource('globalPlan', filter,
        (ev) => this.onGlobalPlan(ev.entityUuid, ev.message)),
      this._client.subscribeResource('localTrajectory', filter,
        (ev) => this.onLocalTrajectory(ev.entityUuid, ev.message)),
    ]);
    const rejected = results.find((r) => r.status === 'rejected');
    if (rejected) {
      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      await Promise.all(fulfilled.map((r) => r.value.unsubscribe().catch(() => {})));
      throw rejected.reason;
    }
    this._subs.set(uuid, results.map((r) => r.value));
    if (this._logging) console.log(`ISO 21423 robots: observing ${uuid}`);
  };

  /** Drops every subscription for a revoked robot. Safe when it was never observed. */
  unobserve = async (uuid) => {
    this._lastCcsPoint.delete(uuid);
    this._lastCcsYaw.delete(uuid);
    this._warnedFootprint.delete(uuid);
    for (const key of [...this._pathTimers.keys()]) {
      if (key.startsWith(`${uuid}/`)) {
        clearTimeout(this._pathTimers.get(key).timer);
        this._pathTimers.delete(key);
      }
    }
    for (const key of [...this._pathLastWrite.keys()]) {
      if (key.startsWith(`${uuid}/`)) this._pathLastWrite.delete(key);
    }
    const subs = this._subs.get(uuid);
    if (!subs) return;
    this._subs.delete(uuid);
    await Promise.all(subs.map((s) => s.unsubscribe().catch(() => {})));
    if (this._logging) console.log(`ISO 21423 robots: stopped observing ${uuid}`);
  };

  /** Unsubscribes everything, for module shutdown. */
  stop = async () => {
    await Promise.all([...this._subs.keys()].map((uuid) => this.unobserve(uuid)));
  };

  /**
   * Handles an ISO status message: writes the online attribute and refreshes the two `robots`
   * fields `BasicsModule` maintains for wire robots (`src/server/modules/basics.js:56-87`), so
   * the UI's online/offline logic works unchanged.
   */
  onStatus = async (uuid, status) => {
    if (this._isRevoked(uuid)) return;
    const { online } = mapStatus(status && status.states);
    await this._save(uuid, { [this._sources.online]: { value: online } });
    try {
      await this._robots.updateOne(
        { _id: uuid },
        { $set: { 'status.agentOnline': online, updateStamp: Date.now() } });
    } catch (err) {
      if (this._logging) console.warn(`ISO 21423 robots: robot update failed for ${uuid}: ${err.message}`);
    }
  };

  /**
   * Handles an ISO odometry sample: converts the pose out of the facility CCS into ORO's map
   * frame and writes it alongside the two speed attributes.
   *
   * When the CCS is uncalibrated the speeds are still written and the pose is skipped — a speed
   * has no frame, but a pose in an unknown frame would be a lie.
   */
  onOdometry = async (uuid, sample) => {
    if (this._isRevoked(uuid)) return;
    const values = {};
    const point = sample && sample.pose && sample.pose.locationPoint;
    // Retained VERBATIM, in the robot's own CCS frame: the cancel-nav translation sends a `move`
    // back to this exact point (decision 15), so round-tripping it through the transform would
    // introduce error for no reason.
    if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
      this._lastCcsPoint.set(uuid, point);
      this._lastCcsYaw.set(uuid,
        (sample.pose.orientation && sample.pose.orientation.yaw) || 0);
    }
    if (point && Number.isFinite(point.x) && Number.isFinite(point.y)
        && this._converter.calibrated) {
      const { x, y } = this._converter.fromCcsPoint(point);
      const yaw = (sample.pose.orientation && sample.pose.orientation.yaw) || 0;
      const pose = { x, y, theta: this._converter.fromCcsYaw(yaw) };
      values[this._sources.pose] = { value: pose };
      await this._saveRobotPose(uuid, pose);
    }
    const velocity = (sample && sample.velocity) || {};
    if (Number.isFinite(velocity.linear)) {
      values[this._sources.speedLinear] = { value: velocity.linear };
    }
    if (Number.isFinite(velocity.angular)) {
      values[this._sources.speedAngular] = { value: velocity.angular };
    }
    await this._save(uuid, values);
  };

  /** Handles an ISO battery message. ISO `batterySoc` and ORO's `batteryPercentage` are both 0..1 fractions. */
  onBattery = async (uuid, battery) => {
    if (this._isRevoked(uuid)) return;
    const values = {};
    const b = battery || {};
    if (Number.isFinite(b.batterySoc)) {
      values[this._sources.batteryPercentage] = { value: b.batterySoc };
    }
    if (Number.isFinite(b.batteryVoltage)) {
      values[this._sources.batteryVoltage] = { value: b.batteryVoltage };
    }
    if (typeof b.batteryChargingState === 'string') {
      values[this._sources.batteryIsCharging] = { value: b.batteryChargingState === 'CHARGING' };
    }
    await this._save(uuid, values);
  };

  /**
   * Writes one batch of attribute values. Never throws: this runs on the ISO message callback,
   * and a Mongo hiccup must not tear down the subscription.
   */
  /**
   * Handles OpenRobOps' `customData` extension resource (raw text — extension resources have no
   * schema): the pairs go through the same key-value path as a wire robot's custom data, so
   * `keyValue` DataSourceDefinitions, statuses and incidents work unchanged, and into
   * `robot_key_values` for the Key-Values widget.
   */
  onCustomData = async (uuid, text) => {
    if (this._isRevoked(uuid)) return;
    const parsed = parseCustomData(text);
    if (!parsed) {
      if (this._logging) console.warn(`ISO 21423 robots: malformed customData from ${uuid}`);
      return;
    }
    const { ts, pairs } = parsed;
    if (!pairs.length) return;
    try {
      await this._attrs.handleKeyValuePairs(uuid, ISO_CUSTOM_FIELD, pairs, ts);
    } catch (err) {
      if (this._logging) console.warn(`ISO 21423 robots: key-value save failed for ${uuid}: ${err.message}`);
    }
    if (!this._keyValues) return;
    const $set = {};
    pairs.forEach((kv) => { if (!KV_RESERVED_KEYS.has(kv.key)) $set[kv.key] = { value: kv.value, ts }; });
    try {
      await this._keyValues.updateOne({ _id: uuid }, { $set }, { upsert: true });
    } catch (err) {
      if (this._logging) console.warn(`ISO 21423 robots: robot_key_values update failed for ${uuid}: ${err.message}`);
    }
  };

  /**
   * Handles an ISO `identity` (retained; replayed on subscribe). The only field ORO uses is the
   * robot's physical outline, `details.imrFootprint` (+ `imrHeight`), stored as the robot's
   * REPORTED footprint. A configured `RobotFootprint` overrides it (spec decision 1). Malformed
   * footprints are ignored with one warning per robot.
   *
   * @param {string} uuid
   * @param {Object} identity an ISO EntityIdentity
   */
  onIdentity = async (uuid, identity) => {
    if (this._isRevoked(uuid)) return;
    const details = (identity && identity.details) || {};
    const pts = details.imrFootprint;
    const valid = Array.isArray(pts) && pts.length >= 3
      && pts.every((p) => p && Number.isFinite(p.x) && Number.isFinite(p.y));
    if (!valid) {
      if (pts !== undefined && !this._warnedFootprint.has(uuid)) {
        this._warnedFootprint.add(uuid);
        console.warn(`ISO 21423 robots: ignoring malformed imrFootprint for ${uuid}`);
      }
      return;
    }
    const footprint = {
      points: pts.map(({ x, y }) => [x, y]),
      height: Number.isFinite(details.imrHeight) ? details.imrHeight : null,
      ts: Date.now(),
      source: 'iso21423',
    };
    try {
      await this._robots.updateOne({ _id: uuid }, { $set: { footprint } });
    } catch (err) {
      if (this._logging) console.warn(`ISO 21423 robots: footprint update failed for ${uuid}: ${err.message}`);
    }
  };

  /**
   * Mirrors the pose into `localization.robotPose`, which is what the Navigation widget draws
   * (wire robots get it from `modules/localization.js` `_doUpdatePose`; the `pose` attribute alone
   * is not enough). The frame is ORO's `map` frame, the one `fromCcsPoint` converts into.
   */
  _saveRobotPose = async (robotId, pose) => {
    if (!this._localization) return;
    const ts = Date.now();
    try {
      await this._localization.updateOne(
        { _id: robotId },
        { $set: { robotPose: { ...pose, frameId: 'map', ts }, robotPoseUpdatedTs: ts } },
        { upsert: true },
      );
    } catch (err) {
      if (this._logging) {
        console.warn(`ISO 21423 robots: localization update failed for ${robotId}: ${err.message}`);
      }
    }
  };

  /** ISO `globalPlan` (nav2's global plan for the flatland agent) → ORO path "0". */
  onGlobalPlan = async (uuid, msg) => this._savePath(
    uuid, ISO_PATH_IDS.globalPlan, (msg && msg.globalPlan) || [], msg && msg.timestamp);

  /** ISO `localTrajectory` (the controller's next few seconds) → ORO path "1". */
  onLocalTrajectory = async (uuid, msg) => this._savePath(
    uuid, ISO_PATH_IDS.localTrajectory, (msg && msg.localTrajectory) || [], msg && msg.timestamp);

  /**
   * Converts stamped CCS points into ORO's `map` frame and writes them in the same shape
   * `modules/localization.js` `onPath` uses for wire robots, so the widget draws both alike.
   * The stored `ts` is the ISO message's own `timestamp` (falling back to `Date.now()` when it
   * fails to parse), NOT the write's wall-clock time: a retained `globalPlan` replayed on
   * subscribe carries its original timestamp, and rendering it with "now" would make a stale
   * plan look current. Writes are limited to one per `ISO_PATH_MIN_MS` per (robot, path), rate
   * limited on wall-clock time; a burst keeps only the latest points (there is no live-MQTT
   * channel for ISO paths, so Mongo IS the display path).
   */
  _savePath = async (uuid, pathId, stampedPoints, msgTimestamp) => {
    if (this._isRevoked(uuid) || !this._localization || !this._converter.calibrated) return;
    const points = [];
    for (const sp of stampedPoints) {
      const lp = sp && sp.locationPoint;
      if (lp && Number.isFinite(lp.x) && Number.isFinite(lp.y)) points.push(this._converter.fromCcsPoint(lp));
    }
    const key = `${uuid}/${pathId}`;
    const write = async () => {
      this._pathLastWrite.set(key, Date.now());
      const parsed = Date.parse(msgTimestamp);
      const ts = Number.isFinite(parsed) ? parsed : Date.now();
      try {
        await this._localization.updateOne({ _id: uuid },
          { $set: { [`paths.${pathId}`]: { points, ts, frameId: 'map' }, pathsUpdatedTs: ts } }, { upsert: true });
      } catch (err) {
        if (this._logging) console.warn(`ISO 21423 robots: path update failed for ${uuid}: ${err.message}`);
      }
    };
    const elapsed = Date.now() - (this._pathLastWrite.get(key) || -Infinity);
    const pending = this._pathTimers.get(key);
    if (pending) { pending.next = write; return; }          // latest wins
    if (elapsed >= ISO_PATH_MIN_MS) { await write(); return; }
    const entry = { next: write, timer: null };
    entry.timer = setTimeout(async () => { this._pathTimers.delete(key); await entry.next(); }, ISO_PATH_MIN_MS - elapsed);
    this._pathTimers.set(key, entry);
  };

  /** Test hook: run every pending path write now. */
  flushPendingPaths = async () => {
    const entries = [...this._pathTimers.values()];
    this._pathTimers.clear();
    for (const e of entries) { clearTimeout(e.timer); await e.next(); }
  };

  _save = async (robotId, attributeValues) => {
    if (!Object.keys(attributeValues).length) return;
    try {
      await this._attrs.saveAttributeValues({ robotId, attributeValues, ts: Date.now() });
    } catch (err) {
      if (this._logging) {
        console.warn(`ISO 21423 robots: attribute save failed for ${robotId}: ${err.message}`);
      }
    }
  };
}

export { IsoTelemetryIngester, mapStatus, OFFLINE_STATES, ISO_PATH_IDS, ISO_PATH_MIN_MS };
