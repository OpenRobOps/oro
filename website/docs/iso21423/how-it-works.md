---
sidebar_position: 2
---

# How ISO 21423 works: a hands-on tour

This page explains ISO 21423 by watching it run. Every message below was captured from a live
system: the [Flatland simulator](./flatland-simulator.md) connected to a local OpenRobOps through
the [`iso21423_ros`](./ros2-connector.md) connector. You can reproduce every step in about twenty
minutes, and by the end you will know the standard well enough to debug any ISO 21423 robot,
from any vendor, with nothing more than an MQTT client.

:::info[What you need]
- The Flatland simulator running in ISO mode against your local OpenRobOps. Follow
  [Try it with the Flatland simulator](./flatland-simulator.md) first.
- The Mosquitto command-line clients (`sudo apt install mosquitto-clients`, or `brew install mosquitto`).
:::

## 0. Set up your shell

ORO's broker requires a login. Each robot gets its own credential that can only see its own
topics, so for this tour use a broker user that can see everything. In a local development setup
that is ingest's own user, from `settings.mqtt.brokers.local` in `ingest/settings.json`:

```bash
MQTT="-h localhost -p 1883 -u <username> -P <password>"
R=7b1a9c3e-1111-4222-8333-444455556666        # the simulated robot's ISO entity UUID
B=/ISO_21423/v1/IMR/$R                        # its topic namespace
CCS=0b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d      # the facility coordinate system
ME=0d1e2f30-4152-4637-8899-aabbccddeeff       # your own UUID, as the sender of requests
```

:::warning
This user is a broker superuser. Use it only on a development machine. In production, give each
tool its own broker user with narrow ACLs.
:::

## 1. Discovery: one subscription shows the whole fleet

Everything in ISO 21423 lives under one topic layout:

```
/ISO_21423/v1/<entityType>/<entityUuid>/<resource>
```

`v1` is the major version of the standard. `entityType` is `IMR` for a robot (*Industrial Mobile
Robot*) and `IMRFM` for a fleet manager (*IMR Fleet Manager*). The standard leaves the list of
types open, so doors, elevators or chargers can join the same network.

Every entity publishes a retained `identity`. Retained means the broker keeps the last message and
hands it to anyone who subscribes later, so a new participant learns the whole population in one
step, without any directory service:

```bash
mosquitto_sub $MQTT -v -t '/ISO_21423/v1/+/+/identity'
```

You get two identities. The first is OpenRobOps itself: ingest acts as the fleet manager.

```json
/ISO_21423/v1/IMRFM/aecca1e9-2dcf-43a9-a02e-ac18e14e41fc/identity
{
  "id": "aecca1e9-2dcf-43a9-a02e-ac18e14e41fc",
  "entityType": "IMRFM",
  "manufacturerName": "OpenRobOps",
  "iso21423Version": "1.0",
  "capabilities": { "provides": [], "accepts": { "requests": [] } },
  "details": { "platform": "OpenRobOps", "service": "ingest", "role": "iso-robots",
               "softwareVersions": [{ "moduleName": "openrobops", "moduleVersion": "1.0.0" }] }
}
```

The second is the robot:

```json
/ISO_21423/v1/IMR/7b1a9c3e-1111-4222-8333-444455556666/identity
{
  "id": "7b1a9c3e-1111-4222-8333-444455556666",
  "entityType": "IMR",
  "manufacturerName": "OpenRobOps",
  "iso21423Version": "1.0",
  "capabilities": {
    "provides": ["status", "odometry", "batteryStatus", "globalPlan", "localTrajectory", "customData"],
    "accepts": { "requests": ["move", "dock", "pauseImr", "resumeImr", "customCommand"] }
  },
  "details": {
    "imrModel": "flatland-nav2",
    "imrSerialNumber": "flatland-sim",
    "imrFootprint": [{ "x": 0.22, "y": -0.19 }, { "x": 0.2506, "y": -0.1839 }, "… 20 points"],
    "imrHeight": 0.4
  }
}
```

The identity is the entity's contract with the rest of the facility:

