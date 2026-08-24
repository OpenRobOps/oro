---
sidebar_position: 4
---

# Data Model

OpenRobOps uses a single MongoDB database (`meteor`) shared across all components. This page documents the key collections and their schemas.

## Collections Overview

| Collection | Written By | Read By | Description |
|------------|-----------|---------|-------------|
| `robots` | Ingest, Web App | Web App, API | Robot records and status |
| `localization` | Ingest | Web App, API | Robot pose, maps, lasers, paths |
| `attr_values` | Ingest | Web App | Robot telemetry values |
| `module_states` | Web App | Web App, API | Agent module (agentlet) run states |
| `mqtt_credentials` | Web App | MQTT Broker | Robot MQTT login credentials |
| `users` | Meteor Accounts | Web App, API | User accounts and roles |
| `robot_status` | Ingest | Web App | Per-robot computed status entries |
| `robot_vitals` | Ingest, Web App | Web App | System vitals (CPU, RAM, disk, RTT) |
| `robot_key_values` | Ingest | Web App | Last-seen custom data / event keys per robot |
| `custom_data` | Ingest | Web App | Custom text/image payloads |
| `custom_script` | Ingest | Web App | Command execution feedback |
| `diagnostics` | Ingest | Web App | ROS diagnostics snapshots |
| `timeseries` | Ingest | Web App | Attribute history for timeline charts |
| `robot_agent_files` | Ingest | Web App | Agent log file metadata |
| `robot_alerts` | Web App | Web App | Alerts raised from attribute statuses |
| `incidents` | Web App | Web App | Incidents derived from alerts |
| `notifications` | Web App | Web App | In-app notifications (one per open alert) |
| `event_log` | Web App, Ingest | Web App | Audit log of actions and incident changes |
| `upstream_mqtt_credentials` | Ingest | Ingest | Encrypted upstream broker credentials |

The web app also defines a MongoDB **view**, `view_robots_with_status`, which
joins robots with their status entries for the fleet list.

There is no single "configuration" collection: each Config API kind handler
owns its own collection — `attr_defs` (DataSourceDefinition), `status_config`
(StatusDefinition), `action_defs` (ActionDefinition), `dashboards`
(DashboardDefinition), `module_states` (ModuleState), `incident_definitions`
(IncidentDefinition), and `notification_channels` (NotificationChannel). See
[ConfigAPI Storage](#configapi-storage) below.

## Robots Collection

Primary collection for robot records.

| Field | Type | Description |
|-------|------|-------------|
| `_id` | String | Unique robot identifier |
| `name` | String | Human-readable robot name |
| `hostname` | String | Robot hostname |
| `status.agentOnline` | Boolean | Whether the agent is currently connected |
| `status.value` | Number | Computed status severity (max across configured statuses) |
| `version` | String | Agent software version |
| `variant` | String | Agent variant identifier |
| `updateStamp` | Number | Last update timestamp (epoch ms) |
| `lock` | Object | Lock state (`userId`, `userName`, `locked`, `lockedTs`, `expirationTs`) |
| `robotKey` | String | Robot registration key |

**Indexes:** `name` (with collation), `lock.expirationTs`

## Localization Collection

Stores robot spatial data. Keyed by robot ID (`_id` matches robot ID).

| Field | Type | Description |
|-------|------|-------------|
| `_id` | String | Robot ID |
| `robotPose` | Object | Current pose: `x`, `y`, `theta`, `frameId`, `ts` |
| `robotPoseUpdatedTs` | Number | Pose update timestamp |
| `laserRanges` | Object | Laser scan data (keyed by laser ID) |
| `laserRangesUpdatedTs` | Number | Laser update timestamp |
| `costmap` | Object | Costmap data |
| `map` | Object | Map metadata: `mapId`, `x`, `y`, `resolution`, `dataHash` |
| `defaultMap` | String | Current active map label |
| `paths` | Object | Path data (keyed by path ID), each with `points` and `ts` |

## Module States Collection

Tracks the run state of **agent modules (agentlets)** per robot. Written by the
web app (AgentManager and the ConfigAPI `ModuleState` kind), not by ingest.

| Field | Type | Description |
|-------|------|-------------|
| `entityId` | String | Robot ID |
| `moduleName` | String | Agentlet name (e.g., "SystemAgentlet", "RosLocalizationAgentlet") |
| `entityType` | String | Entity type (robot / agent / user / system) |
| `runlevel` | Number | Current module run level |
| `minRunlevel` | Number | Minimum required run level |
| `loaded` | Boolean | Whether the module is loaded |

## MQTT Credentials Collection

Stores robot authentication credentials for the MQTT broker.

| Field | Type | Description |
|-------|------|-------------|
| `robotId` | String | Associated robot ID |
| `username` | String | MQTT username (unique) |
| `encryptedPassword` | String | Encrypted MQTT password |
| `superuser` | Boolean | Superuser flag for MQTT ACL |
| `acls` | Array | Access control list entries |
| `brokerId` | String | Broker identifier |
| `hostname` | String | Broker hostname |
| `port` | String | Broker port |
| `websocket_port` | String | Broker WebSocket port |
| `status` | String | Credential status |
| `tsCreated` | Number | Creation timestamp (epoch ms) |
| `tsUsed` | Number | Last used timestamp (epoch ms) |

**Indexes:** `username` and `robotId` (unique with `partialFilterExpression`), plus a TTL index on `expiresAt` for transient UI credentials

## Users Collection

Standard Meteor Accounts collection with OpenRobOps extensions.

| Field | Type | Description |
|-------|------|-------------|
| `_id` | String | User ID |
| `emails` | Array | Email addresses |
| `services` | Object | OAuth tokens and API keys (server-only) |
| `services.oro.apiKeys` | Array | Per-user REST API keys: `{ id, name, keyHash, expirationTs, lastUsedTs, createdTs, roleId }` — only the HMAC `keyHash` is stored, never the plaintext |
| `userRoles` | Array | Role strings (e.g., `["admin"]`) |

## ConfigAPI Storage

Configuration objects are stored in collections managed by each ConfigAPI kind handler. The general structure follows:

| Field | Type | Description |
|-------|------|-------------|
| `kind` | String | Configuration kind (e.g., "DataSourceDefinition") |
| `metadata.id` | String | Unique identifier within the kind |
| `spec` | Object | Kind-specific configuration payload |

## Next Steps

- [System Architecture](./system-architecture.md) — how components use these collections
- [REST API Overview](../api/overview.md) — accessing data via the API
- [ConfigAPI Reference](../api/configapi.md) — configuration object schemas
