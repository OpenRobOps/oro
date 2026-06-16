---
sidebar_position: 2.1
---

# Actions API

Execute actions on a robot and check execution status. Actions are defined with
ConfigAPI `ActionDefinition` objects (see
[Config API Kinds](./configapikinds.md#actiondefinition)); the action types exposed
over the REST API are `RunScript`, `PublishToTopic` and `DispatchMission`.

## Execute Action

```
POST /api/robots/{robotId}/actions
```

Runs a defined action on the robot, as the calling user. Requires **operate** access
on the robot.

### Path Parameters

| Parameter | Description |
|-----------|-------------|
| `robotId` | Unique robot identifier |

### Request Body

```json
{
  "actionId": "set_speed",
  "parameters": { "speed_mode": "1.0" }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `actionId` | string | Yes | The `metadata.id` of the `ActionDefinition` |
| `parameters` | object | No | Action arguments, keyed by argument name |

### Response

```json
{
  "executionId": "wYm3p9...",
  "status": "started",
  "startTs": 1710000000000,
  "lastUpdateTs": 1710000000000
}
```

### Errors

| Status | Condition |
|--------|-----------|
| 400 | Invalid body, or the action could not be started (response may include a `validations` array) |
| 403 | User lacks operate access to this robot |
| 404 | No action found for `actionId` |

### Example

```bash
curl -X POST \
  -H "x-auth-api-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  http://localhost:3000/api/robots/robot_abc123/actions \
  -d '{ "actionId": "restart_service" }'
```

---

## Get Action Execution Status

```
GET /api/robots/{robotId}/actions/{executionId}
```

Returns the status of a previous execution, as reported by the robot. Requires
**operate** access.

:::note
Execution status is currently only tracked for `RunScript` actions.
:::

### Response

```json
{
  "executionId": "wYm3p9...",
  "status": "finished",
  "statusDetails": "",
  "startTs": 1710000000000,
  "lastUpdateTs": 1710000005000,
  "returnCode": 0,
  "stderr": "",
  "stdout": "service restarted\n"
}
```

### Errors

| Status | Condition |
|--------|-----------|
| 404 | No execution status found for that `executionId` |

### Example

```bash
curl -H "x-auth-api-key: YOUR_KEY" \
  http://localhost:3000/api/robots/robot_abc123/actions/wYm3p9
```
