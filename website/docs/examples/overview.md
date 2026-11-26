---
sidebar_position: 1
slug: /examples
---

# Examples

Ready-to-run robots for OpenRobOps (ORO), from the
[OpenRobOps/oro-examples](https://github.com/OpenRobOps/oro-examples) repository.
Each example is a Docker environment with a simulated robot, the InOrbit ROS2 agent, and the ORO
configuration (dashboards, data sources, statuses, incidents, actions) that goes with it.
Start one, apply its config, and the robot shows up in ORO with live data.

| Example | Robot | Best for |
|---|---|---|
| [TurtleBot3 in Gazebo](./turtlebot-gazebo-sim.md) | TurtleBot3 Burger: fake, Gazebo or a real one | Teleop, waypoints, missions, live SLAM + Nav2, ORO actions that run scripts |
| [Flatland Nav2](./flatland-nav2-sim.md) | Diff-drive AMR in a 2D office | Nav2 on a known map, battery and charging docks, camera, ROS diagnostics |

Not sure? Start with **Flatland**: no 3D simulator, light on CPU, and the full ORO feature set
in a few minutes.

## Before you start

1. ORO running locally: see [Quick Start](../getting-started/quick-start.md).
   The examples expect it at `http://localhost:3000/`.
2. Docker with the `compose` plugin, and an X11 or Wayland desktop for RViz / Gazebo.
3. The `oro` CLI, pointed at your ORO with an API key
   (see [Quick Start → step 6](../getting-started/quick-start.md)):
   ```bash
   pipx install oro-cli
   oro context add local --url http://localhost:3000/api --api-key <API_KEY>
   ```
4. A robot API key for the agent: any value from `robotApiKeys` in `oro/app/settings.json`.
5. The repository, with submodules (Flatland builds from upstream source):
   ```bash
   git clone --recurse-submodules https://github.com/OpenRobOps/oro-examples.git
   ```

:::warning[One example per ORO instance]
Both examples use the same ids for their ORO objects (dashboards, data sources, agent
ModuleStates, robot footprint). Applying one example's config overwrites the other's.
To switch, re-apply the config of the example you start.
:::
