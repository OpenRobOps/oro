# OpenRobOps (ORO)

OpenRobOps is an open-source robot fleet management and operations platform.
It provides real-time observability, monitoring, and control for autonomous
mobile robots (AMRs) across vendors — fully self-hostable, with native support
for ROS and Open RMF.

Started by [InOrbit.AI](https://www.inorbit.ai), OpenRobOps brings the same
production-proven technology used to manage thousands of robots into an open,
transparent foundation that teams can own and extend.

## Architecture

```
Robot Agent (on-device)
    │ MQTT (protobuf)
    ▼
┌──────────────────┐      ┌──────────────────┐
│  Mosquitto MQTT  │◄────►│  Ingest Service  │
│  (broker)        │      │  (telemetry proc)│
└──────┬───────────┘      └────────┬─────────┘
       │                           │
       ▼                           ▼
┌──────────────────────────────────────────┐
│              MongoDB                      │
└──────────────────┬───────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────┐
│         Meteor App Server                 │
│  (REST API, Pub/Sub, WebSocket)           │
└──────────────────┬───────────────────────┘
                   │
                   ▼
              Web Browser
```

| Component | Description | Default Port |
|-----------|-------------|-------------|
| **Web App** | Meteor full-stack app — UI, API server, real-time pub/sub | 3000 |
| **MongoDB** | Primary data store (Meteor-integrated) | 3001 |
| **MQTT Broker** | Mosquitto with MongoDB-backed auth | 1883 / 9001 (WS) |
| **Ingest** | Processes robot telemetry via pluggable modules | — |

## Tech Stack

- **Meteor 3** with React 18 and Material UI
- **Node.js v22**
- **MongoDB** for persistence
- **Mosquitto MQTT** broker with go-auth plugin
- **Protocol Buffers** for message serialization
- **Docker Compose** for local services
- **Terraform** for configuration management

## Key Features

- **Real-time fleet monitoring** — live telemetry from multiple robots
- **Customizable dashboards** — user-defined layouts and widgets
- **Pluggable module system** — extensible ingest pipeline (system stats,
  custom data, localization, diagnostics, cameras, and more)
- **Role-based access control** — admin and team member roles
- **Multi-vendor support** — vendor-agnostic MQTT messaging layer
- **OAuth integration** — Google and GitHub login
- **Protocol Buffers** — efficient binary serialization for telemetry

## Project Structure

```
oro/
├── web/app/          # Meteor application (client + server)
├── ingest/           # Telemetry ingest service
├── mqtt/             # Mosquitto broker config & Docker Compose
├── terraform/        # Settings generation (Terraform)
└── scripts/          # Utility scripts
```

## Getting Started

See [Developer's documentation](README-dev.md)

## Learn More

- [InOrbit.AI](https://www.inorbit.ai) — the company behind OpenRobOps
- [InOrbit RobOps](https://www.inorbit.ai/robops) — robot operations platform

## License

OpenRobOps is licensed under the [Apache License 2.0](LICENSE).
