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
| `spec.timeline` | object | No | Timeseries options: `disabled` (boolean) turns off history recording; `fieldType` (`string` \| `number` \| `boolean`) overrides the stored value type. `timeline: {}` enables history with defaults |

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
| `rosDiagnostics` | `namespace` (required), `key` (required) | Value from ROS diagnostics. `namespace` is the diagnostic status' full name as published by the node (e.g. `/Other/amcl: Standard deviation`); `key` is one of its key-values. Two reserved keys are always available for every status: `__level__` (numeric diagnostic level) and `__msg__` (status message) — the only bindable diagnostics values on agents older than 4.19.0, which don't forward diagnostics key-values |

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

Binding a diagnostic's message via the reserved `__msg__` key (works even when
the agent forwards no key-values):

```yaml
apiVersion: v0.1
kind: DataSourceDefinition
metadata:
  id: amcl_std_dev
spec:
  label: AMCL standard deviation
  source:
    rosDiagnostics:
      namespace: '/Other/amcl: Standard deviation'
      key: __msg__
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
| `layout.grid` | number/string | No | Width in grid columns (conventionally 1-12, not validated) or CSS value |
| `layout.height` | number/string | No | Height in rows or CSS value |
| `layout.chroma` | boolean | No | Enable color theming |
| `layout.withoutBackground` | boolean | No | Render without background |
| `config` | object | No | Type-specific widget configuration |
| `widgets` | array | Only for `group` type | Nested widgets (only for `group` type) |

#### Supported widget types

| Type | Config fields | Description |
|------|---------------|-------------|
| `vitals` | `dataSources[]` with `id`, `label`, `unit`, `type` (`text` or `gauge`) | Real-time vital metrics display |
| `chart` | `chartType` (`linechart` or `areachart`, **required** when `config` is present), `min`, `max`, `dataSources[]` with `id`, `label`, `precision`, `scale`, `op` (`average`, `count`, `maximum`, `minimum`, `sum`, `last`). `dataSources[].id` values must be unique within the widget | Time-series chart |
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
| `text` | `text` (Markdown string) | Markdown panel |

The enum also accepts `robotSearch`, `fleetControl`, `image`,
`robotControlBar`, `navigationControlBar`, `missionTracker`,
`fleetMissionTracker`, and `missionControlBar`, but these have no config
converter — any `config` passed is silently dropped. Note that some accepted
types (`localization`, `dataBags`, `logsWidget`, `image`, `robotSearch`,
`history`, and the mission widgets) currently have no client renderer and
display "Unknown widget type" on dashboards.

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

## IncidentDefinition

Defines how alerts raised for an attribute's status become incidents: severity,
automatic and manual actions, and notification channels per level. The
`metadata.id` is the **attribute (trigger) id** the definition applies to.
See the [Incidents & Alerts guide](../guides/incidents-alerts.md) for the full
pipeline.

### Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `spec.label` | string | No | Fixed incident title |
| `spec.labelTemplate` | string | No | Title template; supports `{{robotName}}` |
| `spec.error` / `spec.warning` | object | No | Per-level blocks (see below) |
| `spec.<level>.severity` | enum | No | `SEV 0`, `SEV 1`, `SEV 2`, or `SEV 3` |
| `spec.<level>.autoActions` | array | No | `ActionDefinition` ids executed automatically at this level (run as the system user) |
| `spec.<level>.manualActions` | array | No | Action ids offered as buttons on the in-app notification |
| `spec.<level>.notificationChannels` | array | No | `NotificationChannel` ids notified at this level (missing channels are skipped) |
| `spec.ok` | object | No | Resolution block — only `autoActions` and `notificationChannels` (no `severity`/`manualActions`); runs on resolve |

### Example

```yaml
apiVersion: v0.1
kind: IncidentDefinition
metadata:
  id: battery_level
spec:
  labelTemplate: "Battery problem on {{robotName}}"
  error:
    severity: SEV 1
    autoActions: [pause_robot]
    manualActions: [restart_agent]
    notificationChannels: [ops-webhook]
  ok:
    notificationChannels: [ops-webhook]
```

---

## NotificationChannel

Named delivery endpoints referenced by `IncidentDefinition`
`notificationChannels` lists. Webhook is the only supported type today.

### Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `spec.type` | enum | Yes | Only `webhook` |
| `spec.url` | url | Yes | Endpoint that receives JSON `POST`s |
| `spec.secret` | string | No | Sent as `Authorization: Bearer <secret>` on each delivery |

The `metadata.id` is the name referenced from incident definitions. Deliveries
fire on incident open, escalation, and resolve; best-effort, no retries. See
the [Incidents & Alerts guide](../guides/incidents-alerts.md#notification-channels)
for the payload format.

### Example

```yaml
apiVersion: v0.1
kind: NotificationChannel
metadata:
  id: ops-webhook
spec:
  type: webhook
  url: https://ops.example.com/hooks/oro
  secret: my-shared-secret
