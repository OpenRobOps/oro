---
sidebar_position: 2
---

# MQTT & Protocols

:::info
This page describes the ORO protocol. Other communication standards are currently work-in-progress and will be added soon to these guides.
:::

OpenRobOps uses MQTT as its primary communication protocol between robot agents and the cloud platform. Most telemetry messages are serialized with Protocol Buffers; a few legacy topics (such as `state` and `ros/loc/config/N`) carry pipe-delimited text instead.

## MQTT Broker

The broker is **Mosquitto** with the `mosquitto-go-auth` plugin, which authenticates clients against MongoDB.

| Port | Protocol | Use |
|------|----------|-----|
| 1883 | MQTT | Standard robot agent connections |
| 9001 | WebSocket | Browser-based MQTT clients |

### Authentication

Robot MQTT credentials are stored in the `mqtt_credentials` MongoDB collection:

| Field | Description |
|-------|-------------|
| `username` | Unique MQTT username |
| `password` | PBKDF2 hash checked by the broker's auth plugin |
| `encryptedPassword` | AES-GCM-encrypted copy, used to re-issue the password to clients |
| `robotId` | Associated robot ID |
| `superuser` | Whether the client has superuser privileges |
| `acls` | Access control list (topic permissions) |
| `status` | Credential status |

Passwords are hashed using **PBKDF2** with SHA-512, 100,000 iterations, and a 16-byte salt.

The ingest service connects as a **master** user with its own credentials (configured in `settings.json`), allowing it to subscribe to all robot topics. The web app also provisions **transient multi-robot credentials** for browser sessions (scoped by `robotIds` and expiring via a TTL index on `expiresAt`).

## Topic Structure

Robot telemetry is published to topics following this pattern:

```
r/<robot_id>/<message_type>
```

Where `<robot_id>` is the unique robot identifier and `<message_type>` indicates the data being sent.

Two other topic families exist: `system/<subtopic>` for system-wide (non-robot)
messages, and server→robot publishes on the same `r/<robot_id>/...` tree (for
example `ros/loc/mapreq` map requests and command topics).

### Subscriptions

Subtopics the ingest service subscribes to today (`r/+/` prefix implied):

| Subtopic | Handler | Payload |
|----------|---------|---------|
| `state` | BasicsModule | Pipe-delimited text (`online\|apiKey\|version\|hostname`) |
| `out_cmd` | BasicsModule | Robot-originated commands |
| `system/stats` | SystemModule | `SystemStatsMessage` |
| `custom` | CustomDataModule | `CustomDataMessage` |
| `events` | RobotEventsModule | `CustomDataMessage` |
| `ros/diagnostics2`, `ros/diagnostics/status` | DiagnosticsModule | ROS diagnostics |
| `custom_command/script/status` | CustomCommandsModule | `CustomScriptStatusMessage` |
| `ros/loc/data2`, `ros/loc/pose`, `ros/loc/map2`, `ros/loc/costmap`, `ros/loc/path`, `ros/loc/config/0..2` | RobotLocalizationModule | Localization messages |
| `ros/odometry/+` | OroMqtt (built-in, if `odometryEnabled`) | `OdometryDataMessage` |
| `echo` | OroMqtt (built-in) | Command callbacks |
| `logfiles_update` | OroMqtt (built-in) | `RobotFilesUpdateMessage` |

## Protocol Buffers

Telemetry messages use protobuf serialization. The source of truth is
`app/private/oro.proto` (copied into `ingest/src/shared/` by `ingest/import.sh`
on each ingest start). Key message types, as defined there:

### SystemStatsMessage

System resource metrics from the robot (`r/+/system/stats`):

```protobuf
message SystemStatsMessage {
  int64 timestamp = 1;              // Client capture time (ms)
  float elapsed_seconds = 2;        // Duration of the reported period

  float cpu_load_percentage = 3;    // Period average, [0.0, 1.0]

  // Network transfers since last report
  string network_interface = 4;
  int64 total_tx = 5;
  int64 total_rx = 6;
  int64 agent_tx = 7;
  int64 agent_rx = 8;

  // Disk usage
  float hdd_usage_percentage = 9;         // [0.0, 1.0]
  float agent_hdd_usage_mb = 10;
  float agent_hdd_usage_percentage = 11;

  repeated DiskUsageMessage optional_disks_data = 15;
  repeated NetworkStatsMessage optional_network_interfaces_data = 16;

  float ram_usage_percentage = 17;  // [0.0, 1.0]
}
```

