# Robot footprint — design

**Date:** 2026-08-27
**Status:** approved

## Problem

The Navigation widget draws every robot as a default 0.45 m ring. Operators want the robot's real
outline (polygon or radius) and colors, per robot or fleet-wide, and ISO 21423 robots already report
their outline in `identity.details.imrFootprint`. ORO has the renderers (`RobotPoseLayer`,
`RobotBufferFootprintLayer`) but nothing feeds them (`LocalizationAdapter` hardcodes
`robotsUiPreferences = {}`), and the `RobotFootprint` ConfigAPI kind is only a constant.

Reference: InOrbit's `RobotFootprint` kind, which writes `UIPreferences.map.pose` and whose
scopes (robot → tag → account) merge field-wise. ORO has a single fleet, so scopes are
`system` and `<robotId>`.

## Decisions

1. **Configured overrides reported.** ISO-reported footprints are stored separately as the robot's
   default; a robot-scope `RobotFootprint` beats it, which beats the system-scope one.
2. **ISO: identity only.** `identity.details.imrFootprint`/`imrHeight` (retained, static). The live
   `footprint` resource is out of scope.
3. **`bufferFootprint` is accepted and stored but not rendered** until zones exist.

## 1. Data model

### Configured — `ui_preferences` (existing collection, InOrbit shape)

```
{ entityType: 'system' | 'robot', entityId: '0' | <robotId>,
  map: { pose: { footprint: [[x,y],…], bufferFootprint: [[x,y],…], radius,
                 primaryColor, secondaryColor, opacity } } }
```
Unique index `{entityType, entityId}` (add in `collections.js`). Polygons stored as `[x, y]`
pairs in metres, robot frame (+x forward), which is what `RobotPoseLayer` consumes. Validation on
write with the existing `Schemas.PosePreferenece` (`app/imports/lib/uiPreferences.js`).
Suppression (InOrbit semantics): `{ footprint: null, bufferFootprint: null, radius: null }`.

### Reported — `robots.footprint`

```
footprint: { points: [[x,y],…], height, ts, source: 'iso21423' }
```
Written by ISO ingest only; never touched by the kind. Valid when ≥3 finite points.

### Resolution — `resolveFootprint({ robotCfg, systemCfg, reported })` (shared, pure)

1. Field-wise merge: each of `footprint, bufferFootprint, radius, primaryColor, secondaryColor,
   opacity` takes the robot-scope value when defined (`null` counts as defined = suppressed),
   else the system-scope value.
2. If the merged result defines neither `footprint` nor `radius` (both undefined, not null) and
   `reported.points` is valid → `footprint = reported.points`.
3. Nulls are dropped from the output. Returns a `map.pose`-shaped object (may be `{}`); the
   renderer's defaults (0.45 m ring) remain the final fallback.

## 2. ConfigAPI kind `RobotFootprint`

```yaml
kind: RobotFootprint
apiVersion: v0.1
metadata:
  id: system                 # 'system' | <robotId>
spec:                        # all optional; `spec: null` suppresses
  footprint: [{x: 0.3, y: 0.2}, {x: 0.3, y: -0.2}, {x: -0.3, y: -0.2}, {x: -0.3, y: 0.2}]
  bufferFootprint: [...]     # stored, not rendered yet
  radius: 0.3                # metres; also sizes the orientation arrow (0 = none)
  primaryColor: "#2A3C98"
  secondaryColor: "#CCCCCC"
  opacity: 1
```
- `$$strict`; polygons `array min 3` of `{x: number, y: number}`; colors `^#[0-9a-fA-F]{6}$`;
  `opacity` 0–1; `radius` ≥ 0. Handler converts `{x,y}` → `[x,y]` on write and back on `list`.
- `apply` upserts `map.pose` for the entity (whole object replaced, like InOrbit's
  `updatePreference`); `spec: null` writes the suppression triple; `clear` unsets `map.pose`.
- `list` short → flat `{id, label}` (label = id); full → re-applicable object.
- Auth: fleet `configure` guard shared with the other kinds (`isoRobots.js`).
- REST `GET /api/robots/{robotId}/footprint` (un-comment the route in `rest/robots.js`) →
  resolved `{footprint, bufferFootprint, radius}` (pairs), `{}` when none; `ACCESS_LEVEL_VIEW`.

## 3. Server → client

- Publication `robot_footprints({ robotIds })`: `canAccessRobots(VIEW)`; observes
  `ui_preferences` (system doc + those robots) and `robots` (`footprint` field) and publishes the
  **resolved** pose preferences per robot into the client-only `robot_footprints` collection as
  `{ _id: robotId, pose }` (same pattern as `robot_maps`; avoids DDP merge-box field shadowing and
  keeps resolution server-side in one place). Recompute for a robot on any change to its inputs.
- Client hook `useRobotsFootprints(robotIds)` → `{ [robotId]: { map: { pose } } }`.
  `LocalizationAdapter` passes it as `robotsUiPreferences`. `RobotPoseLayer` needs no change.
- `RobotBufferFootprintLayer` stays wired but `showBufferFootprint` remains false (decision 3).

## 4. ISO 21423 ingest and flatland agent

- `IsoTelemetryIngester.observe(uuid)` also subscribes to the retained `identity` resource; on a
  message with `details.imrFootprint` of ≥3 finite `{x,y}` points → upsert
  `robots.footprint = { points: [[x,y]…], height: details.imrHeight, ts, source: 'iso21423' }`.
  Malformed → one warn per robot, no write. Nothing else in ingest changes.
- Flatland `iso-agent` (sim-flatland repo, separate PR): publish a spec-valid `imrIdentity` in
  `details`: `imrModel: 'flatland-nav2'`, `imrSerialNumber` (the uuid), `imrFootprint` = 16-point
  polygon of the turtlebot body circle (`worlds/turtlebot.model.yaml`: radius 0.22 m),
  `imrWorkingArea` = same, `imrHeight: 0.4`, `softwareVersions: [{name:'iso-agent', version}]`.

## 5. Docs and tests

- Docs: `configapikinds.md` (kind reference), `maps.md` "Robot footprint" section (precedence
  rules), `iso-robots-setup.md` (identity footprint now used; remove `footprint` from known
  limitations).
- Tests (app mocha): kind apply/list(short+full round-trip)/clear/suppress, `{x,y}`→`[x,y]`,
  schema rejects (2 points, bad color, opacity 2); `resolveFootprint` precedence table (robot >
  system > reported > none; null suppression; field-wise merge); REST footprint. Ingest mocha:
  identity → `robots.footprint` valid/invalid. Manual: flatland ros2 with system footprint then
  robot override; ISO robot shows reported polygon, then config override.

Out of scope: live `footprint` resource, rendering `bufferFootprint`, inflation, authoring tools.