```

---

## ModuleState

Singleton state documents for **agent modules** (agentlets), keyed by module
name. Used to persist per-module configuration such as the minimum run level
at which a module starts.

### Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `spec.state` | object | Yes | Opaque state blob; contents are not validated |

Applying **replaces** the whole stored state document — include every field you
want kept, not just the one you're changing. `metadata.id` is the module
(agentlet) name, e.g. `RosLocalizationAgentlet`. Requires fleet configure
access.

### Example

```yaml
apiVersion: v0.1
kind: ModuleState
metadata:
  id: RosLocalizationAgentlet
spec:
  state:
    minRunlevel: 2
```

---

## SpatialAnnotation

Uploads a map image for the [Navigation widget](./navigation.md). `metadata.id`
is the map id. By default a map is stored at `scope: system`, so every robot
can list it as a **shared map**; setting `spec.scope` to a robot id stores a
robot-owned map instead. The image travels as base64 inside the spec (the
Config API is JSON-only) — see [Maps](../maps.md) for the end-to-end workflow
and the [`tools/png2map.py`](https://github.com/OpenRobOps/oro/blob/main/tools/png2map.py)
helper that builds this YAML from a PNG file.

### Schema

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `spec.scope` | string | No | `system` | `system` for a shared map, or a robot id for a robot-owned map |
| `spec.type` | string | No | `map` | Must be `map` if present |
| `spec.frameId` | string | Yes | | Coordinate frame the image is drawn in. Robot grids are normally in `map`; see [Maps](../maps.md#frames-and-transforms) for what happens when this differs from a robot's own frame |
| `spec.label` | string | Yes | | Display name shown in the map switcher |
| `spec.x` | number | Yes | | World X of the image's bottom-left corner, in `frameId` units |
| `spec.y` | number | Yes | | World Y of the image's bottom-left corner, in `frameId` units |
| `spec.resolution` | number | Yes | | Metres per pixel (must be positive) |
| `spec.formatVersion` | enum | No | `2` | `1` or `2` |
| `spec.image` | string | Yes | | Base64-encoded PNG. 12 MB decoded max; width/height and a content hash are computed server-side |

:::note[Collisions with robot-ingested maps]
`apply` is rejected when the id collides with a map the robot itself already
publishes over MQTT (its live occupancy grid) — pick a different id for the
shared map.
:::

`list` returns every field except `spec.image` by default; request the full
format to get the image data back. `clear` removes the map id at **every**
scope (system and all robots), not just the scope it was applied at.

### Example

```yaml
apiVersion: v0.1
kind: SpatialAnnotation
metadata:
  id: warehouse-floor-1
spec:
  scope: system
  type: map
  frameId: map
  label: Warehouse Floor 1
  x: 0
  y: 0
  resolution: 0.05
  formatVersion: 2
  image: <base64 PNG>
```

---

## SpatialTransformation

Defines a rigid transform between two coordinate frames, so a robot whose
localization frame differs from a map's `frameId` can still be placed on that
map. `metadata.id` is `system` (applies to every robot) or a robot id
(overrides the system entry for that robot only). See
[Maps: Frames and transforms](../maps.md#frames-and-transforms) for when one
is needed.

### Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `spec.transformations` | array | Yes | One entry per source frame (`from`) |
| `spec.transformations[].from` | string | Yes | Source frame id |
| `spec.transformations[].to` | string | Yes | Destination frame id |
| `spec.transformations[].matrix` | array | One of `matrix`/`referencePoints` | Explicit 3x3 matrix mapping a pose in `from` into `to` |
| `spec.transformations[].referencePoints` | array | One of `matrix`/`referencePoints` | ≥3 `{from:{x,y}, to:{x,y}}` landmark pairs; the rigid transform (rotation + translation) is least-squares fitted server-side |

Exactly one of `matrix` or `referencePoints` must be given per entry, and
`from` must differ from `to`. Applying **replaces** the entity's whole set of
transformations — include every `from` frame you want kept. At most one entry
per source frame is allowed.

When the Navigation widget looks up a transform for a robot, it checks the
robot's own entry first, then the `system` entry, then falls back to identity
when the frames are already equal; if none of those apply, the map is shown
with a banner and the robot is hidden.

The ISO 21423 facility CCS calibration is itself a `system`-scope
`map → <ccs.id>` entry — see the
[ISO Robots setup guide](../iso21423/iso-robots-setup.md#2-settings).

### Example

```yaml
apiVersion: v0.1
kind: SpatialTransformation
metadata:
  id: system
spec:
  transformations:
    - from: map
      to: 3f2504e0-4f89-41d3-9a0c-0305e82c3301
      referencePoints:
        - from: { x: 0, y: 0 }
          to: { x: 12.40, y: 8.10 }
        - from: { x: 10, y: 0 }
          to: { x: 22.35, y: 8.05 }
        - from: { x: 0, y: 10 }
          to: { x: 12.45, y: 18.05 }
```

---

## See Also

- [Config API](./configapi.md) -- API endpoints for apply, clear, and list operations
- [Maps](../maps.md) -- shared maps, frames and transforms, and the map switcher
- [Attributes & Status](../guides/attributes-status.md) -- practical guide to using DataSourceDefinitions and StatusDefinitions
- [Incidents & Alerts](../guides/incidents-alerts.md) -- the alert → incident pipeline
- [Custom Data Sources](../extending/custom-data-sources.md) -- advanced data source configuration
