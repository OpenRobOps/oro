# Incident Manual-Action Notifications (Branch 1, Server/Data) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose per-level `manualActions` on incident definitions, generate an in-app notification when an incident with manual actions opens, and provide a publication plus methods to run (as the logged-in user) and dismiss those notifications.

**Architecture:** A new `NotificationsFromAlertsIntegration` registers as an `AlertsManager` listener (same pattern as `IncidentsFromAlertsIntegration`); on an open alert whose definition has `manualActions` it upserts a `Notifications` doc keyed by `alertId`, and removes it on resolve. A `NotificationsManager` (wrapped by a Meteor publication + two methods) lists notifications and runs an allow-listed action through `ActionsEngine.runAction` as `this.userId`, recording the run on the alert's `executedActions`.

**Tech Stack:** Meteor 3, `fastest-validator` (config API), `meteortesting:mocha` + `chai` + `chai-as-promised`.

## Global Constraints

- **Robot-scoped, single-tenant.** Never use `entity`/`entityId`/`entityType`/`companyId`. Notifications are keyed by `robotId` (+ `alertId`).
- **In-app only.** No email / Google Chat / AMQP channels.
- **Manual actions run as the logged-in user** (`this.userId` -> `Meteor.userAsync()`), not the system user.
- **Auto-remove on resolve.** A notification is removed when its incident resolves; `dismiss` also removes it (no `dismissedTs`).
- **Copyright header** on every new file (copy verbatim from `app/imports/server/incidentsFromAlertsIntegration.js`); `TODO:` / `NOTE:` comments only. No em dashes in comments (use `;` or `,`). Always "ORO" / "InOrbit". No abbreviations in identifiers.
- **Branch:** `incidents/manual-actions` (already created from `incidents/auto-actions`).
- **Run tests:** from `app/`, `./tests-run.sh --once --grep "<name>"`; full run `./tests-run.sh --once`. New `*.test.js` are registered in `app/tests/main.js`.

## Confirmed facts

- `app/imports/lib/alerts.js` already allows `error.manualActions` / `warning.manualActions` (arrays of strings) and an `executedActions` array on the alert; only the config-API validator needs changing to accept `manualActions` on input.
- `app/imports/server/configAPI/incidentDefinitions.js`: `LEVEL_BLOCK` is `strict` with `severity` + `autoActions`; `configObjectToIncidentDefinition` copies blocks with `{ ...spec.error }` and `incidentDefinitionToConfigObject` echoes whole blocks, so adding `manualActions` to the validator round-trips with no other change. The `ok` block stays autoActions-only.
- `app/imports/shared/constants.js` defines `COLLECTIONS.NOTIFICATIONS = 'notifications'`.
- `ActionsEngine` (`app/imports/server/actions.js`) is a **singleton**. `getActionDefinitions(actionIds)` returns an object **keyed by `_id`** (via lodash `keyBy`). `runAction({ actionId, context, args, user })` returns `undefined` on success or `{ errors }` on failure.
- Alerts listeners register in `app/imports/server/incidentsManagementSubsystem.js`; `IncidentsFromAlertsIntegration.handleAlertEvent(alertMsg)` reloads the alert from `RobotAlerts` by `_id`, then acts. `ALERT_STATUS_RESOLVED` / `ALERT_STATUS_NEW` come from `app/imports/shared/alerts`.
- Server publications/methods register on import; `app/server/main.js` is the startup entry (imports server modules, calls `initIncidentsManagement`).
- Test helpers: `app/imports/server/test/incidentsCreation.test.js` shows `wire()` (fresh `AlertsManager`, `removeAllAlertsListeners`, attach one integration) and `fakeActions()` (swap the engine). `app/imports/server/test/configAPI/configAPIIncidentDefinition.test.js` shows `makeConfigObject(id, spec)`, `createUser({ role })`, `new ConfigAPI().init()`, and `chai-as-promised` (`expect(...).to.be.rejected`).

## File Structure

