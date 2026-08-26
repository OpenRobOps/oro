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
const OFFLINE_STATES = new Set(['OFFLINE', 'LOST_CONNECTION']);

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
   * @param {Object} opts.converter a CcsConverter; uncalibrated suppresses pose only
   * @param {Object} opts.sources `config.attributeSources`
   * @param {Object} [opts.roster] an AdmittedRoster; when given, a callback for a uuid it no
   *   longer admits is a no-op — a safety net for a subscription that outlived a failed
   *   `unsubscribe()` on revoke. Optional: unit tests construct without it.
   * @param {boolean} [opts.logging=false]
   */
  constructor({
    client, attributesManager, robotsColl, converter, sources, roster, logging = false,
  }) {
    this._client = client;
    this._attrs = attributesManager;
    this._robots = robotsColl;
    this._converter = converter;
    this._sources = sources;
    this._roster = roster;
    this._logging = logging;
    this._subs = new Map();        // uuid -> Subscription[]
    this._lastCcsPoint = new Map();  // uuid -> the last ISO LocationPoint seen, unconverted
    this._lastCcsYaw = new Map();    // uuid -> the last ISO yaw seen, unconverted
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
   * Subscribes to one admitted robot's status, odometry and battery.
   *
   * Per-robot rather than one fleet-wide wildcard, so revoking a robot actually stops the traffic
   * (ND-17: the SDK unsubscribes on the last listener) instead of merely filtering it in ORO.
   *
   * @param {string} uuid the robot's ISO entity uuid, which is also its ORO robot id
   */
  observe = async (uuid) => {
    if (this._subs.has(uuid)) return;
    const { EntityFilter } = this._client.sdk;
    const filter = EntityFilter.entity(uuid);
    const subs = await Promise.all([
      this._client.subscribeResource('status', filter,
        (ev) => this.onStatus(ev.entityUuid, ev.message)),
      this._client.subscribeResource('odometry', filter,
        (ev) => this.onOdometry(ev.entityUuid, ev.message)),
      this._client.subscribeResource('batteryStatus', filter,
        (ev) => this.onBattery(ev.entityUuid, ev.message)),
    ]);
    this._subs.set(uuid, subs);
    if (this._logging) console.log(`ISO 21423 robots: observing ${uuid}`);
  };

  /** Drops every subscription for a revoked robot. Safe when it was never observed. */
  unobserve = async (uuid) => {
    this._lastCcsPoint.delete(uuid);
    this._lastCcsYaw.delete(uuid);
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
      values[this._sources.pose] = { value: { x, y, theta: this._converter.fromCcsYaw(yaw) } };
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

export { IsoTelemetryIngester, mapStatus, OFFLINE_STATES };
