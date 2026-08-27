---
sidebar_position: 2.2
---

# Maps

The Navigation widget displays a robot on a map: an image, a resolution, and
an origin that place the robot's localization data in pixel space. OpenRobOps
supports two kinds of map.

## Robot maps vs shared maps

A **robot map** is the occupancy grid a robot itself publishes over MQTT as
it maps or localizes; it belongs to that robot and no other robot can use it.
A **shared map** is uploaded once through the Config API's
[`SpatialAnnotation`](./api/configapikinds.md#spatialannotation) kind at
`scope: system` and is available to every robot that lists it — for example a
facility floor plan drawn outside of SLAM, or a map shared by robots that
can't produce their own (see [ISO robots](#iso-robots) below).
`SpatialAnnotation` can also store a robot-owned map (`scope: <robotId>`),
but the common case is a shared map at system scope.

## Uploading a shared map

[`tools/png2map.py`](https://github.com/OpenRobOps/oro/blob/main/tools/png2map.py)
turns a PNG into the YAML `SpatialAnnotation` document and prints it to
stdout:

```bash
tools/png2map.py warehouse.png --id warehouse-floor-1 --frame map \
  --resolution 0.05 --x 0 --y 0 --label "Warehouse Floor 1" \
  > warehouse-floor-1.yaml
```

`--from-ros-yaml map.yaml` lifts `resolution` and `origin` from a ROS
`map_server` YAML file when you're converting an existing ROS map (values
also given on the command line win). Apply the result like any other
Config API object:

```bash
inorbit apply -f warehouse-floor-1.yaml   # or POST /api/configuration/apply
```

Only PNG images are accepted, capped at 12 MB decoded.

## Frames and transforms

Every map has a `frameId` — the coordinate frame its image is drawn in.
Robot localization grids are normally in the `map` frame, and most shared
maps declare `frameId: map` too, so no extra setup is needed.

When a shared map's `frameId` differs from a robot's own frame, the widget
needs a [`SpatialTransformation`](./api/configapikinds.md#spatialtransformation)
linking the two frames (either an explicit matrix or ≥3 reference point
pairs). Without one, the map is still shown but the robot is hidden and a
banner explains that no transform links the two frames.

This is exactly how the ISO 21423 facility coordinate system (CCS) works: the
CCS is a frame in its own right, and the system `map → <ccs.id>` transform —
described in the
[ISO Robots setup guide](./iso21423/iso-robots-setup.md#2-settings) — is what
lets ORO place ISO robots (whose poses arrive in the CCS) on a map drawn in
the `map` frame, or vice versa.

## Switching maps in the Navigation widget

When a robot can display two or more maps, a map switcher dropdown appears
in the Navigation widget's control bar. Shared maps are labelled
**"(shared)"** in that list to distinguish them from the robot's own maps.

## ISO robots

ISO 21423 robots have no occupancy-grid resource of their own — the standard
doesn't define one — so they never have a robot map. Shared maps are the
only maps an ISO robot can display. Ingest converts every ISO pose into the
`map` frame on the way in, so a map drawn in the facility CCS frame
(`frameId: <ccs.id>`) still needs the system `map → <ccs.id>` transform to
place the robot on it — the same transform `CcsConverter.load()` seeds from
`settings.iso21423.ccs` when no `SpatialTransformation` exists yet (see
[Frames and transforms](#frames-and-transforms) above).
