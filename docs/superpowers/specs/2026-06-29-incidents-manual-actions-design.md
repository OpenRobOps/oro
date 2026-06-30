# Incident Manual-Action Notifications — Branch 1 (Server/Data) Design

**Date:** 2026-06-29
**Branch:** `incidents/manual-actions` (created from `incidents/auto-actions`)
**Status:** Design — awaiting review before writing the implementation plan.

## Context

Incidents already support automatic actions (`autoActions`, shipped on `incidents/auto-actions`).
This feature adds **manual actions**: actions an operator runs by hand from an in-app
notification when an incident is open.

The full feature is split into two branches (decision: split server then client):

- **Branch 1 (this spec) — server/data.** Expose `manualActions` in the incident-definition
  Config API; generate in-app notifications from open incidents that carry manual actions;
  provide methods/publication to list, run, and dismiss them.
- **Branch 2 (separate spec) — client UI.** Migrate the inorbit `Banner` / `useNotifications`
  / `Notifications` components, un-stub `NotificationsClient` in `DashboardSelector`, add a
  notification bell toggle (enable/disable display, persisted in uiPreferences), and wire the
  run/dismiss buttons.

## Global constraints

- **Robot-scoped, single-tenant.** Never use `entity`/`entityId`/`entityType`/`companyId`.
  Notifications are keyed by `robotId` (+ `alertId`). This drops inorbit's company scoping.
- **In-app only.** No email / Google Chat / AMQP channels. The inorbit
  `alertsNotificationsBus` and `notificationChannels/` are out of scope.
- **Manual actions only here.** `autoActions` already done; `distributions` (external) stay out.
- **System vs user.** Auto-actions run as the system user; manual actions run as the
  **logged-in user** (`this.userId`) who clicked the button.
- **Copyright header** on every new file; `TODO:` / `NOTE:` comments only (no person names,
  no em dashes, no abbreviations, always "ORO").
- **Tests:** from `app/`, `./tests-run.sh --once --grep "<name>"`; new `*.test.js` registered
  in `app/tests/main.js`.

## Confirmed facts (verified against the `incidents/auto-actions` base)

- `app/imports/lib/alerts.js` storage schema already allows `error.manualActions` /
  `warning.manualActions` (arrays of strings) and an `executedActions` array on the alert.
- `app/imports/server/configAPI/incidentDefinitions.js`: `configObjectToIncidentDefinition`
  copies each level block with `{ ...spec.error }`, and `incidentDefinitionToConfigObject`
  echoes whole blocks. So once the **validator** `LEVEL_BLOCK` allows `manualActions`, it
  persists and round-trips with no other change. The validator is `strict`, so it currently
  rejects `manualActions`.
- The `ok` block has no manual actions (a resolved incident has nothing to act on).
- `app/imports/shared/constants.js` already defines `COLLECTIONS.NOTIFICATIONS = 'notifications'`.
- Alerts listeners register via `app/imports/server/incidentsManagementSubsystem.js`
  (`new AlertsManager().addAlertsListener(...)`); `IncidentsFromAlertsIntegration.handleAlertEvent`
  is the pattern to mirror.
- `app/imports/server/actions.js` `ActionsEngine`: `getActionDefinitions(actionIds)` resolves
  action ids to definitions (for labels); `runAction({ actionId, context, args, user })` runs one.
- `AlertsManager.createAlert` calls listeners after create/update/reopen; `resolveAlert` sets
  status `resolved` and notifies listeners. The same listener sees both, so a single
  `NotificationsFromAlertsIntegration` handles create (upsert notification) and resolve (remove).

## Architecture and data flow

```
Incident opens / updates (AlertsManager -> listeners)
  -> NotificationsFromAlertsIntegration.handleAlertEvent(alertMsg)
       look up incidentDefinition[level].manualActions
       status == new  && manualActions.length -> upsert Notifications doc
       status == resolved (or no manualActions) -> remove the doc

Notifications collection (oro lib/notifications.js), one doc per open alert with manual actions:
  { _id, robotId, alertId, componentId, origin: 'robot_alert',
    severity, message, label, actions: [{ actionId, label }], ts, dismissedTs? }

Client (Branch 2) reads via 'notifications' publication and runs/dismisses via methods.

Run:  notifications.runManualAction({ notificationId, actionId })
        validate actionId is in the notification's actions
        ActionsEngine.runAction({ actionId, context: { robotId }, user: <this.userId user> })
        record { actionId, userId, ts } into RobotAlerts.executedActions
Dismiss: notifications.dismiss({ notificationId }) -> remove (or set dismissedTs)
```

