---
sidebar_position: 1
---

# Dashboards & Widgets

:::note
The widget catalog below reflects the widgets currently shipping in ORO. More widget types are added regularly.
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
| **Fleet Status** | Fleet-wide status grid with configurable attribute columns and color coding |
| **Fleet Control** | Filter, sort, and group robots by status or attribute |
| **IncidentTimeline** | Calendar timeline of incidents across robots (uses `react-calendar-timeline`) |
| **IncidentList** | Sortable list of active and recent incidents |
| **Fleet Log (Audit)** | Fleet-wide audit log of action executions and events |
| **Text** | Rich-text panel used for welcome pages and informational content |

### Robot Widgets

| Widget | Description |
|--------|-------------|
| **Vitals** | Real-time system vitals: CPU, memory, disk, network RTT, clock drift |
| **Timeline (Timeseries)** | Line/area chart of any attribute over time, with avg / min / max / sum / count / last aggregations |
| **ROS Diagnostics** | Hardware diagnostic statuses by component, with severity filtering |
| **Map** | 2D map with robot pose, costmap, laser scans, and paths — drives navigation when used in the Navigation dashboard |
| **ListData** | Tabular view of robot attributes with configurable columns |
| **CustomData** | Custom key-value pairs, text blobs, or images published by the agent |
| **Camera** | Live image feed for a configurable camera ID |
| **Actions** | Robot action buttons; can be embedded inline or shown as a dedicated widget (with `expanded` and `bigButtons` config) |
| **Lock** | Lock/unlock a robot to prevent concurrent control |
| **Robot Control Bar** | Strip of common controls (search, restart agent, update agent, lock) |
| **Robot Info Buttons** | Robot metadata display (name, ID, agent version, online status) |
| **Robot Log (Audit)** | Per-robot audit log of action executions and events |

### Navigation Widgets

The Navigation dashboard layers teleoperation on top of the standard map view:

| Widget | Description |
|--------|-------------|
| **Navigation Detail** | Combined view with map, teleop controls, teleop gauges, and a camera grid |
| **Navigation Control Bar** | Robot selection and navigation-specific actions |
| **Camera Grid** | Multi-camera layout (sub-component of Navigation Detail) |
| **Teleop Controls** | Joystick and velocity command interface |
| **Teleop Gauges** | Speed and rotation feedback gauges |

### Widget Toolbars

Most widgets render inside a toolbar wrapper that hosts widget-specific controls — for example a Live / History toggle (`LiveButtonToolbar`), a time-range and aggregation picker for the Timeline widget (`TimelineFilter`), severity and component filters for the Incident widgets (`IncidentsFilter`, `IncidentTimelineFilter`), and severity filters for ROS Diagnostics (`ROSDiagnosticsFilter`).

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
