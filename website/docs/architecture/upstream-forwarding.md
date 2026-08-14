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
2. For each received message, drops it if its subtopic appears in the configured deny list (typically server→robot topics such as `in_cmd`), otherwise republishes it to the upstream broker as `r/{upstreamRobotId}/{subtopic}` with the original payload bytes, QoS, and retain flag preserved. The one exception is the `state` topic: the agent-version field of its `online|apiKey|agentVersion|hostname` payload is stamped with a `+oro-<version>` semver build-metadata suffix, so upstream operators can tell the telemetry was relayed through an ORO instance. The stamp is idempotent (never applied twice).

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

### Command callbacks (echo relay)

Many server→robot commands use the callback mechanism: the server prefixes the
payload with a sequence number (`<seq>|<rest>`), registers a callback, and waits
(≈10s) for the robot to echo that seq back on `r/{robotId}/echo`. Because the
robot is connected to *this* ORO, its echo arrives here, not at the upstream
server — so without help the upstream server's callback would time out
("Timeout waiting for callback").

For commands marked `awaitsEcho` (and the `in_cmd` ping), the forwarder bridges
the callback:

1. **On the way down**, it rewrites the command's `<seq>|` prefix to a
   forwarder-local **negative** seq (`-1, -2, …`) and records `negSeq →
   upstreamSeq` in a short-lived (≈15s) per-robot translation table.
2. **On the echo**, when the robot echoes a negative seq we issued, it is
   translated back to the upstream server's original seq and re-published as an
   `oro.Echo` on `r/{upstreamRobotId}/echo`, preserving the robot's timestamp.

Negative seqs can never collide with the positive `_seq++` counters used by this
ORO instance or the upstream server, so each side cleanly resolves only its own
callbacks: the forwarder relays only seqs in its table, and the local ORO ignores
the negative ones outright. Default `awaitsEcho` commands: `ros/loc/nav_goal`,
`ros/loc/set_pose`, `ros/teleop/step` (plus the `in_cmd` ping). Fire-and-forget
commands (protobuf ones, `restart`/`get_state`) are forwarded verbatim.

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

All operator-facing configuration lives under the top-level `upstream` key in `ingest/settings.json`:

```json
{
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
        { "subtopic": "ros/loc/nav_goal", "awaitsEcho": true },
        { "subtopic": "in_cmd", "acceptsPayloads": ["restart", "get_state"] }
      ]
    },
    "credentialEncryptionKey": "<64-hex-char key>",
    "logging": false
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
| `forwarding.downstreamCommands` | Optional override of the **downstream** (upstream→robot) command allow-list. List of `{ subtopic, acceptsPayloads?, awaitsEcho? }`; `acceptsPayloads` (optional) restricts delivery to those exact string payloads; `awaitsEcho: true` marks callback commands (`<seq>\|…`) whose robot echo must be relayed back upstream (see [Command callbacks](#command-callbacks-echo-relay)). Omit to use the built-in default; set to `[]` to disable downstream delivery. See [Downstream commands](#downstream-commands). |
| `credentialEncryptionKey` | 64-character hex string used to AES-256-GCM-encrypt stored upstream passwords. Typically reuses the value from `mqtt.credentialEncryptionKey`. |
| `logging` | Verbose per-message logging. Off by default. |

Most keys are also exposed as Terraform variables (`upstream_enabled`, `upstream_api_base_url`, `upstream_api_key`, `upstream_robot_mapping`, `upstream_reject_unauthorized`, `upstream_deny_topic_suffixes`) when settings are generated via `scripts/generate-settings.sh`. `forwarding.downstreamCommands` is settings-only (no Terraform variable), and `credentialEncryptionKey` is auto-generated by Terraform rather than a variable.

## Verifying

A local end-to-end check needs a second MQTT-capable upstream (another ORO instance is the simplest):

1. On the upstream, add the local key to `robotApiKeys` and confirm `/mqtt_config` reaches the server.
2. Set the matching `upstream` block on the local ingest, with at least one mapping, then restart ingest.
3. Confirm a row appears in `upstream_mqtt_credentials` and an MQTT connection is established to the upstream (check ingest logs and the upstream's `r/{upstreamRobotId}/state` topic).
4. Publish a synthetic message to the local broker on `r/{localRobotId}/state` and confirm it shows up upstream at `r/{upstreamRobotId}/state`.
5. Publish on `r/{localRobotId}/in_cmd` and confirm it is **not** forwarded upstream.
6. From the upstream, send a callback command (e.g. a nav goal) to the mapped robot and confirm the robot receives it **and** the upstream command resolves (no "Timeout waiting for callback"). Issue the same command from the local ORO and confirm it still resolves locally — i.e. no cross-talk between the two servers' callbacks.
