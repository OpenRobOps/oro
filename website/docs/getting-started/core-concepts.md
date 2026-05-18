---
sidebar_position: 3
---

# Core Concepts

This page introduces the key abstractions in OpenRobOps. Understanding these concepts will help you navigate the rest of the documentation.

## Robots

A **Robot** is the primary entity in OpenRobOps. Each robot has a unique ID and optionally a name, an online status, and an agent version. 
Robots report telemetry, can receive and execute actions.
Robots are registered when an agent first connects using a valid API key.

## Agents

:::info
Agents and SDKs are still under development.
:::

An **Agent** runs on the robot hardware and is responsible for collecting and publishing telemetry data over MQTT using Protocol Buffer messages. The agent communicates with the MQTT broker, which feeds data into the ingest pipeline.

Agents are organized into **agentlets** — small, focused modules that each handle a specific type of telemetry (system stats, localization, custom data, etc.).

## Telemetry

**Telemetry** is the data stream flowing from robot agents to OpenRobOps. It includes:

- **System stats** — CPU, memory, disk, and network usage
- **Localization** — robot pose (x, y, yaw), maps, laser scans, paths
- **Custom data** — arbitrary key-value pairs, text, or images published by the agent

Telemetry flows through MQTT as protobuf-encoded messages and is processed by the ingest service before being stored in MongoDB.

## Attributes

**Attributes** are named values associated with a robot, computed from telemetry or set via configuration. Examples include battery level, operational mode, or any custom metric. Attributes are defined and configured through the [ConfigAPI](../api/configapi.md) using `DataSourceDefinition` objects.

## Dashboards & Widgets

**Dashboards** are the primary UI for viewing robot data. They contain **Widgets** — reusable UI components that display specific data:

- **Fleet widgets** — display data across all robots (e.g., IncidentTimeline, IncidentList)
- **Robot widgets** — display data for a single robot (e.g., Vitals, CustomData, Lock, ControlBar)

## Incidents

**Incidents** are events that indicate a problem or notable condition on a robot. They appear in the IncidentTimeline and IncidentList widgets. Incident definitions are configured through the ConfigAPI.

## Actions

**Actions** are operations that can be triggered on robots (e.g., restart, send command). Action definitions are managed through the ConfigAPI.

## Audit Log

The **Audit Log** records action executions, command feedback, and notable robot events. It powers the fleet-wide and per-robot log widgets so operators can trace who did what, when, and with what result.

## Derived Attributes

In addition to attributes pulled directly from telemetry, ORO can compute **derived attributes** — values calculated from one or more existing attributes on a configurable schedule. See [ConfigAPI](../api/configapi.md) for details.

## ConfigAPI

The **ConfigAPI** is a declarative configuration system for managing platform behavior. It follows a "configuration as code" pattern where you apply JSON/YAML configuration objects to define robot attributes, dashboard widgets, incident definitions, etc.

Configuration is applied via `POST /api/configuration/apply` and retrieved via `GET /api/configuration/list`. See the [ConfigAPI Reference](../api/configapi.md) for details.

## Ingest Modules

**Ingest modules** are pluggable components in the ingest service that process specific types of MQTT messages. Each module subscribes to relevant MQTT topics, decodes protobuf messages, and writes processed data to MongoDB. Active modules include:

- **BasicsModule** — basic robot identification and status
- **SystemModule** — system resource monitoring (CPU, RAM, disk, network)
- **RobotLocalizationModule** — pose, maps, paths, laser, and costmap
- **CustomDataModule** — user-defined key-value data, text, and images
- **DiagnosticsModule** — ROS-style hardware diagnostics with severity levels
- **CustomCommandsModule** — execution feedback from remote commands and actions

## MQTT Topics

:::info
This refers to the MQTT-based ORO protocol. 
:::

Robots publish telemetry to MQTT topics following the pattern:

```
r/<robot_id>/<topic_type>
```

The MQTT broker handles authentication and authorization of MQTT clients backed by MongoDB. Each robot receives credentials allowing to read and write its own MQTT topics. Other uses of MQTT authentication include transient credentials provisioned to client browsers.

## Next Steps

- [Connecting Your First Robot](./connecting-first-robot.md) — put these concepts into practice
- [Dashboards & Widgets](../guides/dashboards-widgets.md) — explore the UI components
- [System Architecture](../architecture/system-architecture.md) — deep dive into how components interact
