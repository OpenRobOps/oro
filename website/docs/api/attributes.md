---
sidebar_position: 3
---

# Attributes API

Endpoint for retrieving robot attribute values.

## Get Robot Attribute

```
GET /api/robots/{robotId}/attributes/{attributeId}
```

Returns the current value of a specific attribute for a robot.

### Path Parameters

| Parameter | Description |
|-----------|-------------|
| `robotId` | Unique robot identifier |
| `attributeId` | Attribute identifier (as defined in DataSourceDefinitions) |

### Response

```json
{
  "attribute": "battery_level",
  "value": "87",
  "ts": 1710000000000
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `attribute` | string | The attribute ID that was queried |
| `value` | string | Current attribute value |
| `ts` | number | Timestamp of the last value update (epoch milliseconds) |

### Errors

| Status | Condition |
|--------|-----------|
| 403 | User lacks view access to this robot |
| 404 | Attribute does not exist for this robot |

### Example

```bash
curl -H "x-auth-app-key: YOUR_KEY" \
  http://localhost:3000/api/robots/robot_abc123/attributes/battery_level
```

## How Attributes are Defined

Attributes are created through **DataSourceDefinition** objects via the [ConfigAPI](./configapi.md). A DataSourceDefinition maps telemetry data to a named attribute that can then be queried through this endpoint.

See [Attributes & Status](../guides/attributes-status.md) for a practical guide.
