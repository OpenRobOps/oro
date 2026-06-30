# Incident Manual-Action Notifications — Branch 2 (Client UI) Design

**Date:** 2026-06-30
**Branch:** `incidents/notifications-ui` (created from `incidents/manual-actions`)
**Status:** Design — awaiting review before writing the implementation plan.

## Context

Branch 1 (server/data, on `incidents/manual-actions`) added: a `Notifications` collection,
an alert-to-notification listener (a notification is created when an open incident's
definition declares `manualActions`, removed on resolve), and a `notifications` publication
plus `notifications.dismiss` / `notifications.runManualAction` methods. The publication
requires `robotId` and `canAccessRobot`.

Branch 2 builds the **in-app UI**: a notification banner at the top of the app, a bell to
toggle whether it shows, and action buttons that run the manual actions. It migrates the
existing inorbit notifications UI (`Banner`, `useNotifications`, `Notifications`) into oro,
adapted to oro's robot-scoped, single-tenant model, and un-stubs the `NotificationsClient`
slot that `DashboardSelector` already renders.

## Global constraints

- **Robot-scoped, single-tenant.** Never use `entity`/`entityId`/`entityType`/`companyId`.
  The banner shows notifications for the robot currently in view, via `getRobotId(context)`.
- **In-app only.** No email / Google Chat / external channels.
- **Run via the Branch 1 method.** Action buttons call `notifications.runManualAction({
  notificationId, actionId })`; the dismiss button calls `notifications.dismiss({ notificationId })`.
  No client-side confirmation or argument prompts in v1 (the configured manual actions are no-arg).
- **Copyright header** on every new file; comments use `;` or `,`, never em dashes; always
  "ORO"/"InOrbit"; no abbreviations in identifiers.
- **Remove on migration** (per the established inorbit to oro rules): company/edition features,
  `companyId`, billing/zeroData/InstallRobot notification origins, feature flags, person names
  in `TODO`/`NOTE` comments.
- **Tests:** oro's suite runs server-only by default (`TEST_CLIENT=0`). New server `*.test.js`
  register in `app/tests/main.js`. Client behavior is verified live against the sim.

## Confirmed facts (verified against the codebase)

- `DashboardSelector` (`app/imports/client/oro/dashboardSelector/DashboardSelector/DashboardSelector.js`)
  already renders `{!muteNotifications && NotificationsClient && <NotificationsClient />}` at the
  top of `DashboardPanelsWrapper`, next to `<RobotOfflineBar context={context} />`. It receives
  `context` from `useUrlContext()`.
- `app/imports/client/oro/dashboardSelector/index.js` currently stubs the slot:
  `// import NotificationsClient from '../Notifications'` and `const NotificationsClient = () => null;`,
  passed as the `NotificationsClient` prop. It already imports from `'../../../lib/collections'`
  and uses `useTracker` / `Meteor.subscribe`.
- `RobotOfflineBar/index.js` resolves the current robot with `getRobotId(context)` and feeds
  `useRobotData(robotId)`; the notifications container uses the same `getRobotId(context)`.
- `PreferencesManager` (`app/imports/server/preferences.js`) exposes `getPreferences(key)` /
  `setPreferences(key, value)` over the `Preferences` collection (keyed by `_id: key`,
  system-wide) and a `preferences` publication that takes `{ keys }` and requires a role.
  It is a draft but functional.
- Branch 1's `notifications` publication signature is `('notifications', { robotId })`; the
  methods are `notifications.runManualAction({ notificationId, actionId })` and
  `notifications.dismiss({ notificationId })`. A notification doc is
  `{ _id, robotId, alertId, componentId, origin: 'robot_alert', severity, message, label,
  actions: [{ actionId, label }], ts }`.
- Inorbit sources to migrate: `client/inorbit/util/Banner/`, `client/inorbit/hooks/useNotifications.js`,
  `client/inorbit/Notifications/{index.js,NotificationsComponent.js}`. The inorbit `Banner`
  imports `ActionsButtons`; the oro version renders plain buttons that call the run method.

## Architecture and data flow

```
DashboardSelector (top of app, tabs bar)
  bell IconButton  --toggles-->  notificationsEnabled (per-user preference)
      read:  Meteor.subscribe('preferences', { keys: ['notificationsBell'] })
      write: Meteor.call('preferences.setNotificationsBell', enabled)
  <NotificationsClient context={context} enabled={notificationsEnabled} />   (un-stubbed)
       robotId = getRobotId(context)
       useNotifications(robotId) -> Meteor.subscribe('notifications', { robotId })
                                 -> Notifications.find({ robotId }, { sort: { ts: -1 } })
       enabled && notifications.length
         -> <Banner> newest notification: message, severity color, one button per action
              action button -> Meteor.call('notifications.runManualAction',
                                            { notificationId, actionId })
              dismiss button -> Meteor.call('notifications.dismiss', { notificationId })
```

## Components (units)

