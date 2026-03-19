---
sidebar_position: 2
---

# MQTT & Protocols

:::info
This page describes the ORO protocol. Other communication standards are currently work-in-progress and will be added soon to these guides.
:::

OpenRobOps uses MQTT as its primary communication protocol between robot agents and the cloud platform. All telemetry messages are serialized with Protocol Buffers.

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
| `encryptedPassword` | Password encrypted with a configured key |
| `robotId` | Associated robot ID |
| `superuser` | Whether the client has superuser privileges |
| `acls` | Access control list (topic permissions) |
| `status` | Credential status |

Passwords are hashed using **PBKDF2** with SHA-512, 100,000 iterations, and a 16-byte salt.

The ingest service connects as a **master** user with its own credentials (configured in `settings.json`), allowing it to subscribe to all robot topics.

## Topic Structure

Robot telemetry is published to topics following this pattern:

```
r/<robot_id>/<message_type>
```

Where `<robot_id>` is the unique robot identifier and `<message_type>` indicates the data being sent.

## Protocol Buffers

All telemetry messages use protobuf serialization, defined in `ingest/src/shared/oro.proto`. Key message types:

### SystemStatsMessage

System resource metrics from the robot:

```protobuf
message SystemStatsMessage {
  float cpuLoad = 1;
  float ramPercentage = 2;
  float diskPercentage = 3;
  repeated DiskInfo diskDetails = 4;
  NetworkStats network = 5;
}
```

### LocationAndPoseMessage

Robot position and spatial data:

```protobuf
message LocationAndPoseMessage {
  float x = 1;
  float y = 2;
  float yaw = 3;
  string frameId = 4;
  // Laser range data included inline
}
```

### MapMessage

Occupancy grid or costmap data:

```protobuf
message MapMessage {
  bytes data = 1;        // PNG-encoded map image
  float resolution = 2;
  float x = 3;           // Origin x
  float y = 4;           // Origin y
  string mapId = 5;
}
```

### PathDataMessage

Robot paths (planned or executed):

```protobuf
message PathDataMessage {
  repeated Point points = 1;
  string pathId = 2;
}
```

### CustomDataMessage

Arbitrary key-value data, text, or images:

```protobuf
message CustomDataMessage {
  repeated Value values = 1;    // Key-value pairs
  // Also supports diagnostics, images, text
}
```

### Other Message Types

| Message | Description |
|---------|-------------|
| `OdometryDataMessage` | Linear/angular distance and speed |
| `CameraMessage` | JPEG-encoded camera images |
| `AlertMessage` | Robot alerts with severity level |
| `RosDiagnosticsMessage` | ROS diagnostics data |
| `TopicMonitorMessage` | ROS topic monitoring |
| `RosOutMessage` | ROS log messages (compressed) |
| `CustomScriptCommandMessage` | Remote script execution |

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