- **Modify** `app/imports/server/configAPI/incidentDefinitions.js` — accept `manualActions` in `LEVEL_BLOCK`.
- **Create** `app/imports/lib/notifications.js` — `Notifications` collection + `ORIGIN_ROBOT_ALERT`.
- **Create** `app/imports/server/notificationsFromAlertsIntegration.js` — the alerts listener that upserts/removes notifications.
- **Modify** `app/imports/server/incidentsManagementSubsystem.js` — register the listener.
- **Create** `app/imports/server/notifications.js` — `NotificationsManager` + `notifications` publication + `notifications.dismiss` / `notifications.runManualAction` methods.
- **Modify** `app/server/main.js` — import the notifications module so its publication/methods register.
- **Modify** `app/imports/server/test/configAPI/configAPIIncidentDefinition.test.js` — `manualActions` round-trip + rejection.
- **Create** `app/imports/server/test/notificationsFromAlerts.test.js` — listener behavior.
- **Create** `app/imports/server/test/notificationsMethods.test.js` — manager run/dismiss behavior.
- **Modify** `app/tests/main.js` — register the two new test files.

---

## Task 1: Expose `manualActions` in the incident-definition spec

**Files:**
- Modify: `app/imports/server/configAPI/incidentDefinitions.js`
- Test: `app/imports/server/test/configAPI/configAPIIncidentDefinition.test.js`

**Interfaces:**
- Consumes: existing `LEVEL_BLOCK`, `AUTO_ACTIONS`, `makeConfigObject`, `createUser`, `ConfigAPI`.
- Produces: incident definitions persist `error.manualActions` / `warning.manualActions` (arrays of non-empty strings).

- [ ] **Step 1: Write the failing round-trip test**

In `configAPIIncidentDefinition.test.js`, add inside `describe('configAPI:IncidentDefinition', ...)`:

```javascript
  it('apply: stores per-level manualActions', async () => {
    const user = await createUser({ role: ROLE_ADMIN });
    new ConfigAPI().init();
    await new ConfigAPI().apply({
      configObject: makeConfigObject('batteryLow', {
        label: 'Battery incident',
        error: { severity: ICM_SEV_1, manualActions: ['DockManual'] },
        warning: { severity: ICM_SEV_2, manualActions: ['NotifyOps', 'Pause'] }
      }),
      user
    });
    const doc = await IncidentConfiguration.findOneAsync({ _id: 'batteryLow' });
    expect(doc.error.manualActions).deep.eq(['DockManual']);
    expect(doc.warning.manualActions).deep.eq(['NotifyOps', 'Pause']);
  });

  it('apply: rejects manualActions that are not an array of strings', async () => {
    const user = await createUser({ role: ROLE_ADMIN });
    new ConfigAPI().init();
    await expect(
      new ConfigAPI().apply({
        configObject: makeConfigObject('bad', { error: { manualActions: [123] } }), user
      })
    ).to.be.rejected;
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd app && ./tests-run.sh --once --grep "IncidentDefinition"`
Expected: FAIL — the strict validator rejects the unknown `manualActions` field (the round-trip test errors on `apply`).

- [ ] **Step 3: Add `manualActions` to the validator**

In `incidentDefinitions.js`, replace the `AUTO_ACTIONS` block and `LEVEL_BLOCK` (currently lines 44-58) with:

```javascript
// Supports per-level severity, autoActions (run automatically) and manualActions
// (ids of actions an operator runs by hand from an in-app notification).
// Distributions are intentionally not part of this schema yet; the `ok` block has
// no manual actions (a resolved incident has nothing to act on).
const ACTION_IDS = {
  type: 'array', optional: true, items: { type: 'string', empty: false }
};

const LEVEL_BLOCK = {
  type: 'object',
  optional: true,
  strict: true,
  props: {
    severity: { type: 'enum', values: ICM_SEV_ALL, optional: true },
    autoActions: ACTION_IDS,
    manualActions: ACTION_IDS
  }
};
```

Then update the `ok` field of `IncidentDefinitionSpecApplySchema` to keep using the shared const:

```javascript
  ok: { type: 'object', optional: true, strict: true, props: { autoActions: ACTION_IDS } }
```

