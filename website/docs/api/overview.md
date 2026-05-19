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

All API requests (except `OPTIONS` for CORS) require authentication via the `x-auth-app-key` HTTP header:

```bash
curl -H "x-auth-app-key: YOUR_API_KEY" \
  http://localhost:3000/api/robots
```

The API key is stored on the user document in MongoDB at `services.oro.appKey`. You can set it directly:

```bash
mongosh mongodb://localhost:3001/meteor

db.users.updateOne(
  { "emails.address": "your@email.com" },
  { $set: { "services.oro.appKey": "your-secret-key" } }
)
```

### Authentication Errors

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `AUTHENTICATION_ERROR: no appKey provided` | Missing `x-auth-app-key` header |
| 403 | `AUTHENTICATION_ERROR: wrong credentials` | Invalid API key |
| 403 | `User not authorized` | User lacks required role |
| 403 | `User not authorized for robot {id}` | User lacks access to specific robot |

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
| `POST` | Create or apply configuration |
| `OPTIONS` | CORS preflight (handled automatically) |

## CORS

The API supports permissive CORS, allowing requests from any origin:

- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: *`
- `Access-Control-Allow-Headers: x-auth-app-key, content-type`

## Available Endpoints


:::info
This listing corresponds to a pre-release version and will be updated soon.
:::

| Endpoint | Method | Description | Reference |
|----------|--------|-------------|-----------|
| `/api/robots` | GET | List all robots | [Robots API](./robots.md) |
| `/api/robots/{robotId}` | GET | Get a single robot | [Robots API](./robots.md) |
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
| 400 | Bad request (invalid parameters) |
| 401 | Authentication required |
| 403 | Forbidden (insufficient permissions) |
| 404 | Resource not found |
| 500 | Internal server error |

## Next Steps

- [Robots API](./robots.md) — list and query robots
- [ConfigAPI](./configapi.md) — declarative configuration management
