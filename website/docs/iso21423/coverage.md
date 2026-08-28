---
sidebar_position: 4
---

# ISO 21423 coverage

How much of ISO/FDIS 21423 OpenRobOps implements today, what is still missing, and where it deliberately goes beyond the standard. Two layers are covered separately, because they have different scopes:

- **SDK** — [`@openrobops/iso21423`](https://github.com/OpenRobOps/iso21423), the TypeScript implementation of the wire standard (topics, schemas, session, request state machine). Usable by any IMR or IMRFM.
- **ORO fleet manager** — ORO ingest's `IsoRobotsModule`, the IMRFM built on the SDK ([setup guide](./iso-robots-setup.md)). It only needs the subset of the standard a fleet manager consumes.

The ISO Upstream direction (ORO presenting its own fleet as IMRs to another fleet manager) is **not implemented yet** — only a settings flag and shared groundwork (CCS conversion, deterministic entity UUIDs) exist.

Legend: ✅ implemented · 🌗 partial · ❌ not implemented · — not applicable to that layer.

## Clause by clause

| Clause | SDK | ORO fleet manager | Notes |
|--------|:---:|:-----------------:|-------|
| 4 Common coordinate system (CCS) | 🌗 | ✅ | SDK has the CCS/reference/location-point types and a least-squares rigid-transform fit (Annex D), but no CCS *transport* — the standard defines none either. ORO calibrates from `iso21423.ccs.referencePoints` (≥ 3 pairs, as Clause 4 requires) and converts poses, paths and goals both ways. |
| 5 IMR identity and capability | ✅ | 🌗 | SDK: full Table 4 typing, schema validation, `provides`/`accepts`/`manages`/`managedBy`, identity discovery catalogue. ORO uses identity for admission and reads `imrFootprint` + `imrHeight`; model, serial, rated speed/load, charger types, vendor contact, thumbnail, etc. are ignored. |
| 6 IMR location and status | ✅ | 🌗 | SDK: all 32 Table 5 operating states + modes (open vocabulary preserved), odometry, battery, trajectories. ORO maps only online/offline (`OFFLINE`, `LOST_CONNECTION`); the other states are not surfaced. Battery health, temperature and current are ignored. |
| 7 IMRFM identity and capability | ✅ | ✅ | ORO publishes an IMRFM identity with `details.softwareVersions` (ingest's own version plus `robots.softwareVersions` from settings); `manages: []` is deliberate — ISO robots are self-managed, ORO never publishes on their behalf. |
| 8 IMRFM state | ✅ | ❌ | ORO does not publish `READY` / `NOT_READY` / `OFFLINE`; liveness is only the Last Will. |
| 9 Request messages | ✅ | 🌗 | SDK: envelope, details, status, Figures C.3/C.4 state machines, all five C.2.2 concurrency strategies, capability enforcement on send. ORO sends requests (below) but advertises `accepts: []` and serves none. |
| 10 Messaging protocol and formats | ✅ | ✅ | MQTT 3.1.1 with persistent session, keep-alive 60 s, B.4 Last Will on `disconnection` (QoS 1, retained), JSON per Annex A. Streaming rate bounds of Table B.1 enforced by a latest-wins gate. |
| Annex A JSON schema | 🌗 | — | Every object in the SDK schema except `ccs`, `referencePoint` and `entityFootprintHeight`. Ingress normalisation for known FDIS inconsistencies (comma timestamps, `id` vs `entityId`). |
| Annex B topics | ✅ | ✅ | Root namespace `/ISO_21423/v1`, `+/+/identity` discovery, request/status topics always include `<entityType>`. |
| B.5.2.4 Managed entities (IMRFM publishes for robots) | ✅ | ❌ | `FleetGateway` in the SDK; ORO does not use it (decision: robots publish their own resources). |
| Security (10.1, IEC 62443/27001 "should") | 🌗 | ✅ | SDK: username/password + TLS options, identity self-check probe. ORO adds a concrete model: two-gate onboarding (admission + credentials), per-robot broker credentials and ACLs scoped to the robot's own topic tree. |

## Resources (Table B.1)

| Resource | SDK | ORO ingests | ORO maps it to |
|----------|:---:|:-----------:|----------------|
| `identity` | ✅ | 🌗 | Admission check, name/hostname, footprint (`imrFootprint`, `imrHeight`) |
| `status` | ✅ | 🌗 | `agentOnline` only |
| `batteryStatus` | ✅ | 🌗 | `batteryPercentage`, `batteryVoltage`, `batteryIsCharging` |
| `odometry` | ✅ | ✅ | `pose` (CCS → map), `speedLinear`, `speedAngular`, robot pose on the map |
| `localTrajectory` | ✅ | ✅ | Robot path `"1"` (Navigation widget, ≤ 1/s) |
| `globalPlan` | ✅ | ✅ | Robot path `"0"` |
| `globalPath` (NURBS) | ✅ | ❌ | Typed and validated in the SDK; not used by ORO |
| `footprint` (live resource) | 🌗 | ❌ | QoS entry only, no schema or typed publisher — the FDIS leaves it half specified. ORO uses the retained identity footprint instead. |
| `request/<uuid>`, `request/<uuid>/status` | ✅ | send only | See below |
| `activeRequestsStatus` | ✅ | ❌ | SDK publishes it for served requests; ORO neither serves nor reads it |
| `disconnection` (B.4 Last Will) | ✅ | ✅ | Treated as a first-class resource; `LOST_CONNECTION` → offline |

## Request actions (Annex C)

| Action | SDK | ORO sends it | Triggered by |
|--------|:---:|:------------:|--------------|
| `move` | ✅ | ✅ | **Navigate to** action (goal converted to the CCS). Tolerances and `arrivalTime` are not set. |
| `cancel` | ✅ | ✅ | **Cancel navigation**, when a `move`/`dock` is in flight. Sent as `cancelRequest` (see extensions); `cancel` is accepted on ingress. |
| `dock` | ✅ | ✅ | `dock` / `dock=<id>` messages; always `dockActions: ["CHARGE"]`, addressed by location (no `dockId`). |
| `undock` | ✅ | ❌ | No ORO trigger yet. |
| `pauseImr` / `resumeImr` | ✅ | 🌗 | Wired to `commandTopics.pause`/`.resume`, `null` by default — no built-in ORO action publishes there yet. |
| Request status feedback | ✅ | ❌ | ORO does not feed `SUCCEEDED`/`ABORTED`/`EXECUTING` back into its action-execution status; a nav goal is acknowledged on receipt, not arrival. |
| Multi-detail, `priority`, `atomic`, `recoveries`, empty `destination` | ✅ | ❌ | ORO always sends one detail per request to an explicit robot. |

## What is left

Roughly in the order it is likely to matter:

1. **ISO Upstream** — ORO as an IMR proxy for its own wire/ROS robots. Design exists, no code.
2. **IMRFM state** (Clause 8).
3. **Request status feedback** into ORO's action-execution API; `undock`; built-in pause/resume actions.
4. **Richer status and identity mapping** — operating states beyond online/offline (e.g. `CHARGING`, `LOW_BATTERY`, stop categories → statuses/incidents), battery health, model/serial/rated values as robot metadata.
5. **Mixed fleets** — a deployment is either wire or ISO today.
6. **SDK**: `footprint`, `ccs`/`referencePoint` schema kinds; enforcing Table 5 conditional rules (exactly one `MODE_*`, stop categories in manual modes); minimum-frequency heartbeats; the planned examples (IMR simulator, gateway template, fleet observer).

## Extensions over the standard

All of these use hooks the standard leaves open (resource catalogue B.2.2, entity types B.2.3, action `type` in Table C.2, state and reason-code vocabularies).

| Extension | What | Why |
|-----------|------|-----|
| `customData` resource | `/ISO_21423/v1/IMR/<uuid>/customData`, QoS 1, `{ timestamp, values: { key: string } }`. Robots opt in via `capabilities.provides`. | ISO has no key-value message; this carries deployment-specific data sources, statuses, incidents and the Key-Values widget unchanged. |
| `customCommand` action | `{ type: "customCommand", version: "1.0", properties: { command } }`, opt-in via `capabilities.accepts`. | Pass-through for any ORO **PublishToTopic** action, so existing deployment actions survive the protocol change. |
| `cancelRequest` action name | SDK emits `cancelRequest`, normalises legacy `cancel` on ingress. | Resolves an ambiguity in the FDIS naming; both are in the SDK schema. |
| `disconnection` as a resource, JSON Last Will | Last Will payload is `{"states":["LOST_CONNECTION"]}`. | The FDIS Last Will text is not valid JSON and its state is unregistered. |
| Dock conventions | `dock` / `dock=<id>` messages, nearest-dock selection, docks configured in ORO's map frame. | Standard ISO robots can be docked from ORO without knowing OpenRobOps. |
| Cancel-nav semantics | With nothing in flight, "cancel" is a `move` to the robot's current pose (not `pauseImr`). | Matches ORO's goal-to-current-pose behaviour; `pauseImr` implies a later resume. |
| CCS calibration storage | Reference points in settings, seeded into ORO's `spatial_transformations`. | The standard defines the CCS but no way to distribute it. |
| Onboarding and ACLs | `IsoRobot` admission object, `POST /iso_mqtt_config`, per-robot Mosquitto ACLs. | The standard only says "should follow IEC 62443/27001". |
| Fleet gateway helpers (SDK) | Retained-request janitor, identity self-check probe. | Operational robustness the standard does not address. |

The SDK repository keeps a [catalogue of FDIS defects](https://github.com/OpenRobOps/iso21423/blob/main/docs/iso-fdis-21423-defects.md) explaining each deviation and the position taken.
