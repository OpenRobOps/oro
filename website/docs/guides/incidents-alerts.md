---
sidebar_position: 3.5
---

# Incidents & Alerts

Incidents turn attribute status changes into operator-facing events: banners
with action buttons, timeline entries, webhook notifications, and automatic
remediation actions. This guide covers the full pipeline and how to configure it.

## The Pipeline

```
Attribute value changes (telemetry)
    │
    ▼
StatusDefinition rule fires (ingest)
    │  POST /peer/alerts
    ▼
Alert (web app AlertsManager)
    │  matched against the IncidentDefinition for the attribute + level
    ▼
Incident
    ├── In-app notification (banner with manual-action buttons)
    ├── Webhook delivery to notification channels
    ├── Auto-actions executed on the robot
    └── Event log entry
```

1. A [StatusDefinition](../api/configapikinds.md#statusdefinition) rule
   evaluates an attribute and changes the robot's status for that attribute to
   `warning` or `error`.
2. The ingest service reports the change to the web app, which raises an
   **alert**.
3. The `AlertsManager` looks up the **`IncidentDefinition`** whose id matches
   the attribute (trigger) id. If the definition has a block for the alert's
   level, an **incident** is created (or an existing one updated); the
   listeners then fan out notifications, webhooks, auto-actions, and event-log
   entries.

:::warning[The most common configuration trap]
An alert with **no matching `IncidentDefinition` for its level is silently
dropped** — no incident, no notification, nothing in the timeline. If statuses
change but no incidents appear, define an `IncidentDefinition` whose
`metadata.id` equals the attribute id and which has a block for the firing
level (`error` and/or `warning`).
:::

## Defining Incidents

An `IncidentDefinition` is applied through the
[Config API](../api/configapi.md). Its `metadata.id` is the **attribute id**
whose status changes trigger it:

```yaml
apiVersion: v0.1
kind: IncidentDefinition
metadata:
  id: battery_level
spec:
  labelTemplate: "Battery problem on {{robotName}}"
  error:
    severity: SEV 1
    autoActions: [pause_robot]
    manualActions: [restart_agent, return_to_dock]
    notificationChannels: [ops-webhook]
  warning:
    severity: SEV 3
    notificationChannels: [ops-webhook]
  ok:
    autoActions: [resume_robot]
    notificationChannels: [ops-webhook]
```

| Field | Description |
|-------|-------------|
| `label` | Fixed incident title |
| `labelTemplate` | Title template; supports the `{{robotName}}` placeholder |
| `error` / `warning` | Per-level blocks, applied when the alert is at that level |
| `<level>.severity` | Incident severity: `SEV 0` (most severe) to `SEV 3` |
| `<level>.autoActions` | Action ids executed automatically when the level is reached (run as the system user; failures are logged, not retried) |
| `<level>.manualActions` | Action ids offered to operators as buttons on the in-app notification |
| `<level>.notificationChannels` | `NotificationChannel` ids to deliver to at this level |
| `ok` | The **resolution** block — no `severity` or `manualActions`; its `autoActions` and `notificationChannels` run when the incident resolves |

All action ids reference [ActionDefinition](../api/configapikinds.md#actiondefinition)
objects. Channel ids reference `NotificationChannel` objects; a referenced
channel that doesn't exist is skipped with a warning (no referential integrity
is enforced at apply time).

### Lifecycle details

- **Deduplication** — an already-open alert for the same trigger is updated,
  not duplicated. An alert that resolved less than **10 minutes** ago is
  reopened instead of creating a new incident.
- **Escalation** — when an alert's level rises, the incident records its
  `highestSeverity` and notification channels are re-notified; same-level
  updates are not re-delivered.
- **Resolution** — when the status returns to `ok`, the incident resolves: the
  `ok` block's auto-actions run, and the union of all levels' channels is
  notified.

## Notification Channels

A `NotificationChannel` names a delivery endpoint. Webhooks are the only
supported type today:

```yaml
apiVersion: v0.1
kind: NotificationChannel
metadata:
  id: ops-webhook
spec:
  type: webhook
  url: https://ops.example.com/hooks/oro
  secret: my-shared-secret   # optional
```

Deliveries are JSON `POST`s. When `secret` is set, it is sent as
`Authorization: Bearer <secret>`. Keep real secrets out of committed YAML —
substitute them at apply time.

The payload:

```json
{
  "status": "open",
  "severity": "SEV 1",
  "robotId": "robot_abc123",
  "robotName": "warehouse-bot-1",
  "componentId": "battery_level",
  "label": "Battery problem on warehouse-bot-1",
  "message": "battery_level is below 20",
  "value": 12,
  "formattedValue": "12 %",
  "alertId": "...",
  "ts": 1710000000000
}
```

Delivery semantics: webhooks fire on **open**, **escalation**, and **resolve**
(`status: "resolved"`) only — not on every alert update. Delivery is
best-effort with a timeout and **no retries**.

## Operator Experience

- Every open incident shows an in-app **notification banner**. If the current
  level declares `manualActions`, they appear as buttons; otherwise the banner
  is dismiss-only.
- **Dismissal sticks** — later updates to the same alert never resurrect a
  dismissed notification. The notification is removed automatically when the
  incident resolves.
- Incidents appear in the **Incident List** and **Incident Timeline** fleet
  widgets (Config API types `incidentList` / `incidentTimeline`), which offer
  severity and component filters plus a live/history toggle. See
  [Dashboards & Widgets](./dashboards-widgets.md).

## Removing or Suppressing

Clear a definition to stop producing incidents for an attribute:

```bash
curl -X POST \
  -H "x-auth-api-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  http://localhost:3000/api/configuration/clear \
  -d '{
    "kind": "IncidentDefinition",
    "apiVersion": "v0.1",
    "metadata": { "id": "battery_level" }
  }'
```

Both kinds require **configure** access on incidents (engineer role or above).

## Next Steps

- [Attributes & Status](./attributes-status.md) — define the statuses that trigger alerts
- [Config API Kinds](../api/configapikinds.md) — full schema reference
- [Dashboards & Widgets](./dashboards-widgets.md) — the incident widgets
