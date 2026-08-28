---
sidebar_position: 2
---

# ISO Robots — Setup Guide

This guide turns an OpenRobOps deployment into an ISO 21423 fleet manager (IMRFM) and walks through admitting ISO 21423 robots (IMRs). It is the operator-facing version of `docs/iso21423-robots.md` in the [ORO repository](https://github.com/OpenRobOps/oro/blob/main/docs/iso21423-robots.md), which has the full reference including design decisions.

:::tip[Want to try it first?]
[Try it with the Flatland simulator](./flatland-simulator.md) gives you a working ISO robot and the exact settings below, ready to paste.
:::

## 1. ISO mode is a deployment decision

Setting `iso21423.robots.enabled: true` in the ingest settings switches **ingest** into ISO mode. In ISO mode ingest does not load the wire-protocol telemetry modules (`Basics`, `System`, `CustomData`, `RobotEvents`, `Diagnostics`, `CustomCommands`, `RobotLocalization`) at all; `IsoRobotsModule` runs in their place. Everything else — Mongo, worker queues, attributes, statuses, incidents, the web app — is unchanged.

Consequently **a deployment is either a wire (ORO/ROS agent) deployment or an ISO deployment**; mixing both kinds of robots in one instance is not supported in v1. [Upstream forwarding](../architecture/upstream-forwarding.md) has nothing to forward in ISO mode and logs a warning if left enabled.

## 2. Settings

Add an `iso21423` block to `ingest/settings.json` (Terraform users: `iso21423_robots_enabled = true` renders the skeleton; fill in the deployment-specific values by hand).

```json
{
  "iso21423": {
    "ccs": {
      "id": "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
      "name": "facility",
      "referencePoints": [
        { "map": { "x": 0,  "y": 0  }, "ccs": { "x": 12.40, "y": 8.10  } },
        { "map": { "x": 10, "y": 0  }, "ccs": { "x": 22.35, "y": 8.05  } },
        { "map": { "x": 0,  "y": 10 }, "ccs": { "x": 12.45, "y": 18.05 } }
      ]
    },
    "logging": false,
    "robots": {
      "enabled": true,
      "imrfmId": "5f0b1d5e-2b8b-4c8b-8c8b-2b8b4c8b8c8b",
      "manufacturerName": "OpenRobOps",
      "mqtt": { "username": "<broker user for this module>", "password": "<password>" },
      "docks": { "A": { "x": 9.0, "y": 18.5 } },
      "commandTopics": {
        "navGoal": "ros/loc/nav_goal",
        "cancelNav": "ros/nav/goal_to_current_pose",
        "customCommand": "custom_command/ros",
        "pause": null,
        "resume": null
      }
    },
    "upstream": { "enabled": false }
  }
}
```

| Key | Required | Meaning |
|-----|----------|---------|
| `ccs.id`, `ccs.referencePoints` | yes, for poses | Facility coordinate system id (a UUID) and ≥ 3 landmark pairs `{map, ccs}` fitting the rigid transform between ORO's map frame and the facility CCS (ISO Clause 4). Without it status and battery still flow but **poses are dropped** and navigation commands refused. |
| `robots.enabled` | yes | Switches ingest into ISO mode. |
| `robots.imrfmId` | yes | The UUID ORO uses as its own IMRFM identity on the ISO network. |
| `robots.mqtt.username/password` | yes | Broker login for this module's own ISO session (separate from ORO's wire connection and from robot credentials). Reusing the ingest master credential works for local setups. |
| `robots.broker` | no | Defaults to ORO's own Mosquitto (`settings.mqtt.brokers[defaultBrokerId]`). Set only if ISO robots use another broker. |
| `robots.docks` | no | Docking stations in ORO's map frame, keyed by the id operators use in `dock=<id>` actions (case-insensitive). |
| `robots.commandTopics` | no | Which agent-bound MQTT subtopics ORO's actions publish to; defaults match the built-in Navigate/Cancel actions and `PublishToTopic`. |
| `robots.attributeSources` | no | Rename the ORO attribute ids the ISO telemetry is written to (defaults: `agentOnline`, `pose`, `speedLinear`, `speedAngular`, `batteryPercentage`, `batteryVoltage`, `batteryIsCharging`). |

