---
sidebar_position: 2.3
---

# Locks API

A robot can be **locked** so that only one user operates it at a time. All locks
behave identically once taken; `soft` is a *request* flag, not a lock kind — on
lock it means "fail instead of taking over another user's lock", and on unlock
it means "only release the lock if it is mine". Users with the engineer role or
above can break another user's lock (by locking/unlocking without `soft`).

Locks **expire**: by default after 600 seconds (configurable via lock
preferences; a value ≤ 0 means never). Expired locks are cleared lazily the
next time the lock is read.

## Get Lock Status

```
GET /api/robots/{robotId}/lock
```

Requires **view** access on the robot.

### Response

```json
{
  "lock": {
    "userId": "abc",
    "userName": "Jo Smith",
    "userEmail": "jo@example.com",
    "locked": true,
    "ts": 1710000000000,
    "expirationTs": 1710000600000
  },
  "lockedForUser": true
}
```

| Field | Type | Description |
|-------|------|-------------|
| `lock` | object \| null | The current lock, or `null` if the robot is not locked |
| `lock.userId` / `userName` / `userEmail` | string | The lock owner |
| `lock.ts` | number | When the lock was taken (epoch ms) |
| `lock.expirationTs` | number | When the lock expires (epoch ms) |
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
| `soft` | boolean | `false` | Fail (403) instead of taking over another user's existing lock |

### Response

`201 Created`:

```json
{ "lock": { "userId": "abc", "userName": "Jo Smith", "userEmail": "jo@example.com", "locked": true, "ts": 1710000000000, "expirationTs": 1710000600000 } }
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

With `soft: true`, the lock is only released if the calling user owns it.

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
