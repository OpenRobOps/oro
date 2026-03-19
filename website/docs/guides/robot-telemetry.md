---
sidebar_position: 2
---

# Robot Telemetry

Telemetry is the core data flowing from robot agents to OpenRobOps. This guide explains the data pipeline, available ingest modules, and what each captures.

## Data Flow

```
Robot Agent
    │
    │  Publish protobuf messages to MQTT topics
    │  Topic pattern: r/<robot_id>/<message_type>
    ▼
Mosquitto MQTT Broker (:1883)
    │
    │  Forward to subscribers
    ▼
Ingest Service
    │
    │  Module-specific processing:
    │  - Decode protobuf
    │  - Transform & validate
    │  - Store in MongoDB
    ▼
MongoDB (:3001)
    │
    │  Meteor reactive pub/sub
    ▼
Web App → Browser
```

## Ingest Modules

The ingest service uses a **pluggable module architecture**. Each module subscribes to specific MQTT topics, decodes the protobuf messages, and writes processed data to MongoDB.

### BasicsModule

Handles basic robot identification and connection status. Tracks when a robot first connects and updates its online/offline state.

### SystemModule

Captures system-level resource metrics from the robot:

| Metric | Description |
|--------|-------------|
| **CPU load** | Current CPU utilization percentage |
| **RAM usage** | Used and total memory |
| **Disk usage** | Used and total disk space (per-disk breakdown) |
| **Network** | Bytes sent/received, packet statistics |

Data is encoded using the `SystemStatsMessage` protobuf type.

### RobotLocalizationModule

Processes spatial data from the robot:

| Data Type | Description |
|-----------|-------------|
| **Pose** | Robot position (x, y) and orientation (yaw) in a map frame |
| **Map** | PNG-encoded occupancy grid or costmap |
| **Laser scans** | 2D laser range data (runs + values encoding) |
| **Paths** | Planned or executed paths as sequences of points |

Uses `LocationAndPoseMessage`, `MapMessage`, and `PathDataMessage` protobuf types.

### CustomDataModule

Handles arbitrary data published by the robot agent. Supports three data types:

| Type | Protobuf Field | Description |
|------|---------------|-------------|
| **KeyValue** | `values` | Named key-value pairs (string keys, string values) |
| **Text** | Text content | Arbitrary text blobs |
| **Image** | Binary data | Images (JPEG) for camera feeds or visual data |

Uses the `CustomDataMessage` protobuf type.

## Protobuf Messages

All telemetry is serialized using Protocol Buffers for efficiency. 
These are some of the protobuf messages in the ORO protocol.
The complete schema is defined in [`web/app/private/oro.proto`](https://github.com/OpenRobOps/oro/blob/main/web/app/private/oro.proto). 

Key message types:

```protobuf
message SystemStatsMessage {
  float cpuLoad = 1;
  float ramPercentage = 2;
  float diskPercentage = 3;
  // ... per-disk details, network stats
}

message LocationAndPoseMessage {
  float x = 1;
  float y = 2;
  float yaw = 3;
  string frameId = 4;
  // ... laser data
}

message CustomDataMessage {
  repeated Value values = 1;
  // ... diagnostics, images, text
}
```

## Inactive Modules

:::warning
These modules are being completed and documentation needs updating.
:::

The following modules exist in the codebase but are not yet enabled:

- **AlertsModule** — robot alert handling
- **DiagnosticsModule** — ROS diagnostics integration
- **StatesModule** — robot state machine tracking
- **RosoutModule** — ROS log forwarding
- **RosMonitorModule** — ROS topic/node/param monitoring
- **CustomCommandsModule** — remote command execution
- **RobotEventsModule** — robot event processing
- **ImagesModule** — camera image handling

These modules are being ported and will be available in future releases. See the [Roadmap](../contributing/roadmap.md) for details.

## Next Steps

- [MQTT & Protocols](../architecture/mqtt-protocols.md) — topic structure and message details
- [Ingest Pipeline](../architecture/ingest-pipeline.md) — deep dive into module architecture
- [Custom Ingest Modules](../extending/custom-ingest-modules.md) — build your own module
