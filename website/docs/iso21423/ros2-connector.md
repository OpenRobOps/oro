---
sidebar_position: 5
---

# Connect your own ROS 2 robot

[`iso21423_ros`](https://github.com/OpenRobOps/iso21423_ros) is a ROS 2 node that turns a robot
into an ISO 21423 IMR. It reads your robot's ROS topics and actions, publishes them in the
standard's format, and turns incoming ISO requests into Nav2 goals. It is the same connector the
[Flatland simulator](./flatland-simulator.md) uses, and it is not tied to OpenRobOps: it works
with any ISO 21423 broker and fleet manager.

- **A standard Nav2 robot needs one YAML file.** No code.
- **Anything else** (other topics, vendor actions, extra states) is a small Python class named in
  that YAML.
- ROS 2 **Jazzy** and **Humble**. Apache 2.0.

If you haven't yet, read [How ISO 21423 works](./how-it-works.md) first: this page uses its terms.

## How it fits together

```text
 Your robot (ROS 2)                     iso21423_ros node                 MQTT broker          OpenRobOps
 ────────────────────                   ─────────────────                 ───────────          ──────────
 TF map → base_link  ─┐                                                                       ingest
 /odom               ─┼─ sources ───►  odometry, status        ─────►  /ISO_21423/v1/  ─────►  (IMRFM)
 /battery_state      ─┤                batteryStatus                    IMR/<uuid>/…
 /plan, /local_plan  ─┘                globalPlan, localTrajectory
                                                                                              actions
 Nav2 NavigateToPose ◄─ handlers ◄──   move, dock, pauseImr,   ◄─────  …/request/<uuid>  ◄─── Navigate to,
 Nav2 DockRobot                        resumeImr, cancelRequest                                Dock, Cancel
```

The connector is built on the `iso21423` Python library
([OpenRobOps/iso21423](https://github.com/OpenRobOps/iso21423), `py-sdk/`), which implements the
robot side of the standard without any ROS dependency: topics, schema validation, the Last Will,
the request state machine and the execution policies. The connector only adds the ROS mapping.

## What your robot needs

| ROS 2 interface | Used for | Required |
|---|---|---|
| TF `map` → `base_link` | `odometry` pose | yes |
| `/odom` (`nav_msgs/Odometry`) | `odometry` velocity, `FORWARD`/`REVERSE` | yes |
| `navigate_to_pose` action (Nav2) | `move`, and `dock` without a docking server | for `move` |
| `/battery_state` (`sensor_msgs/BatteryState`) | `batteryStatus`, `CHARGING`, `LOW_BATTERY` | no |
| `/plan`, `/local_plan` (`nav_msgs/Path`) | `globalPlan`, `localTrajectory` | no |
| `dock_robot` / `undock_robot` actions (Nav2 docking, Jazzy) | `dock` by dock id, `undock` | no |

All names are configurable. Anything missing is simply not published; a source that never receives
data is harmless.

## 1. Prepare OpenRobOps

1. **ISO mode and the CCS.** Enable ISO robots in ingest and calibrate the facility coordinate
   system: [setup guide, Settings](./iso-robots-setup.md#2-settings).
2. **Admit the robot.** Pick a UUID for it (lowercase) and apply an `IsoRobot` object:

   ```yaml
   apiVersion: v0.1
   kind: IsoRobot
   metadata:
     id: 5f8c1e2a-6b3d-4a9f-8e11-2c7d9a4b1f00
     scope: system/0
   spec:
     label: amr-07
     manufacturerName: Acme Robotics
     hostname: amr07.facility.local
   ```

   ```bash
   oro apply -f iso-robot.yaml
   ```

3. **Get an API key.** Any value from `robotApiKeys` in the app settings. The connector exchanges
   it for the robot's own broker login (`POST /iso_mqtt_config`), so no broker password is
   configured on the robot.

## 2. Write the robot's configuration

Start from [`config/nav2_default.yaml`](https://github.com/OpenRobOps/iso21423_ros/blob/main/config/nav2_default.yaml),
which lists every key with its default. For a Nav2 robot joining OpenRobOps, this is enough:

```yaml title="robot.yaml"
iso21423_connector:
  ros__parameters:
    entity_uuid: 5f8c1e2a-6b3d-4a9f-8e11-2c7d9a4b1f00   # = IsoRobot metadata.id
    manufacturer_name: Acme Robotics
    identity:
      model: AMR-500
      serial_number: SN-0007
      height: 0.45                                      # m
      footprint_from_nav2: true                         # read the footprint from the costmap
      footprint: [0.3, 0.2, 0.3, -0.2, -0.3, -0.2, -0.3, 0.2]   # fallback, x1 y1 x2 y2 … (m)
    credentials_provider: openrobops
    oro:
      url: https://oro.example.com/
    ccs:
      id: 3f2504e0-4f89-41d3-9a0c-0305e82c3301          # = iso21423.ccs.id in ORO
      reference_points: [0.0, 0.0, 12.40, 8.10,         # map_x, map_y, ccs_x, ccs_y, …
                         10.0, 0.0, 22.35, 8.05,
                         0.0, 10.0, 12.45, 18.05]
    sources:
      odometry: {enabled: true}
      batteryStatus: {enabled: true}
      globalPlan: {enabled: true}
      localTrajectory: {enabled: true}
    handlers:
      move: {enabled: true}
      dock: {enabled: true}
      pauseImr: {enabled: true}
      resumeImr: {enabled: true}
```

A few things are worth understanding rather than copying:

- **The entry names are the ISO names.** `sources.odometry` publishes the `odometry` resource;
  `handlers.move` serves `move` requests. The identity's `provides` and `accepts` lists are built
  from the enabled entries, so the robot never advertises something it cannot do. `cancelRequest`
  is always handled and not listed.
- **The reference points must match ORO's.** Use the same three or more map/CCS pairs as
  `iso21423.ccs.referencePoints` in ingest. With fewer than three, the connector treats map
  coordinates as CCS coordinates, which is right only when your map origin is the facility origin.
- **Sim time.** In a simulator, add `use_sim_time: true`, or every TF pose looks stale and the
  robot reports `LOST`.

Without OpenRobOps, replace `credentials_provider` and `oro` with the broker's own settings:

```yaml
    broker:
      url: mqtts://broker.example.com:8883     # mqtts:// enables TLS
      username: amr-07
      password_file: /run/secrets/broker_password
```

## 3. Run it

The connector ships as a Docker image. Until the image is published, build it from the two
repositories checked out side by side:

```bash
git clone https://github.com/OpenRobOps/iso21423.git
git clone https://github.com/OpenRobOps/iso21423_ros.git
cd iso21423_ros
docker build --build-context iso21423=../iso21423 --target runtime \
  -t iso21423-ros:jazzy -f docker/Dockerfile .          # --build-arg ROS_DISTRO=humble for Humble
```

Run it on the robot's ROS 2 network (host networking and the same `ROS_DOMAIN_ID` as the robot):

```bash
docker run -d --name iso21423 --restart always --net host --ipc host \
  -e ROS_DOMAIN_ID=$ROS_DOMAIN_ID -e ORO_API_KEY=<api key> \
  -v $PWD/robot.yaml:/robot.yaml:ro \
  iso21423-ros:jazzy \
  ros2 launch iso21423_ros connector.launch.py params_file:=/robot.yaml
```

The log should end with:

```text
[iso21423_ros.credentials] broker mqtt://oro.example.com:1883 as <generated user>
[iso21423_ros.node] registered 5f8c1e2a-… on mqtt://oro.example.com:1883: provides ['status', 'odometry', 'batteryStatus', 'globalPlan', 'localTrajectory'], accepts ['move', 'dock', 'pauseImr', 'resumeImr']
```

The robot then shows up in ORO online, on the map, with battery and speed. Send it a goal with
*Navigate to*.

## 4. Check it from the outside

The fastest way to see what a robot really sends is the broker itself
(see [the tour](./how-it-works.md#0-set-up-your-shell) for credentials):

```bash
mosquitto_sub $MQTT -v -t '/ISO_21423/v1/IMR/5f8c1e2a-6b3d-4a9f-8e11-2c7d9a4b1f00/#'
```

| Symptom | Cause |
|---|---|
| Log repeats `iso_mqtt_config -> 403` | The robot is not admitted yet (step 1.2), or its UUID differs from `metadata.id`. The connector retries every 10 s. |
| Robot online in ORO but not on the map | `ccs.id` differs between the robot and ORO, so ORO drops the poses. |
| `status` keeps reporting `LOST` | No TF from `ccs.map_frame` to `base_frame` (check the frame names), or a simulator without `use_sim_time: true`. |
| Robot drawn in the wrong place | Reference points differ between the robot and ORO. |
| A `move` ends `ABORTED`, message `navigate_to_pose server unavailable` | Nav2 is not up, or runs under another action name (`handlers.move.action`). `server_timeout_s` bounds the wait. |
| Robot online but `LOST`, no battery, never moves | The container cannot see the robot's ROS graph: wrong `ROS_DOMAIN_ID`, or no `--net host`. |

## Tuning

| Key | Default | When to change it |
|---|---|---|
| `execution_policy` | `preempt` | What a new request does while one is running. `preempt` cancels the running one, like an operator expects. `queue_after` runs requests one after another; `abort_new` refuses new work while busy; `queue_replace`, `parallel` and `priority` are the standard's other strategies. |
| `sources.odometry.rate_hz` | `2.0` | Faster pose updates. The standard allows 0.5–30 Hz. |
| `sources.odometry.lost_after_s` | `2.0` | How old a TF pose may be before the robot reports `LOST`. |
| `sources.batteryStatus.low_threshold` | `0.2` | When `LOW_BATTERY` appears. |
| `handlers.move.progress_min_interval_s` | `2.0` | How often `distanceRemaining` progress is published. |
| `handlers.dock.mode` | `auto` | `docking_server` uses Nav2 docking (`DockRobot`, Jazzy only), `navigate` drives to the dock location, `auto` picks the server when it exists. |
| `identity.footprint_from_nav2` | `false` | Read the outline from the global costmap instead of configuring it. |

`toleranceRadius` in a `move` request is honoured: the goal counts as reached when the robot is
that close, even if Nav2 is still refining.

## Beyond Nav2: hooks

When your robot does not speak the standard ROS interfaces, replace or add entries with your own
Python classes. A class is named with `class:` in the YAML, as a module path
(`my_pkg.module:Class`) or a file (`/path/to/file.py:Class`). Every other key under the entry is
passed to it as `params`.

### A source: a vendor battery topic

Say your robot publishes its battery as a `std_msgs/Float32` percentage on `/vendor/battery_pct`.
Replace the default battery source:

```python title="vendor_battery.py"
from std_msgs.msg import Float32


class VendorBattery:
    def __init__(self, node, publisher, params):
        self.node, self.pub = node, publisher
        self.low = float(params.get("low_threshold", 0.2))
        self._states = []
        node.create_subscription(Float32, params.get("topic", "/vendor/battery_pct"), self._on_msg, 10)

    def states(self):                      # contributes to `status`; must be fast and lock-free
        return list(self._states)

    def _on_msg(self, msg):
        soc = min(1.0, max(0.0, msg.data / 100.0))
        self._states = ["LOW_BATTERY"] if soc < self.low else []
        self.pub.publish_battery_status({"batterySoc": soc})
        self.node.status.refresh()        # republish status if the states changed
```

```yaml
    sources:
      batteryStatus:
        class: /hooks/vendor_battery.py:VendorBattery
        topic: /vendor/battery_pct
```

Mount the file into the container with `-v $PWD/hooks:/hooks:ro`. The library validates every
message against the standard's schema before publishing it, and stamps the timestamp for you.

### A handler: a vendor action

A handler serves one request action type. Its `execute` runs on its own thread, may block, should
watch `ctx.cancelled`, and returns `ctx.succeeded()` or `ctx.aborted(reason, message)`. The
connector ships a complete 30-line example, a `beep` action:
[`config/example_vendor_hook.py`](https://github.com/OpenRobOps/iso21423_ros/blob/main/config/example_vendor_hook.py).

```yaml
    handlers:
      beep:
        class: /ws/install/iso21423_ros/share/iso21423_ros/config/example_vendor_hook.py:BeepHandler
        topic: /beep
```

`beep` then appears in the identity's `accepts` list, and any ISO 21423 fleet manager can send it.

:::note[Vendor actions and OpenRobOps]
OpenRobOps sends `move`, `dock`, `cancelRequest`, its own `customCommand` and, when the
deployment configures pause actions, `pauseImr`/`resumeImr`. To trigger robot-specific behaviour from ORO actions, enable the connector's
`customCommand` handler (`class: iso21423_ros.oro:CustomCommandHandler`): every ORO
`PublishToTopic` action then arrives as a `std_msgs/String` on `/inorbit/custom_command`.
`extensions.customData` does the reverse, turning `key=value` strings on `/inorbit/custom_data`
into ORO key-value data. Both are off by default, so the connector stays plain ISO 21423 on other
fleet managers. The [Flatland configuration](https://github.com/OpenRobOps/sim-flatland/blob/main/config/iso21423_connector.yaml)
uses both.
:::

The [connector README](https://github.com/OpenRobOps/iso21423_ros#hooks-your-own-sources-and-handlers)
documents what hooks can use from the node (TF, the CCS transform, the shared Nav2 runner) and the
threading rules.

## Behaviour worth knowing

- **Start order does not matter.** The broker connection and the credential fetch retry every
  10 s, so the connector can start before the network or ORO.
- **Shutdown is clean.** On SIGTERM the connector cancels its own Nav2 goals, reports those requests
  `ABORTED` ("connector shutting down"), publishes `OFFLINE`, clears its retained topics and
  disconnects. No Last Will is published, so the fleet manager can tell a shutdown from a crash.
- **Crashes are recoverable.** Requests are retained on the broker until the sender clears them, so
  a connector that restarts mid-`move` picks the request up again and finishes it.
- **Pause keeps the goal.** `pauseImr` cancels the running Nav2 goal but remembers it; `resumeImr`
  sends it again. This also applies to dock and undock goals.
- **Humble** has no Nav2 docking actions: `undock` is not offered and `dock` drives to the dock
  location.

## Next

- [How ISO 21423 works](./how-it-works.md): the protocol, message by message.
- [ISO 21423 coverage](./coverage.md): what OpenRobOps implements, clause by clause.
- [Connector README](https://github.com/OpenRobOps/iso21423_ros#readme): the full parameter reference.