### LocationAndPoseMessage

Robot pose plus laser scans (`r/+/ros/loc/data2`):

```protobuf
message LocationAndPoseMessage {
  int64 ts = 1;                     // Timestamp (ms)

  // Robot pose
  float pos_x = 2;
  float pos_y = 3;
  float yaw = 4;

  repeated LaserMessage lasers = 5;
}
```

### MapMessage

Map or costmap data, PNG-encoded (`r/+/ros/loc/map2` and `r/+/ros/loc/costmap`):

```protobuf
message MapMessage {
  uint32 width = 1;         // Pixels
  uint32 height = 2;        // Pixels
  bytes pixels = 3;         // PNG-encoded
  float x = 4;
  float y = 5;
  float theta = 6;          // Orientation, radians
  float resolution = 7;     // m/cell
  int64 ts = 8;
  string label = 9;         // Topic/identifier (deprecated by map_id)
  int64 data_hash = 10;     // Hash of the occupancy grid data
  string frame_id = 11;
  string map_id = 12;
  bool is_update = 13;      // Set on map_id/frame_id updates
  int32 formatVersion = 14;
}
```

### PathDataMessage

Robot paths (`r/+/ros/loc/path`):

```protobuf
message PathDataMessage {
  repeated PathPoint points = 1;   // Deprecated for agent >= 1.20.0
  int64 ts = 2;
  repeated RobotPath paths = 3;    // Each with points, ts, path_id
}
```

Path point coordinates may be delta-integer encoded on the wire; the ingest
localization module decodes them before storage.

### CustomDataMessage

Arbitrary key-value data, text files, or images (`r/+/custom` and `r/+/events`):

```protobuf
message CustomDataMessage {
  string custom_field = 1;    // ID of the custom data element

  oneof payload {
    KeyValuePairs key_value_payload = 2;
    bytes image_payload = 3;
    bytes text_file_payload = 4;              // Deprecated (agent > 1.5.0)
    DiagnosticsMessage diagnostics_payload = 5;
    TextFileMessage text_file_payload_2 = 6;
  }
  int64 ts = 7;
}
```

### Other Message Types

Ingested today:

| Message | Description |
|---------|-------------|
| `OdometryDataMessage` | Linear/angular distance and speed |
| `RosDiagnosticsStatusMessage` | ROS diagnostics data |
| `CustomScriptStatusMessage` | Remote script execution status |
| `PoseMessage` | Robot pose updates (alternative to `LocationAndPoseMessage`) |
| `Echo` | Command callback/acknowledgement resolution |

Defined in the protocol but **not currently ingested** (their ingest modules are
disabled): `AlertMessage`, `RosOutMessage`, `TopicMonitorMessage`, `CameraMessage`.

## Agent Module System (Agentlets)

Robot agents are organized into **agentlets** — small, independent modules that each handle a specific telemetry type. Each agentlet:

1. Collects data from the robot's systems (sensors, ROS, OS)
2. Serializes it into the appropriate protobuf message
3. Publishes to the corresponding MQTT topic

The ingest service mirrors this structure with its own modules that subscribe to and process these messages.

## Credential Flow

When a robot agent first connects:

1. Agent requests MQTT credentials via `POST /mqtt_config` on the web app
2. Server generates credentials and stores them in `mqtt_credentials` (encrypted)
3. Server returns broker hostname, port, and credentials to the agent
4. Agent connects to the MQTT broker using the provided credentials
5. Broker validates against MongoDB via the go-auth plugin

## Next Steps

- [Ingest Pipeline](./ingest-pipeline.md) — how messages are processed server-side
- [Data Model](./data-model.md) — where processed data is stored
- [Robot Telemetry](../guides/robot-telemetry.md) — practical guide to telemetry data