- **`provides`** lists the resources it publishes, so a subscriber knows which topics exist without
  guessing. `customData` is not in the standard: it is an OpenRobOps extension resource, which the
  standard explicitly allows (see [Extensions](./coverage.md#extensions-over-the-standard)).
- **`accepts`** lists the request actions it will execute. A well-behaved sender never sends
  anything else; ORO checks this list before every command.
- **`imrFootprint`** is the robot's outline in its own frame, in meters. ORO draws the robot on the
  map with it.

Note that ORO's identity says it accepts no requests and manages no robots. That is deliberate:
ISO robots publish their own data and ORO only consumes it and sends them commands.

## 2. The robot's live data

Subscribe to everything under the robot:

```bash
mosquitto_sub $MQTT -v -t "$B/#"
```

Each resource has its own delivery rules, set by Table B.1 of the standard:

| Resource | QoS | Retained | Published | Content |
|---|:---:|:---:|---|---|
| `identity` | 1 | yes | on change | Who it is and what it can do |
| `status` | 1 | yes | on change | Operating mode and active states |
| `batteryStatus` | 0 | yes | on change | State of charge, charging state, health |
| `odometry` | 0 | no | streaming, 0.5–30 Hz | Pose and velocity |
| `localTrajectory` | 0 | no | streaming, 1–10 Hz | The next few meters of the path |
| `globalPlan` | 1 | yes | on change | The planned route |
| `request/<uuid>` | 2 | yes | per request | A command for this robot |
| `request/<uuid>/status` | 2 | yes | on change | That command's progress |
| `activeRequestsStatus` | 1 | yes | on change | Everything the robot is working on |

The pattern follows from what each message is for. State that a newcomer needs immediately
(identity, status, plan) is retained and sent only when it changes, never as a heartbeat. Fast
telemetry streams at QoS 0, because for a 10 Hz pose the next sample is worth more than a
redelivered old one. Commands use QoS 2, exactly once, because a `move` must never be lost or run
twice.

### Status: one mode plus a set of states

```json
{ "entityId": "7b1a9c3e-…", "timestamp": "2026-11-26T17:26:09.383Z",
  "states": ["MODE_AUTO", "CHARGING", "IDLE"] }
```

`states` always starts with exactly one **operating mode** (`MODE_AUTO`, `MODE_SEMIAUTO`,
`MODE_TELEOP`, `MODE_MANUAL`, `MODE_MAINTENANCE`), followed by every **operating state** that is
currently true. The standard defines 32 of them. A few you will see from the simulator:

| State | Meaning | Where the connector gets it |
|---|---|---|
| `IDLE` | No active task | No request running |
| `FORWARD` / `REVERSE` | Moving | Velocity from `/odom` |
| `CHARGING`, `LOW_BATTERY` | Battery | `sensor_msgs/BatteryState` |
| `DOCKING` | Driving onto a dock | A `dock` request running |
| `PAUSED` | Paused by `pauseImr` | Pause handler |
| `LOST` | Position unknown | TF pose older than 2 s |

States combine: a robot can be `CHARGING` and `FORWARD` in the same message, as it pulls away from
the charger. `READY`, `NOT_READY` and `OFFLINE` look like they belong here, but in the standard
they are fleet-manager states, so a robot never reports them.

### Odometry and the facility coordinate system

```json
{ "pose": {
    "locationPoint": { "ccsId": "0b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d",
                       "x": 8.952, "y": 18.259, "z": 0 },
    "orientation": { "yaw": 0.2387, "pitch": 0, "roll": 0 } },
  "velocity": { "linear": 0.0, "angular": 0.0 },
  "timestamp": "2026-11-26T17:30:10.643Z" }
```

Every position in ISO 21423 carries a `ccsId`: the **Common Coordinate System** it is expressed in.
Each vendor's robots build their own maps with their own origins, so "x = 8.95" means nothing
until everyone agrees on one frame. The CCS is that frame: one per floor, with a surveyed origin
and at least three **reference points**. Each fleet fits a rotation and translation from its own
map to the CCS through those points. The connector converts robot poses into the CCS before
publishing them, and ORO converts them back into its map frame before drawing them. The simulator's
map origin is the facility origin, so the calibration here is the identity transform. The
[setup guide](./iso-robots-setup.md#2-settings) shows a real calibration.

If the robot's `ccsId` does not match the CCS ORO is configured with, ORO drops the pose rather
than drawing the robot in the wrong place.

### Battery and paths

`batteryStatus` uses fractions, not percentages: `"batterySoc": 0.758` is 75.8 %.
`batteryChargingState` and `batteryHealth` are separate fields, because a charging battery can
still be unhealthy. `globalPlan` is a list of future location points, each in the CCS, and
`localTrajectory` is the same for the next few meters.

## 3. Liveness: why retained data needs a Last Will

Retained data has a weakness. If the robot crashes, its retained `status` still says
`MODE_AUTO, FORWARD` forever. The standard closes that gap with MQTT's **Last Will and Testament**:
when the robot connects, it leaves a message with the broker, and the broker publishes that message
itself if the connection dies without a clean goodbye.

Watch the `disconnection` resource and simulate a crash:

```bash
mosquitto_sub $MQTT -v -t "$B/disconnection" -t "$B/status" &
docker kill iso_connector          # no clean shutdown: the process just dies
```

The broker publishes the will immediately (or within the 60 s keep-alive if the network fails
instead of the process):

```json
/ISO_21423/v1/IMR/7b1a9c3e-…/disconnection   {"states":["LOST_CONNECTION"]}
```

The will is retained too, so anyone who joins later also sees that the robot is gone. ORO marks
the robot offline. When the robot comes back (`docker start iso_connector`), it clears the will
(an empty retained message on the same topic) and publishes a fresh `status`.

A clean shutdown is different. On `docker stop`, the connector first ends its running requests,
publishes `OFFLINE`, clears its retained topics and then disconnects, so no will is published.
A will means something went wrong.

:::note
The will payload shown above is valid JSON. The text in the standard's draft (FDIS) is not, so
OpenRobOps' SDKs publish this form. The SDK repository keeps a
[catalogue of FDIS defects](https://github.com/OpenRobOps/iso21423/blob/main/docs/iso-fdis-21423-defects.md)
with the position taken on each.
:::

## 4. Send a request yourself

ORO's *Navigate to* action sends an ISO `move` request. You can send the same request by hand.
Each request gets its own UUID in the topic name, so any number of senders can talk to the same
robot without colliding:

```bash
Q=11111111-2222-4333-8444-555555555555        # this request's UUID
mosquitto_sub $MQTT -v -t "$B/request/$Q/status" -t "$B/status" &
mosquitto_pub $MQTT -q 2 -r -t "$B/request/$Q" -m '{
  "source": "'$ME'", "destination": "'$R'", "sequenceId": 1,
  "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'",
  "details": [{ "type": "move", "version": "1.0",
                "properties": { "location": { "ccsId": "'$CCS'", "x": 5.3, "y": 11.6, "z": 0 },
                                "toleranceRadius": 0.3 } }]
}'
```

The request is an envelope around an ordered list of **details** (actions). `source` and
`sequenceId` together identify it. `toleranceRadius` says how close counts as "arrived", and the
robot chooses its own path: ISO 21423 tells a robot *where* to go, not *how*.

The robot answers on the request's `status` topic. This is the real sequence, trimmed:

```text
17:30:29.005  RECEIVED     move RECEIVED
17:30:29.006  ACCEPTED     move ACCEPTED
17:30:29.006  EXECUTING    move EXECUTING
17:30:31.020  EXECUTING    move EXECUTING  distanceRemaining 7.55
17:30:33.033  EXECUTING    move EXECUTING  distanceRemaining 7.10
              …            (one progress update every 2 s)
17:31:01.120  EXECUTING    move EXECUTING  distanceRemaining 0.42
17:31:01.631  SUCCEEDED    move SUCCEEDED
```

Meanwhile the robot's `status` went from `MODE_AUTO, CHARGING, IDLE` (sitting on the charger) to
`MODE_AUTO, CHARGING, FORWARD` (pulling away), then `MODE_AUTO, FORWARD`, and finally
`MODE_AUTO, IDLE`.

Each status message carries the overall state plus a `detailStatuses` array with one entry per
detail:

```json
{ "source": "7b1a9c3e-…", "destination": "0d1e2f30-…",
  "sequenceId": 86, "requestSequenceId": 1,
  "timestamp": "2026-11-26T17:30:31.020Z",
  "status": "EXECUTING",
  "detailStatuses": [{ "type": "move", "version": "1.0",
                       "status": { "code": "EXECUTING" },
                       "properties": { "distanceRemaining": 7.5457 } }] }
```

### The request state machine

Every request follows the same lifecycle (Annex C, figures C.3 and C.4 of the standard):

```text
RECEIVED ──► ACCEPTED ──► EXECUTING ──► SUCCEEDED
    │            │            │
    │            │            ├──► CANCELED    (a cancel was honoured)
    │            │            ├──► ABORTED     (failure, with a reason code)
    │            │            └──► RECOVERY ──► CANCELED / ABORTED
    └────────────┴──► ABORTED / CANCELED      (rejected, or cancelled before it started)
```

`SUCCEEDED`, `CANCELED` and `ABORTED` are terminal. An `ABORTED` status carries a machine-readable
reason: `REJECTED`, `TIMEOUT`, `ACTION_NOT_IMPLEMENTED`, `MALFORMED_REQUEST`,
`INVALID_IMR_STATE_FOR_ACTION` and others. `RECOVERY` runs the request's optional `recoveries`
actions before the final state, for example "if docking fails, move out of the charger's way".

### Clean up after yourself

The request was published retained, so a robot that reconnects still finds it. That is how a
command survives a dropped connection. Once the request is finished, the sender clears it with an
empty retained message:

```bash
mosquitto_pub $MQTT -q 2 -r -n -t "$B/request/$Q"
```

ORO does this for every request it sends. Try the opposite once: send a `move`, run
`docker kill iso_connector` while the robot drives, then `docker start iso_connector`. The
restarted robot finds the still-retained request, reports `RECEIVED` again and finishes the move.

## 5. Pause, resume and cancel

Requests that control other requests use the same mechanism. Send a new `move` as request
`sequenceId` 2, then pause it:

```bash
mosquitto_pub $MQTT -q 2 -r -t "$B/request/22222222-0000-4000-8000-000000000003" -m '{
  "source": "'$ME'", "destination": "'$R'", "sequenceId": 3,
  "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'",
  "details": [{ "type": "pauseImr", "version": "1.0" }] }'
```

The robot stops, the `move` stays `EXECUTING`, and `status` gains `PAUSED`. `resumeImr` (same
envelope, `sequenceId` 4) drops `PAUSED` and the robot carries on to the same goal. Pause and
resume act on the robot, not on one request, which is why they never wait in line behind the
request they pause.

To cancel, send `cancelRequest` and name the target by its sender and `sequenceId`:

```json
"details": [{ "type": "cancelRequest", "version": "1.0",
              "properties": { "source": "0d1e2f30-4152-4637-8899-aabbccddeeff", "requestId": 2 } }]
```

The `cancelRequest` itself ends `SUCCEEDED`, the `move` ends `CANCELED`, and the robot returns to
`IDLE`. Cancelling something that is not running ends the `cancelRequest` `ABORTED` with reason
`REJECTED`. ORO's *Cancel navigation* action sends exactly this.

## 6. A busy robot: execution policies

What happens when a request arrives while another is running? The standard leaves that to the
implementation and lists the acceptable strategies: refuse the new one, queue it, replace the
queued one, run both in parallel, or order by `priority`. A good sender never assumes: it watches
the status.

`iso21423_ros` defaults to **preempt**: the new request cancels the running one and starts at once,
which is what an operator expects from "go here instead". Send a second `move` while the first is
running and you will see:

```text
request 6  move  EXECUTING
request 7  move  RECEIVED → ACCEPTED → EXECUTING
request 6  move  CANCELED
request 7  move  EXECUTING … SUCCEEDED
```

Other policies are one line of configuration (`execution_policy`, see
[the connector page](./ros2-connector.md#tuning)).

## 7. What OpenRobOps does with all this

ORO ingest is the fleet manager in everything you just watched:

- It subscribes to every admitted robot's resources and feeds them into the same attributes
  pipeline as any other robot: `pose`, speeds, battery, paths, online state, and `customData`
  key-values. Dashboards, statuses, incidents and the map work unchanged.
- It turns ORO actions into ISO requests: *Navigate to* becomes `move`, *Cancel navigation*
  becomes `cancelRequest`, dock buttons become `dock`, and any other `PublishToTopic` action
  becomes a `customCommand`. It sends only what the robot lists in `accepts`.
- It treats `disconnection` as the source of truth for liveness.

See [ISO 21423 in OpenRobOps](./overview.md#what-an-iso-robot-gets-in-oro) for the full mapping
and [ISO 21423 coverage](./coverage.md) for a clause-by-clause view of what is implemented.

## Where the standard leaves room, and what we chose

ISO 21423 is young, and its final draft leaves several things open or inconsistent. Both
OpenRobOps SDKs take an explicit position on each, and document it:

| Question | The standard | OpenRobOps |
|---|---|---|
| Last Will payload | Text that is not valid JSON | `{"states":["LOST_CONNECTION"]}` on `disconnection`, retained, QoS 1 |
| Name of the cancel action | Both `cancel` and `cancelRequest` appear | Sends `cancelRequest`, accepts both |
| Busy robot | Five acceptable strategies | All five, plus `preempt` (the connector's default) |
| Pause while busy | Not specified | `pauseImr`/`resumeImr` bypass the queue |
| Key-value data and vendor commands | Open catalogues | `customData` resource and `customCommand` action, both opt-in |
| Distributing the CCS calibration | Defined, but no transport | Reference points in ORO settings; the connector has its own copy |

The full list is in the [FDIS defect catalogue](https://github.com/OpenRobOps/iso21423/blob/main/docs/iso-fdis-21423-defects.md),
and a longer introduction to the standard lives in the
[SDK repository](https://github.com/OpenRobOps/iso21423/tree/main/docs/standard).

## Next

- [Connect your own ROS 2 robot](./ros2-connector.md): run the same connector on your robot.
- [ISO Robots setup guide](./iso-robots-setup.md): every OpenRobOps setting.