(`configObjectToIncidentDefinition` and `incidentDefinitionToConfigObject` copy whole level blocks, so `manualActions` persists and round-trips with no further change.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd app && ./tests-run.sh --once --grep "IncidentDefinition"`
Expected: PASS — all existing tests plus the 2 new ones.

- [ ] **Step 5: Commit**

```bash
cd /home/clari/oro
git add app/imports/server/configAPI/incidentDefinitions.js \
        app/imports/server/test/configAPI/configAPIIncidentDefinition.test.js
git commit -m "feat(incidents): accept per-level manualActions in the incident-definition config API

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Notifications collection and the alert-to-notification listener

**Files:**
- Create: `app/imports/lib/notifications.js`
- Create: `app/imports/server/notificationsFromAlertsIntegration.js`
- Modify: `app/imports/server/incidentsManagementSubsystem.js`
- Modify: `app/tests/main.js`
- Test: `app/imports/server/test/notificationsFromAlerts.test.js`

**Interfaces:**
- Consumes: `RobotAlerts`, `IncidentConfiguration` (`app/imports/lib/alerts.js`); `ALERT_STATUS_RESOLVED` (`app/imports/shared/alerts`); `COLLECTIONS` (`app/imports/shared/constants`); `ActionsEngine.getActionDefinitions(actionIds)` returning an object keyed by `_id`; `AlertsManager.addAlertsListener`.
- Produces:
  - `Notifications` (Mongo collection) and `ORIGIN_ROBOT_ALERT = 'robot_alert'`, exported from `app/imports/lib/notifications.js`.
  - `NotificationsFromAlertsIntegration` (default export) with `handleAlertEvent(alertMsg)`. Constructor accepts an optional actions engine: `new NotificationsFromAlertsIntegration(actionsEngine)`.
  - Notification doc shape: `{ _id, robotId, alertId, componentId, origin, severity, message, label, actions: [{ actionId, label }], ts }`.

- [ ] **Step 1: Create the Notifications collection**

Create `app/imports/lib/notifications.js` (copy the copyright header from `app/imports/server/incidentsFromAlertsIntegration.js`):

```javascript
/* <copyright header here> */

/**
 * In-app notifications.
 *
 * Robot-scoped (no company scope). Currently populated from open incidents that
 * carry manual actions; see server/notificationsFromAlertsIntegration.js.
 */
import { Mongo } from 'meteor/mongo';
import { COLLECTIONS } from '../shared/constants';

// Notifications generated from a robot alert / incident.
const ORIGIN_ROBOT_ALERT = 'robot_alert';

const Notifications = new Mongo.Collection(COLLECTIONS.NOTIFICATIONS);

export { Notifications, ORIGIN_ROBOT_ALERT };
```

- [ ] **Step 2: Write the failing listener test**

Create `app/imports/server/test/notificationsFromAlerts.test.js` (copy the copyright header):

```javascript
/* <copyright header here> */

/**
 * Tests for NotificationsFromAlertsIntegration:
 * open incident with manualActions creates a notification; resolve removes it.
 */
import { Meteor } from 'meteor/meteor';
import { expect } from 'chai';
import { keyBy } from 'lodash';
// ORO modules
import { resetDatabase } from './setup';
import { createRobot } from './configAPI';
import { RobotAlerts, IncidentConfiguration } from '../../lib/alerts';
import { Notifications } from '../../lib/notifications';
import { ICM_SEV_1 } from '../../shared/alerts';
import AlertsManager from '../alertsManager';
import NotificationsFromAlertsIntegration from '../notificationsFromAlertsIntegration';

if (!Meteor.isTest) {
  throw new Error('This is TEST code only');
}

const TRIGGER = 'batteryLow';
const EVENT = { name: 'Battery', level: 'error', message: 'battery critical' };

// A fake actions engine that resolves ids to definitions with labels.
const fakeEngine = (labelsById = {}) => ({
  getActionDefinitions: async (ids) => keyBy(
    ids.map((id) => ({ _id: id, label: labelsById[id] || id })), '_id'
  )
});

const seedDefinition = async (extra = {}) => IncidentConfiguration.insertAsync({
  _id: TRIGGER, triggerId: TRIGGER, label: 'Battery incident',
  error: { severity: ICM_SEV_1, ...(extra.error || {}) },
  warning: {},
  ok: {}
});

// Wire a fresh AlertsManager with only the notifications integration attached.
const wire = (engine) => {
  const mgr = new AlertsManager();
  mgr.removeAllAlertsListeners();
  const integration = new NotificationsFromAlertsIntegration(engine);
  mgr.addAlertsListener((...args) => integration.handleAlertEvent(...args));
  return mgr;
};

describe('NotificationsFromAlertsIntegration', () => {
  let robotId;
  beforeEach(async () => {
    await resetDatabase();
    robotId = await createRobot('r2d2');
  });
  afterEach(() => {
    new AlertsManager().removeAllAlertsListeners();
  });

  it('creates a notification with resolved action labels when an incident with manualActions opens', async () => {
    await seedDefinition({ error: { severity: ICM_SEV_1, manualActions: ['DockManual'] } });
    const mgr = wire(fakeEngine({ DockManual: 'Send to dock' }));
    await mgr.createAlert({ robotId, triggerId: TRIGGER, event: EVENT, source: 'status' });

    const notification = await Notifications.findOneAsync({ robotId });
    expect(notification).to.be.ok;
    expect(notification.origin).eq('robot_alert');
    expect(notification.actions).deep.eq([{ actionId: 'DockManual', label: 'Send to dock' }]);
    const alert = await RobotAlerts.findOneAsync({ robotId, componentId: TRIGGER });
    expect(notification.alertId).eq(alert._id);
  });

  it('creates no notification when the definition has no manualActions', async () => {
    await seedDefinition();
    const mgr = wire(fakeEngine());
    await mgr.createAlert({ robotId, triggerId: TRIGGER, event: EVENT, source: 'status' });
    expect(await Notifications.find({ robotId }).countAsync()).eq(0);
  });

  it('removes the notification when the incident resolves', async () => {
    await seedDefinition({ error: { severity: ICM_SEV_1, manualActions: ['DockManual'] } });
    const mgr = wire(fakeEngine());
    await mgr.createAlert({ robotId, triggerId: TRIGGER, event: EVENT, source: 'status' });
    expect(await Notifications.find({ robotId }).countAsync()).eq(1);
    await mgr.resolveAlert({ robotId, triggerId: TRIGGER });
    expect(await Notifications.find({ robotId }).countAsync()).eq(0);
  });

  it('does not duplicate notifications when an open incident updates', async () => {
    await seedDefinition({ error: { severity: ICM_SEV_1, manualActions: ['DockManual'] } });
    const mgr = wire(fakeEngine());
    await mgr.createAlert({ robotId, triggerId: TRIGGER, event: EVENT, source: 'status' });
    await mgr.createAlert({
      robotId, triggerId: TRIGGER, event: { ...EVENT, message: 'still critical' }, source: 'status'
    });
    expect(await Notifications.find({ robotId }).countAsync()).eq(1);
  });
});
```

Register the file: in `app/tests/main.js`, after the line importing `incidentsCreation.test.js` (line 24), add:

```javascript
import '../imports/server/test/notificationsFromAlerts.test.js'
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd app && ./tests-run.sh --once --grep "NotificationsFromAlertsIntegration"`
Expected: FAIL — `notificationsFromAlertsIntegration` module does not exist yet.

- [ ] **Step 4: Implement the listener**

Create `app/imports/server/notificationsFromAlertsIntegration.js` (copy the copyright header):

```javascript
/* <copyright header here> */

/**
 * Creates and removes in-app notifications in response to alert changes.
 *
 * When an open incident's definition declares manualActions for the alert's level,
 * a notification is upserted (keyed by alertId) carrying those actions as buttons.
 * The notification is removed when the incident resolves, or when no manual actions
 * are configured.
 *
 * Registered as an AlertsManager listener (see incidentsManagementSubsystem).
 */
import { RobotAlerts, IncidentConfiguration } from '../lib/alerts';
import { ALERT_STATUS_RESOLVED } from '../shared/alerts';
import { Notifications, ORIGIN_ROBOT_ALERT } from '../lib/notifications';
import ActionsEngine from './actions';

export default class NotificationsFromAlertsIntegration {
  constructor(actionsEngine) {
    this._actionsEngine = actionsEngine || new ActionsEngine();
  }

  handleAlertEvent = async (alertMsg) => {
    const alert = await RobotAlerts.findOneAsync({ _id: alertMsg?._id });
    if (!alert) {
      console.warn(`NotificationsFromAlertsIntegration could not find RobotAlert ${alertMsg?._id}`);
      return;
    }
    // A resolved incident has nothing to act on; drop any notification for it.
    if (alert.status === ALERT_STATUS_RESOLVED) {
      await Notifications.removeAsync({ alertId: alert._id });
      return;
    }
    const definition = await IncidentConfiguration.findOneAsync({ _id: alert.componentId });
    const actionIds = definition?.[alert.event?.level]?.manualActions;
    if (!actionIds?.length) {
      await Notifications.removeAsync({ alertId: alert._id });
      return;
    }
    const definitionsById = await this._actionsEngine.getActionDefinitions(actionIds);
    const actions = actionIds.map((actionId) => ({
      actionId,
      label: definitionsById[actionId]?.label || actionId
    }));
    await Notifications.upsertAsync(
      { alertId: alert._id },
      {
        $set: {
          robotId: alert.robotId,
          alertId: alert._id,
          componentId: alert.componentId,
          origin: ORIGIN_ROBOT_ALERT,
          severity: alert.severity,
          message: alert.message,
          label: alert.label,
          actions,
          ts: alert.ts
        }
      }
    );
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd app && ./tests-run.sh --once --grep "NotificationsFromAlertsIntegration"`
Expected: PASS — all 4 new tests.

- [ ] **Step 6: Register the listener in the subsystem**

In `app/imports/server/incidentsManagementSubsystem.js`, add the import after the `IncidentsFromAlertsIntegration` import (line 22):

```javascript
import NotificationsFromAlertsIntegration from './notificationsFromAlertsIntegration';
```

Inside `initIncidentsManagement()`, after the `incidentsFromAlertsIntegration` listener registration (line 30-32), add:

```javascript
  // Open incidents with manual actions surface as in-app notifications.
  const notificationsFromAlertsIntegration = new NotificationsFromAlertsIntegration();
  new AlertsManager().addAlertsListener(
    (...args) => notificationsFromAlertsIntegration.handleAlertEvent(...args)
  );
```

- [ ] **Step 7: Run the full incidents suite (regression check)**

Run: `cd app && ./tests-run.sh --once --grep "incidents"`
Expected: PASS — the creation engine, auto-actions, and notification listener tests all green (the new listener does not disturb existing incident creation, which seeds no manualActions).

- [ ] **Step 8: Commit**

```bash
cd /home/clari/oro
git add app/imports/lib/notifications.js \
        app/imports/server/notificationsFromAlertsIntegration.js \
        app/imports/server/incidentsManagementSubsystem.js \
        app/imports/server/test/notificationsFromAlerts.test.js \
        app/tests/main.js
git commit -m "feat(incidents): generate in-app notifications from incidents with manual actions

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Notifications publication and run/dismiss methods

**Files:**
- Create: `app/imports/server/notifications.js`
- Modify: `app/server/main.js`
- Modify: `app/tests/main.js`
- Test: `app/imports/server/test/notificationsMethods.test.js`

**Interfaces:**
- Consumes: `Notifications` (`app/imports/lib/notifications.js`); `RobotAlerts` (`app/imports/lib/alerts.js`); `ActionsEngine.runAction({ actionId, context, args, user })` (returns `undefined` on success, `{ errors }` on failure).
- Produces:
  - `NotificationsManager` (default export). Constructor accepts an optional actions engine: `new NotificationsManager(actionsEngine)`.
    - `dismiss({ notificationId })` -> removes the notification.
    - `runManualAction({ notificationId, actionId, user })` -> validates `actionId` is one of the notification's `actions`, runs it via the engine with `context: { robotId }`, throws `Meteor.Error('action-failed')` if the engine returns `{ errors }`, then pushes `{ actionId, userId: user?._id, ts }` onto the alert's `executedActions`. Returns the engine result.
  - Meteor publication `'notifications'` (optional `{ robotId }` filter) and methods `'notifications.dismiss'` / `'notifications.runManualAction'` that delegate to `NotificationsManager` after resolving `Meteor.userAsync()`.

- [ ] **Step 1: Write the failing manager test**

Create `app/imports/server/test/notificationsMethods.test.js` (copy the copyright header):

```javascript
/* <copyright header here> */

/**
 * Tests for NotificationsManager: running an allow-listed manual action as a user,
 * recording it on the alert, and dismissing notifications.
 */
import { Meteor } from 'meteor/meteor';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
// ORO modules
import { resetDatabase } from './setup';
import { RobotAlerts, ALERT_STATUS_NEW } from '../../lib/alerts';
import { Notifications, ORIGIN_ROBOT_ALERT } from '../../lib/notifications';
import { ICM_SEV_1 } from '../../shared/alerts';
import NotificationsManager from '../notifications';

chai.use(chaiAsPromised);
const { expect } = chai;

if (!Meteor.isTest) {
  throw new Error('This is TEST code only');
}

const USER = { _id: 'user-1', profile: { name: 'Clara' } };

// Seeds an open alert and a notification referencing it. Returns { alertId, notificationId }.
const seed = async ({ actions }) => {
  const alertId = await RobotAlerts.insertAsync({
    robotId: 'r2d2', componentId: 'batteryLow', status: ALERT_STATUS_NEW,
    ts: 1, message: 'battery critical', severity: ICM_SEV_1
  });
  const notificationId = await Notifications.insertAsync({
    robotId: 'r2d2', alertId, componentId: 'batteryLow', origin: ORIGIN_ROBOT_ALERT,
    severity: ICM_SEV_1, message: 'battery critical', label: 'Battery incident', actions, ts: 1
  });
  return { alertId, notificationId };
};

// A capturing fake actions engine. `result` is what runAction returns.
const fakeEngine = (result) => {
  const calls = [];
  return { calls, runAction: async (a) => { calls.push(a); return result; } };
};

describe('NotificationsManager', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('runs an allow-listed manual action as the given user and records it on the alert', async () => {
    const { alertId, notificationId } = await seed({ actions: [{ actionId: 'DockManual', label: 'Dock' }] });
    const engine = fakeEngine(undefined);
    await new NotificationsManager(engine).runManualAction({
      notificationId, actionId: 'DockManual', user: USER
    });
    expect(engine.calls).to.have.length(1);
    expect(engine.calls[0].actionId).eq('DockManual');
    expect(engine.calls[0].context).deep.eq({ robotId: 'r2d2' });
    expect(engine.calls[0].user._id).eq('user-1');
    const alert = await RobotAlerts.findOneAsync({ _id: alertId });
    expect(alert.executedActions).to.have.length(1);
    expect(alert.executedActions[0].actionId).eq('DockManual');
    expect(alert.executedActions[0].userId).eq('user-1');
  });

  it('rejects an action that is not on the notification', async () => {
    const { notificationId } = await seed({ actions: [{ actionId: 'DockManual', label: 'Dock' }] });
    const engine = fakeEngine(undefined);
    await expect(
      new NotificationsManager(engine).runManualAction({
        notificationId, actionId: 'DeleteEverything', user: USER
      })
    ).to.be.rejected;
    expect(engine.calls).to.have.length(0);
  });

  it('rejects when the actions engine reports errors', async () => {
    const { alertId, notificationId } = await seed({ actions: [{ actionId: 'DockManual', label: 'Dock' }] });
    const engine = fakeEngine({ errors: { args: true } });
    await expect(
      new NotificationsManager(engine).runManualAction({
        notificationId, actionId: 'DockManual', user: USER
      })
    ).to.be.rejected;
    const alert = await RobotAlerts.findOneAsync({ _id: alertId });
    expect(alert.executedActions || []).to.have.length(0);
  });

  it('dismiss removes the notification', async () => {
    const { notificationId } = await seed({ actions: [{ actionId: 'DockManual', label: 'Dock' }] });
    await new NotificationsManager().dismiss({ notificationId });
    expect(await Notifications.find({}).countAsync()).eq(0);
  });
});
```

Register the file: in `app/tests/main.js`, after the `notificationsFromAlerts.test.js` import added in Task 2, add:

```javascript
import '../imports/server/test/notificationsMethods.test.js'
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd app && ./tests-run.sh --once --grep "NotificationsManager"`
Expected: FAIL — the `notifications` server module does not exist yet.

- [ ] **Step 3: Implement the manager, publication, and methods**

Create `app/imports/server/notifications.js` (copy the copyright header):

```javascript
/* <copyright header here> */

