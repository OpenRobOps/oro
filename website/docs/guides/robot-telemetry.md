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

| Data Type | Topic | Description |
|-----------|-------|-------------|
| **Pose** | `ros/loc/data2`, `ros/loc/pose` | Robot position (x, y) and orientation (yaw) in a map frame |
| **Map** | `ros/loc/map2` | PNG-encoded occupancy grid |
| **Costmap** | `ros/loc/costmap` | PNG-encoded costmap overlay |
| **Laser scans** | (in `ros/loc/data2`) | 2D laser range data (runs + values encoding) |
| **Paths** | `ros/loc/path` | Planned or executed paths as sequences of points |
| **Config** | `ros/loc/config/0..2` | Localization configuration (pipe-delimited text) |

Uses `LocationAndPoseMessage`, `PoseMessage`, `MapMessage`, and `PathDataMessage` protobuf types.

### CustomDataModule

Handles arbitrary data published by the robot agent. Supports three data types:

| Type | Protobuf Field | Description |
|------|---------------|-------------|
| **KeyValue** | `key_value_payload` | Named key-value pairs (string keys, string values) |
| **Text** | `text_file_payload_2` | Arbitrary text blobs (`text_file_payload` is deprecated) |
| **Image** | `image_payload` | Images (JPEG) for camera feeds or visual data |

Uses the `CustomDataMessage` protobuf type.

### RobotEventsModule

Handles sampled key-value **events** published by the agent on
`r/<robot_id>/events`. Events use the same `CustomDataMessage` payload as
custom data but carry event semantics rather than periodic values: duplicate
keys within one message are each applied in order.

Event values feed attributes exactly like `keyValue` data sources, and every
key's last-seen value is also recorded in the `robot_key_values` collection so
new keys can be discovered when defining data sources.

### DiagnosticsModule

Processes ROS-style hardware diagnostics published by the robot agent: per-component status (OK / Warn / Error / Stale), human-readable messages, and structured key-value detail. Severity is fed back into the robot's attributes so it can drive fleet-level health indicators. Each status's key-values — plus its level and message via the reserved `__level__` and `__msg__` keys — can be mapped to attributes with `rosDiagnostics` data sources (see [Config API Kinds](../api/configapikinds.md#datasourcedefinition)).

Subscribes to `r/<robot_id>/ros/diagnostics2` and `r/<robot_id>/ros/diagnostics/status`. Uses the `RosDiagnosticsMessage` protobuf type. Writes to the `diagnostics` collection.

### CustomCommandsModule

Captures the execution feedback of remote commands and actions — exit codes, stdout, stderr, and progress updates — so the UI can show whether a triggered action succeeded.

Subscribes to `r/<robot_id>/custom_command/script/status`. Uses the `CustomScriptStatusMessage` protobuf type. Writes to the `custom_script` collection.

### UpstreamModule

Optional module (off by default) that forwards local robot telemetry to an
upstream ORO or InOrbit instance and relays allowed commands back down. See
[Upstream Forwarding](../architecture/upstream-forwarding.md).

### Odometry

Odometry is handled directly by the MQTT dispatcher rather than a module:
when `mqtt.odometryEnabled` is true (the default), ingest subscribes to
`r/<robot_id>/ros/odometry/+` and produces the `speedLinear`, `speedAngular`,
and distance attributes that feed the navigation dashboard's speed/rotation
gauges and distance vitals. Distance updates are throttled to one write every
10 seconds. Set `"odometryEnabled": false` under `mqtt` in `ingest/settings.json`
to drop the subscription.

## Protobuf Messages

All telemetry is serialized using Protocol Buffers for efficiency. 
These are some of the protobuf messages in the ORO protocol.
The complete schema is defined in [`app/private/oro.proto`](https://github.com/OpenRobOps/oro/blob/main/app/private/oro.proto). 

Key message types:

```protobuf
message SystemStatsMessage {
  int64 timestamp = 1;             // Client capture time (ms)
  float elapsed_seconds = 2;
  float cpu_load_percentage = 3;   // [0.0, 1.0]
  // ... network fields (4-8), disk usage (9-11, 15-16)
  float ram_usage_percentage = 17; // [0.0, 1.0]
}

message LocationAndPoseMessage {
  int64 ts = 1;
  float pos_x = 2;
  float pos_y = 3;
  float yaw = 4;
  repeated LaserMessage lasers = 5;
}

message CustomDataMessage {
  string custom_field = 1;
  oneof payload {
    KeyValuePairs key_value_payload = 2;
    bytes image_payload = 3;
    bytes text_file_payload = 4;   // Deprecated (agent > 1.5.0)
    DiagnosticsMessage diagnostics_payload = 5;
    TextFileMessage text_file_payload_2 = 6;
  }
  int64 ts = 7;
}
```

## Inactive Modules

:::warning
These modules are being completed and documentation needs updating.
:::

The following modules exist in the codebase but are not yet enabled:

- **AlertsModule** — robot alert handling
- **StatesModule** — robot state machine tracking
- **RosoutModule** — ROS log forwarding
- **RosMonitorModule** — ROS topic/node/param monitoring
- **ImagesModule** — camera image handling
- **DataBagsModule** — timeseries data bags
- **GpsModule** — GPS position ingestion

These modules are being ported and will be available in future releases. See the [Roadmap](../contributing/roadmap.md) for details.

## Next Steps

- [MQTT & Protocols](../architecture/mqtt-protocols.md) — topic structure and message details
- [Ingest Pipeline](../architecture/ingest-pipeline.md) — deep dive into module architecture
- [Custom Ingest Modules](../extending/custom-ingest-modules.md) — build your own module
