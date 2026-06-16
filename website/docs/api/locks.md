---
sidebar_position: 2.3
---

# Locks API

A robot can be **locked** so that only one user operates it at a time. A *soft* lock
can be re-acquired or released by the same user; a *hard* lock prevents other users from
operating the robot until it is released (users with the engineer role or above can
break another user's lock).

## Get Lock Status

```
GET /api/robots/{robotId}/lock
```

Requires **view** access on the robot.

### Response

```json
{
  "lock": { "userId": "abc", "ts": 1710000000000, "soft": false },
  "lockedForUser": true
}
```

| Field | Type | Description |
|-------|------|-------------|
| `lock` | object \| null | The current lock, or `null` if the robot is not locked |
| `lockedForUser` | boolean | `true` if the robot is locked by **another** user (so you cannot operate it) |

---

## Lock Robot

```
PUT /api/robots/{robotId}/lock
```

Requires **operate** access on the robot.

### Request Body (optional)

```json
{ "soft": false }
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `soft` | boolean | `false` | Acquire a soft lock instead of a hard lock |

### Response

`201 Created`:

```json
{ "lock": { "userId": "abc", "ts": 1710000000000, "soft": false } }
```

### Errors

| Status | Condition |
|--------|-----------|
| 403 | The robot is already locked by another user |
| 404 | Robot does not exist |

---

## Unlock Robot

```
DELETE /api/robots/{robotId}/lock
```

Requires **operate** access on the robot. Returns `204 No Content` on success.

### Request Body (optional)

```json
{ "soft": false }
```

### Errors

| Status | Condition |
|--------|-----------|
| 403 | The robot is locked by another user, or does not exist |

### Example

```bash
# Lock
curl -X PUT -H "x-auth-api-key: YOUR_KEY" \
  http://localhost:3000/api/robots/robot_abc123/lock

# Unlock
curl -X DELETE -H "x-auth-api-key: YOUR_KEY" \
  http://localhost:3000/api/robots/robot_abc123/lock
```
