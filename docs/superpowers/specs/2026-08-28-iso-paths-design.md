# ISO robot paths — design

**Date:** 2026-08-28
**Status:** approved

## Problem

The Navigation widget draws robot paths (`localization.paths.<pathId>`, styled per path id from
`uiPreferences.map.robotPath.elementValues`), but only wire-protocol robots publish them. ISO 21423
robots report `globalPlan` / `localTrajectory` / `globalPath`; ORO ignores them and the flatland
iso-agent doesn't send them. There is also no config-as-code way to style paths: InOrbit set
`map.robotPath` from its UI, and neither flatland profile defines it.

## Decisions

1. Report **`globalPlan`** (nav2 `/plan`, on change) and **`localTrajectory`** (nav2 `/local_plan`,
   throttled to 2 Hz). Skip `globalPath` (NURBS) until a real robot sends it.
2. Path ids: `globalPlan` → `"0"` (the id the InOrbit ROS2 agent uses for `/plan`, so one styling
   config covers both transports), `localTrajectory` → `"1"`.
3. Styling via a new **`RobotPath`** ConfigAPI kind: one document per scope with a `paths` map keyed
   by path id, merged robot-over-system per path id.
4. The `robot_footprints` publication becomes `robot_ui_preferences`, delivering the resolved
   `{ pose, robotPath }` per robot; `RobotLayer` already reads both from `uiPreferences.map`.

## 1. Flatland iso-agent (sim-flatland repo)

- Subscribe `/plan` (`nav_msgs/msg/Path`) → `imr.publishGlobalPlan({ globalPlan: points })` on every
  message (the SDK dedupes identical retained payloads, so a re-published unchanged plan is free).
- Subscribe `/local_plan` (`nav_msgs/msg/Path`) → `imr.publishLocalTrajectory({ points })`, throttled
  with the existing `throttle()` to `ISO_LOCAL_TRAJECTORY_HZ` (default 2).
- `toStampedPoints(ccsId, pathMsg)` (pure, in `mapping.js`): each `poses[i].pose.position` →
  `{ timestamp, locationPoint: { ccsId, x, y, z: 0 } }`. nav2 leaves per-pose stamps at 0, so the
  timestamp is the message time (`nowTimestamp()`); the whole path shares it. Empty `poses` → an
  empty array (valid per schema; clears the path).
- Add `'globalPlan'`, `'localTrajectory'` to `capabilities.provides`.
- Tests: `toStampedPoints` shape + schema validation with `assertValid('globalPlan', …)` /
  `assertValid('localTrajectory', …)`.

## 2. ORO ingest — `IsoTelemetryIngester`

- `observe(uuid)` additionally subscribes `globalPlan` → `onGlobalPlan` and `localTrajectory` →
  `onLocalTrajectory`; both call `_savePath(uuid, pathId, stampedPoints)`.
- `_savePath`: ignore when revoked or `!converter.calibrated`; drop points with non-finite `x`/`y`;
  convert each with `converter.fromCcsPoint` (CCS → `map`); write
  `{ $set: { ['paths.' + pathId]: { points: [{x, y}…], ts, frameId: 'map' }, pathsUpdatedTs: ts } }`
  on `localization` (upsert), `ts = Date.now()` (epoch ms — the client merge compares it
  numerically against the live-MQTT `ts`). Same shape `onPath` writes for wire robots.
- Rate limit: at most one write per `(uuid, pathId)` per `ISO_PATH_MIN_MS` (constant 1000 ms) —
  latest wins (a pending write is replaced, not queued). Independent of the wire limiter (60 s),
  because ISO robots have no live-MQTT channel to the widget.
- Not a resolution/precedence concern: paths are telemetry, not config.

## 3. `RobotPath` ConfigAPI kind (app)

```yaml
kind: RobotPath
apiVersion: v0.1
metadata:
  id: system                     # 'system' | <robotId>
spec:
  paths:
    "0":                         # path id as published by the robot
      label: Global plan         # optional, display only
      pointColor: ["#2A3C98", "#7F8CC7", "#C7CCE5"]   # current / recent / stale (1-3 entries)
      lineColor:  ["#2A3C98", "#7F8CC7"]              # current / recent (1-2 entries)
      pointWidth: 3
      lineWidth: 2
      isDashed: false
      shouldPersist: false        # true = never fade with age
    "1":
      label: Local trajectory
      lineColor: ["#B4622A"]
      isDashed: true
```
- `$$strict`; `paths` non-empty object keyed by `^[a-zA-Z0-9_-]+$`; colors `#rrggbb`; widths > 0;
  every field optional per path (renderer defaults apply). Stored as
  `ui_preferences.map.robotPath = { elementList: [ids…], elementValues: { id: {…} } }` at
  system or robot scope (whole object replaced on `apply`; `clear` unsets `map.robotPath`).
- Resolution (shared, pure, alongside `resolveFootprint`): `resolveRobotPath({robotCfg, systemCfg})`
  → per path id, the robot entry if present else the system entry (entry-level override, not
  field-level — a robot that restyles path `"0"` gives the whole style). Returns
  `{ elementValues }` (or `{}`).
- `list` short → `{id, label}`; full round-trips.

## 4. Publication and client

- Rename `robot_footprints` → `robot_ui_preferences` (collection constant, publication, hook
  `useRobotsUiPreferences`). Docs published per robot: `{ _id: robotId, pose, robotPath }`, both
  resolved server-side (`footprintDocsFor` → `uiPreferencesDocsFor`, observing
  `ui_preferences` `map.pose` + `map.robotPath` and `robots.footprint`).
- Hook returns `{ [robotId]: { map: { pose, robotPath } } }`; `LocalizationAdapter` unchanged
  otherwise; `RobotLayer`/`PathLayer` unchanged.
- REST: unchanged (`/footprint` keeps its shape).

## 5. Flatland config, docs, tests

- `oro-config/paths.yaml` (profile-independent, system scope): styles for `"0"` and `"1"` as above.
  Applies to the ros2 profile's `/plan` (`"0"`) too.
- Docs: `configapikinds.md` (`RobotPath`), `maps.md` "Robot paths" paragraph (ids, ISO sources,
  rates), `iso-robots-setup.md` (paths now used; remove from known limitations).
- Tests — app: kind apply/list/clear/round-trip/schema rejects; `resolveRobotPath` override per id;
  publication resolution includes `robotPath`. Ingest: CCS→map conversion of stamped points, rate
  limit (latest wins), empty path clears, uncalibrated → no write. Agent: `toStampedPoints` + schema.
  Manual: flatland ISO profile — send a nav goal, global plan appears (styled), local trajectory
  updates ~2 Hz; ros2 profile — `/plan` styled by the same config.

Out of scope: `globalPath` (NURBS), path length simplification (agent-side for wire; nav2 plans are
short enough), per-field merge of path styles.
