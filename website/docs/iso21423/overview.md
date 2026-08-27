---
sidebar_position: 1
---

# ISO 21423 in OpenRobOps

[ISO 21423](https://www.iso.org/standard/86216.html) — *Industrial mobile robots: communications and interoperability* — is the open standard for how autonomous mobile robots (AMRs, called **IMRs**) and fleet managers (**IMRFMs**) talk to each other: MQTT topics with JSON payloads for identity, status, odometry, battery, paths, and a request protocol for commands such as `move`, `dock`, `pauseImr`.

OpenRobOps implements the standard natively, on both sides of a fleet manager:

| Direction | ORO's role | What it does | Status |
|-----------|-----------|--------------|--------|
| **ISO Robots** | IMRFM (fleet manager) | ISO 21423-native robots join an ORO fleet. Their telemetry appears as ordinary robot data; operators command them from the ORO UI. | Available — [setup guide](./iso-robots-setup.md) |
| **ISO Upstream** | IMR proxy | ORO presents its own fleet (robots that speak the ORO/ROS agent protocol) *to* a higher-level ISO fleet manager. | In development |

The two directions are independent modules with independent settings; enabling one has no effect on the other. Both share one **facility coordinate system (CCS)** calibration, described in the setup guide.

## Why it matters

- **Vendor-neutral onboarding.** Any robot that implements ISO 21423 can join an ORO fleet without an OpenRobOps agent on board — no ROS, no vendor SDK. The robot publishes the standard resources; ORO does the rest.
- **Same operations experience.** ISO robots get the same dashboards, data sources, statuses, incidents, actions, locks and audit log as any other robot. Nothing changes for operators.
- **Standards-based extension.** ISO 21423 leaves its vocabularies open (entity types, resources, states, request actions). OpenRobOps uses that to carry its own key-value *custom data* and pass-through *custom commands* in standard form, so deployment-specific features survive the protocol change.

## What an ISO robot gets in ORO

| ISO 21423 resource / request | In OpenRobOps |
|------------------------------|---------------|
| `identity` | Admission check (robot must be pre-admitted), name, hostname |
| `status` (`states[]`) | Online/offline (`agentOnline`) |
| `odometry` | `pose` (converted from the facility CCS to ORO's map frame), `speedLinear`, `speedAngular` |
| `batteryStatus` | `batteryPercentage`, `batteryVoltage`, `batteryIsCharging` |
| `customData` *(ORO extension resource)* | Key-value data sources → attributes, statuses, incidents, Key-Values widget |
| ORO **Navigate to** action | ISO `move` request |
| ORO **Cancel navigation** action | ISO `cancelRequest` (or a `move` to the current position) |
| ORO **`dock`** / **`dock=<id>`** actions | Native ISO `dock` request with `dockActions: [CHARGE]` |
| Any other **PublishToTopic** action | ORO's `customCommand` request (vendor action type), the robot republishes the message locally |

Not part of ISO 21423 today (and therefore not available from ISO robots): occupancy-grid maps, laser scans, camera images, ROS diagnostics trees, and system vitals (CPU, disk, network). Paths (`globalPath`, `localTrajectory`) are in the standard and are on the roadmap.

## Components

- **ORO ingest — `IsoRobotsModule`** (`ingest/src/server/isoRobots/`): the IMRFM. Admission roster, telemetry ingestion into the attributes pipeline, command translation.
- **ORO web app**: the `IsoRobot` configuration kind (admission) and the `POST /iso_mqtt_config` endpoint (broker credentials for robots).
- **`@openrobops/iso21423`** ([OpenRobOps/iso21423](https://github.com/OpenRobOps/iso21423)): the TypeScript SDK that implements the standard — topics, JSON Schema validation, MQTT session with the standard's Last Will semantics, request state machine, fleet gateway. Used by ORO and by the reference robot agent below. Anyone building an ISO 21423 robot or fleet manager in Node.js can use it.
- **Reference robot agent — `sim-flatland` ISO agent** ([OpenRobOps/sim-flatland](https://github.com/OpenRobOps/sim-flatland)): a small Node.js sidecar that turns the flatland/Nav2 simulated robot into an ISO 21423 IMR. It is the fastest way to see an ISO fleet end to end — see [Try it with the Flatland simulator](./flatland-simulator.md).

## Next steps

- [ISO Robots — setup guide](./iso-robots-setup.md): enable ISO mode, calibrate the CCS, admit robots, issue credentials, command mapping, limitations.
- [Try it with the Flatland simulator](./flatland-simulator.md): a complete ISO 21423 fleet on your laptop in a few commands.
