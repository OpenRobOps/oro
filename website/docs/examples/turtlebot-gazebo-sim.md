---
sidebar_position: 2
---

# TurtleBot3 in Gazebo

A TurtleBot3 Burger connected to ORO: a fake robot, a Gazebo simulation, or a real TurtleBot on
your network. Drive it from ORO, send waypoint missions, and build a map live with SLAM.

Source: [`oro-examples/turtlebot-gazebo-sim`](https://github.com/OpenRobOps/oro-examples/tree/main/turtlebot-gazebo-sim)

## Run it

1. Agent credentials. Copy the template and set `INORBIT_KEY` to a robot API key:
   ```bash
   cd oro-examples/turtlebot-gazebo-sim
   cp agent/agent.env.sh.example agent/agent.env.sh
   ```
2. ORO config (dashboards, data sources, statuses, actions, incidents, agent ModuleStates, footprint):
   ```bash
   oro apply -f agent/cac
   ```
3. Start the robot. The recommended mode is Gazebo + SLAM + keyboard teleop:
   ```bash
   ./start.sh -g -slam -k
   ```
   `start.sh` builds the image, starts the robot, RViz and the agent, and drops you into tmux
   in the robot container. Exiting tmux stops everything.

| Flag | What it does |
|---|---|
| *(none)* | Fake TurtleBot: it moves, but has no laser |
| `-g` | Gazebo robot in `turtlebot3_world`, with a simulated laser |
| `-slam` | Builds the map live with `slam_toolbox`; Nav2 drives. Needs `-g` or `-r` |
| `-map` | Serves a fixed floor plan. For the fake robot only |
| `-k` | Keyboard teleop in its own tmux window |
| `-r` | Real TurtleBot3 on the same network |

## What to expect

- Gazebo and RViz open. The first build takes a few minutes.
- In ORO, robot **turtlebot** comes online once the robot publishes odometry.
- The **Navigation** dashboard shows the robot pose, laser scan and, with `-slam`, the map as it grows
  (RViz every ~5 s, ORO every ~1 min).
- The **Robot** dashboard shows mode, speed, obstacle distance, IMU tilt and stuck detection.

## Try it from ORO

| Action | What happens |
|---|---|
| Joystick (Navigation) | Teleop the robot |
| **Start mission** | Drives a route: *Out and back*, *Spin at a pillar* (3 turns), or *Hexagon perimeter* |
| **Stop mission** | Drops the route and stops the wheels |
| **Scan area** | Explores on its own for 1–5 min so SLAM maps the area (needs `-g -slam`) |
| **Add / Remove last / Erase waypoint list** | Builds a waypoint list from the robot's current pose |
| **Visit waypoints** | Drives the saved waypoints in order |
| **Emergency stop** | Ends any scan or mission and stops the wheels |

Incidents: **Stuck** (told to move but hasn't, 20 s), **Lifted** (tilt over 25°), and **Battery low**
(real robot only). Missions are tuned for the Gazebo world: use them with `-g` or `-g -slam`.

## Troubleshooting

- Agent log: `turtlebot-gazebo-sim/local/inorbit_agent.log`, or the `agent` tmux window.
- Teleop does nothing: check the log for `"cmd_vel_topic":"cmd_vel"`. The agent picks up config
  changes on restart.

More (real robot onboarding, file layout, key-values): the example's
[README](https://github.com/OpenRobOps/oro-examples/tree/main/turtlebot-gazebo-sim).
