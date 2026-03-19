---
sidebar_position: 1
---

# Dashboards & Widgets

:::warning
This guide is incomplete; work-in-progress. More widgets are being implemented. Config reference needs to be updated.
:::

OpenRobOps provides a customizable dashboard system for monitoring your robot fleet. Dashboards are composed of **widgets** — self-contained UI components that display specific data.

## Dashboard Types

### Fleet Dashboard

The fleet dashboard shows an overview of all connected robots. It includes fleet-level widgets that aggregate data across the fleet.

### Robot Dashboard

Clicking on a robot opens its detail dashboard, showing robot-specific widgets with live telemetry, vitals, and controls.

## Available Widgets

### Fleet Widgets

| Widget | Description |
|--------|-------------|
| **IncidentTimeline** | Calendar timeline showing incidents across all robots over time |
| **IncidentList** | Sortable list of active and recent incidents |

### Robot Widgets

| Widget | Description |
|--------|-------------|
| **Vitals** | Real-time system vitals: CPU, memory, disk, network RTT, clock drift |
| **CustomData** | Displays custom key-value pairs, text, or images published by the agent |
| **Lock** | Shows lock status and allows locking/unlocking a robot |
| **RobotInfoButtons** | Robot metadata display (name, ID, agent version, online status) |
| **ControlBar** | Action buttons for interacting with the robot |

## Widget Data Flow

Each widget receives data through React context and Meteor's reactive pub/sub system:

1. **Telemetry** arrives via MQTT and is processed by the ingest service.
2. **MongoDB** stores the processed data in appropriate collections.
3. **Meteor publications** reactively push data changes to subscribed clients.
4. **Widget components** render the data using React 18 and Material UI.

Widgets use the `WidgetDataContext` for shared robot data and the `useCustomWidgetData()` hook for retrieving custom data sources.

## CustomData Widget Types

The CustomData widget supports multiple display formats configured via [DataSourceDefinitions](../api/configapi.md):

| Type | Description |
|------|-------------|
| **KeyValue** | Displays named key-value pairs in a table |
| **Text** | Renders text content |
| **Image** | Displays images published by the robot agent |

## Layout

Widgets are rendered within a `DashboardWidgetWrapper` component that provides consistent styling and layout. The dashboard uses a responsive grid layout built on Material UI.

## Configuring Dashboards

Dashboard content is driven by the data sources and status definitions configured through the [ConfigAPI](../api/configapi.md). To customize what appears on dashboards:

1. Define **DataSourceDefinitions** to map telemetry fields to widget data
2. Define **StatusDefinitions** to control status indicators and thresholds
3. Widgets automatically pick up configuration changes

See [Custom Widgets](../extending/custom-widgets.md) to learn how to build new widget types.