### 1. Banner (presentational)
**New:** `app/imports/client/oro/util/Banner/` (`index.js`, `Banner.js`)
- Migrate from inorbit. Props: `open`, `message`, `statusColor`, `statusContent`, `actions`
  (`[{ label, onClick, disabled? }]`), and an `onDismiss`. Renders a sticky top bar with the
  message, a severity/status indicator, and one MUI `Button` per action plus a dismiss control.
- Drop: `companyId`, `robotId`, `url`, `ActionsButtons`, billing/zeroData/InstallRobot logic.
  Buttons are driven entirely by the `actions` prop.

### 2. useNotifications hook
**New:** `app/imports/client/oro/hooks/useNotifications.js`
- `useNotifications(robotId)` -> `{ notifications, isLoading }`. Returns `{ notifications: [],
  isLoading: false }` when `robotId` is falsy. Otherwise `Meteor.subscribe('notifications',
  { robotId })` and `Notifications.find({ robotId }, { sort: { ts: -1 } }).fetch()`.
- Imports `Notifications` from `app/imports/lib/notifications.js` (Branch 1). No companyId.

### 3. Notifications container + presentation
**New:** `app/imports/client/oro/Notifications/` (`index.js`, `NotificationsComponent.js`)
- Container `Notifications({ context, enabled })`: `robotId = getRobotId(context)`;
  `useNotifications(robotId)`; if `!enabled` or no notifications, render nothing; otherwise pass
  the newest notification to `NotificationsComponent`.
- `NotificationsComponent` maps the notification's `actions` to Banner action buttons:
  each `onClick` calls `Meteor.call('notifications.runManualAction', { notificationId, actionId })`;
  a dismiss button calls `Meteor.call('notifications.dismiss', { notificationId })`. Surfaces a
  brief running/error state per button (reuse `CustomSnackbar` or inline disabled state on click).
- Severity color from `theme.palette.severityColor[notification.severity]`.

### 4. Un-stub the slot
**Modify:** `app/imports/client/oro/dashboardSelector/index.js`
- Replace `const NotificationsClient = () => null;` with the real
  `import NotificationsClient from '../Notifications';`. Pass `context` (and `enabled`) through.

### 5. Bell toggle + per-user preference
**Modify:** `app/imports/client/oro/dashboardSelector/DashboardSelector/DashboardSelector.js`
- Add a bell `IconButton` to the tabs bar (`TabsContainer`). Filled bell = notifications shown,
  bell-off icon = hidden. Clicking toggles `notificationsEnabled` and persists it.
- Read the preference via `Meteor.subscribe('preferences', { keys: ['notificationsBell'] })`
  and `Preferences.findOne('notificationsBell')`; the per-user value lives under that document
  keyed by the current `userId` (a map `{ [userId]: boolean }`). Default = enabled (shown).

**Modify:** `app/imports/server/preferences.js`
- Add a Meteor method `preferences.setNotificationsBell(enabled)` that requires `this.userId`,
  validates `enabled` is a boolean, and calls `setPreferences('notificationsBell',
  { [this.userId]: enabled })` (merge-preserving, so other users' entries are untouched).

**Test:** `app/imports/server/test/preferencesNotificationsBell.test.js`
- `setPreferences('notificationsBell', { u1: false })` then `getPreferences('notificationsBell')`
  returns `{ _id: 'notificationsBell', u1: false }`; a second user's write merges rather than
  overwrites (`{ u1: false, u2: true }`). Register in `app/tests/main.js`.

## Out of scope

- Fleet-wide aggregation across robots (banner is scoped to the robot in view; the Branch 1
  publication is per-robot by design).
- Client-side action confirmation dialogs and argument prompts.
- The fuller `UIPreferences` + `ConfigManager` per-user entity-config path for the bell.
- Reusing `ActionsButtons` / `WithActionsContext` for the notification buttons.
- External notification channels.

## Self-review

- **Spec coverage:** banner (unit 1), data hook (2), container/run-dismiss wiring (3), slot
  un-stub (4), bell + per-user preference + method + test (5). All map to the approved design. ✅
- **Scope:** robot-in-view banner; PreferencesManager per-user key for the bell; run via the
  Branch 1 method. No new subsystem. ✅
- **Consistency:** `getRobotId(context)` matches `RobotOfflineBar`; `'notifications'` `{ robotId }`
  and the two method names match Branch 1 exactly; notification `actions` shape `{ actionId, label }`
  is what Branch 1 writes and what the buttons consume. ✅
- **"entity"/companyId scrub:** none introduced; companyId removed from the migrated hook,
  container, and Banner. ✅
- **Risks:** (1) the `Preferences` doc is system-wide, so the per-user value must be stored under
  a `userId`-keyed field and `setPreferences` must merge (it does, field-by-field) so users do not
  clobber each other; the method passes only `{ [this.userId]: enabled }`. (2) `runManualAction`
  may reject (`action-failed` / `action-not-allowed`); the button surfaces the error rather than
  assuming success. (3) When no robot is in view (`getRobotId` returns falsy), the hook subscribes
  to nothing and the banner renders nothing; this is intended.
