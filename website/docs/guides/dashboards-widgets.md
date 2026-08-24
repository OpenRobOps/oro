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

| Widget | Config API `type` | Description |
|--------|-------------------|-------------|
| **Fleet Status** | `fleetStatus` | Fleet-wide status grid with configurable attribute columns and color coding |
| **Fleet Control** | `fleetControl` | Filter, sort, and group robots by status or attribute |
| **IncidentTimeline** | `incidentTimeline` | Calendar timeline of incidents across robots (uses `react-calendar-timeline`) |
| **IncidentList** | `incidentList` | Sortable list of active and recent incidents |
| **Fleet Log (Audit)** | `auditLogFleet` | Fleet-wide audit log of action executions and events |
| **Text** | `text` | Markdown panel (`config.text`) used for welcome pages and informational content; added via Config API only |

The `type` value is what `DashboardDefinition` widgets reference — see
[Config API Kinds](../api/configapikinds.md#dashboarddefinition).

### Robot Widgets

| Widget | Config API `type` | Description |
|--------|-------------------|-------------|
| **Vitals** | `vitals` | Real-time system vitals: CPU, memory, disk, network RTT |
| **Timeline (Timeseries)** | `chart` | Line/area chart of any attribute over time; config: `chartType` (`areachart`/`linechart`, required), `min`/`max`, per-source `op` (avg / min / max / sum / count / last), `precision`, `scale` |
| **ROS Diagnostics** | `diagnostics` | Hardware diagnostic statuses by component, with severity filtering |
| **Key-value Sources** | `keyValues` | Table of key-value pairs from a configured data source |
| **Log files (Text)** | `customDataText` | Text-file content published by the agent |
| **Custom Image** | `customDataImage` | Images published by the agent |
| **Camera** | `cameraWidget` | Live camera feed (see note below on `cameraId`) |
| **Actions** | `actionsWidget` | Robot action buttons; can be embedded inline or shown as a dedicated widget (with `expanded`, `bigButtons`, and `actionIds` config) |
| **Robot Control Bar** | `robotControlBar` | Strip of common controls (search, restart agent, update agent, lock/unlock, robot info) |
| **Robot Log (Audit)** | `auditLog` | Per-robot audit log of action executions and events |

:::note[Maps]
The 2D map view (robot pose, costmap, laser scans, paths) currently renders
only inside the **Navigation** dashboard's Navigation Detail widget; a
standalone map widget for robot dashboards is not currently enabled.
:::

The Camera widget's `cameraId` is the camera **slot key** into the agent's
`cameras_config` map (`"0"`, `"1"`, …; default `"0"`), from which the ROS topic
is derived — it is not a topic name.

### Navigation Widgets

The Navigation dashboard layers teleoperation on top of the standard map view:

| Widget | Config API `type` | Description |
|--------|-------------------|-------------|
| **Navigation Detail** | `navigation` | Combined view with map, teleop controls, teleop gauges, and a camera grid |
| **Navigation Control Bar** | `navigationControlBar` | Robot selection and navigation-specific actions |
| **Camera Grid** | — | Multi-camera layout (sub-component of Navigation Detail) |
| **Teleop Controls** | — | Joystick and velocity command interface (sub-component) |
| **Teleop Gauges** | — | Speed and rotation feedback gauges (sub-component) |

The speed/rotation gauges are fed by odometry ingestion
(`mqtt.odometryEnabled`, on by default) — see
[Robot Telemetry](./robot-telemetry.md).

:::note[Defined but not enabled]
These widget type ids exist in the schema but their renderers are currently
disabled — dashboards referencing them show "Unknown widget type":
`localization` (standalone map), `dataBags`, `logsWidget`, `image`,
`robotSearch`, `history`, `missionTracker`, `fleetMissionTracker`,
`missionControlBar`.
:::

### Widget Toolbars

Most widgets render inside a toolbar wrapper that hosts widget-specific controls — for example a time-range and aggregation picker for the Timeline widget (`TimelineFilter`), severity and component filters for the Incident widgets (`IncidentsFilter`, `IncidentTimelineFilter`), and severity filters for ROS Diagnostics (`ROSDiagnosticsFilter`). Several filters include a shared Live / History toggle (`LiveButton`).

## Widget Data Flow

Each widget receives data through React context and Meteor's reactive pub/sub system:

1. **Telemetry** arrives via MQTT and is processed by the ingest service.
2. **MongoDB** stores the processed data in appropriate collections.
3. **Meteor publications** reactively push data changes to subscribed clients.
4. **Widget components** render the data using React 18 and Material UI.

Widgets use the `WidgetDataContext` for shared robot data and the `useCustomWidgetData()` hook for retrieving custom data sources.

## Custom Data Widgets

Custom data is displayed by three distinct widget types, all rendered by one
underlying component and selected by the widget's `config.mapping.source`:

| Widget type | Mapping source | Description |
|-------------|----------------|-------------|
| **Key-value Sources** (`keyValues`) | `key-value` | Named key-value pairs in a table |
| **Log files** (`customDataText`) | `file-text` | Text-file content |
| **Custom Image** (`customDataImage`) | `file-image` | Images published by the agent |

The `mapping.sourceId` selects which configured data source to display. Note
these widgets' `config` cannot currently be set through the Config API — their
dashboard converters accept no configuration.

## Layout

Widgets are rendered within a `DashboardWidgetWrapper` component that provides consistent styling and layout. The dashboard uses a responsive grid layout built on Material UI.

## Configuring Dashboards

Dashboard content is driven by the data sources and status definitions configured through the [ConfigAPI](../api/configapi.md). To customize what appears on dashboards:

1. Define **DataSourceDefinitions** to map telemetry fields to widget data
2. Define **StatusDefinitions** to control status indicators and thresholds
3. Widgets automatically pick up configuration changes

See [Custom Widgets](../extending/custom-widgets.md) to learn how to build new widget types.
