---
sidebar_position: 5
---

# Upstream MQTT Forwarding

ORO can act as a *transparent middle node* between local robots and an "upstream" MQTT broker — either another ORO instance or InOrbit's commercial cloud. When enabled, robots continue to connect to this ORO instance as normal, and ORO additionally connects *as those robots* to the upstream broker, republishing their telemetry. The upstream broker sees what looks like the robots themselves connecting.

The feature lives in the ingest service as `UpstreamModule` (`ingest/src/server/modules/upstream.js`) and is **off by default**.

## Data flow

```
                                ┌─ existing modules (basics, system, …)
local robots → Mosquitto → ingest
                                └─ UpstreamModule
                                      │ one MQTT client per mapped robot
                                      ▼
                                Upstream broker (other ORO / InOrbit)
                                topics: r/{upstreamRobotId}/...
```

For each mapped robot, the module:

1. Subscribes on the local broker to `r/{localRobotId}/#`.
2. For each received message, drops it if its subtopic appears in the configured deny list (typically server→robot topics such as `in_cmd`), otherwise republishes it to the upstream broker as `r/{upstreamRobotId}/{subtopic}` with the original payload bytes, QoS, and retain flag preserved.

Forwarding is **primarily upstream** (robot telemetry → upstream). A limited,
operator-configurable **allow-list** of server→robot commands is also delivered
**downstream** (upstream → local robot): the module subscribes on the upstream
broker to those command topics and republishes each onto the local broker as
`r/{localRobotId}/{subtopic}`, so the robot receives them as if sent locally.
See [Downstream commands](#downstream-commands) below.

## Downstream commands

Selected server→robot commands received from upstream are delivered down to the
local robot. This is an **allow-list** (not a whole subtree) so that robot→server
feedback that happens to share a namespace — e.g. `custom_command/script/status`
— keeps flowing upstream and is never echoed back to the robot.

The built-in default allow-list covers the common robot-operation commands:

| Category | Subtopics |
|----------|-----------|
| Custom commands / scripts | `custom_command/ros`, `custom_command/script/command` |
| Teleoperation | `ros/teleop/step`, `ros/teleop/go` |
| Navigation & localization | `ros/loc/set_pose`, `ros/loc/nav_goal`, `ros/nav/goal_path`, `ros/nav/goal_to_current_pose`, `ros/loc/mapreq` |
| Data capture uploads | `ros/rosbag/upload`, `ros/databag/upload` |
| Agent control | `in_cmd` — **only** `restart` and `get_state` payloads |

Two categories are **intentionally excluded** from the default because they would
conflict with this ORO instance's own management of the robot, and should only be
enabled when the operator owns both ends:

- `modules/set_state` (reconfigures local modules), and
- other `in_cmd` payloads such as `load_module` / `unload_module` / `update`.

`in_cmd` sequence-number pings (`<seq>|`) are not commands; they are relayed to
the real robot and their echoes returned upstream so the upstream server measures
the actual robot's round-trip latency.

Commands that arrive over the upstream link are recorded in the shared
`event_log` collection with `source: 'upstream'` for `custom_command/ros`
(PublishToTopic), `custom_command/script/command` (RunScript) and `in_cmd`
`restart` (RestartAgent). High-frequency or non-action commands (e.g. teleop) are
delivered but not event-logged.

To override the allow-list, set `forwarding.downstreamCommands` (see below). An
explicit empty array disables downstream command delivery entirely.

## Credentials

Operators do **not** seed credentials manually. On startup, for each mapped robot, the module:

1. Looks up `(localRobotId, apiBaseUrl)` in the `upstream_mqtt_credentials` MongoDB collection.
2. If absent (or if the stored password fails to decrypt), it calls the upstream server's `/mqtt_config` HTTP endpoint:

   ```
   POST {api.baseUrl}/mqtt_config
   { apiKey, robotId: <upstreamRobotId>, hostname, agentVersion }
   → 200 { hostname, port, protocol, username, password }
   ```

   This is the same endpoint robots use to bootstrap themselves. As a side effect, the upstream creates the robot record and provisions broker credentials if they don't already exist.
3. Encrypts the returned password with the local `credentialEncryptionKey` (AES-256-GCM) and persists the row.
4. Connects the upstream MQTT client using the stored credentials.

On an MQTT auth failure (`CONNACK` codes 4 or 5), the stored row is invalidated and re-fetched. Permanent HTTP failures (400/403/404) are recorded with a 5-minute retry cool-down so a misconfigured robot does not hammer the upstream.

:::caution
The `upstream_mqtt_credentials` collection is managed entirely by the module. Do not edit it by hand.
:::

## Per-robot connection constraint

The upstream protocol issues credentials *per robot*. The module therefore opens **one MQTT client per mapped robot**. When upstream support for multi-robot credentials becomes available, the per-robot design — encapsulated in the `UpstreamRobotClient` class — will be extended to optionally share one upstream connection across multiple mapped robots. Until then, expect N upstream connections for N mapped robots.

## Configuration

All operator-facing configuration lives under `modules.upstream` in `ingest/settings.json`:

```json
{
  "modules": {
    "upstream": {
      "enabled": false,
      "api": {
        "baseUrl": "https://control.inorbit.ai",
        "apiKey": "<upstream-issued-robot-api-key>"
      },
      "brokerOptions": {
        "rejectUnauthorized": true
      },
      "robotMapping": [
        { "localRobotId": "robot-1", "upstreamRobotId": "abc-1" }
      ],
      "forwarding": {
        "denyTopicSuffixes": ["in_cmd", "modules/set_state"],
        "publishRetainedMessages": true,
        "downstreamCommands": [
          { "subtopic": "custom_command/ros" },
          { "subtopic": "ros/teleop/go" },
          { "subtopic": "in_cmd", "acceptsPayloads": ["restart", "get_state"] }
        ]
      },
      "credentialEncryptionKey": "<64-hex-char key>",
      "logging": false
    }
  }
}
```

| Field | Purpose |
|-------|---------|
| `enabled` | Master switch. Module is not instantiated unless `true`. |
| `api.baseUrl` | Upstream server base URL exposing `/mqtt_config`. |
| `api.apiKey` | Upstream-issued robot API key. Must be in the upstream's `robotApiKeys` settings. |
| `brokerOptions` | MQTT client options not returned by `/mqtt_config`. `rejectUnauthorized` controls TLS verification for both MQTT and the HTTPS call to `/mqtt_config`. |
| `robotMapping` | List of `{ localRobotId, upstreamRobotId }` pairs. Empty list = no forwarding. |
| `forwarding.denyTopicSuffixes` | Subtopics to drop when forwarding **upstream** (exact match against the part after `r/{robotId}/`). |
| `forwarding.publishRetainedMessages` | Whether to preserve the retain flag when republishing. Default `true`. |
| `forwarding.downstreamCommands` | Optional override of the **downstream** (upstream→robot) command allow-list. List of `{ subtopic, acceptsPayloads? }`; `acceptsPayloads` (optional) restricts delivery to those exact string payloads. Omit to use the built-in default; set to `[]` to disable downstream delivery. See [Downstream commands](#downstream-commands). |
| `credentialEncryptionKey` | 64-character hex string used to AES-256-GCM-encrypt stored upstream passwords. Typically reuses the value from `mqtt.credentialEncryptionKey`. |
| `logging` | Verbose per-message logging. Off by default. |

These keys are also exposed as Terraform variables (`upstream_enabled`, `upstream_api_base_url`, `upstream_api_key`, `upstream_robot_mapping`, `upstream_reject_unauthorized`, `upstream_deny_topic_suffixes`) when settings are generated via `scripts/generate-settings.sh`.

## Verifying

A local end-to-end check needs a second MQTT-capable upstream (another ORO instance is the simplest):

1. On the upstream, add the local key to `robotApiKeys` and confirm `/mqtt_config` reaches the server.
2. Set the matching `modules.upstream` block on the local ingest, with at least one mapping, then restart ingest.
3. Confirm a row appears in `upstream_mqtt_credentials` and an MQTT connection is established to the upstream (check ingest logs and the upstream's `r/{upstreamRobotId}/state` topic).
4. Publish a synthetic message to the local broker on `r/{localRobotId}/state` and confirm it shows up upstream at `r/{upstreamRobotId}/state`.
5. Publish on `r/{localRobotId}/in_cmd` and confirm it is **not** forwarded.
