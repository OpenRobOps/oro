---
sidebar_position: 5
---

# Config API

The ConfigAPI provides declarative "configuration as code" management for OpenRobOps. It allows you to define data sources, status rules, and other platform behaviors through JSON configuration objects.

## Concepts

Configuration objects follow a consistent structure:

```json
{
  "kind": "DataSourceDefinition",
  "metadata": {
    "id": "my-config-id"
  },
  "spec": {
    // Kind-specific configuration
  }
}
```

| Field | Description |
|-------|-------------|
| `kind` | The type of configuration object |
| `metadata.id` | Unique identifier within the kind |
| `spec` | Kind-specific configuration payload |

## Supported Kinds

| Kind | Description |
|------|-------------|
| [`DataSourceDefinition`](./configapikinds.md#datasourcedefinition) | Custom data source and attribute mappings |
| [`StatusDefinition`](./configapikinds.md#statusdefinition) | Robot status computation rules |
| [`ActionDefinition`](./configapikinds.md#actiondefinition) | Robot action definitions |
| [`DashboardDefinition`](./configapikinds.md#dashboarddefinition) | Custom dashboard layouts with widgets |

For detailed schemas and examples of each kind, see [Config API Kinds](./configapikinds.md).

:::note
Additional kinds (IncidentDefinition, RobotCamera, and others) are defined in the codebase but not yet enabled. See the [Roadmap](../contributing/roadmap.md).
:::

---

## Apply Configuration

```
POST /api/configuration/apply
```

Creates or updates a configuration object.

### Request Body

```json
{
  "kind": "DataSourceDefinition",
  "metadata": {
    "id": "battery_level"
  },
  "spec": {
    // Kind-specific fields
  }
}
```

### Response

```json
{
  "operationStatus": "SUCCESS"
}
```

### Errors

| Status | Condition |
|--------|-----------|
| 400 | Invalid schema or unsupported kind |
| 401 | Authorization error |
| 500 | Internal error |

### Example

```bash
curl -X POST \
  -H "x-auth-app-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  http://localhost:3000/api/configuration/apply \
  -d '{
    "kind": "DataSourceDefinition",
    "metadata": { "id": "battery_level" },
    "spec": { }
  }'
```

---

## Clear Configuration

```
POST /api/configuration/clear
```

Removes a configuration object.

### Request Body

```json
{
  "kind": "DataSourceDefinition",
  "metadata": {
    "id": "battery_level"
  }
}
```

### Response

```json
{
  "operationStatus": "SUCCESS"
}
```

### Errors

| Status | Condition |
|--------|-----------|
| 400 | Invalid schema or unsupported kind |
| 401 | Authorization error |
| 500 | Internal error |

### Example

```bash
curl -X POST \
  -H "x-auth-app-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  http://localhost:3000/api/configuration/clear \
  -d '{
    "kind": "DataSourceDefinition",
    "metadata": { "id": "battery_level" }
  }'
```

---

## List Configurations

```
GET /api/configuration/list
```

Lists configuration objects matching the given filters.

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `kind` | string | Yes | Configuration kind to list |
| `id` | string | No | Specific configuration ID |
| `format` | string | No | `short` (default) or `full` |
| `all` | boolean | No | Include all configurations (`true`/`false`) |

The `full` format returns the complete configuration object (including `spec`), suitable for re-applying with the `apply` endpoint.

### Response

```json
{
  "items": [
    {
      "kind": "DataSourceDefinition",
      "metadata": {
        "id": "battery_level",
        "scope": ""
      }
    }
  ]
}
```

### Example

```bash
# List all DataSourceDefinitions
curl -H "x-auth-app-key: YOUR_KEY" \
  "http://localhost:3000/api/configuration/list?kind=DataSourceDefinition"

# Get full details
curl -H "x-auth-app-key: YOUR_KEY" \
  "http://localhost:3000/api/configuration/list?kind=DataSourceDefinition&format=full"
```

---

## List Available Kinds

```
GET /api/configuration/kinds
```

Returns the list of configuration kinds supported by this instance.

### Response

```json
{
  "items": [
    "DataSourceDefinition",
    "StatusDefinition"
  ]
}
```

### Example

```bash
curl -H "x-auth-app-key: YOUR_KEY" \
  http://localhost:3000/api/configuration/kinds
```

## Global Configuration

Some configuration kinds are "global" — they apply to the entire system rather than individual robots. For these kinds, the `metadata.id` must be set to `"all"`.

## Next Steps

- [Attributes & Status](../guides/attributes-status.md) — practical guide to using DataSourceDefinitions and StatusDefinitions
- [Custom Data Sources](../extending/custom-data-sources.md) — advanced data source configuration
- [REST API Overview](./overview.md) — authentication and general API info
