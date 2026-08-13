---
sidebar_position: 3
---

# Ingest Pipeline

The ingest service is a Node.js application that processes robot telemetry from MQTT and stores it in MongoDB. It uses a pluggable module architecture for extensibility.

## Entry Point

The service starts in `ingest/src/main.js`, which initializes core managers and loads modules:

```
Ingest Service Startup
├── MongoManager.init()       → Connect to MongoDB
├── PeerClient.init()         → Connect to web app Peer API
├── UpstreamModule            → (if enabled) loaded before OroMqtt.run() so
│                                retained state messages forward on connect
├── OroMqtt.run()             → Connect to MQTT broker
├── DerivedAttributesService  → Worker queue for derived attributes
└── Load modules:
    ├── BasicsModule
    ├── SystemModule
    ├── CustomDataModule
    ├── RobotEventsModule
    ├── DiagnosticsModule
    ├── CustomCommandsModule
    └── RobotLocalizationModule
```

## Core Managers

### MongoManager

Manages MongoDB connections and provides database access to all modules.

### OroMqtt

MQTT client wrapper that connects to the broker as the ingest master user. Provides topic subscription and message routing to modules.

### PeerClient

HTTP client for communicating with the web app's internal Peer API. Used for:

- Creating and resolving alerts from attribute status changes (`createAlert`, `resolveAlert` → `POST /peer/alerts`)
- Relaying robot commands received on `out_cmd` (`robotCommand` → `POST /peer/robot/command`)

## Module Architecture

Each ingest module follows a consistent pattern:

```javascript
class MyModule {
  constructor({ mqtt, mongo, ... }) {
    this.mqtt = mqtt;
    // Store references to shared managers
  }

  load(settings) {
    // Register a listener for a subtopic; OroMqtt subscribes to
    // r/+/<subtopic> and routes matching messages here
    this.mqtt.registerListener('my_topic', this.handleMessage);
  }

  handleMessage(robotId, message, packet) {
    // 1. Decode protobuf message
    // 2. Transform/validate data
    // 3. Write to MongoDB
  }
}
```

### Module Lifecycle

1. **Constructor** — receives shared managers (MQTT client, Mongo, etc.)
2. **load()** — subscribes to MQTT topics and registers handlers; optionally accepts per-module settings
3. **Message handling** — processes incoming messages and writes to MongoDB

### Active Modules

| Module | MQTT Topics | MongoDB Collection | Description |
|--------|------------|-------------------|-------------|
| **BasicsModule** | `state`, `out_cmd` | `robots` | Robot identity, version, online status; routes outbound commands |
| **SystemModule** | `system/stats` | `attr_values` | CPU, RAM, disk, network metrics (via AttributesManager) |
| **CustomDataModule** | `custom` | `custom_data`, `robot_key_values` | Key-value pairs, text, images |
| **DiagnosticsModule** | `ros/diagnostics2`, `ros/diagnostics/status` | `diagnostics` | ROS hardware diagnostics, severity-based status |
| **RobotEventsModule** | `events` | `attr_values`, `robot_key_values` | Sampled key-value events mapped to attributes |
| **CustomCommandsModule** | `custom_command/script/status` | `custom_script` | Command/action execution feedback |
| **RobotLocalizationModule** | `ros/loc/*` (pose, map, path, costmap, ...) | `localization`, `spatial_annotations` | Pose, maps, lasers, paths, costmaps |
| **UpstreamModule** | all robot topics (when enabled) | `upstream_mqtt_credentials`, `event_log` | Forwards telemetry to an upstream ORO/InOrbit — see [Upstream Forwarding](./upstream-forwarding.md) |

### Module Settings

Per-module configuration can be provided via the `modules` key in `ingest/settings.json`:

```json
{
  "modules": {
    "robotLocalization": {
      // Localization-specific settings
    }
  }
}
```

### Derived Attributes Service

In addition to MQTT-driven modules, the ingest service runs a `DerivedAttributesService` worker that recomputes derived attributes on every source attribute update (event-driven via an in-memory work queue). Derived attributes are configured via the ConfigAPI; see [ConfigAPI](../api/configapi.md).

## Data Processing Flow

```
MQTT Message Received
    │
    ├── Extract robotId from topic
    │
    ├── Decode protobuf message
    │   (using shared proto definitions)
    │
    ├── Transform & validate
    │   (module-specific logic)
    │
    ├── Write to MongoDB
    │   (upsert into appropriate collection)
    │
    └── Optional: Notify PeerClient
        (trigger UI updates or commands)
```

## Shared Utilities

The ingest service includes shared code in `ingest/src/shared/`:

- **oro.proto** — Protocol Buffer definitions
- Utility functions for data transformation

## Graceful Shutdown

The ingest service traps `SIGHUP`, `SIGINT`, and `SIGTERM` signals for clean shutdown:

1. Disconnect MQTT client
2. Close MongoDB connections
3. Exit process

## Next Steps

- [Custom Ingest Modules](../extending/custom-ingest-modules.md) — how to write your own module
- [MQTT & Protocols](./mqtt-protocols.md) — message types and topic structure
- [Data Model](./data-model.md) — MongoDB collections detail
