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
 * Translates ORO operator commands into ISO 21423 requests.
 *
 * The seam is deliberately outside the Meteor app: ORO's Actions framework already publishes
 * agent-bound commands to `r/<robotId>/<subtopic>` (`app/imports/server/modules/nav2d.js:69-95`),
 * and ingest is on the same broker, so this module listens exactly where a robot agent would.
 * Nothing app-side changes — which also means ISO robots inherit ORO's operator locks, argument
 * validation and audit logging for free.
 *
 * TODO(iso-seam): this seam is a deliberate SHORTCUT (pinned decision 8). Subscribing to the
 * agent-bound topics keeps ORO's app 100% unchanged AND lands each command on the ingest instance
 * that owns the robot's broker for free — ingest runs one instance per broker
 * (`src/server/mqtt.js:311-321`, `:744-758`), so broker affinity does the routing. It is NOT the
 * end state. The natural evolution is an ISO-kind ActionDefinition executor inside `ActionsEngine`,
 * expressing "this robot speaks ISO" as a first-class transport instead of inferring it from a
 * topic subscription — rejected for now precisely because an app-side executor has no broker
 * affinity and would need instance routing invented for it. Do not mistake this file for the
 * design; it is the cheapest thing that preserves existing behaviour while the ISO direction
 * proves itself.
 *
 * Two wire details matter and are easy to get wrong:
 *   1. `publishAsync` prepends a sequence number (`app/imports/server/mqtt.js:481`), so a nav goal
 *      arrives as `"<seq>|<executionTs>|<x>|<y>|<theta>"`, not the four fields nav2d builds.
 *   2. That same call REJECTS after 10 s without an `oro.Echo` on `r/<robotId>/echo`
 *      (`app/imports/server/mqtt.js:341-347`), which `ActionsEngine` reports as "Timeout waiting
 *      for robot response" (`app/imports/server/actions.js:1186-1190`). A real agent echoes; so
 *      does this module, before dispatching, because an echo means "received" and nothing more.
 */

/** Subtopic ORO agents echo on; `OroMqtt` registers `r/+/echo` for the reverse direction. */
const ECHO_SUBTOPIC = 'echo';

/**
 * OpenRobOps-defined request detail carrying a PublishToTopic action's message verbatim. The
 * robot side republishes `properties.command` wherever its agent used to. ISO 21423 §6 leaves the
 * action `type` vocabulary open, so this is a vendor type under the default `ISO-21423` format
 * (the SDK's executor rejects any other `format`, so the detail does not set one); the robot must
 * list `customCommand` in its `accepts`.
 */
const customCommandDetail = (command) => ({
  type: 'customCommand', version: '1.0', blocking: true, atomic: false, properties: { command },
});

/** `dock` → nearest dock (id null); `dock=A` → dock id "a"; anything else → undefined. */
const parseDockCommand = (cmd) => {
  if (cmd === 'dock') return { dockId: null };
  if (cmd.startsWith('dock=') && cmd.length > 5) return { dockId: cmd.slice(5).toLowerCase() };
  return undefined;
};

/**
 * Parses a nav-goal payload.
 *
 * @param {Buffer|string|undefined} payload the raw MQTT body
 * @returns {{seq: string, executionTs: number, x: number, y: number, theta: number}|null}
 *   null when the shape is not the expected five pipe-separated fields with numeric coordinates
 */
const parseNavGoal = (payload) => {
  if (payload === undefined || payload === null) return null;
  const parts = String(payload).split('|');
  if (parts.length !== 5) return null;
  const [seq, tsRaw, xRaw, yRaw, thetaRaw] = parts;
  const executionTs = Number(tsRaw);
  const x = Number(xRaw);
  const y = Number(yRaw);
  const theta = Number(thetaRaw);
  if (![executionTs, x, y, theta].every(Number.isFinite)) return null;
  return { seq, executionTs, x, y, theta };
};

class IsoCommandRouter {
  /**
   * @param {Object} opts
   * @param {Object} opts.oroMqtt the OroMqtt singleton
   * @param {Object} opts.imrfm ORO's own IMRFM EntityHandle, used as the request source
   * @param {Object} opts.roster the AdmittedRoster
   * @param {Object} opts.converter a CcsConverter (ORO map → CCS for move targets)
   * @param {Object} opts.sdk the loaded SDK namespace, for the action builders
   * @param {Object} opts.commandTopics `config.commandTopics`
   * @param {Object} opts.telemetry the IsoTelemetryIngester, for `lastCcsPose` (decision 15)
   * @param {boolean} [opts.logging=false]
   */
  constructor({
    oroMqtt, imrfm, roster, converter, sdk, commandTopics, telemetry, docks = {}, logging = false,
  }) {
    this._docks = docks;
    this._mqtt = oroMqtt;
    this._telemetry = telemetry;
    this._imrfm = imrfm;
    this._roster = roster;
    this._converter = converter;
    this._sdk = sdk;
    this._topics = commandTopics;
    this._logging = logging;
    this._inFlight = new Map();   // robotId -> RequestHandle of the current move
  }

