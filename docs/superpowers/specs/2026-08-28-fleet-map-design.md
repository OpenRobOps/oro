# Fleet map (multiple robots on the map) — design

**Date:** 2026-08-28
**Status:** approved

## Problem

The Navigation widget and the Map widget always render exactly one robot: every caller passes
`[selectedRobotId]`. The rendering stack is already fleet-ready — `LocalizationAdapter`, the
`localization` / `robot_ui_preferences` publications, the MQTT data source and `Localization.js`'s
per-robot `RobotLayer` loop (heavy layers only for the selected robot, click-to-select) all take
arrays. InOrbit shows "all robots in the selected robot's location"; ORO has one implicit location.

## Decisions

1. **Robot set = every robot the user can see** (online ones drawn, as today). No config.
2. **Map choice unchanged**: Navigation switcher (selected robot's maps ∪ shared), Map widget
   `config.mapId` → selected robot default → first shared map. Other robots are drawn on the
   selected map through their own frame transform.
3. **Per-robot frame transforms**; robots with no transform to the map frame are skipped
   individually (small note), never blanking the whole map.
4. **Robot name labels** (port of InOrbit `RobotName.js`) as a map layer, default on when more
   than one robot is displayed.
5. **Bandwidth**: non-selected robots via Mongo only, low-bandwidth (no lasers/paths); live MQTT
   only for the selected robot. No robot cap (follow-up knob).

## 1. Robot set

- `useFleetRobotIds()` (client hook, `app/imports/client/oro/hooks/useFleetRobotIds.js`): subscribes
  `robots` (existing publication), returns the sorted array of robot ids, deep-compared so the
  reference only changes when the set changes.
- `NavigationDetail/index.js` and `Dashboard_index.js` (`LocalizationWidgetWithContext`) pass
  `robotIds={fleetRobotIds}`; `selectedRobotId` stays the dashboard-context robot. The dead
  `options` prop on the Map widget is removed.

## 2. Per-robot frames and transforms

- Publication `spatial_transformations({ robotIds })` (accepts `robotId` too, for compatibility):
  robot docs for the set + the system doc; `canAccessRobots(VIEW)`.
- `useFrameTransforms({ robotIds, robotFrames, to })` → `{ [robotId]: transform | null }` using
  `findFrameTransform` per robot; `robotFrames[robotId] = localization.map.frameId || 'map'`.
- `LocalizationAdapter`: `filteredRobotLocalizationData[rId] = transformLocalizationData(data, transforms[rId])`
  only for robots whose transform is non-null; the others are dropped from the rendered set and
  counted. `map.noTransform` (banner + hide interactions) now applies only when the **selected**
  robot has no transform; a separate `map.skippedRobots` count feeds a small note
  ("N robots not shown: no transform to `<frame>`").

## 3. Robot names

- `RobotLayers/RobotName.js`: OpenLayers overlay anchored at the pose (+25,−30 px), text =
  `robotDetails.name || robotId`, selected robot highlighted (primary color background), zIndex
  above avatars. Rendered from `RobotLayer` when `showRobotNames`.
- `mapLayers.js` gains `robotNames` ("Names"); `Localization.js` passes
  `showRobotNames={isLayerVisible(ROBOT_NAMES)}`. Default visibility: on when
  `robotsLocalizationData` has more than one robot, off otherwise (computed once per mount/robot-set
  change unless the user toggled it).

## 4. Bandwidth

- `useMeteorLocalizationData({ robotIds, selectedRobotId })`: two subscriptions —
  `localization({ robotIds: others, lowBandwidth: true })` and
  `localization({ robotIds: [selected] })`; `lowBandwidth` keeps working as a global override.
- `MqttLocalizationDataSources`: `useDirectClientMulti` for `ros/loc/data2` / `ros/loc/path` only
  with `[selectedRobotId]`; other robots' poses come from Mongo.

## 5. Tests

- `useFleetRobotIds` reference stability (pure helper `stableIds(prev, next)`).
- Per-robot transform helper and the skip/draw partition (pure, in `shared/maps.js`).
- `spatial_transformations` publication accepts `robotIds` and returns robot docs + system doc.
- Live (flatland ros2 + ISO): both robots on the shared map with names; click to select either;
  lasers/paths only for the selected; ISO robot skipped with the note when the map is in a CCS frame
  without a transform; single-robot view unchanged.

Out of scope: configurable robot sets / areas, per-robot dimming, clustering, robot cap.
