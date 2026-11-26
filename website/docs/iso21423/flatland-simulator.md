---
sidebar_position: 3
---

# Try it with the Flatland simulator

[OpenRobOps/sim-flatland](https://github.com/OpenRobOps/sim-flatland) is a Docker environment with a complete simulated AMR — 2D physics, Nav2 navigation, a battery with charging zones, a camera, diagnostics — that can connect to OpenRobOps in **three modes**: standalone, through the InOrbit ROS2 agent, or as an **ISO 21423 robot** through the [`iso21423_ros`](https://github.com/OpenRobOps/iso21423_ros) connector, a ROS 2 node built on the `iso21423` Python library. This page walks through the ISO mode end to end. The simulator's README ([Connectivity modes](https://github.com/OpenRobOps/sim-flatland#connectivity-modes), [ISO 21423 Connector](https://github.com/OpenRobOps/sim-flatland#iso-21423-connector)) is the authoritative reference; this page mirrors it for convenience.

What you get: the robot appears in ORO as an ISO robot with live pose, speed and battery, Battery/Dock/Message actions, statuses and incidents, and you can send it navigation goals from the map — all over the ISO 21423 wire format. Watch the raw traffic at any time with `mosquitto_sub -t '/ISO_21423/v1/#' -v`.

## Prerequisites

- OpenRobOps running locally ([Quick Start](../getting-started/quick-start.md)), including Mosquitto and ingest.
- The [`oro` CLI](https://github.com/OpenRobOps/oro-cli) installed (`pipx install oro-cli`) with a context pointing at your local instance (`oro context add local --url http://localhost:3000/api --api-key <key>`, see [Quick Start step 6](../getting-started/quick-start.md#6-install-and-configure-the-oro-cli)).
- Docker, and the simulator repo cloned next to the library and connector repos (the connector image is built from these sibling checkouts):

```bash
git clone https://github.com/OpenRobOps/iso21423.git
git clone https://github.com/OpenRobOps/iso21423_ros.git
git clone https://github.com/OpenRobOps/sim-flatland.git
cd sim-flatland && git submodule update --init
```

## 1. Configure OpenRobOps ingest for ISO mode

Add to `ingest/settings.json` and restart ingest. Flatland's map origin is `[0,0,0]`, so the facility coordinate system is the map frame itself and the calibration is the identity. The two docks are the simulated charging zones.

```json
"iso21423": {
  "ccs": {
    "id": "0b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d",
    "name": "flatland",
    "referencePoints": [
      { "map": { "x": 0,  "y": 0  }, "ccs": { "x": 0,  "y": 0  } },
      { "map": { "x": 10, "y": 0  }, "ccs": { "x": 10, "y": 0  } },
      { "map": { "x": 0,  "y": 10 }, "ccs": { "x": 0,  "y": 10 } }
    ]
  },
  "robots": {
    "enabled": true,
    "imrfmId": "9a1b2c3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d",
    "mqtt": { "username": "<settings.mqtt.brokers.local.username>", "password": "<its password>" },
    "docks": { "A": { "x": 9.0, "y": 18.5 }, "D": { "x": 11.5, "y": 1.5 } }
  },
  "upstream": { "enabled": false }
}
```

Ingest's log should say `Ingest is in ISO 21423 mode` and `ISO 21423 robots is ON`.

## 2. Apply the ISO configuration profile and admit the robot

The simulator ships two OpenRobOps configuration profiles with the same object ids — `oro-config/ros2/` for the ROS2 agent and `oro-config/iso/` for ISO mode. Apply the ISO one; `iso-robot.yaml` is the `IsoRobot` admission object (Gate 2).

```bash
cd sim-flatland/oro-config
oro apply -f iso/config.yaml       # data sources, dashboards, actions, statuses, incidents
oro apply -f iso/iso-robot.yaml    # admits robot 7b1a9c3e-1111-4222-8333-444455556666
```

## 3. Configure and start the ISO connector

```bash
cd sim-flatland
cp local/iso-agent.env.sh.example local/iso-agent.env.sh
```

Edit `local/iso-agent.env.sh`:

| Variable | Value |
|----------|-------|
| `ISO_ENTITY_UUID` | `7b1a9c3e-1111-4222-8333-444455556666` — must equal `metadata.id` in `iso/iso-robot.yaml` |
| `ISO_CCS_ID` | `0b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d` — must equal `iso21423.ccs.id` above |
| `ORO_API_KEY` | one of `robotApiKeys` from `app/settings.json` |
| `ORO_URL` | `http://localhost:3000/` |

Then start the simulation with the `iso-agent` profile (the `iso-connector` service) instead of the default ROS2 agent:

```bash
xhost +local:docker                                  # for rviz; skip with --no-rviz
COMPOSE_PROFILES=iso-agent docker compose up --build
```

The connector performs Gate 1 itself (`credentials_provider: openrobops`) — `POST /iso_mqtt_config` with the API key, read from the `ORO_API_KEY` environment variable — obtains its broker credential, registers as an IMR and starts publishing. Its log shows `registered <uuid> on mqtt://…`. (A `403` with *"not admitted"* means step 2 was skipped; the connector retries every 10 s.)

## 4. What to look at

- **Fleet** dashboard: the robot `flatland-iso` online, Battery and Message statuses.
- **Robot** dashboard: battery gauge and chart, linear/angular speed, charging state, Key-Value pairs (`battery_*`, `estimated_time_remaining`, `echo`) and the **Actions** widget:
  - *Dock A / Dock D / Dock (nearest)* → native ISO `dock` requests; the robot drives to the charging zone and starts charging.
  - *Reset / Charging / Discharging* → `customCommand` requests, republished on the sim's command topic (the battery is simulated, these are test hooks).
  - *Hello / Warning / Error / Message* → `customCommand`; the robot echoes back through `customData`, which drives the `message` data source, status and incident.
- **Navigation** dashboard: click a goal on the map → ISO `move`; *Cancel navigation* → `cancelRequest`.
- Raw ISO traffic: `mosquitto_sub -h localhost -u <user> -P <pass> -t '/ISO_21423/v1/#' -v`.

## Under the hood

The connector (`sim-flatland/config/iso21423_connector.yaml` configures the `iso21423_ros` node) reads ROS 2 directly and maps it onto ISO 21423:

| ROS 2 | ISO 21423 |
|-------|-----------|
| TF `map` → `base_link` + `/odom` twist | `odometry` at 2 Hz (`LOST` in `status` when the pose goes stale) |
| `/battery_state` | `batteryStatus` |
| `/plan`, `/local_plan` | `globalPlan`, `localTrajectory` |
| nav2 goal status + battery | `status.states` (`MODE_AUTO`, `IDLE`/`FORWARD`/…, `DOCKING`, `PAUSED`, `CHARGING`, `LOW_BATTERY`, `LOST`) |
| `/inorbit/custom_data` `key=value` | `customData` (batched, 500 ms) |
| `move` / `dock` requests | nav2 `NavigateToPose` action goal (`dock` with `mode: navigate`) |
| `pauseImr` / `resumeImr` requests | cancel and resend the goal |
| `customCommand` requests | `/inorbit/custom_command` (`std_msgs/String`) |

`customData`, `customCommand` and fetching credentials from ORO are the connector's opt-in OpenRobOps extras; other brokers and fleet managers get the plain ISO 21423 behaviour. The connector never publishes `READY`/`NOT_READY`, which are fleet-manager states.

Switching back to the ROS2 agent is `docker compose up` (default profile) plus `oro apply -f oro-config/ros2/config.yaml`, and `iso21423.robots.enabled: false` in ingest.
