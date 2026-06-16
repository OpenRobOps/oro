---
sidebar_position: 1
---

# REST API Overview

OpenRobOps exposes a REST API for programmatic access to robot data, configuration, and management operations.

## Base URL

```
http://localhost:3000/api
```

All API endpoints are served under the `/api` path prefix by the Meteor app server.

## Authentication

All API requests (except `OPTIONS` for CORS) require authentication via the `x-auth-api-key` HTTP header:

```bash
curl -H "x-auth-api-key: YOUR_API_KEY" \
  http://localhost:3000/api/robots
```

API keys are **per-user** and created from the web app under **Settings → API keys**.
The key is shown **once** at creation time — copy or download it then, as it cannot be
retrieved later. A key may carry an expiration; an expired key is rejected. See
[Access Control → API Keys](../guides/access-control.md#api-keys) for how to create and
manage keys.

:::note
The header `x-auth-inorbit-app-key` is also accepted as an alias, for compatibility
with existing InOrbit tooling.
:::

### Authentication Errors

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `AUTHENTICATION_ERROR: no API key provided` | Missing `x-auth-api-key` header |
| 403 | `AUTHENTICATION_ERROR: wrong credentials` | Unknown / invalid API key |
| 403 | `AUTHENTICATION_ERROR: API key expired` | The key has passed its expiration |
| 403 | `User not authorized` | User lacks any role (pending approval) |
| 403 | `User not authorized for robot {id}` | User lacks access to the specific robot |

## Response Format

All responses are JSON. Successful responses return the data directly:

```json
{
  "id": "robot_123",
  "name": "my-robot",
  "agentOnline": true
}
```

Error responses include an `error` field:

```json
{
  "error": "NOT_FOUND"
}
```

## HTTP Methods

| Method | Usage |
|--------|-------|
| `GET` | Retrieve resources |
| `POST` | Execute actions / apply configuration |
| `PUT` | Create or update a resource (e.g. lock a robot) |
| `DELETE` | Remove a resource (e.g. unlock a robot) |
| `OPTIONS` | CORS preflight (handled automatically) |

## CORS

The API supports permissive CORS, allowing requests from any origin:

- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: *`
- `Access-Control-Allow-Headers: x-auth-api-key, x-auth-inorbit-app-key, content-type`

## Available Endpoints

| Endpoint | Method | Description | Reference |
|----------|--------|-------------|-----------|
| `/api/robots` | GET | List all robots | [Robots API](./robots.md) |
| `/api/robots/{robotId}` | GET | Get a single robot | [Robots API](./robots.md) |
| `/api/robots/{robotId}/lock` | GET | Get robot lock status | [Locks API](./locks.md) |
| `/api/robots/{robotId}/lock` | PUT | Lock a robot | [Locks API](./locks.md) |
| `/api/robots/{robotId}/lock` | DELETE | Unlock a robot | [Locks API](./locks.md) |
| `/api/robots/{robotId}/actions` | POST | Execute an action | [Actions API](./actions.md) |
| `/api/robots/{robotId}/actions/{executionId}` | GET | Get action execution status | [Actions API](./actions.md) |
| `/api/robots/{robotId}/navigation/waypoints` | POST | Send a navigation waypoint | [Navigation API](./navigation.md) |
| `/api/robots/{robotId}/attributes/{attrId}` | GET | Get robot attribute | [Attributes API](./attributes.md) |
| `/api/robots/{robotId}/localization/pose` | GET | Get robot pose | [Localization API](./localization.md) |
| `/api/robots/{robotId}/localization/full` | GET | Get full localization | [Localization API](./localization.md) |
| `/api/configuration/apply` | POST | Apply config object | [ConfigAPI](./configapi.md) |
| `/api/configuration/clear` | POST | Clear config object | [ConfigAPI](./configapi.md) |
| `/api/configuration/list` | GET | List configurations | [ConfigAPI](./configapi.md) |
| `/api/configuration/kinds` | GET | List config kinds | [ConfigAPI](./configapi.md) |

## Error Codes

| Status Code | Meaning |
|-------------|---------|
| 200 | Success |
| 201 | Created (e.g. robot locked) |
| 204 | Success, no content (e.g. robot unlocked) |
| 400 | Bad request (invalid parameters) |
| 401 | Authentication required |
| 403 | Forbidden (insufficient permissions) |
| 404 | Resource not found |
| 500 | Internal server error |

## Next Steps

- [Robots API](./robots.md) — list and query robots
- [Actions API](./actions.md) — execute actions on robots
- [ConfigAPI](./configapi.md) — declarative configuration management
- [Access Control](../guides/access-control.md) — roles, API keys, and permissions
