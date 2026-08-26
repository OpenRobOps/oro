# ISO 21423 — ISO Robots

## 1. What it is

The ISO Robots direction lets ISO 21423-native robots join an ORO fleet, with ORO acting as the
**IMRFM** (Intralogistics Multiple Robot Fleet Manager, in ISO 21423 terms): robots publish their
own identity, status, odometry and battery over MQTT in the ISO wire format, ORO ingests that as
ordinary robot telemetry, and operators command those robots from the ORO UI exactly as they
command any other robot.

This is the opposite direction from **ISO Upstream** (`docs/iso21423-bridge.md`, forthcoming — see
the ISO Upstream bridge plan), which presents ORO's own fleet *to* an upper ISO fleet manager
instead of admitting ISO robots *into* ORO's fleet. The two directions are independent modules with
independent settings and independent enable flags — turning one on has no effect on the other.

## 2. ISO mode is a deployment decision

Enabling `settings.iso21423.robots.enabled` switches ingest into ISO mode. In ISO mode ingest does
not load the InOrbit wire-protocol telemetry modules **at all**:

- `BasicsModule`
- `SystemModule`
- `CustomDataModule`
- `RobotEventsModule`
- `DiagnosticsModule`
- `CustomCommandsModule`
- `RobotLocalizationModule`

The `IsoRobotsModule` is loaded in their place. Nothing protocol-specific stays running underneath
it — Mongo, the worker queues, `AttributesManager`, `DerivedAttributesService` and `PeerClient` are
unaffected either way.

Because of this, **a deployment is either a wire deployment or an ISO deployment. Mixing wire
robots and ISO robots in one deployment is not supported in v1.** There is no per-robot protocol
dispatch — an ORO instance that has switched to ISO mode will never again receive an InOrbit-wire
telemetry message from any robot.

The InOrbit upstream forwarder (`settings.upstream`, the `UpstreamModule` that forwards local
telemetry to another ORO/InOrbit instance) is unrelated to either ISO direction but shares the same
fate in ISO mode: with no wire telemetry modules running, it has nothing to forward. Ingest logs a
warning at startup if `settings.upstream.enabled` is left `true` alongside ISO mode, and continues
forwarding nothing.

## 3. The full `settings.iso21423` block

`iso21423.uuidNamespace`, `iso21423.ccs` and `iso21423.logging` are shared by both directions —
they describe the facility, not either integration. Each direction then has its own subtree with
its own `enabled` flag, its own broker and its own credential.

```json
{
  "iso21423": {
    "uuidNamespace": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "ccs": {
      "id": "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
      "name": "facility",
      "referencePoints": [
        { "map": { "x": 0,  "y": 0  }, "ccs": { "x": 12.40, "y": 8.10  } },
        { "map": { "x": 10, "y": 0  }, "ccs": { "x": 22.35, "y": 8.05  } },
        { "map": { "x": 0,  "y": 10 }, "ccs": { "x": 12.45, "y": 18.05 } }
      ]
    },
    "logging": false,

    "robots": {
      "enabled": true,
      "imrfmId": "5f0b1d5e-2b8b-4c8b-8c8b-2b8b4c8b8c8b",
      "manufacturerName": "OpenRobOps",
      "rosterPollMs": 30000,
      "requestTimeoutMs": 30000,
      "commandTopics": {
        "navGoal": "ros/loc/nav_goal",
        "cancelNav": "ros/nav/goal_to_current_pose",
        "customCommand": "custom_command/ros",
        "pause": null,
        "resume": null
      },
      "docks": {},
      "attributeSources": {
        "online": "agentOnline",
        "pose": "pose",
        "speedLinear": "speedLinear",
        "speedAngular": "speedAngular",
        "batteryPercentage": "batteryPercentage",
        "batteryVoltage": "batteryVoltage",
        "batteryIsCharging": "batteryIsCharging"
      }
    },

    "upstream": {
      "enabled": false
    }
  }
}
```

