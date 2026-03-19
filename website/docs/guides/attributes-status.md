---
sidebar_position: 3
---

# Attributes & Status

:::warning
This guide is still incomplete. Missing examples of how to configure attributes (key-values and derived attributes) and how to publish test data.
:::


Attributes and status definitions control how robot data is presented and interpreted in OpenRobOps dashboards.

## Attributes

An **attribute** is a named value associated with a robot, derived from telemetry data. Examples include battery level, speed, operational mode, or any custom metric your robots report.

### How Attributes Work

1. Robot agents publish telemetry via MQTT (e.g., custom data key-value pairs).
2. **DataSourceDefinitions** (configured via ConfigAPI) map telemetry fields to named attributes.
3. The **AttributesManager** computes and stores current attribute values.
4. Widgets query attribute values to display on dashboards.

Attributes can be sourced from ROS topics, from REST API calls or derived from other attributes using an expressions language.

### Querying Attributes

Retrieve a robot's attribute value via the REST API:

```bash
curl -H "x-auth-app-key: YOUR_KEY" \
  http://localhost:3000/api/robots/{robotId}/attributes/{attributeId}
```

Response:

```json
{
  "attribute": "battery_level",
  "value": "87",
  "ts": 1710000000000
}
```

### Defining Attributes via ConfigAPI

Use `DataSourceDefinition` objects to define how telemetry maps to attributes:

```bash
curl -X POST \
  -H "x-auth-app-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  http://localhost:3000/api/configuration/apply \
  -d '{
    "kind": "DataSourceDefinition",
    "metadata": { "id": "battery_level" },
    "spec": {
      // DataSourceDefinition spec fields
    }
  }'
```

See the [ConfigAPI Reference](../api/configapi.md) for the full specification.

## Status Definitions

**StatusDefinitions** control how a robot's status is computed and displayed. They define rules that evaluate attribute values to determine a robot's current status (e.g., "healthy", "warning", "error").

### Configuring Status

Status definitions are applied through the ConfigAPI:

```bash
curl -X POST \
  -H "x-auth-app-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  http://localhost:3000/api/configuration/apply \
  -d '{
    "kind": "StatusDefinition",
    "metadata": { "id": "robot_health" },
    "spec": {
      // StatusDefinition spec fields
    }
  }'
```

### How Status is Computed

1. **StatusDefinitions** reference one or more attributes.
2. Rules evaluate attribute values against thresholds or conditions.
3. The computed status is stored on the robot document.
4. Dashboard widgets display the status with appropriate visual indicators.

## Vitals

The **Vitals** widget displays real-time system health metrics that are automatically collected by the SystemModule:

| Vital | Source | Description |
|-------|--------|-------------|
| **CPU** | SystemStatsMessage | Current CPU utilization |
| **Memory** | SystemStatsMessage | RAM usage percentage |
| **Disk** | SystemStatsMessage | Disk usage percentage |
| **Network RTT** | sysNetRtt | Round-trip time to the robot |
| **Clock Drift** | sysNetAgentTimeDelta | Time synchronization offset |

These vitals are stored in the `RobotVitals` MongoDB collection and do not require ConfigAPI configuration.

## Next Steps

- [ConfigAPI Reference](../api/configapi.md) — full details on DataSourceDefinition and StatusDefinition
- [Custom Data Sources](../extending/custom-data-sources.md) — define your own data sources
- [Dashboards & Widgets](./dashboards-widgets.md) — how attributes and status appear in the UI
