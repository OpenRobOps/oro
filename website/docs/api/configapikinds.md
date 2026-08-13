---
sidebar_position: 5
---

# Config API Kinds

This page provides a full reference for each configuration `kind` supported by the Config API. All examples use YAML format. For general API usage (apply, clear, list endpoints), see the [Config API](./configapi.md) page.

Every configuration object follows this structure:

```yaml
apiVersion: v0.1
kind: <KindName>
metadata:
  id: <unique-id>
spec:
  # Kind-specific fields
```

---

## DataSourceDefinition

Defines custom data sources and attribute mappings for robots. Data sources represent individual metrics, sensors, or computed values that the platform tracks.

### Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `spec.label` | string | No | Human-readable label for the data source (max 255 chars) |
| `spec.type` | enum | No | Value type. One of: `json`, `yaml` |
| `spec.unit` | string | No | Unit of measurement (max 10 chars), e.g. `%`, `m/s`, `kB/s` |
| `spec.scale` | number | No | Scale factor applied to the value |
| `spec.precision` | number | No | Number of decimal places for display |
| `spec.source` | object | No | Data source mapping (exactly one key allowed) |

#### Source types

The `source` field must contain exactly one of the following keys:

| Source Key | Fields | Description |
|------------|--------|-------------|
| `keyValue` | `key` (required), `topic` (optional) | Maps to a key-value pair published by the robot agent |
| `derived` | `transform` (required), `filter` (optional) | Computed value using an expression |
| `network` | `interface`, `mappingKey`, `optionKey` (all required) | Network interface metrics |
| `textFile` | `path` (required) | Value read from a text file on the robot |
| `imageFile` | `path` (required) | Image read from a file on the robot |
| `diskUsage` | `partition` (required) | Disk usage for a specific partition |
| `networkUsage` | `interface` (required) | Network usage for a specific interface |
| `rosDiagnostics` | `namespace` (required), `key` (required) | Value from ROS diagnostics |

### Examples

A simple data source with label, unit, and precision:

```yaml
apiVersion: v0.1
kind: DataSourceDefinition
metadata:
  id: cpuLoadPercentage
spec:
  label: CPU usage
  precision: 1
  unit: '%'
```

A data source backed by a key-value pair from the robot agent:

```yaml
apiVersion: v0.1
kind: DataSourceDefinition
metadata:
  id: battery_level
spec:
  label: Battery Level
  unit: '%'
  precision: 0
  source:
    keyValue:
      key: battery_percentage
```

A derived (computed) data source:

```yaml
apiVersion: v0.1
kind: DataSourceDefinition
metadata:
  id: battery_hours_remaining
spec:
  label: Battery hours remaining
  unit: h
  precision: 1
  source:
    derived:
      transform: "batteryPercentage / avgDrainRatePerHour"
      filter: "batteryPercentage > 0"
```

A JSON-typed data source (for structured values like poses):

```yaml
apiVersion: v0.1
kind: DataSourceDefinition
metadata:
  id: pose
spec:
  label: Robot Pose
  type: json
```

A data source reading from ROS diagnostics:

```yaml
apiVersion: v0.1
kind: DataSourceDefinition
metadata:
  id: motor_temperature
spec:
  label: Motor Temperature
  unit: "\u00B0C"
  precision: 1
  source:
    rosDiagnostics:
      namespace: /motors/left
      key: temperature
```

---

## StatusDefinition

Defines status computation rules for robots. Status rules evaluate data source values and produce a status level (`WARNING` or `ERROR`) when conditions are met. A StatusDefinition references a DataSourceDefinition by sharing the same `metadata.id`.

### Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `spec.rules` | array | Yes | List of status rules (evaluated in order) |
| `spec.rules[].function` | enum | Yes | Comparison function: `ABOVE`, `BELOW`, `EQUALS`, `NOT_EQUALS`, `CONTAINS` |
| `spec.rules[].params` | array | No | Arguments for the function (typically one value) |
| `spec.rules[].status` | enum | Yes | Status level to set when the rule matches: `WARNING` or `ERROR` |
| `spec.rules[].sustainedForSeconds` | number | No | Minimum duration (in seconds, >= 1) the condition must hold before triggering |
| `spec.calculated` | object | No | Creates a derived data source for this status |
| `spec.calculated.expression` | string | Yes (if `calculated` present) | Expression to compute the value |
| `spec.calculated.filter` | string | No | Filter expression (only compute when filter is true) |
| `spec.calculated.label` | string | No | Label for the auto-created data source |

### Examples

A status that triggers a warning when CPU is sustained above 85% for 60 seconds, and an error above 95%:

```yaml
apiVersion: v0.1
kind: StatusDefinition
metadata:
  id: cpuLoadPercentage
spec:
  rules:
    - function: ABOVE
      params:
        - 0.95
      status: ERROR
      sustainedForSeconds: 60
    - function: ABOVE
      params:
        - 0.85
      status: WARNING
      sustainedForSeconds: 60
```

A status that flags an error when disk usage exceeds 90%, and a warning above 70%:

```yaml
apiVersion: v0.1
kind: StatusDefinition
metadata:
  id: diskUsagePercentage
spec:
  rules:
    - function: ABOVE
      params:
        - 0.9
      status: ERROR
    - function: ABOVE
      params:
        - 0.7
      status: WARNING
```

A status using `NOT_EQUALS` to detect ROS master down:

```yaml
apiVersion: v0.1
kind: StatusDefinition
metadata:
  id: rosMasterStatus
spec:
  rules:
    - function: NOT_EQUALS
      params:
        - 1
      status: ERROR
```

A status with a calculated (derived) expression:

```yaml
apiVersion: v0.1
kind: StatusDefinition
metadata:
  id: fleet_utilization
spec:
  calculated:
    label: Fleet Utilization
    expression: "activeRobots / totalRobots * 100"
    filter: "totalRobots > 0"
  rules:
    - function: BELOW
      params:
        - 20
      status: WARNING
    - function: BELOW
      params:
        - 10
      status: ERROR
```

---

## ActionDefinition

Configures actions that can be executed on robots. Actions appear in the UI and can be triggered manually or programmatically.

### Schema

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `spec.type` | enum | Yes | | Action type. One of: `RestartAgent`, `RunScript`, `PublishToTopic`, `Url`, `MapSwitch`, `NavigatePath`, `Relocalize`, `NavigateTo`, `CancelNavGoal`, `Teleop`, `UpdateAgent`, `CameraToggle` — applying any other value fails |
| `spec.label` | string | No | `""` | Display label (max 255 chars) |
| `spec.description` | string | No | `""` | Description text (max 255 chars) |
| `spec.lock` | boolean | No | `false` | Whether the action locks the robot during execution |
| `spec.group` | string | No | | Group name for organizing actions in the UI (max 255 chars) |
| `spec.confirmation` | object | No | `{ required: false }` | Confirmation settings |
| `spec.confirmation.required` | boolean | No | `false` | Whether to show a confirmation dialog |
| `spec.condition` | object | No | | Conditions that control when the action is available |
| `spec.condition.rules` | array | Yes (if `condition` present) | | Array of condition rules |
| `spec.widgets` | array | No | | Widgets where this action is embedded. Values: `navigation` |
| `spec.arguments` | array | No | `[]` | Action arguments |
| `spec.arguments[].type` | enum | No | `string` | Argument type: `string` or `number` |
| `spec.arguments[].name` | string | No | | Argument name (auto-generated if omitted) |
| `spec.arguments[].value` | string/number | No | | Default value for the argument |
| `spec.arguments[].dataSourceId` | string | No | | Data source to bind this argument to |
| `spec.arguments[].input` | object | No | | Input control configuration |
| `spec.arguments[].input.control` | enum | Yes (if `input` present) | | Input control type: `text` or `select` |
| `spec.arguments[].input.values` | array | No | | List of options for `select` controls |
| `spec.arguments[].input.values[].label` | string | Yes | | Display label for the option |
| `spec.arguments[].input.values[].value` | string | Yes | | Value for the option |

