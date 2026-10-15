# Robot config kind and ghost robots

`Robot` is a configuration kind (`POST /api/configuration/apply`, like every other kind) that
declares a robot by id with its identity fields. It is **not** a way to feed live data: ingest owns
status, pose and telemetry, and this kind only ever sets a name and tags on a real robot.

```yaml
apiVersion: v0.1
kind: Robot
metadata: { id: picker-3, scope: "" }
spec:
  label: Picker 3          # optional, defaults to the id
  tags: [RSMagni]          # optional free-form labels
```

Applying a real robot before its agent connects pre-registers it offline with that name;
re-applying touches only `label` and `tags`. Clearing it deletes the robot document, and is
refused while the robot is online.

## Ghost robots (demos)

With `ghost: true` the robot is a static placeholder: it reads as **online**, and the spec may also
carry a pose, datasource values and statuses. These three fields are rejected without `ghost: true`.

```yaml
apiVersion: v0.1
kind: Robot
metadata: { id: picker-4, scope: "" }
spec:
  label: Picker 4
  ghost: true
  pose: { x: 8.0, y: 5.0, theta: 1.57 }        # default map frame; theta optional
  attributes:                                   # datasource ids -> value (string/number/bool)
    batteryPercentage: 0.55
    cpuLoadPercentage: 0.63
    missionStatus: running
  statuses: { cpuLoadPercentage: WARN, localization: OK }   # OK | WARN | ERROR
```

What it writes, once, using the platform's ghost sentinel (`updateStamp` and every `ts` set to
`HACK_GHOST_UPDATE_STAMP_VALUE`, which the UI treats as never stale):

| Spec field   | Collection          | Shown by                                   |
|--------------|---------------------|--------------------------------------------|
| (always)     | `robots`            | fleet list, online indicator               |
| `attributes` | `attr_values`, `robot_key_values` | Vitals / Data Sources / Key Values widgets |
| `statuses`   | `robot_status`      | Fleet Status chips                         |
| `pose`       | `localization`      | Navigation widget and fleet map            |

Percentages follow the UI convention of `0..1` fractions. Charts stay empty (no timeseries is
written). Re-applying replaces the static values; `clear` removes the robot and all of them.