  /**
   * Installs one OroMqtt listener per configured subtopic. Pause and resume are skipped when the
   * deployment has not named the subtopics its own pause/resume actions publish to.
   */
  register = () => {
    this._mqtt.registerListener(this._topics.navGoal, (robotId, msg) => this.onNavGoal(robotId, msg));
    this._mqtt.registerListener(this._topics.cancelNav, (robotId) => this.onCancelNav(robotId));
    if (this._topics.customCommand) {
      this._mqtt.registerListener(this._topics.customCommand,
        (robotId, msg) => this.onCustomCommand(robotId, msg));
    }
    if (this._topics.pause) {
      this._mqtt.registerListener(this._topics.pause, (robotId) => this.onPause(robotId));
    }
    if (this._topics.resume) {
      this._mqtt.registerListener(this._topics.resume, (robotId) => this.onResume(robotId));
    }
  };

  /**
   * Handles an ORO nav goal: echoes it so the app's `publishAsync` resolves, then sends an ISO
   * `move` with the target converted into the facility CCS.
   *
   * Deliberately does NOT echo when the goal is unusable — an unadmitted robot, a malformed
   * payload, or an uncalibrated CCS. Withholding the echo makes the operator's action fail
   * visibly ("Timeout waiting for robot response") instead of appearing to succeed while nothing
   * moves.
   */
  onNavGoal = async (robotId, msg) => {
    if (!this._roster.isAdmitted(robotId)) return;
    const goal = parseNavGoal(msg);
    if (!goal) {
      console.warn(`ISO 21423 robots: unparseable nav goal for ${robotId}: ${String(msg)}`);
      return;
    }
    if (!this._converter.calibrated) {
      console.warn(`ISO 21423 robots: refusing a nav goal for ${robotId} — CCS is uncalibrated: `
        + this._converter.reason);
      return;
    }

    await this._echo(robotId, this._topics.navGoal, String(msg));

    const location = this._converter.toLocationPoint({ x: goal.x, y: goal.y });
    const orientation = this._converter.toOrientation({ theta: goal.theta });
    try {
      const handle = await this._imrfm.sendRequest({
        destination: robotId,
        destinationType: 'IMR',
        details: [this._sdk.move({ location, orientation })],
      });
      this._trackInFlight(robotId, handle);
    } catch (err) {
      console.warn(`ISO 21423 robots: move request failed for ${robotId}: ${err.message}`);
    }
  };

  /**
   * Handles ORO's cancel-nav command.
   *
   * With a `move` in flight, cancels it. With nothing in flight, sends a `move` to the robot's
   * CURRENT position — NOT `pauseImr` (decision 15). `pauseImr` would be the wrong verb: a later
   * `resumeImr` would carry on navigating, which is exactly what the operator asked to stop. ORO's
   * own semantics are literally "override the goal with the current pose"
   * (`app/imports/server/modules/nav2d.js:60-66`), so a `move` to here is the faithful translation.
   *
   * The target is reused verbatim in its original CCS frame, so no transform runs. With no odometry
   * seen yet there is nothing to stop and nothing honest to aim at, so this no-ops with a
   * diagnostic rather than fabricating a goal.
   */
  onCancelNav = async (robotId) => {
    if (!this._roster.isAdmitted(robotId)) return;

    const handle = this._inFlight.get(robotId);
    if (handle) {
      this._inFlight.delete(robotId);
      try {
        await handle.cancel();
      } catch (err) {
        console.warn(`ISO 21423 robots: cancel failed for ${robotId}: ${err.message}`);
      }
      return;
    }

    const here = this._telemetry.lastCcsPose(robotId);
    if (!here) {
      this._imrfm.ctx.diagnostic('cancel-nav-no-pose', { robotId });
      console.warn(`ISO 21423 robots: cancel-nav for ${robotId} ignored — no odometry seen yet, `
        + 'so there is no known position to stop at.');
      return;
    }
    await this._send(robotId, this._sdk.move({
      location: here.locationPoint,
      orientation: { yaw: here.yaw, pitch: 0, roll: 0 },
    }));
  };