:::note[Required arguments per type]
Some action types require specific arguments, and apply fails with
`Missing action argument: ...` without them: `RunScript` requires `filename`,
`PublishToTopic` requires `message`, `CameraToggle` requires `cameraId`, and
`MapSwitch` requires `label`.
:::

### Examples

A simple agent-restart action with no arguments:

```yaml
apiVersion: v0.1
kind: ActionDefinition
metadata:
  id: restart_agent
spec:
  type: RestartAgent
  label: Restart Agent
  description: Restarts the robot agent
  lock: true
  confirmation:
    required: true
```

A script action with a dropdown-selected extra argument (`filename` is
required for `RunScript`):

```yaml
apiVersion: v0.1
kind: ActionDefinition
metadata:
  id: set_speed
spec:
  type: RunScript
  label: Set Speed
  description: Sets the maximum robot speed
  group: Motion Control
  arguments:
    - name: filename
      type: string
      value: set_speed.sh
    - name: speed_mode
      type: string
      input:
        control: select
        values:
          - label: Slow
            value: "0.5"
          - label: Normal
            value: "1.0"
          - label: Fast
            value: "2.0"
```

A topic-publish action embedded in the navigation widget (`message` is
required for `PublishToTopic`):

```yaml
apiVersion: v0.1
kind: ActionDefinition
metadata:
  id: announce_arrival
spec:
  type: PublishToTopic
  label: Announce Arrival
  widgets:
    - navigation
  arguments:
    - name: message
      type: string
      value: arrived
```

---

## DashboardDefinition

Defines custom dashboards with sections and widgets. Dashboards organize robot and fleet data into configurable views.

### Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `spec.label` | string | Yes | Dashboard display name |
| `spec.order` | number | No | Sort order for the dashboard in the UI |
| `spec.sections` | array | Yes | List of dashboard sections |

#### Section schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `label` | string | Yes | Section display name |
| `scope` | enum | Yes | Section scope: `fleet`, `robot`, `navigation`, `mission`, `demo`, `location`, `order` |
| `comment` | string | No | Optional section comment |
| `withControlWidget` | boolean | No | Whether to show the control widget in this section |
| `widgets` | array | Yes | List of widgets in the section |

#### Widget schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `label` | string | Yes | Widget display name |
| `type` | enum | Yes | Widget type (see supported types below) |
| `layout` | object | No | Layout configuration |
| `layout.grid` | number/string | No | Width in grid columns (1-12) or CSS value |
| `layout.height` | number/string | No | Height in rows or CSS value |
| `layout.chroma` | boolean | No | Enable color theming |
| `layout.withoutBackground` | boolean | No | Render without background |
| `config` | object | No | Type-specific widget configuration |
| `widgets` | array | Only for `group` type | Nested widgets (only for `group` type) |

#### Supported widget types

| Type | Config fields | Description |
|------|---------------|-------------|
| `vitals` | `dataSources[]` with `id`, `label`, `unit`, `type` (`text` or `gauge`) | Real-time vital metrics display |
| `chart` | `chartType` (`linechart` or `areachart`), `min`, `max`, `dataSources[]` with `id`, `label`, `precision`, `scale`, `op` | Time-series chart |
| `history` | `dataSources[]` with `id`, `label`, `type` | Historical data table |
| `listData` | `dataSources[]` with `id`, `label`, `precision`, `type`, `unit` | Data list display |
| `actionsWidget` | `bigButtons`, `expanded`, `actionIds[]` | Robot actions panel |
| `cameraWidget` | `cameraId` | Camera video feed |
| `localization` | `mapId` | Map/localization view |
| `fleetStatus` | `isExpanded`, `statuses[]` with `id`, `label` | Fleet status overview |
| `group` | (uses nested `widgets`) | Group of widgets |
| `dataBags` | (none) | Data bags viewer |
| `auditLog` | (none) | Robot audit log |
| `auditLogFleet` | (none) | Fleet audit log |
| `keyValues` | (none) | Key-value pairs viewer |
| `diagnostics` | (none) | ROS diagnostics viewer |
| `navigation` | (none) | Navigation view |
| `incidentList` | (none) | Incident list |
| `incidentTimeline` | (none) | Incident timeline |
| `logsWidget` | (none) | Logs viewer |
| `customDataImage` | (none) | Custom data image |
| `customDataText` | (none) | Custom data text |

