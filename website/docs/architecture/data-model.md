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
| `module_states` | Ingest | Web App | Ingest module run states |
| `mqtt_credentials` | Web App | MQTT Broker | Robot MQTT login credentials |
| `users` | Meteor Accounts | Web App, API | User accounts and roles |
| `configuration` | ConfigAPI | Web App | Configuration objects |

## Robots Collection

Primary collection for robot records.

| Field | Type | Description |
|-------|------|-------------|
| `_id` | String | Unique robot identifier |
| `name` | String | Human-readable robot name |
| `hostname` | String | Robot hostname |
| `status.agentOnline` | Boolean | Whether the agent is currently connected |
| `status.value` | String | Computed status string |
| `version` | String | Agent software version |
| `variant` | String | Agent variant identifier |
| `updateStamp` | Number | Last update timestamp (epoch ms) |
| `lock` | Object | Lock state (`expirationTs`, owner) |
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

Tracks the state of ingest modules per robot.

| Field | Type | Description |
|-------|------|-------------|
| `entityId` | String | Robot ID |
| `moduleName` | String | Module name (e.g., "system", "localization") |
| `entityType` | String | Entity type identifier |
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
| `port` | Number | Broker port |
| `websocket_port` | Number | Broker WebSocket port |
| `status` | String | Credential status |
| `tsCreated` | Date | Creation timestamp |
| `tsUsed` | Date | Last used timestamp |

**Indexes:** `username` (unique, sparse), `robotId` (unique, sparse)

## Users Collection

Standard Meteor Accounts collection with OpenRobOps extensions.

| Field | Type | Description |
|-------|------|-------------|
| `_id` | String | User ID |
| `emails` | Array | Email addresses |
| `services` | Object | OAuth tokens and app keys |
| `services.oro.appKey` | String | REST API authentication key |
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