:::note[The CCS calibration is also a SpatialTransformation]
Once calibrated (from these reference points, or from an existing entry),
the ORO map ↔ facility CCS transform lives in the same place as any other
frame transform: the `system`-scope
[`SpatialTransformation`](../api/configapikinds.md#spatialtransformation)
config object, as a `map → <ccs.id>` entry. It's visible with `inorbit list`
and editable the same way. A [shared map](../maps.md) drawn directly in the
facility CCS should declare `frameId: <ccs.id>` — it then lines up with ISO
robots' poses without needing its own transform.
:::

Restart ingest and confirm in its log:

```
Ingest is in ISO 21423 mode: InOrbit wire-protocol modules are NOT loaded
ISO 21423 robots is ON: IMRFM <imrfmId> at <broker url>
```

## 3. Onboarding a robot — two gates, in this order

**Gate 2 — admission (do this first).** Applying an `IsoRobot` configuration object admits a robot; its `metadata.id` is the robot's ISO entity UUID and becomes its ORO robot id. Use lowercase UUIDs (MQTT topics are case-sensitive).

```yaml
apiVersion: v0.1
kind: IsoRobot
metadata:
  id: 5f8c1e2a-6b3d-4a9f-8e11-2c7d9a4b1f00
  scope: system/0
spec:
  label: Line3-AMR-07
  manufacturerName: Acme Robotics
  hostname: amr07.facility.local
```

```bash
inorbit apply -f iso-robot.yaml        # or POST /api/configuration/apply
```

Until a robot is admitted ORO ignores it (one log line per process: `IMR <uuid> is publishing on the ISO network but is not admitted`) and refuses it credentials. Clearing the object (`POST /api/configuration/clear`) revokes admission.

**Gate 1 — broker credentials.** The robot (or its integrator) exchanges the fleet-wide robot API key for a stable, per-robot broker login:

```bash
curl -X POST -H "Content-Type: application/json" http://localhost:3000/iso_mqtt_config \
  -d '{ "apiKey": "<one of robotApiKeys>", "entityUuid": "5f8c1e2a-6b3d-4a9f-8e11-2c7d9a4b1f00" }'
```

```json
{ "hostname": "localhost", "port": 1883, "protocol": "mqtt://",
  "websocket_port": 9001, "websocket_protocol": "ws://",
  "username": "<generated>", "password": "<generated>" }
```

It returns **403 until Gate 2 is done** — expected, not a bug. The same call always returns the same credential. Its ACLs cover the robot's own subtree `/ISO_21423/v1/IMR/<uuid>/#` plus the fleet-wide identity wildcard. Admission is the real access control; the API key is fleet-wide (as for `/mqtt_config`) and the credential is only the transport.

## 4. What the robot publishes and receives

Standard resources, on `/ISO_21423/v1/IMR/<uuid>/<resource>`: `identity` (retained; must list what it `provides`/`accepts`), `status`, `odometry` (poses in the facility CCS, `locationPoint.ccsId` = `ccs.id`), `batteryStatus` (`batterySoc` is a 0..1 fraction, as is ORO's `batteryPercentage`). Liveness is MQTT keepalive plus the standard's retained Last Will on `…/disconnection`.

`identity.details.imrFootprint` (a &ge;3-point polygon) and `imrHeight`, when present, are stored as the robot's reported footprint and used as its default outline on the map -- see [Maps: Robot footprint](../maps.md#robot-footprint). A configured [`RobotFootprint`](../api/configapikinds.md#robotfootprint) overrides it. Malformed footprints are ignored, with one warning logged per robot.

`globalPlan` (nav2's global plan) and `localTrajectory` (nav2's local plan) are ingested into the Navigation widget's paths, styled by a configured [`RobotPath`](../api/configapikinds.md#robotpath) -- see [Maps: Robot paths](../maps.md#robot-paths).

**Key-value data — ORO's `customData` extension resource.** ISO 21423 has no key-value message but leaves the resource catalog open, so ORO defines one:

```
/ISO_21423/v1/IMR/<uuid>/customData         QoS 1, not retained, no schema
{ "timestamp": "2026-08-26T20:00:00.000Z", "values": { "echo": "hello", "battery_charging": "true" } }
```

A robot that lists `customData` in `capabilities.provides` gets exactly the wire robot's treatment: pairs feed `keyValue` [data sources](../guides/attributes-status.md), statuses and incidents, and the Key-Values widget. Values are strings. The SDK exposes this through `registerExtensionResource('customData', { qos: 1, retain: false })` and `EntityHandle.publishExtension(...)`.

**Commands.** ORO's actions travel through its Actions framework unchanged (locks, validation, audit log) and are translated by ingest into ISO requests to the robot:

| ORO action | ISO request detail |
|------------|--------------------|
| Navigate to | `move { location, orientation }` (goal converted map → CCS) |
| Cancel navigation | `cancelRequest` for the in-flight move/dock; otherwise `move` to the current pose |
| `PublishToTopic` with message `dock` / `dock=<id>` | native `dock { dockLocation, dockActions: ["CHARGE"] }`, from `robots.docks` (nearest dock for bare `dock`) |
| any other `PublishToTopic` message | `customCommand { command: "<message>" }` — an OpenRobOps-defined action type under the default `ISO-21423` format; the robot republishes it locally |
| deployment-defined pause/resume actions (`commandTopics.pause/resume`) | `pauseImr` / `resumeImr` |

ORO's `sendRequest` only sends action types the robot advertises in `capabilities.accepts`.

## 5. Known limitations (v1)

- No mixed wire/ISO fleets in one deployment.
- The robot's ISO UUID is its ORO robot id, visible in URLs.
- Request outcomes (SUCCEEDED/ABORTED) are not surfaced in ORO's action-status API; a navigation goal is acknowledged on receipt, not on arrival.
- No map, laser, camera, diagnostics or system vitals — ISO 21423 has no such resources.
- `undock` and `globalPath` (a NURBS curve, distinct from `globalPlan`) are not yet used. The live `footprint` resource is also not yet used -- only the retained `identity`'s `imrFootprint`/`imrHeight` (see below).

## 6. Rollback

Set `iso21423.robots.enabled: false` and restart ingest: it loads the wire-protocol modules again and disconnects from the ISO network. Admitted robots, credentials and retained ISO topics survive; clear `IsoRobot` objects and suspend `mqtt_credentials` documents (`{ robotId: "<uuid>" }`) to remove them.