The values shown for `robots` above ARE the defaults `src/server/isoRobots/config.js` fills in when
a key is omitted, with two exceptions that have no default and must always be set once
`robots.enabled` is `true`: `robots.imrfmId` (a UUID) and, indirectly, the broker credential (see
below). `uuidNamespace` and `ccs` also default (an empty, uncalibrated CCS) when omitted — see
[§6](#6-ccs-calibration).

**The broker split is deliberate and explicit (decision 13):**

- `robots.broker` is the broker this deployment's ISO robots connect to. It defaults from ORO's own
  `settings.mqtt.brokers[defaultBrokerId]` — in this direction, ORO's own Mosquitto instance IS the
  ISO broker — so `robots.broker` is normally **omitted entirely**. Set it only to point ISO robots
  at a different broker than the one ORO's wire robots would use.
- `upstream.broker` (Plan 5) names an upstream, facility- or vendor-owned broker and has no default:
  it is always explicit, because there is no "ORO's own broker" to fall back to for a connection
  going *out*.

Pointing `upstream.broker` at ORO's own broker is legitimate — for a co-located facility where the
upper fleet manager also happens to run on ORO's Mosquitto — and in that case ORO registers **two**
IMRFM entities on the one broker, one per direction. That is correct, not a fault: each direction is
a separate ISO session with its own identity and its own Last Will.

## 4. Onboarding a robot — the two gates

An ISO robot needs two separate things before ORO treats it as part of the fleet: broker
credentials, and admission. **Do Gate 2 first.**

### Gate 2, admission — do this first

Applying an `IsoRobot` configuration object is what admits a robot to ORO's fleet. Until this is
done, **ORO ignores the robot entirely and refuses it credentials** — a robot publishing on the ISO
network without being admitted appears in ingest's log exactly once per process:

```
ISO 21423 robots: IMR <uuid> is publishing on the ISO network but is not admitted. ORO is
ignoring it. Admit it by applying an IsoRobot configuration object with id "<uuid>" (see
docs/iso21423-robots.md).
```

and nowhere else — no error, no partial admission, no retry storm.

The object's `metadata.id` is the robot's ISO entity UUID, which becomes its ORO robot id
(`/api/configuration/apply`, `POST`):

```yaml
apiVersion: v0.1
kind: IsoRobot
metadata:
  id: 5f8c1e2a-6b3d-4a9f-8e11-2c7d9a4b1f00
  scope: system/0
spec:
  label: Line3-AMR-07
  manufacturerName: Acme Robotics
  hostname: amr07.facility.local
```

Gate 2's admission check, the roster and every ACL normalize uuids to lowercase before comparing, but MQTT topics are case-sensitive on the wire — configure robots (and the `IsoRobot` object's `metadata.id`) with lowercase uuids so the topic a robot actually publishes on matches what ORO subscribes to.

```bash
curl -X POST \
  -H "x-auth-api-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  http://localhost:3000/api/configuration/apply \
  -d '{
    "apiVersion": "v0.1",
    "kind": "IsoRobot",
    "metadata": { "id": "5f8c1e2a-6b3d-4a9f-8e11-2c7d9a4b1f00", "scope": "system/0" },
    "spec": { "label": "Line3-AMR-07", "manufacturerName": "Acme Robotics", "hostname": "amr07.facility.local" }
  }'
```

`spec` is optional — everything in it just fills in the robot's display name and hostname; ingest
owns status and pose once telemetry arrives. Re-applying an already-admitted robot updates only
those display fields.

Applying or clearing an `IsoRobot` object requires the calling user to have `configure` access on
the fleet singleton (same guard as `ModuleState`) — a user with only, e.g., viewer access gets
`Unauthorized` rather than admitting the robot.

