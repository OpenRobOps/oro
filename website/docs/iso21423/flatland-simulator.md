---
sidebar_position: 3
---

# Try it with the Flatland simulator

[OpenRobOps/sim-flatland](https://github.com/OpenRobOps/sim-flatland) is a Docker environment with a complete simulated AMR — 2D physics, Nav2 navigation, a battery with charging zones, a camera, diagnostics — that can connect to OpenRobOps in **three modes**: standalone, through the InOrbit ROS2 agent, or as an **ISO 21423 robot** through a small Node.js sidecar built on `@openrobops/iso21423`. This page walks through the ISO mode end to end. The simulator's README ([Connectivity modes](https://github.com/OpenRobOps/sim-flatland#connectivity-modes), [ISO 21423 Agent](https://github.com/OpenRobOps/sim-flatland#iso-21423-agent)) is the authoritative reference; this page mirrors it for convenience.

What you get: the robot appears in ORO as an ISO robot with live pose, speed and battery, Battery/Dock/Message actions, statuses and incidents, and you can send it navigation goals from the map — all over the ISO 21423 wire format. Watch the raw traffic at any time with `mosquitto_sub -t '/ISO_21423/v1/#' -v`.

## Prerequisites

- OpenRobOps running locally ([Quick Start](../getting-started/quick-start.md)), including Mosquitto and ingest.
- The `inorbit` CLI configured with a user API key (`INORBIT_CLI_API_KEY`, `INORBIT_CLI_URL=http://localhost:3000/api`).
- Docker, and the simulator repo cloned next to the SDK repo (the ISO agent image builds the SDK from a sibling checkout):

```bash
git clone https://github.com/OpenRobOps/iso21423.git
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
inorbit apply -f iso/config.yaml       # data sources, dashboards, actions, statuses, incidents
inorbit apply -f iso/iso-robot.yaml    # admits robot 7b1a9c3e-1111-4222-8333-444455556666
```

## 3. Configure and start the ISO agent

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

Then start the simulation with the ISO agent profile instead of the default ROS2 agent:

```bash
xhost +local:docker                                  # for rviz; skip with --no-rviz
COMPOSE_PROFILES=iso-agent docker compose up --build
```

The agent performs Gate 1 itself — `POST /iso_mqtt_config` with the API key — obtains its broker credential, registers as an IMR and starts publishing. Its log shows `registered IMR …` and `rosbridge connected`. (A `403` with *"not admitted"* means step 2 was skipped; the agent retries every 10 s.)

## 4. What to look at

- **Fleet** dashboard: the robot `flatland-iso` online, Battery and Message statuses.
- **Robot** dashboard: battery gauge and chart, linear/angular speed, charging state, Key-Value pairs (`battery_*`, `estimated_time_remaining`, `echo`) and the **Actions** widget:
  - *Dock A / Dock D / Dock (nearest)* → native ISO `dock` requests; the robot drives to the charging zone and starts charging.
  - *Reset / Charging / Discharging* → `customCommand` requests, republished on the sim's command topic (the battery is simulated, these are test hooks).
  - *Hello / Warning / Error / Message* → `customCommand`; the robot echoes back through `customData`, which drives the `message` data source, status and incident.
- **Navigation** dashboard: click a goal on the map → ISO `move`; *Cancel navigation* → `cancelRequest`.
- Raw ISO traffic: `mosquitto_sub -h localhost -u <user> -P <pass> -t '/ISO_21423/v1/#' -v`.

## Under the hood

The sidecar (`sim-flatland/iso-agent/`, ~250 lines of JavaScript) reads ROS 2 through rosbridge and maps it onto ISO 21423 with the SDK:

| ROS 2 | ISO 21423 |
|-------|-----------|
| `/amcl_pose` + `/odom` twist | `odometry` at 2 Hz |
| `/battery_state` | `batteryStatus` |
| nav2 goal status + diagnostics + battery | `status.states` (`MODE_AUTO`, `READY`/`NOT_READY`, `IDLE`/`FORWARD`/…, `DOCKING`, `CHARGING`, `LOW_BATTERY`) |
| `/inorbit/custom_data` `key=value` | `customData` (batched, 500 ms) |
| `move` / `dock` requests | nav2 `NavigateToPose` action goal |
| `customCommand` requests | `/inorbit/custom_command` (`std_msgs/String`) |

Switching back to the ROS2 agent is `docker compose up` (default profile) plus `inorbit apply -f oro-config/ros2/config.yaml`, and `iso21423.robots.enabled: false` in ingest.
