---
sidebar_position: 3
---

# Attributes & Status

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
curl -H "x-auth-api-key: YOUR_KEY" \
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

### Defining a Key-Value Attribute

A `DataSourceDefinition` whose `source.keyValue.key` matches a key the agent publishes
maps that telemetry into a named attribute:

```bash
curl -X POST \
  -H "x-auth-api-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  http://localhost:3000/api/configuration/apply \
  -d '{
    "apiVersion": "v0.1",
    "kind": "DataSourceDefinition",
    "metadata": { "id": "battery_level" },
    "spec": {
      "label": "Battery Level",
      "unit": "%",
      "precision": 0,
      "source": { "keyValue": { "key": "battery_percentage" } }
    }
  }'
```

### Defining a Derived Attribute

A `derived` source computes a value from other attributes using an expression
(`filter` is optional and gates when the value is computed):

```bash
curl -X POST \
  -H "x-auth-api-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  http://localhost:3000/api/configuration/apply \
  -d '{
    "apiVersion": "v0.1",
    "kind": "DataSourceDefinition",
    "metadata": { "id": "battery_hours_remaining" },
    "spec": {
      "label": "Battery hours remaining",
      "unit": "h",
      "precision": 1,
      "source": {
        "derived": {
          "transform": "batteryPercentage / avgDrainRatePerHour",
          "filter": "batteryPercentage > 0"
        }
      }
    }
  }'
```

See the [Config API Kinds reference](../api/configapikinds.md#datasourcedefinition) for every `source` type and field.

### Publishing Test Data

Key-value attributes are fed by custom data the agent publishes over MQTT, which the
ingest **CustomDataModule** stores and the matching `DataSourceDefinition` maps to the
attribute `id`. For the end-to-end flow (and how to publish from a robot or the Flatland
simulator), see [Custom Data Sources](../extending/custom-data-sources.md).

## Status Definitions

**StatusDefinitions** control how a robot's status is computed and displayed. They define rules that evaluate attribute values to determine a robot's current status (e.g., "healthy", "warning", "error").

### Configuring Status

Status definitions are applied through the ConfigAPI:

A `StatusDefinition` shares its `metadata.id` with a `DataSourceDefinition` and lists
rules that raise a `WARNING` or `ERROR` when the value matches. The example below flags
an error when CPU stays above 95% for 60 seconds, and a warning above 85%:

```bash
curl -X POST \
  -H "x-auth-api-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  http://localhost:3000/api/configuration/apply \
  -d '{
    "apiVersion": "v0.1",
    "kind": "StatusDefinition",
    "metadata": { "id": "cpuLoadPercentage" },
    "spec": {
      "rules": [
        { "function": "ABOVE", "params": [0.95], "status": "ERROR", "sustainedForSeconds": 60 },
        { "function": "ABOVE", "params": [0.85], "status": "WARNING", "sustainedForSeconds": 60 }
      ]
    }
  }'
```

See the [Config API Kinds reference](../api/configapikinds.md#statusdefinition) for all rule functions (`ABOVE`, `BELOW`, `EQUALS`, `NOT_EQUALS`, `CONTAINS`) and the `calculated` option.

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
