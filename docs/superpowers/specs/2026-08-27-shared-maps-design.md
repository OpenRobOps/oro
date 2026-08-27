# Shared ("pretty") maps — design

**Date:** 2026-08-27
**Status:** approved

## Problem

The Navigation widget can only show the occupancy grid a robot publishes over MQTT. Operators
want to display nicer, human-oriented maps (site drawings, rendered floor plans) and switch
between them and the raw grid. ISO 21423 robots publish no map at all, so an uploaded map is
the only way to see them on a map. Maps must be shareable across robots, and robots may still
carry several maps of their own.

Reference implementation: the InOrbit platform's "location maps" (`spatial_annotations` v2 shape,
`spatial_transformations` matrices, `MapSelector` switcher). This design ports that model with one
simplification: ORO has a single implicit location, so shared maps live at **system scope**
instead of on a location/area entity. A future "areas" extension swaps `entityId: '0'` for an
area id; nothing else changes.

## Scope

In: data model, two ConfigAPI kinds, listing/publications, Navigation widget switcher and pose
transforms, CCS unification, a PNG→YAML helper, flatland bootstrap example.
Out (noted as TODOs where relevant): REST multipart upload, areas/collections, bitmap warping,
object storage.

## 1. Data model

No new collections.

### Maps — `spatial_annotations`

InOrbit v2 shape, entity-generic:

```
{
  entityType: 'system' | 'robot',
  entityId:   '0' | <robotId>,
  label:      <mapId>,                 // unique per entity; what the UI selects
  type:       'map',
  frameId:    <frame the image is drawn in>,
  annotation: {
    label,                             // display name
    x, y,                              // world metres of the image's bottom-left corner
    resolution,                        // metres / pixel
    width, height,                     // pixels, computed server-side
    formatVersion: 1 | 2,              // 1 = image is vertically flipped, 2 = as uploaded
    dataHash,                          // md5 of PNG bytes
    data                               // base64 PNG (Mongo; 12 MB cap like ingest)
  },
  createdTs, updatedTs
}
```

Robot grids ingested from MQTT keep today's legacy `map: {…}` shape untouched. A shared
`normalizeMapAnnotation(doc)` (port of InOrbit's `formatAnnotationDocument`) returns
`{ entity: {entityType, entityId, frameId}, annotation: {annotationId, label, x, y, resolution,
width, height, formatVersion, dataHash, data} }` for both shapes so the client sees one shape.

### Transforms — `spatial_transformations` (existing schema, currently unused)

```
{ entityType, entityId,
  transformations: { <srcFrameId>: { frameId: <dstFrameId>, aTb: { m: 3x3 } } } }
```

- `entityType:'system', entityId:'0'` — shared transforms (e.g. `map` → `<ccsId>`).
- `entityType:'robot'` — per-robot overrides.
- Lookup order for frame F→G: robot entry, then system entry, then identity if F === G, else
  **none**. Inverses are derived (`inv(m)`) — never stored twice.

## 2. ConfigAPI kinds

Both follow the existing envelope `{kind, apiVersion:'v0.1', metadata:{id}, spec}` and are
handled in `app/imports/server/configAPI/`, registered in `configAPI.js`, validated with
`fastest-validator`, and bootstrappable from `app/private/bootstrap/<Kind>.yaml`.

### `SpatialAnnotation` (constant already exists, no handler yet)

```yaml
kind: SpatialAnnotation
apiVersion: v0.1
metadata:
  id: warehouse-pretty            # -> label / mapId
spec:
  scope: system                   # 'system' (default) | <robotId>
  type: map                       # only 'map' supported now
  frameId: map                    # frame the image is drawn in
  label: Warehouse (rendered)     # display name
  x: 0.0
  y: 0.0
  resolution: 0.0125
  formatVersion: 2                # default 2
  image: <base64 PNG>
```

Handler: decode base64, check PNG magic, reject > 12 MB decoded, `width/height` via
`image-size`, `dataHash` md5, upsert `{entityType, entityId, label}`. `list` strips
`annotation.data`; `format=full` includes `image` again so a config round-trips. `clear` removes
the doc.

### `SpatialTransformation` (handler exists commented out; finish it)

```yaml
kind: SpatialTransformation
apiVersion: v0.1
metadata:
  id: system                      # 'system' | <robotId>
spec:
  transformations:
    - from: map
      to: facility-ccs-1
      matrix: [[c,-s,tx],[s,c,ty],[0,0,1]]     # either matrix …
    - from: map
      to: other-frame
      referencePoints:                          # … or ≥3 pairs, fit server-side
        - { from: {x: 0, y: 0}, to: {x: 10.2, y: 3.1} }
        - …
```

Handler: exactly one of `matrix` / `referencePoints` per entry; `matrix` validated like
InOrbit's `assertValidTransformationMatrix` (3x3, last row `[0,0,1]`, finite, rotation block
orthonormal within tolerance); `referencePoints` fitted with the ISO SDK geometry
(`fitTransform`) already used by `ingest/src/server/iso21423/ccs.js`. Stores the resulting `aTb.m`
under `transformations[from] = {frameId: to, aTb}`. One `from` key per entity (schema constraint).

### Upload path