  /**
   * Handles a PublishToTopic action's message. `dock`/`dock=<id>` are translated to the native
   * ISO `dock` action; every other message is forwarded verbatim as an OpenRobOps `customCommand`.
   */
  onCustomCommand = async (robotId, msg) => {
    if (!this._roster.isAdmitted(robotId)) return;
    let cmd;
    try {
      cmd = this._mqtt.lookupType('oro.CustomCommandRosMessage').decode(msg).cmd;
    } catch (err) {
      console.warn(`ISO 21423 robots: undecodable custom command for ${robotId}: ${err.message}`);
      return;
    }
    const dock = parseDockCommand(cmd);
    if (dock) {
      await this.onDock(robotId, dock.dockId);
      return;
    }
    await this._send(robotId, customCommandDetail(cmd));
  };

  /**
   * Sends the native ISO `dock` action (with `dockActions: ['CHARGE']`) to the dock named by
   * `dockId`, or to the dock nearest the robot's last-seen position when `dockId` is null.
   * Docks come from `iso21423.robots.docks` (ORO map frame) and are converted into the CCS.
   */
  onDock = async (robotId, dockId) => {
    if (!this._converter.calibrated) {
      console.warn(`ISO 21423 robots: refusing a dock for ${robotId} — CCS is uncalibrated: `
        + this._converter.reason);
      return;
    }
    let id = dockId;
    if (id === null) {
      const here = this._telemetry.lastCcsPose(robotId);
      const ids = Object.keys(this._docks);
      if (!here || !ids.length) {
        console.warn(`ISO 21423 robots: dock for ${robotId} ignored — `
          + (ids.length ? 'no odometry seen yet, so no nearest dock' : 'no docks configured'));
        return;
      }
      const dist = (d) => {
        const p = this._converter.toLocationPoint(this._docks[d]);
        return (p.x - here.locationPoint.x) ** 2 + (p.y - here.locationPoint.y) ** 2;
      };
      id = ids.reduce((best, d) => (dist(d) < dist(best) ? d : best));
    }
    const dock = this._docks[id];
    if (!dock) {
      console.warn(`ISO 21423 robots: unknown dock "${id}" for ${robotId}; configured: `
        + `${Object.keys(this._docks).join(', ') || '(none)'}`);
      return;
    }
    const handle = await this._send(robotId, this._sdk.dock({
      dockLocation: this._converter.toLocationPoint(dock), dockActions: ['CHARGE'],
    }));
    if (handle) this._trackInFlight(robotId, handle);
  };

  /** Remembers the in-flight motion request so a cancel-nav can cancel it. */
  _trackInFlight = (robotId, handle) => {
    this._inFlight.set(robotId, handle);
    // Free the slot on completion however it ends, so a later cancel-nav pauses rather than
    // trying to cancel a finished request.
    if (handle.completion) {
      handle.completion().catch(() => {}).finally(() => {
        if (this._inFlight.get(robotId) === handle) this._inFlight.delete(robotId);
      });
    }
  };

  /** Handles the deployment's pause action. */
  onPause = async (robotId) => {
    if (!this._roster.isAdmitted(robotId)) return;
    await this._send(robotId, this._sdk.pauseImr());
  };

  /** Handles the deployment's resume action. */
  onResume = async (robotId) => {
    if (!this._roster.isAdmitted(robotId)) return;
    await this._send(robotId, this._sdk.resumeImr());
  };

  /** Sends one request detail; returns its handle, or undefined on failure. Never throws onto the MQTT callback. */
  _send = async (robotId, detail) => {
    try {
      return await this._imrfm.sendRequest({
        destination: robotId, destinationType: 'IMR', details: [detail],
      });
    } catch (err) {
      console.warn(
        `ISO 21423 robots: ${detail.type} request failed for ${robotId}: ${err.message}`);
      return undefined;
    }
  };

  /**
   * Publishes the `oro.Echo` the app's pending callback is waiting for.
   *
   * `stringPayload` carries the payload VERBATIM, sequence prefix included — that prefix is how
   * `_callbackSend` correlates the reply (`app/imports/server/mqtt.js:471-482`).
   */
  _echo = async (robotId, subtopic, payload) => {
    try {
      const Echo = this._mqtt.lookupType('oro.Echo');
      await this._mqtt.publishProtobuf(robotId, ECHO_SUBTOPIC, {
        timeStamp: Date.now(),
        topic: subtopic,
        stringPayload: payload,
      }, Echo);
    } catch (err) {
      console.warn(`ISO 21423 robots: failed to echo ${subtopic} for ${robotId}: ${err.message}`);
    }
  };
}

export { IsoCommandRouter, parseNavGoal, parseDockCommand, customCommandDetail, ECHO_SUBTOPIC };
