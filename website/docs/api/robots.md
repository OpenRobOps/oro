---
sidebar_position: 2
---

# Robots API

Endpoints for listing and retrieving robot information.

## List Robots

```
GET /api/robots
```

Returns all robots in the fleet. Requires the viewer role; note this endpoint
applies no per-robot filtering.

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `isOnline` | boolean | — | Filter by online status; accepts `true`/`false`, `1`/`0`, or a bare flag (= true). Other values return 400 |
| `withLocalization` | boolean | `false` | Include localization data (pose) in response |

### Response

```json
[
  {
    "id": "robot_abc123",
    "name": "warehouse-bot-1",
    "agentVersion": "1.2.0",
    "agentOnline": true,
    "updatedTs": 1710000000000
  },
  {
    "id": "robot_def456",
    "name": "warehouse-bot-2",
    "agentVersion": "1.2.0",
    "agentOnline": false,
    "updatedTs": 1709999000000
  }
]
```

### With Localization

When `withLocalization=true`, each robot includes pose data:

```json
[
  {
    "id": "robot_abc123",
    "name": "warehouse-bot-1",
    "agentVersion": "1.2.0",
    "agentOnline": true,
    "updatedTs": 1710000000000,
    "localization": {
      "pose": {
        "x": 12.5,
        "y": 3.2,
        "theta": 1.57,
        "frameId": "map",
        "ts": 1710000000000
      }
    }
  }
]
```

### Example

```bash
# List all online robots with localization
curl -H "x-auth-api-key: YOUR_KEY" \
  "http://localhost:3000/api/robots?isOnline=true&withLocalization=true"
```

---

## Get Robot

```
GET /api/robots/{robotId}
```

Returns a single robot by ID.

### Path Parameters

| Parameter | Description |
|-----------|-------------|
| `robotId` | Unique robot identifier |

### Response

```json
{
  "id": "robot_abc123",
  "name": "warehouse-bot-1",
  "agentVersion": "1.2.0",
  "agentOnline": true,
  "updatedTs": 1710000000000
}
```

### Errors

| Status | Condition |
|--------|-----------|
| 403 | User lacks the viewer role (`{"error": "User not authorized to access robots"}` on the list endpoint) |
| 404 | Robot not found (body is the bare JSON string `"Not found"`) |

### Example

```bash
curl -H "x-auth-api-key: YOUR_KEY" \
  http://localhost:3000/api/robots/robot_abc123
```

---

## Get Robot Footprint

```
GET /api/robots/{robotId}/footprint
```

Returns the robot's resolved footprint: its own
[`RobotFootprint`](./configapikinds.md#robotfootprint) config, falling back
field-by-field to the `system` config, falling back to its reported outline
(ISO 21423 robots only) when neither config defines a footprint or radius.
See [Maps: Robot footprint](../maps.md#robot-footprint) for the full
resolution order. Requires the viewer role.

### Path Parameters

| Parameter | Description |
|-----------|-------------|
| `robotId` | Unique robot identifier |

### Response

Polygons as `[x, y]` pairs, in metres, in the robot's own frame (+x
forward). Only the fields that resolved are present; an empty object `{}`
means no configured or reported footprint (the widget falls back to its
default 0.45 m ring).

```json
{
  "footprint": [[0.3, 0.2], [0.3, -0.2], [-0.3, -0.2], [-0.3, 0.2]],
  "bufferFootprint": [[0.4, 0.3], [0.4, -0.3], [-0.4, -0.3], [-0.4, 0.3]],
  "radius": 0.3
}
```

### Errors

| Status | Condition |
|--------|-----------|
| 403 | User lacks the viewer role |
| 404 | Robot not found |

### Example

```bash
curl -H "x-auth-api-key: YOUR_KEY" \
  http://localhost:3000/api/robots/robot_abc123/footprint
```

## Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Robot unique identifier |
| `name` | string | Human-readable robot name |
| `agentVersion` | string | Agent software version |
| `agentOnline` | boolean | Whether the agent is currently connected |
| `updatedTs` | number | Last update timestamp (epoch milliseconds) |
| `localization` | object | Localization data (only with `withLocalization=true`) |