ConfigAPI is the primary and only implemented path (`POST /api/configuration/apply`, or bootstrap
YAML as project start code). A `// TODO: REST multipart POST /api/maps for browser uploads and
PNGs too large for base64-in-JSON` goes next to the commented `rest/maps` import in
`app/imports/server/rest_api.js`.

## 3. CCS unification

A CCS id **is** a frameId. Facility maps drawn in facility coordinates declare
`frameId: <ccsId>`; robot grids stay in `map`.

- The `map → <ccsId>` rigid transform becomes the system-scope `spatial_transformations` entry.
- `CcsConverter.create()` (ingest) reads that entry first; if absent, it fits
  `settings.iso21423.ccs.referencePoints` as today **and writes** the fitted matrix to the
  system entry so both paths converge. `settings.iso21423.ccs.id` remains the frame name.
- Ingest keeps converting ISO poses into `map` on the way in; nothing downstream changes.

## 4. Server → client

- Publication `spatial_annotations.maps(robotId)`: `{type:'map'}` (or legacy `type` absent) for
  `$or: [{entityType:'robot', entityId: robotId}, {entityType:'system', entityId:'0'}]`, metadata
  only (`annotation.data` / `map.data` excluded).
- Publication `spatial_annotations.map({entityType, entityId, label})` (today's, widened from
  robot-only) — full doc incl. image data for the selected map.
- Publication `spatial_transformations(robotId)`: robot + system docs.
- REST `GET /api/robots/{robotId}/localization/*` untouched.

## 5. Client (Navigation widget)

- **Map list**: hook `useRobotMapsList(robotId)` → `{ maps: [{mapId, label, entityType, frameId}],
  defaultMapId }`; default = `localization.defaultMap` if present, else the first system map.
- **Switcher**: port InOrbit's `MapSelector` into `NavigationControlBar`, shown when
  `maps.length > 1`. Selection stored in dashboard context (`mapLabel` path that already reaches
  `LocalizationAdapter`); a widget `config.mapId` pins the map and hides the switcher.
- **Map data**: `useMeteorMapData` takes `{entityType, entityId, label}`; returns normalized
  metadata + `frameId` + `data:` URL.
- **Frames**: `useFrameTransform(robotId, fromFrame, toFrame)` → 3x3 or `null` (lookup order in
  §1). Robot frame = `localization.map.frameId || 'map'`. In `Localization.js`, when a transform
  exists and is not identity, pose/lasers/paths/costmap origin pass through
  `transformPose()` (`app/imports/shared/geometry.js`) before `RobotLayer`; `WaypointNav` /
  `Relocalize` apply the inverse before dispatching actions. When no transform exists: render the
  map, hide robot layers, show a banner "No transform from `<F>` to `<G>` for this robot".
- **`MapImageLayer`**: unique projection code per instance via existing
  `createImagePixelProjection(codePrefix)` so two rasters can coexist.

## 6. Tooling

`tools/png2map.py` (stdlib only, ~30 lines):

```
png2map.py image.png --id warehouse-pretty --frame map --resolution 0.0125 --x 0 --y 0 \
  [--label "Warehouse"] [--scope system] [--from-ros-yaml map.yaml] > SpatialAnnotation.yaml
```

`--from-ros-yaml` lifts `resolution` and `origin[0..1]` from a ROS map yaml. Output is a
ready-to-`apply` document.

## 7. Bootstrap / flatland

`app/private/bootstrap/SpatialAnnotation.yaml` ships the flatland pretty map
(`sample_map_pretty_1600x1600.png`, `frameId: map`, `resolution: 0.0125`, origin `0,0`,
`formatVersion: 2` — the PNG is displayed as-is; in the widget's y-up pixel space `1` would mirror it, and the agent publishes its own grid as `2` too). Applied only when no
`SpatialAnnotation` exists (existing bootstrap rule). Docs: a short page under
`website/docs/` describing the two kinds and the helper.

## 8. Testing

Automated (Jest, existing runners):
- `SpatialAnnotation` handler: schema rejects, size cap, PNG magic, width/height/hash computed,
  upsert idempotent, `list` strips image.
- `SpatialTransformation` handler: matrix validation, fit from reference points (known
  rotation+translation recovered), mutual exclusion of `matrix`/`referencePoints`.
- `useRobotMapsList` / publication query: robot ∪ system, default selection rules.
- `useFrameTransform`: robot beats system, identity when equal, `null` otherwise.
- Pose round-trip: `transformPose(inv(m), transformPose(m, p)) ≈ p`.
- `CcsConverter.create` prefers the Mongo entry and writes back the settings-derived fit.

Manual (flatland + ISO Robots setup):
- Switch raw ↔ pretty; robot pose, lasers and path line up on both.
- ISO robot with no own map renders on the shared map.
- A second shared map in the CCS frame renders the robot through the `map → ccs` transform.
- Click-to-navigate on the pretty map sends the correct `map`-frame goal.
- Robot with no transform to a CCS-frame map shows the banner, not a misplaced robot.

## Notes / future

- REST multipart upload (TODO in `rest_api.js`).
- Areas: `entityType:'area', entityId:<areaId>` + robot membership; listing becomes robot ∪ area.
- Bitmap warping on import (InOrbit still has this as TODO too).
- Object storage: client already prefers `objectUrl` when it starts with `http`.