Clearing the object (`POST /api/configuration/clear` with the same `metadata`, no `spec`) revokes
admission: ingest stops observing the robot on its next roster poll. It deliberately **does not**
touch the robot's broker credential — being part of the fleet and being able to publish are
different decisions. To also stop the robot from publishing, suspend its credential
(`mqtt_credentials.suspended`, see [§10](#10-rollback)).

### Gate 1, credentials

`POST /iso_mqtt_config` provisions (or returns) the robot's broker credential. `apiKey` is any of
`Meteor.settings.robotApiKeys` — the same fleet-wide shared secret generated by
`terraform/main.tf:43-46` and used for `/mqtt_config`, ORO's existing wire-robot credential
endpoint.

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  http://localhost:3000/iso_mqtt_config \
  -d '{
    "apiKey": "YOUR_ROBOT_API_KEY",
    "entityUuid": "5f8c1e2a-6b3d-4a9f-8e11-2c7d9a4b1f00"
  }'
```

Response (200):

```json
{
  "hostname": "mosquitto.oro.svc.cluster.local",
  "port": 1883,
  "protocol": "mqtt://",
  "websocket_port": 9001,
  "websocket_protocol": "ws://",
  "username": "<generated>",
  "password": "<generated>"
}
```

**This call 403s until Gate 2 has admitted the uuid.** Calling it first — the natural order to
try — gets:

```json
{ "error": "ISO robot 5f8c1e2a-6b3d-4a9f-8e11-2c7d9a4b1f00 is not admitted to this fleet. Apply an IsoRobot configuration object with metadata.id = 5f8c1e2a-6b3d-4a9f-8e11-2c7d9a4b1f00 (POST /api/configuration/apply) before requesting credentials. See docs/iso21423-robots.md." }
```

That is expected behavior, not a bug — recognize it and do Gate 2 first next time.

The credential is stable: it is created once and every subsequent call with the same `entityUuid`
returns the identical username/password rather than rotating it.

The credential's ACLs grant read, write and subscribe on the robot's own subtree
(`/ISO_21423/v1/IMR/<uuid>/#`) plus read+subscribe on the fleet-wide identity wildcard
(`/ISO_21423/v1/+/+/identity`), which the SDK subscribes to unconditionally to build its entity
catalog. A robot that needs to **originate** requests to the IMRFM (rather than only receive and
answer them) needs one extra write grant, on `/ISO_21423/v1/IMRFM/<imrfmId>/request/#` — that grant
is not issued automatically and must be added by hand (directly on the `mqtt_credentials` document's
`acls`).

### Why two gates, and why this order

Being able to publish on the broker and being part of ORO's fleet are different decisions — a robot
can hold valid broker credentials without ORO acting on anything it says, and ORO can admit a robot
before it has ever connected. Gate 2 comes first because `robotApiKeys` is fleet-wide: without
admission gating credential issuance, any key holder could mint valid broker credentials for an
arbitrary uuid and inject traffic ORO would then trust. Admission is the real access control; the
credential is just the transport.

### Broker

For this direction, ORO's own Mosquitto instance is the ISO broker (see [§3](#3-the-full-settingsiso21423-block)), so
`iso21423.robots.broker` normally does not need to be set at all — it defaults from
`settings.mqtt`. The module holds a **second** connection to that broker, separate from ORO's own
wire-protocol MQTT connection, because the ISO session needs `cleanSession: false` and its own Last
Will — properties a shared connection can't offer per-purpose.

## 5. The ISO attribute-source convention

Inbound ISO telemetry is written into ORO's ordinary `attr_values` pipeline, under attribute ids
named by `settings.iso21423.robots.attributeSources` (default table below, from
`src/server/iso21423/sharedConfig.js`):

| Canonical key       | Default ORO attribute id | Filled from                                          |
|----------------------|---------------------------|-------------------------------------------------------|
| `online`             | `agentOnline`             | ISO `status.states` (absence of an offline state)      |
| `pose`               | `pose`                    | ISO `odometry.pose.locationPoint` (CCS → ORO map)      |
| `speedLinear`        | `speedLinear`             | ISO `odometry.velocity.linear`                         |
| `speedAngular`       | `speedAngular`            | ISO `odometry.velocity.angular`                        |
| `batteryPercentage`  | `batteryPercentage`       | ISO `batteryStatus.batterySoc` (both 0..1 fractions)    |
| `batteryVoltage`     | `batteryVoltage`          | ISO `batteryStatus.batteryVoltage`                      |
| `batteryIsCharging`  | `batteryIsCharging`       | ISO `batteryStatus.batteryChargingState === 'CHARGING'` |

**Key-value data (`customData` extension resource).** ISO 21423 has no key-value message, but its
extension clause leaves the resource catalog open, so ORO defines one
(`src/server/iso21423/customData.js`, registered through the SDK's `registerExtensionResource`):

```
/ISO_21423/v1/IMR/<uuid>/customData          QoS 1, not retained, no schema
{ "timestamp": "2026-08-26T20:00:00.000Z", "values": { "echo": "hello", "battery_charging": "true" } }
```

A robot that lists `customData` in `capabilities.provides` and publishes it gets exactly the wire
robot's treatment: the pairs go through `AttributesManager.handleKeyValuePairs` (so `keyValue`
DataSourceDefinitions, statuses and incidents work unchanged — mappings without a `topic` match any
custom field) and into `robot_key_values` for the Key-Values widget. Values are strings.

This is one convention shared by both ISO directions: this direction **writes** these attributes
from inbound ISO telemetry, the ISO Upstream direction **reads** the same attributes to publish
outbound ISO telemetry. Overriding a value in `attributeSources` (e.g. to point `pose` at a
deployment-specific attribute id) renames it for both directions at once — there is only one table.

## 6. CCS calibration

ISO 21423 poses are expressed in a facility Coordinate System (CCS); ORO's navigation stack and UI
work in ORO's own map frame. `iso21423.ccs.referencePoints` calibrates a rigid transform between the
two by giving the same physical landmark's coordinates in both frames.

**At least 3 reference points are required (ISO Clause 4)** to fit a unique rigid transform (a
least-squares fit over more than 3 is fine and more robust to measurement error). To measure a
point: pick a landmark visible in both ORO's map and the facility's own CCS documentation (survey
marks, wall corners, dock fiducials, etc.), record its `{x, y}` in ORO's map frame and its `{x, y}`
in the facility CCS, and add the pair to `referencePoints`.

Both directions share exactly one calibration — there is only one `iso21423.ccs` block, not one per
direction, because it is the same physical facility being described.

With fewer than 3 usable reference points (or `ccs.id` unset), the CCS is **uncalibrated**. ORO
still ingests status and battery from ISO robots — those carry no coordinate frame — but drops
pose entirely, and refuses to send `move` requests (nav goals and the cancel-nav fallback both
warn and no-op rather than translate). Ingest logs the reason once at startup and again on every
refused nav goal.

## 7. Commanding an ISO robot

Operators use the ORO UI exactly as they would for any other robot — nothing changes on the
operator side. Under the hood, ORO's Actions framework publishes agent-bound commands on the same
MQTT subtopics a wire robot's agent would listen on, and this module listens there instead of an
agent:

- `NavigateTo` → ISO `move`, targeted at the goal converted into the facility CCS.
- `CancelNavGoal` → **`cancelRequest`** for the in-flight `move`, if one is in flight; otherwise a
  fresh **`move` to the robot's own current position** (from its last-seen odometry). This matches
  ORO's own goal-to-current-pose semantics for cancel. It is deliberately *not* `pauseImr`:
  `pauseImr` implies a later `resumeImr` will carry on toward the original goal, which is the
  opposite of what "cancel" means to the operator. With no odometry seen yet for the robot, there is
  nothing to aim at, so ORO no-ops and logs a diagnostic rather than fabricating a goal.

- Any **`PublishToTopic` action** (`commandTopics.customCommand`, default `custom_command/ros`)
  → its `message` is forwarded verbatim as an OpenRobOps-defined request detail:
  ```json
  { "type": "customCommand", "version": "1.0", "properties": { "command": "<message>" } }
  ```
  ISO 21423 §6 leaves the action `type` vocabulary open (it also allows vendor `format`s, but the
  SDK's executor currently accepts only `ISO-21423`, so none is set); a robot opts in by listing
  `customCommand` in its identity's `capabilities.accepts` (the SDK refuses to send it otherwise)
  and republishes `properties.command` wherever its old agent used to. This is how deployment
  actions such as the flatland simulation's battery hacks reach an ISO robot.
- **`dock` / `dock=<id>` messages** (on that same subtopic) are special-cased into the **native ISO
  `dock`** action with `dockActions: ["CHARGE"]`, so a standard ISO robot can be docked from ORO
  without knowing anything about OpenRobOps. Docks are configured in `iso21423.robots.docks` as
  `{ "<id>": { "x", "y" } }` in ORO's map frame (converted into the CCS on the way out; ids are
  case-insensitive). A bare `dock` picks the dock nearest the robot's last-seen position. An
  in-flight `dock` is cancelled by `CancelNavGoal` exactly like a `move`.

Because these commands travel through ORO's Actions framework unchanged, ISO robots get the same
operator locks, argument validation and audit logging as wire robots, for free.

ISO `pauseImr`/`resumeImr` are not reachable through any built-in ORO action. To reach them
directly: define `pauseRobot`/`resumeRobot` `ActionDefinition`s (an `ActionDefinition` config
object, same as for a wire robot) and set `iso21423.robots.commandTopics.pause` /
`.resume` to the subtopics those actions publish agent-bound commands to. Leaving either unset (the
default, `null`) simply means this deployment has no way to issue that ISO request.
`commandTopics.pause`/`.resume` only work once the deployment's own `pauseRobot`/`resumeRobot`
`ActionDefinition`s publish agent-bound commands on a dedicated subtopic — no built-in ORO action
type does this today, so the knob is forward-looking until such an `ActionDefinition` exists.

## 8. Known limitations

- **No mixed fleets in v1** (decision 1). ISO mode is whole-deployment; there is no per-robot
  protocol dispatch.
- **The robot's ISO uuid is its ORO robot id.** It is visible verbatim in ORO's URLs and UI — there
  is no separate, friendlier ORO robot id and no alias mapping.
- **ISO request status is not surfaced.** A translated command's ISO outcome (success, failure,
  in-progress) is not fed back into ORO's action-execution status API — that API only tracks
  `RunScript` executions (`app/imports/server/rest/actions.js:143`). `undock` has no ORO trigger.
