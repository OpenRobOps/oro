---
sidebar_position: 4
---

# Connecting Your First Robot

This guide walks you through registering a robot with OpenRobOps and verifying that telemetry data flows correctly.

:::info
During this Getting Started guide, all examples assume ORO runs locally (host names, ports and protocols can change on other setups).
:::

## Prerequisites

- A running OpenRobOps instance (see [Quick Start](./quick-start.md))
- An admin user with an API key

:::tip[Don't have a robot yet?]
You can drive ORO end-to-end using the
[Flatland simulator](https://github.com/OpenRobOps/sim-flatland), which publishes
the same MQTT/protobuf telemetry as a real ORO agent. It's the fastest way to
verify your installation.
:::

## Step 1: Get Your API Key

Each user can create API keys for programmatic access from the web app under
**Settings → API keys**. Click **Create API key**, give it a name, and copy the
generated key — it is shown only once. See
[Access Control → API Keys](../guides/access-control.md#api-keys) for details.

Use the key in the `x-auth-api-key` header on API requests.

:::note
User API keys authenticate REST API calls only. Robot agents authenticate with
a different credential: the **robot API key**, one of the values generated into
`app/settings.json` under `robotApiKeys` (created by
`./scripts/generate-settings.sh`).
:::

## Step 2: Register a Robot

Robots are registered automatically on their first `/mqtt_config` request —
before any MQTT connection is made. The registration process:

1. The robot agent posts its `robotId` and the robot API key to the web app's `/mqtt_config` endpoint.
2. The server validates the key against `robotApiKeys` in `app/settings.json`, then creates a robot record in MongoDB — the robot's name defaults to the hostname it reported — and generates MQTT credentials.
3. The credentials are stored (encrypted) in the `mqtt_credentials` collection.
4. The robot connects to the MQTT broker with those credentials and begins publishing telemetry.

## Step 3: Verify MQTT Connectivity

Once the agent connects, you can verify connectivity by checking that the robot appears in the dashboard at `http://localhost:3000/`.

You can also query the [REST API](../api/overview):

```bash
curl -H "x-auth-api-key: your-api-key" \
  http://localhost:3000/api/robots
```

A successful response returns a JSON array of registered robots:

```json
[
  {
    "id": "robot_abc123",
    "name": "my-robot",
    "agentVersion": "1.0.0",
    "agentOnline": true,
    "updatedTs": 1710000000000
  }
]
```

## Step 4: View Robot Data

Once the robot is connected and publishing telemetry:

1. Open the dashboard at `http://localhost:3000/`.
2. The robot should appear in the fleet view.
3. Click on the robot to see its detail page with widgets showing vitals, localization, and custom data.

## Telemetry Data Flow

This is an overview of how data flows from an agent-based robot to your browser. See [system architecture](../architecture/system-architecture) for details.

```
Robot Agent
    │
    │  MQTT publish to r/<robot_id>/<topic>
    │  (usually protobuf-encoded messages)
    ▼
MQTT Broker (Mosquitto :1883)
    │
    │  Pub/Sub
    ▼
Ingest Service
    │
    │  Decode protobuf, process, store
    ▼
MongoDB (:3001)
    │
    │  Polling or op-log query
    ▼
Web App (:3000)
    |
    │  Reactive queries (Meteor pub/sub)
    ▼
Browser (WebSocket, Meteor-based)
```

## Troubleshooting

| Symptom | Check |
|---------|-------|
| Robot not appearing | Verify MQTT broker is running (`docker compose up` in `mqtt/`). Check robot/agent logs. |
| Agent shows offline | Check agent MQTT connection logs; verify credentials in `mqtt_credentials` collection |
| No telemetry data | Ensure ingest service is running; check ingest logs for MQTT subscription errors |
| API returns 401 | Verify you are sending a valid key in the `x-auth-api-key` header (create one under Settings → API keys) |

## Next Steps

- [Robot Telemetry](../guides/robot-telemetry.md) — understand what data the agent sends
- [Dashboards & Widgets](../guides/dashboards-widgets.md) — customize what you see
- [REST API Overview](../api/overview.md) — programmatic access to robot data
