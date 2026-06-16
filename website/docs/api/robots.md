---
sidebar_position: 2
---

# Robots API

Endpoints for listing and retrieving robot information.

## List Robots

```
GET /api/robots
```

Returns all robots visible to the authenticated user.

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `isOnline` | boolean | — | Filter by online status (`true` or `false`) |
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
| 403 | User lacks view access to this robot |
| 404 | Robot not found |

### Example

```bash
curl -H "x-auth-api-key: YOUR_KEY" \
  http://localhost:3000/api/robots/robot_abc123
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