/**
 * NotificationsManager plus the in-app notifications publication and methods.
 *
 * Manual actions run as the logged-in user (resolved from this.userId). An action
 * can only be run if it is one of the actions carried by the notification.
 */
import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';
// ORO modules
import { RobotAlerts } from '../lib/alerts';
import { Notifications } from '../lib/notifications';
import ActionsEngine from './actions';

export default class NotificationsManager {
  constructor(actionsEngine) {
    this._actionsEngine = actionsEngine || new ActionsEngine();
  }

  dismiss = async ({ notificationId }) => Notifications.removeAsync({ _id: notificationId });

  runManualAction = async ({ notificationId, actionId, user }) => {
    const notification = await Notifications.findOneAsync({ _id: notificationId });
    if (!notification) {
      throw new Meteor.Error('notification-not-found', `No notification ${notificationId}`);
    }
    const allowed = (notification.actions || []).some((a) => a.actionId === actionId);
    if (!allowed) {
      throw new Meteor.Error('action-not-allowed', `Action ${actionId} is not on this notification`);
    }
    const result = await this._actionsEngine.runAction({
      actionId,
      context: { robotId: notification.robotId },
      user
    });
    if (result?.errors) {
      throw new Meteor.Error('action-failed', JSON.stringify(result.errors));
    }
    await RobotAlerts.updateAsync(
      { _id: notification.alertId },
      { $push: { executedActions: { actionId, userId: user?._id, ts: Date.now() } } }
    );
    return result;
  };
}

