---
sidebar_position: 4
---

# Localization API

Endpoints for retrieving robot localization data including pose, laser scans, paths, and costmaps.

## Get Robot Pose

```
GET /api/robots/{robotId}/localization/pose
```

Returns the robot's current position and orientation.

### Response

```json
{
  "x": 12.5,
  "y": 3.2,
  "yaw": 1.57,
  "frameId": "map",
  "ts": 1710000000000,
  "mapId": "warehouse-floor-1",
  "xPixels": 250,
  "yPixels": 64,
  "mapDataHash": "abc123def456"
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `x` | number | X position in meters (map frame) |
| `y` | number | Y position in meters (map frame) |
| `yaw` | number | Orientation in radians |
| `frameId` | string | Coordinate frame ID |
| `ts` | number | Pose timestamp (epoch milliseconds) |
| `mapId` | string | Current map identifier |
| `xPixels` | number | X position in pixels (when map data available) |
| `yPixels` | number | Y position in pixels (when map data available) |
| `mapDataHash` | string | Hash of the current map data |

### Errors

| Status | Condition |
|--------|-----------|
| 403 | User lacks view access to this robot |
| 404 | Pose data does not exist for this robot |

### Example

```bash
curl -H "x-auth-app-key: YOUR_KEY" \
  http://localhost:3000/api/robots/robot_abc123/localization/pose
```

---

## Get Full Localization

```
GET /api/robots/{robotId}/localization/full
```

Returns comprehensive localization data including pose, laser scans, paths, and costmaps. You can selectively include specific data types.

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `include` | string (repeatable) | Data fields to include. If omitted, all fields are returned. |

#### Valid `include` values

| Value | Description |
|-------|-------------|
| `pose` | Robot position and orientation |
| `lasers` | Laser scan data |
| `paths` | Robot path data |
| `costmap` | Costmap data |

### Response

```json
{
  "pose": {
    "x": 12.5,
    "y": 3.2,
    "yaw": 1.57,
    "frameId": "map",
    "ts": 1710000000000,
    "mapId": "warehouse-floor-1"
  },
  "lasers": [
    {
      "id": "front_laser",
      "runs": [10, 5, 8],
      "values": [1.2, 3.4, 0.8],
      "ts": 1710000000000
    }
  ],
  "paths": [
    {
      "id": "planned_path",
      "points": [
        { "x": 12.5, "y": 3.2 },
        { "x": 14.0, "y": 5.1 }
      ],
      "ts": 1710000000000
    }
  ],
  "costmap": { }
}
```

### Examples

```bash
# Get all localization data
curl -H "x-auth-app-key: YOUR_KEY" \
  http://localhost:3000/api/robots/robot_abc123/localization/full

# Get only pose and laser data
curl -H "x-auth-app-key: YOUR_KEY" \
  "http://localhost:3000/api/robots/robot_abc123/localization/full?include=pose&include=lasers"
```

### Errors

| Status | Condition |
|--------|-----------|
| 400 | Invalid field in the `include` list |
| 403 | User lacks view access to this robot |