- **A nav goal is acknowledged on receipt, not on arrival.** The synthesized `oro.Echo` this module
  sends back means only that the ISO `move` request was sent to the robot, matching ORO's own
  "received" semantics for any agent command — it says nothing about whether the robot ever reaches
  the goal (decision 9).
- **`robotApiKeys` is fleet-wide**, exactly as it already is for wire robots' `/mqtt_config`: any
  key holder can request credentials for any admitted uuid. Admission (Gate 2), not the key, is the
  real gate on who ends up in the fleet.
- **Identity is thin.** ORO stores a name, an optional hostname, and `version: 'iso-21423-v1'` for
  every admitted ISO robot — nothing richer. The `v1` suffix tracks the protocol major version in
  the ISO topic namespace (`/ISO_21423/v1/...`), so it changes only if that namespace does.

## 9. Rollout

1. Set `iso21423_robots_enabled = true` (Terraform variable, or the equivalent key in
   `k8s/ingest/secret.example.yaml` for a Kubernetes deployment), then re-run
   `./scripts/generate-settings.sh` (or `kubectl apply` the updated Secret).
2. Fill in the deployment-specific values Terraform does **not** generate: `iso21423.robots.imrfmId`
   (a UUID you choose for ORO's own IMRFM identity), `iso21423.robots.broker` (only if ISO robots
   use a different broker than ORO's own), `iso21423.ccs` (at least 3 reference points — see
   [§6](#6-ccs-calibration)), and `iso21423.robots.mqtt` — the broker username/password for this
   *module's own* connection (`config.js` gives it no default, unlike `broker`). This is not a
   robot credential: it's separate from the per-robot Gate-1 credentials each robot obtains via
   `POST /iso_mqtt_config`.
3. Restart ingest. Confirm in its log:
   ```
   Ingest is in ISO 21423 mode: InOrbit wire-protocol modules are NOT loaded
   ISO 21423 robots is ON: IMRFM <imrfmId> at <broker url>
   ```
4. For each robot: Gate 2 first — apply its `IsoRobot` object ([§4](#4-onboarding-a-robot--the-two-gates)).
5. For each robot: Gate 1 — call `POST /iso_mqtt_config` to obtain (or confirm) its broker
   credential, and configure the robot with it.
6. Confirm the robot appears online in the ORO UI and its pose moves as it drives. To watch the raw
   ISO traffic while diagnosing:
   ```bash
   mosquitto_sub -t '/ISO_21423/v1/#' -v
   ```

## 10. Rollback

Set `iso21423.robots.enabled` to `false` and restart ingest — it falls back to loading the InOrbit
wire-protocol modules and stops connecting to the ISO broker entirely.

Admitted robot documents, broker credentials and any retained ISO MQTT topics all survive this — ISO
mode is a runtime switch, not a data migration. To clear each explicitly:

- **Admitted robots:** `POST /api/configuration/clear` with `{ "apiVersion": "v0.1", "kind":
  "IsoRobot", "metadata": { "id": "<uuid>" } }` for each robot, or remove its document directly from
  the `robots` collection.
- **Broker credentials:** remove or suspend the matching document(s) in the `mqtt_credentials`
  collection (`{ robotId: "<uuid>" }`) — e.g. `db.mqtt_credentials.updateOne({robotId: "<uuid>"},
  {$set: {suspended: true}})` to revoke without deleting, or `deleteOne` to remove outright.
- **Retained ISO topics:** publish an empty retained message to each one to clear it from the
  broker, e.g. `mosquitto_pub -r -n -t '/ISO_21423/v1/IMR/<uuid>/identity'` (repeat per retained
  subtopic you want gone), or purge Mosquitto's persistence store if you are decommissioning the
  broker entirely.