// Publishes current in-app notifications, newest first. Optionally scoped to a robot.
Meteor.publish('notifications', function publishNotifications(options = {}) {
  const query = {};
  if (options && options.robotId) {
    query.robotId = options.robotId;
  }
  return Notifications.find(query, { sort: { ts: -1 } });
});

Meteor.methods({
  'notifications.dismiss': async function dismissNotification({ notificationId }) {
    check(notificationId, String);
    if (!this.userId) {
      throw new Meteor.Error('Unauthorized');
    }
    return new NotificationsManager().dismiss({ notificationId });
  },
  'notifications.runManualAction': async function runManualAction({ notificationId, actionId }) {
    check(notificationId, String);
    check(actionId, String);
    if (!this.userId) {
      throw new Meteor.Error('Unauthorized');
    }
    const user = await Meteor.userAsync();
    return new NotificationsManager().runManualAction({ notificationId, actionId, user });
  }
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd app && ./tests-run.sh --once --grep "NotificationsManager"`
Expected: PASS — all 4 new tests.

- [ ] **Step 5: Import the module at server startup**

In `app/server/main.js`, after the `initIncidentsManagement` import (line 56), add:

```javascript
import '../imports/server/notifications';
```

(Importing the module registers its publication and methods. `NotificationsManager` is the default export but the side-effecting import is what wires the publication/methods.)

- [ ] **Step 6: Run the full test suite**

Run: `cd app && ./tests-run.sh --once`
Expected: PASS — all green.

- [ ] **Step 7: Commit**

```bash
cd /home/clari/oro
git add app/imports/server/notifications.js \
        app/server/main.js \
        app/imports/server/test/notificationsMethods.test.js \
        app/tests/main.js
git commit -m "feat(incidents): add notifications publication and run/dismiss methods

notifications.runManualAction runs an allow-listed manual action as the logged-in
user via ActionsEngine and records it on the alert; notifications.dismiss removes a
notification. A 'notifications' publication exposes them to the client.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

- **Spec coverage:**
  - Config exposes `manualActions` (Task 1). ✅
  - `Notifications` collection in `lib/notifications.js` (Task 2, Step 1). ✅
  - `NotificationsFromAlertsIntegration` upserts on open, removes on resolve / no manual actions, registered in the subsystem (Task 2). ✅
  - Publication + `dismiss` + `runManualAction` (run as logged-in user, allow-list validated, records `executedActions`) (Task 3). ✅
  - Tests for all three units, registered in `app/tests/main.js` (Tasks 1-3). ✅
- **Out of scope confirmed absent:** no client UI, no external channels, no `ok`-level manual actions, no `dismissedTs` (dismiss removes; resolve auto-removes). ✅
- **Placeholder scan:** the only `<copyright header here>` markers are explicit instructions to copy the verbatim Apache header from an existing file; all logic is inline. No "TBD"/"handle errors"/"similar to". ✅
- **Type consistency:** `getActionDefinitions` returns a keyed object, read as `definitionsById[actionId]?.label` (Task 2). `runAction` returns `undefined`/`{ errors }`, checked as `result?.errors` (Task 3). Notification `actions` are `{ actionId, label }` everywhere (listener writes them, manager allow-lists by `actionId`, tests assert the shape). `NotificationsManager` constructor takes an optional engine in both the implementation and the tests. The `'notifications'` publication name matches what Branch 2's `useNotifications` will subscribe to. ✅
- **"entity"/companyId scrub:** none; notifications keyed by `robotId` + `alertId`. ✅
- **Risks at execution:** (1) `runManualAction` hard-validates `actionId` against the notification's list before running anything (test: "rejects an action that is not on the notification"). (2) Engine `{ errors }` is surfaced as a thrown `action-failed` and no `executedActions` entry is recorded (test: "rejects when the actions engine reports errors"). (3) Upsert keyed by `alertId` keeps it idempotent across repeated alert updates (test: "does not duplicate notifications when an open incident updates").
