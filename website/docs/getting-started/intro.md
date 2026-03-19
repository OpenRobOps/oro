---
sidebar_position: 1
slug: /getting-started/intro
---

# What is OpenRobOps?

OpenRobOps (ORO) is an **open-source robot fleet management and operations platform**. It provides real-time observability, monitoring, and control for autonomous mobile robots (AMRs) — fully self-hostable, with native support for ROS and Open RMF.

Started by [InOrbit.AI](https://www.inorbit.ai), OpenRobOps brings the same production-proven technology used to manage thousands of robots into an open, transparent foundation that teams can own and extend.

## Who is it for?

- **Robotics teams** building and deploying AMRs who need fleet-wide visibility
- **Operations managers** monitoring robot health, status, and incidents
- **Developers** who want a customizable, self-hosted alternative to proprietary fleet management SaaS

## Key Features

- **Real-time fleet monitoring** — live telemetry from multiple robots
- **Customizable dashboards** — user-defined layouts and widgets
- **Pluggable module system** — extensible ingest pipeline (system stats, custom data, localization, and more)
- **Role-based access control** — with predefined roles for read-only usage, operation, configuration
- **Vendor-agnostic support** — MQTT messaging layer and standard protocols to connect any robot
- **OAuth integration** — Google and GitHub login, plus passwordless email; easily extensible to any identity provider
- **Efficient communication layer** — binary serialization for MQTT messages; conditionally enable robot modules

## Tech Stack

- **Meteor 3** with React 18 and Material UI
- **Node.js v22**
- **MongoDB** for persistence
- **Mosquitto MQTT** broker
- **Protocol Buffers** for message serialization
- **Docker Compose** for local services
- **Terraform** for configuration management

## Next Steps

- [Quick Start](./quick-start.md) — get OpenRobOps running locally in under 10 minutes
- [Core Concepts](./core-concepts.md) — understand the key abstractions
- [Connecting Your First Robot](./connecting-first-robot.md) — register and connect a robot agent
