# Aligning a robot map to a floor plan

Robots localize against their own SLAM grid, in their own frame (usually `map`). To draw them
on a "pretty" floor plan you need two things: the plan itself, and the rigid transform that
maps a pose in the robot's frame onto the plan's frame. Both are ConfigAPI documents.

```
robot pose (frame "map") --[SpatialTransformation map->location]--> pose on the plan (frame "location")
                                                                        |
                                              SpatialAnnotation type: map, frameId: location
```

The transform is rotation + translation only, no scale. If a plan does not fit without
scaling, its `resolution` is wrong; fix that first.

## 1. What a map document says

```yaml
kind: SpatialAnnotation
spec:
  type: map
  frameId: location    # frame the image is drawn in; any string, must match the transform's `to`
  x: -12.3             # world coordinates of the image's origin pixel (see formatVersion)
  y: -15.8
  resolution: 0.0125   # metres per pixel
  formatVersion: 1     # y-axis convention of the image, below
  image: <base64 PNG>
```

`formatVersion` decides how a pixel row becomes a world y. Getting it wrong for either image
produces a mirrored map that no rotation can fit.

| formatVersion | `(x, y)` is | world y of pixel row `r` (0 = top) | typical source |
|---|---|---|---|
| 1 | the top-left pixel | `y + r * resolution` | tools that store image rows top-down; the default |
| 2 | the bottom-left pixel | `y + (height - r) * resolution` | ROS `map_server` PGM/PNG + yaml |

World x is `x + col * resolution` in both. Generate the document with `tools/png2map.py`
(`--format-version 2 --from-ros-yaml map.yaml` for ROS maps).

For a hand-drawn or scanned plan you choose the metadata yourself: `resolution` is a known
distance in metres divided by its length in pixels (measure the longest wall you can), and
`x`, `y` can simply be `0, 0` since the transform absorbs any offset. Pick `formatVersion: 2`
if you think of the drawing as a normal plot with y pointing up, `1` if you prefer to reason
in image rows. Whatever you choose, use the same values in step 3.

## 2. What a transform document says

```yaml
kind: SpatialTransformation
metadata:
  id: system                       # shared by every robot; or a robot id for a per-robot override
spec:
  transformations:
  - from: map                      # robot frame (robot's localization.map.frameId, default "map")
    to: location                   # the plan's frameId
    matrix:                        # [[cos, -sin, tx], [sin, cos, ty], [0, 0, 1]]  ... OR ...
    referencePoints:               # >= 3 pairs, server fits the rigid transform (2D Kabsch)
    - { from: {x: 0, y: 0},   to: {x: 27.10, y: -3.45} }
    - { from: {x: 10, y: 0},  to: {x: 17.31, y: -1.43} }
    - { from: {x: 0, y: 10},  to: {x: 25.08, y: -13.24} }
```

Exactly one of `matrix` / `referencePoints` per entry. With no transform between the two
frames ORO shows the plan with a "No transform from map to location" banner and hides robots.

## 3. Getting the transform

### Option A: reference points, no tooling

Pick three or more landmarks visible in both images and far apart (room corners, dock, door
frame). For each one:

1. Robot-frame coordinates: park the robot there and read its pose, or convert the pixel in
   the SLAM grid with the table above.
2. Plan-frame coordinates: convert the pixel in the plan with the table above.

Paste the pairs as `referencePoints`. Three points with 5 cm care give a fit good to a few
centimetres across a warehouse; more points average out the error.

### Option B: automatic, `tools/align_maps.py`

Needs numpy, scipy, Pillow. It extracts dark pixels (walls) from both images, runs a coarse
rotation/translation search and ICP, and prints the transform document.

```bash
# 1. get the robot's grid and its metadata from the robot's SLAM stack. For a ROS map_server
#    map they are map.pgm/map.png plus map.yaml (`resolution`, `origin: [x, y, yaw]`) and
#    the image is formatVersion 2.

# 2. fit.  --*-meta is RES,X,Y[,FORMATVERSION]; formatVersion defaults to 1
tools/align_maps.py --src robot_map.png  --src-meta 0.05,-10,-10,2 \
                    --dst floor_plan.png --dst-meta 0.0125,0,0,2 \
                    --overlay overlay.png > transform.yaml
```

stderr reports the fit; stdout is the document:

```
inliers (src wall points within N m of a dst wall):
  0.1 m: 59.2%
  0.2 m: 69.3%
```

Read the inliers as "how much of the scanned wall lands on a drawn wall". A SLAM grid has
clutter (racks, people, doors) the plan does not, so 50 to 70 % at 10 cm is a good fit. Below
30 % look at `overlay.png`: a mirrored outline means a wrong `formatVersion`; a plausible but
shifted outline means the coarse search picked a wrong local optimum, re-run with
`--init DEG,TX,TY` near the right answer. Tune `--src-wall-max` / `--dst-wall-max`
(gray threshold, 0 to 255) if walls are grey rather than black.

Always open `overlay.png`: red is the robot's walls drawn on the plan.

## 4. Validate before applying

- Transform a pose you know, for example a robot parked at its dock, and check where it lands
  on the plan. `align_maps.py` prints three reference points you can sanity-check by hand.
- Existing zones or waypoints in the robot frame should land on the features they describe.

## 5. Apply

Both documents are applied through the Configuration API, like any other ORO configuration
object: `POST /api/configuration/apply` on your ORO instance, authenticated with an API key
of a user that has `configure` access, one JSON object per request. See the
[Config API](https://openrobops.org/docs/api/configapi) reference and the
[SpatialAnnotation / SpatialTransformation kinds](https://openrobops.org/docs/api/configapikinds#spatialtransformation);
the [Maps](https://openrobops.org/docs/maps) page explains robot maps vs shared maps. Build the plan document with `tools/png2map.py` and the transform
with `tools/align_maps.py` (or by hand with `referencePoints`), apply the plan first and the
transform second, then open a robot's Localization widget and pick the plan in the map
selector.

## Worked example

Source: a fleet's shared SLAM grid, 0.05 m/px, origin (-10, -10). Target: a warehouse floor
plan, 0.0125 m/px, origin (-12.3, -15.8). Both images store rows top-down (formatVersion 1).
The first attempt treated them as formatVersion 2 and converged to a mirrored 168 deg
solution that put the robots outside the building; drawing a few known zones on the plan
exposed the flip. With the right convention `align_maps.py` gives rotation +168.3 deg,
translation (27.10, -3.45), 59 % of wall points within 10 cm.
