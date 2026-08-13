---
sidebar_position: 3
---

# Roadmap

OpenRobOps is actively evolving. Many features exist in the codebase in various stages of readiness — some are commented out awaiting porting from the upstream InOrbit codebase, others need community contribution.

## Recently Shipped

- **Incidents & alerts** — status-driven incidents with severities, auto/manual actions, in-app notifications, and webhook notification channels
- **Selectable UI themes** — eight themes with per-user persistence and auto light/dark
- **Upstream forwarding** — telemetry and command relay to another ORO/InOrbit instance
- **Robot events ingestion** — sampled key-value events mapped to attributes
- **Navigation gauges** — odometry-fed speed and rotation gauges

## In the Codebase, Not Yet Enabled

Disabled ingest modules (alerts, states, rosout, ROS monitoring, images, data
bags, GPS) and widget types (standalone map, data bags, logs, image, robot
search, history, missions) — see the "Inactive Modules" list in
[Robot Telemetry](../guides/robot-telemetry.md) and the "defined but not
enabled" note in [Dashboards & Widgets](../guides/dashboards-widgets.md).

For current priorities, check [GitHub issues](https://github.com/OpenRobOps/oro/issues)
and [milestones](https://github.com/OpenRobOps/oro/milestones).


## How to Contribute

If you're interested in working on any of these features:

1. Check [GitHub issues](https://github.com/OpenRobOps/oro/issues) for existing discussions
2. Open an issue describing which feature you'd like to tackle
3. Look at the commented-out code for guidance on the intended implementation
4. Follow the [Contributing Guide](./contributing-guide.md) for development setup and PR process