### Examples

A fleet dashboard with status overview and incident tracking:

```yaml
apiVersion: v0.1
kind: DashboardDefinition
metadata:
  id: fleet
spec:
  label: Fleet
  order: 1
  sections:
    - label: Fleet
      scope: fleet
      withControlWidget: true
      widgets:
        - label: Fleet Status
          type: fleetStatus
          layout:
            chroma: true
            grid: 12
          config:
            statuses:
              - id: cpuLoadPercentage
                label: CPU
              - id: diskUsagePercentage
                label: Disk
    - label: Details
      scope: fleet
      withControlWidget: false
      widgets:
        - label: Fleet Log
          type: auditLogFleet
          layout:
            chroma: true
            grid: 4
            height: 1
        - label: Incident List
          type: incidentList
          layout:
            chroma: true
            grid: 8
            height: 1
        - label: Incident Timeline
          type: incidentTimeline
          layout:
            chroma: true
            grid: 12
            height: 1
```

A robot dashboard with vitals, charts, and actions:

```yaml
apiVersion: v0.1
kind: DashboardDefinition
metadata:
  id: robot
spec:
  label: Robot
  order: 2
  sections:
    - label: Health
      scope: robot
      withControlWidget: true
      widgets:
        - label: Vitals
          type: vitals
          layout:
            chroma: true
            grid: 4
            height: 1
          config:
            dataSources:
              - id: cpuLoadPercentage
                label: CPU usage
                type: gauge
                unit: '%'
              - id: diskUsagePercentage
                label: Disk usage
                type: gauge
                unit: '%'
        - label: ROS Diagnostics
          type: diagnostics
          layout:
            chroma: true
            grid: 4
            height: 1
    - label: Details
      scope: robot
      withControlWidget: false
      widgets:
        - label: Timeline
          type: chart
          layout:
            chroma: true
            grid: 8
            height: 1
          config:
            chartType: linechart
            min: 0
            max: 100
            dataSources:
              - id: cpuLoadPercentage
                label: CPU usage
                precision: 1
                scale: 100
              - id: diskUsagePercentage
                label: Disk usage
                precision: 1
                scale: 100
        - label: Map
          type: localization
          layout:
            chroma: true
            grid: 4
            height: 1
        - label: Actions
          type: actionsWidget
          layout:
            chroma: true
            grid: 4
            height: 1
        - label: Key Value pairs
          type: keyValues
          layout:
            chroma: true
            grid: 4
            height: 1
```

A dashboard using widget groups:

```yaml
apiVersion: v0.1
kind: DashboardDefinition
metadata:
  id: monitoring
spec:
  label: Monitoring
  order: 4
  sections:
    - label: Overview
      scope: robot
      withControlWidget: true
      widgets:
        - label: System Metrics
          type: group
          layout:
            grid: 8
          widgets:
            - label: CPU & Memory
              type: chart
              layout:
                grid: 6
                height: 1
              config:
                chartType: areachart
                min: 0
                max: 100
                dataSources:
                  - id: cpuLoadPercentage
                    label: CPU
                    precision: 1
                    scale: 100
            - label: Network
              type: chart
              layout:
                grid: 6
                height: 1
              config:
                chartType: linechart
                dataSources:
                  - id: networkTotalRate
                    label: Network rate
                    precision: 0
        - label: Camera Feed
          type: cameraWidget
          layout:
            grid: 4
            height: 1
          config:
            cameraId: front_camera
```

---

## See Also

- [Config API](./configapi.md) -- API endpoints for apply, clear, and list operations
- [Attributes & Status](../guides/attributes-status.md) -- practical guide to using DataSourceDefinitions and StatusDefinitions
- [Custom Data Sources](../extending/custom-data-sources.md) -- advanced data source configuration
