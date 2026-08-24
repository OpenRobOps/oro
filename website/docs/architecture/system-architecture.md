---
sidebar_position: 1
---

# System Architecture

OpenRobOps follows a modular architecture where each component has a clear responsibility. This page describes how the components interact.

## Component Diagram

This diagram describes the scenario where the robot runs the ORO Agent. 

```
┌──────────────────────────────────────────────────────────────┐
│                     Robot (on-device)                        │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Agent (agentlets, e.g.)                             │    │
│  │  ├── SystemAgentlet     (CPU, RAM, disk, network)    │    │
│  │  ├── RosLocalizationAgentlet (pose, map, laser, path)│    │
│  │  ├── CustomDataAgentlet    (key-value, text, images) │    │
│  │  └── RosDiagnostics, RosOdometry, RosTeleop, ...     │    │
│  └──────────────────────┬───────────────────────────────┘    │
│                         │ MQTT (protobuf)                    │
└─────────────────────────┼────────────────────────────────────┘
                          │ ORO Protocol
                          ▼
┌──────────────────────────────────────────────────────────────┐
│  Mosquitto MQTT Broker                                       │
│  ├── Port 1883 (MQTT)                                        │
│  ├── Port 9001 (WebSocket)                                   │
│  └── Auth: mosquitto-go-auth → MongoDB (mqtt_credentials)    │
└──────────┬──────────────────────────────┬────────────────────┘
           │                              │
           │ Subscribe                    │ Subscribe (browser)
           ▼                              │
┌──────────────────────────────┐          │
│  Ingest Service              │          │
│  ├── OroMqtt                 │          │
│  ├── BasicsModule            │          │
│  ├── SystemModule            │          │
│  ├── CustomDataModule        │          │
│  ├── RobotEventsModule       │          │
│  ├── DiagnosticsModule       │          │
│  ├── CustomCommandsModule    │          │
│  ├── RobotLocalizationModule │          │
│  └── UpstreamModule (opt.)   │          │
└──────────┬───────────────────┘          │
           │ Write                        │
           ▼                              │
┌──────────────────────────────────────┐  │
│  MongoDB (:3001)                     │  │
│  ├── robots                          │  │
│  ├── localization                    │  │
│  ├── attr_values                     │  │
│  ├── module_states                   │  │
│  ├── incidents / notifications      │  │
│  └── per-kind config (attr_defs, …) │  │
└──────────┬───────────────────────────┘  │
           │ Reactive queries             │
           ▼                              │
┌──────────────────────────────────────┐  │
│  Meteor App Server (:3000)           │  │
│  ├── Pub/Sub (DDP WebSocket)         │  │
│  ├── REST API (/api/*)               │  │
│  ├── ConfigAPI (/api/configuration/*)│  │
│  ├── OAuth (Google, GitHub, Email)   │  │
│  └── Static assets (React UI)        │  │
└──────────┬───────────────────────────┘  │
           │ HTTP / WebSocket             │
           ▼                              ▼
┌───────────────────────────────────────────┐
│  Web Browser                              │
│  ├── React 18 + Material UI               │
│  ├── Fleet Dashboard                      │
│  ├── Robot Dashboard                      │
│  └── MQTT (WebSocket) for direct streams  │
└───────────────────────────────────────────┘
```

## Component Responsibilities

### Robot Agent

Runs on-device. Collects telemetry from the robot's systems and publishes it over MQTT using Protocol Buffer serialization. The agent is composed of agentlets, each responsible for a specific data type.

### MQTT Broker (Mosquitto)

Central message bus. Routes telemetry from robots to the ingest service and browser clients. Uses the `mosquitto-go-auth` plugin for authentication against MongoDB, where robot credentials are stored.

### Ingest Service

A Node.js process that subscribes to MQTT topics and processes incoming telemetry. Uses a pluggable module architecture — each module handles a specific message type (system stats, localization, custom data, etc.). Writes processed data to MongoDB.

The ingest service also communicates with the web app via a **Peer API** (`/peer/*` endpoints) for creating alerts and relaying robot commands. Peer calls authenticate with a `peerKey` field inside the JSON body; the `x-auth-peer-key` HTTP header is a separate mechanism used by internal callers of the REST `/api` surface.

### MongoDB

Single database (`meteor`) shared by all components. Stores robot records, telemetry data, user accounts, MQTT credentials, and ConfigAPI objects. Meteor's reactive driver enables real-time data updates to the browser.

### Meteor App Server

Full-stack application server providing:

- **REST API** — CRUD operations for robots, attributes, localization, and configuration
- **Pub/Sub** — Meteor's DDP protocol pushes real-time data changes to connected browsers
- **Authentication** — OAuth and passwordless email via Meteor Accounts
- **Static assets** — serves the React 18 frontend

### Web Browser

React 18 SPA with Material UI. Connects to the Meteor server via WebSocket (DDP) for reactive data and optionally to the MQTT broker via WebSocket for direct telemetry streams.

## Data Flow Summary

| Flow | Path | Protocol |
|------|------|----------|
| Robot → Cloud | Agent → MQTT broker → Ingest → MongoDB | MQTT + protobuf |
| Cloud → Browser | MongoDB → Meteor pub/sub → Browser | DDP (WebSocket) |
| Cloud → Robot | Web app → MQTT broker → Agent (commands, with echo callbacks) | MQTT |
| API access | Client → Meteor REST API → MongoDB | HTTP + JSON |
| Config changes | Client → ConfigAPI → MongoDB → Meteor pub/sub → Browser | HTTP + DDP |
| Upstream | Ingest UpstreamModule → upstream ORO/InOrbit broker | MQTT (see [Upstream Forwarding](./upstream-forwarding.md)) |
| Direct telemetry | MQTT broker → Browser | MQTT over WebSocket |

## Next Steps

- [MQTT & Protocols](./mqtt-protocols.md) — topic structure and message types
- [Ingest Pipeline](./ingest-pipeline.md) — module architecture details
- [Data Model](./data-model.md) — MongoDB collections reference
