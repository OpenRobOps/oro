---
sidebar_position: 3
---

# Flatland Nav2

A simulated diff-drive AMR in a 20 x 20 m multi-room office, built on the
[Flatland](https://github.com/avidbots/flatland) 2D simulator and the full Nav2 stack on ROS 2 Jazzy.
It has a battery with charging docks, a synthetic camera and ROS diagnostics.

Source: [`oro-examples/flatland-nav2-sim`](https://github.com/OpenRobOps/oro-examples/tree/main/flatland-nav2-sim)

## Run it

1. Agent credentials. Copy the template and set `INORBIT_KEY` to a robot API key:
   ```bash
   cd oro-examples/flatland-nav2-sim
   cp local/agent.env.sh.example local/agent.env.sh
   ```
2. ORO config:
   ```bash
   oro apply -f oro-config/config.yaml      # data sources, dashboards, actions, statuses, ModuleStates
   oro apply -f oro-config/maps.yaml        # rendered office map
   oro apply -f oro-config/footprint.yaml   # robot outline on the map
   oro apply -f oro-config/paths.yaml       # planned path styling
   ```
3. Build and start the simulation with the agent:
   ```bash
   git submodule update --init    # only if you cloned without --recurse-submodules
   xhost +local:docker
   COMPOSE_PROFILES=agent docker compose up --build
   ```
   The first build compiles Flatland and takes several minutes. Without `COMPOSE_PROFILES=agent`
   the simulation runs alone, with no ORO connection.

## What to expect

- RViz opens with the office map; the robot starts at (5, 15) and localizes on its own (AMCL).
- In ORO, robot **flatland-ros2** comes online about 30 s after start.
- Four dashboards: **Welcome** (a guide to this simulation), **Fleet** (status, incidents),
  **Robot** (battery, charging, Nav2 health, ROS diagnostics, vitals, actions) and
  **Navigation** (map, laser, costmap, planned path).
- The battery drains slowly at idle and faster while driving. It charges inside a charging zone.

## Try it from ORO

| Action | What happens |
|---|---|
| Click on the map (Navigation) | Nav2 plans and drives there |
| Joystick (Navigation) | Teleop the robot |
| **Dock** (auto, A, D) | Drives to the nearest charger, Charger A (Office) or Charger D (Lobby), and starts charging |
| **Battery**: charge / discharge / reset | Force charging on or off, or refill to 100% |
| **Message**: hello / warning / error / custom | Sets the `message` value; warning and error raise a status and an incident |

Incidents: **Battery low** (below 30% warning, below 15% error) and **Message**.

## Other ways to run it

```bash
docker compose run --rm flatland-nav2 --no-rviz          # headless
docker compose --profile rviz-separate up rviz           # RViz in its own container
docker compose -f docker-compose.nvidia.yml up           # render on an NVIDIA GPU
```

## Troubleshooting

- Agent log: `flatland-nav2-sim/local/inorbit_agent.log` (also tailed by the `agent_logs` container).
- RViz doesn't open: run `xhost +local:docker` and check `echo $DISPLAY`.

More (battery and camera parameters, diagnostics, ROS topics): the example's
[README](https://github.com/OpenRobOps/oro-examples/tree/main/flatland-nav2-sim).

:::note[ISO 21423]
This page covers the ROS2 agent. To connect a Flatland robot as an ISO 21423 robot instead, see
[ISO 21423 → Flatland simulator](../iso21423/flatland-simulator.md).
:::
