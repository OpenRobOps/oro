---
sidebar_position: 2.2
---

# Navigation API

Send navigation goals to a robot.

## Send Waypoint

```
POST /api/robots/{robotId}/navigation/waypoints
```

Sends a navigation goal to the robot (internally executed as the built-in
`navigate_to` action). Requires **operate** access on the robot.

### Path Parameters

| Parameter | Description |
|-----------|-------------|
| `robotId` | Unique robot identifier |

### Request Body

```json
{
  "waypoints": [
    { "x": 12.5, "y": 3.2, "theta": 1.57, "frameId": "map" }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `waypoints` | array | Yes | Non-empty list of waypoints |
| `waypoints[].x` | number | Yes | X coordinate |
| `waypoints[].y` | number | Yes | Y coordinate |
| `waypoints[].theta` | number | Yes | Orientation (radians) |
| `waypoints[].frameId` | string | No | Reference frame (e.g. `map`) |

:::note
The API currently accepts **exactly one** waypoint. Sending more than one returns 400;
multi-waypoint routes are planned.
:::

### Response

```json
{ "message": "Action executed" }
```

### Errors

| Status | Condition |
|--------|-----------|
| 400 | Invalid body, or more than one waypoint supplied |
| 403 | User lacks operate access to this robot |
| 500 | The navigation action failed to execute |

### Example

```bash
curl -X POST \
  -H "x-auth-api-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  http://localhost:3000/api/robots/robot_abc123/navigation/waypoints \
  -d '{ "waypoints": [ { "x": 12.5, "y": 3.2, "theta": 1.57, "frameId": "map" } ] }'
```