## Components (units)

### 1. Config API: expose `manualActions`
**File:** `app/imports/server/configAPI/incidentDefinitions.js`
- Add a `MANUAL_ACTIONS` spec (same shape as `AUTO_ACTIONS`: optional array of non-empty
  strings) and include `manualActions` in `LEVEL_BLOCK.props` (error + warning). Leave the
  `ok` block as autoActions-only.
- No change to `configObjectToIncidentDefinition` / `incidentDefinitionToConfigObject`
  (whole-block copy already round-trips `manualActions`).
- Update the comment on line 45 (currently "manualActions intentionally not part of this schema").

### 2. Notifications collection
**New file:** `app/imports/lib/notifications.js`
- `Notifications = new Mongo.Collection(COLLECTIONS.NOTIFICATIONS)`.
- Export `ORIGIN_ROBOT_ALERT = 'robot_alert'`.
- Robot-scoped; no companyId. Document shape per the data-flow block above.

### 3. Alert -> notification listener
**New file:** `app/imports/server/notificationsFromAlertsIntegration.js`
- Class `NotificationsFromAlertsIntegration` with `handleAlertEvent(alertMsg, options)`
  mirroring `IncidentsFromAlertsIntegration`.
- On an open alert: look up the definition, read `def[alert.event.level].manualActions`;
  if non-empty, resolve labels via `ActionsEngine.getActionDefinitions(actionIds)` and
  upsert one notification keyed by `alertId`.
- On a resolved alert (or when no manual actions configured): remove the notification
  (decision: auto-remove on resolve).
- Register in `incidentsManagementSubsystem.js` via `new AlertsManager().addAlertsListener(...)`.

### 4. Publication + methods
**New file:** `app/imports/server/notifications.js`
- `Meteor.publish('notifications', ...)` — publishes current (non-dismissed) notifications.
  Robot-scoped: optionally filtered by a `robotId` arg; follow existing oro publication
  auth patterns (e.g. `dashboards.js`).
- `Meteor.methods`:
  - `notifications.dismiss({ notificationId })` — removes the notification.
  - `notifications.runManualAction({ notificationId, actionId })` — loads the notification,
    asserts `actionId` is one of its `actions`, calls
    `ActionsEngine.runAction({ actionId, context: { robotId }, user })` as the logged-in
    user (resolved from `this.userId`), and pushes `{ actionId, userId, ts }` onto the
    alert's `executedActions`. Throws if `this.userId` is missing or the actionId is not allowed.

### 5. Tests
**New files** under `app/imports/server/test/`:
- `notificationsFromAlerts.test.js` — open incident with manualActions creates a notification
  with the resolved action labels; resolving removes it; an incident without manualActions
  creates none.
- `notificationsMethods.test.js` — `runManualAction` runs only allow-listed actions (rejects
  an actionId not on the notification), runs as the calling user, records `executedActions`;
  `dismiss` removes the doc. Use a captured fake `ActionsEngine` (same technique as the
  auto-actions tests).
- Extend `app/imports/server/test/configAPI/configAPIIncidentDefinition.test.js` — round-trip
  `manualActions`; reject non-string entries.
- Register new test files in `app/tests/main.js`.

## Out of scope (Branch 2 or later)

- All client UI: `Banner`, `useNotifications`, `Notifications` component, the bell toggle,
  un-stubbing `NotificationsClient`.
- External notification channels (email, Google Chat, AMQP bus).
- `ok`-level manual actions; manual-action argument prompts beyond what `ActionsEngine`
  already enforces.

## Self-review

- **Spec coverage:** Branch 1 = "expose + generate + run/dismiss manual-action notifications,
  server side." Config (unit 1), collection (2), generation (3), run/dismiss (4), tests (5). ✅
- **Scoping:** robot-scoped, no companyId; in-app only; manual (user) vs auto (system). ✅
- **Reuse:** listener pattern, `ActionsEngine`, `COLLECTIONS.NOTIFICATIONS`, whole-block
  config round-trip — all confirmed against the base branch. ✅
- **Risks:** (1) `runManualAction` must hard-validate the actionId against the notification's
  allow-list (prevents running arbitrary actions via a notification id). (2) `runAction` may
  return `{ errors }` for actions needing args; surface that to the caller rather than
  recording a success. (3) Notification upsert must be idempotent on repeated alert updates
  (key by `alertId`).
