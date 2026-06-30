# Incident Notifications UI (Branch 2, Client) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface an open incident's manual actions as an in-app banner at the top of the app, toggled by a bell, with buttons that run the actions via the Branch 1 methods.

**Architecture:** Migrate the inorbit notifications UI into oro, adapted to oro's robot-scoped model: a presentational `Banner`, a `useNotifications(robotId)` hook over the Branch 1 `notifications` publication, and a `Notifications` container that scopes to the robot in view (`getRobotId(context)`) and wires action buttons to `notifications.runManualAction` / `notifications.dismiss`. Un-stub the `NotificationsClient` slot in `DashboardSelector` and add a bell toggle whose on/off state persists per user via `PreferencesManager`.

**Tech Stack:** Meteor 3, React, MUI 5 (`tss-react/mui`, `@mui/material`), `meteortesting:mocha` + `chai`.

## Global Constraints

- **Robot-scoped, single-tenant.** Never use `entity`/`entityId`/`entityType`/`companyId`. The banner shows notifications for the robot in view via `getRobotId(context)`.
- **In-app only.** No email / Google Chat / external channels.
- **Run via the Branch 1 methods.** Action buttons call `notifications.runManualAction({ notificationId, actionId })`; dismiss calls `notifications.dismiss({ notificationId })`. No client-side confirmation or argument prompts (configured manual actions are no-arg).
- **Copyright header** on every new file (copy verbatim from `app/imports/server/incidentsFromAlertsIntegration.js`); comments use `;` or `,`, never em dashes; always "ORO"/"InOrbit"; no abbreviations in identifiers.
- **Migration scrub:** drop `companyId`, billing/zeroData/InstallRobot origins, `ActionsButtons`, url-navigation, feature flags, and person names in `TODO`/`NOTE` comments from the migrated inorbit code.
- **Branch:** `incidents/notifications-ui` (created from `incidents/manual-actions`).
- **Tests:** oro's suite runs server-only by default (`TEST_CLIENT=0`). The one server unit (the bell preference) gets a `*.test.js` registered in `app/tests/main.js` and run with `cd app && ./tests-run.sh --once --grep "..."`. Client components are verified live: oro is running (`npm start`, hot-reload) and an incident notification can be created by POSTing to `/peer/alerts`.

## Confirmed facts

- Branch 1 (present in this branch's tree) provides: `Notifications` collection at `app/imports/lib/notifications.js`; publication `('notifications', { robotId })` returning `Notifications.find({ robotId }, { sort: { ts: -1 } })`; methods `notifications.runManualAction({ notificationId, actionId })` and `notifications.dismiss({ notificationId })`. Notification doc: `{ _id, robotId, alertId, componentId, origin: 'robot_alert', severity, message, label, actions: [{ actionId, label }], ts }`.
- `DashboardSelector.js` renders `{!muteNotifications && NotificationsClient && <NotificationsClient />}` and receives `context` from `useUrlContext()`. It already imports `useState`, `IconButton`. It does NOT import `Meteor` or `useTracker`.
- `dashboardSelector/index.js` stubs `const NotificationsClient = () => null;` with `// import NotificationsClient from '../Notifications'` commented above it.
- The current robot is read with `readRobotProp({ ctx: context, prop: CTX_PROPS.ROBOT_ID })` (`CTX_PROPS`, `readRobotProp` exported from `app/imports/lib/context.js`); this is what `RobotOfflineBar` wraps as `getRobotId(context)`.
- `PreferencesManager` (`app/imports/server/preferences.js`) has `getPreferences(key)` and `setPreferences(key, value)` over the `Preferences` collection (keyed by `_id: key`), and a `preferences` publication taking `{ keys }`. `setPreferences` applies `$set` per field, so writing `{ [userId]: bool }` merges without clobbering other users. The module currently registers only the publication (no `Meteor.methods`); it is imported at startup (via `server/lock.js`).
- `Preferences` is exported from `app/imports/lib/collections.js`. Severity color is `theme.palette.severityColor[severity]` (used in `IncidentList`).
- Severity values are `'SEV 0'`, `'SEV 1'`, `'SEV 2'`.

## File Structure

- **Create** `app/imports/client/oro/util/Banner/Banner.js` and `index.js` — presentational banner.
- **Create** `app/imports/client/oro/hooks/useNotifications.js` — subscribe + fetch.
- **Create** `app/imports/client/oro/Notifications/NotificationsComponent.js` and `index.js` — container + presentation wiring run/dismiss.
- **Modify** `app/imports/client/oro/dashboardSelector/index.js` — un-stub the slot.
- **Modify** `app/imports/client/oro/dashboardSelector/DashboardSelector/DashboardSelector.js` — bell toggle, read preference, pass `context` + `enabled`.
- **Modify** `app/imports/server/preferences.js` — add `preferences.setNotificationsBell` method.
- **Create** `app/imports/server/test/preferencesNotificationsBell.test.js` — per-user merge behavior.
- **Modify** `app/tests/main.js` — register the new test.

---

## Task 1: Per-user bell preference (server)

**Files:**
- Modify: `app/imports/server/preferences.js`
- Modify: `app/tests/main.js`
- Test: `app/imports/server/test/preferencesNotificationsBell.test.js`

**Interfaces:**
- Consumes: `PreferencesManager.setPreferences(key, value)` / `getPreferences(key)`; `Preferences` collection.
- Produces: Meteor method `preferences.setNotificationsBell(enabled: Boolean)` storing the flag under `Preferences` doc `_id: 'notificationsBell'`, field `[userId]`. Client reads `Preferences.findOne('notificationsBell')?.[userId]`.

- [ ] **Step 1: Write the failing test**

Create `app/imports/server/test/preferencesNotificationsBell.test.js` (copy the copyright header from `app/imports/server/incidentsFromAlertsIntegration.js`):

```javascript
/* <copyright header here> */

/**
 * Tests that the per-user notifications bell flag is stored under the shared
 * 'notificationsBell' preferences document without clobbering other users.
 */
import { Meteor } from 'meteor/meteor';
import { expect } from 'chai';
// ORO modules
import { resetDatabase } from './setup';
import PreferencesManager from '../preferences';

if (!Meteor.isTest) {
  throw new Error('This is TEST code only');
}

describe('preferences: notifications bell flag', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('stores a per-user flag and merges across users', async () => {
    const manager = new PreferencesManager();
    await manager.setPreferences('notificationsBell', { userOne: false });
    await manager.setPreferences('notificationsBell', { userTwo: true });
    const doc = await manager.getPreferences('notificationsBell');
    expect(doc.userOne).eq(false);
    expect(doc.userTwo).eq(true);
  });
});
```

Register the test: in `app/tests/main.js`, after the `notificationsMethods.test.js` import (added on Branch 1), add:

```javascript
import '../imports/server/test/preferencesNotificationsBell.test.js'
```

- [ ] **Step 2: Run the test to verify it fails or passes for the right reason**

Run: `cd app && ./tests-run.sh --once --grep "notifications bell flag"`
Expected: PASS already (this confirms `setPreferences` merges per-user fields, the storage approach the method relies on). If it FAILS, the storage assumption is wrong; stop and reconsider before adding the method.

- [ ] **Step 3: Add the method**

In `app/imports/server/preferences.js`, add the `check` import at the top (after the `meteor/meteor` import):

```javascript
import { check } from 'meteor/check';
```

After the `Meteor.publish('preferences', ...)` block (before `export default PreferencesManager;`), add:

```javascript
/**
 * Sets the current user's in-app notifications bell flag (whether the incident
 * notifications banner is shown). Stored under the shared 'notificationsBell'
 * document, keyed by userId, so users do not overwrite each other.
 */
Meteor.methods({
  'preferences.setNotificationsBell': async function setNotificationsBell(enabled) {
    check(enabled, Boolean);
    if (!this.userId) {
      throw new Meteor.Error('Unauthorized');
    }
    return new PreferencesManager().setPreferences('notificationsBell', { [this.userId]: enabled });
  }
});
```

- [ ] **Step 4: Run the test again**

Run: `cd app && ./tests-run.sh --once --grep "notifications bell flag"`
Expected: PASS. Then run the full suite to confirm no regressions: `cd app && ./tests-run.sh --once` — all green.

- [ ] **Step 5: Commit**

```bash
cd /home/clari/oro
git add app/imports/server/preferences.js app/imports/server/test/preferencesNotificationsBell.test.js app/tests/main.js
git commit -m "feat(notifications): add per-user notifications bell preference method

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Banner component (presentational)

**Files:**
- Create: `app/imports/client/oro/util/Banner/Banner.js`
- Create: `app/imports/client/oro/util/Banner/index.js`

**Interfaces:**
- Produces: default-exported `Banner` component. Props: `open: bool`, `message: node`, `actions: [{ label, onClick, disabled? }]`, `statusColor?: string`, `statusContent?: element`.

- [ ] **Step 1: Create the Banner**

Create `app/imports/client/oro/util/Banner/Banner.js` (copy the copyright header):

```javascript
/* <copyright header here> */

/**
 * Displays a banner across the top of the app, following ORO's design.
 * Used for in-app incident notifications; renders a message, a severity color
 * indicator, and one button per action provided.
 */
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { withStyles } from 'tss-react/mui';
import Collapse from '@mui/material/Collapse';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';

const styles = (theme) => ({
  container: {
    paddingLeft: '30px',
    paddingRight: '35px',
    borderRadius: '10px',
    overflow: 'hidden',
    boxShadow: `5px 5px 10px ${theme.palette.boxShadow.light}, -3px -3px 5px 1px ${theme.palette.boxShadow.white}`,
    backgroundColor: theme.palette.background.white,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    [theme.breakpoints.down('1240')]: {
      flexDirection: 'column'
    }
  },
  statusAndMessage: {
    display: 'flex',
    alignItems: 'center'
  },
  status: {
    textAlign: 'center',
    padding: '4px',
    minWidth: '35px',
    height: '32px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  message: {
    padding: theme.spacing(1),
    fontWeight: 700,
    fontSize: '14px'
  },
  actions: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center'
  },
  actionButton: {
    textTransform: 'none'
  }
});

class Banner extends PureComponent {
  render() {
    const {
      open, classes, message, actions, statusColor, statusContent
    } = this.props;
    return (
      <Collapse in={open} timeout={500}>
        <Grid
          container
          className={classes.container}
          style={{ borderBottom: statusColor ? `2px solid ${statusColor}` : undefined }}
        >
          <Grid item className={classes.statusAndMessage}>
            {statusColor && (
              <Grid item className={classes.status} style={{ backgroundColor: statusColor }}>
                {statusContent}
              </Grid>
            )}
            <Typography data-test="notifications-message" className={classes.message}>
              {message}
            </Typography>
          </Grid>
          <Grid item className={classes.actions}>
            {actions.map((action) => (
              <Button
                key={action.label}
                onClick={action.onClick}
                disabled={action.disabled}
                variant="outlined"
                size="small"
                className={classes.actionButton}
                data-test={`notification-action-${action.label}`}
              >
                {action.label}
              </Button>
            ))}
          </Grid>
        </Grid>
      </Collapse>
    );
  }
}

Banner.propTypes = {
  open: PropTypes.bool.isRequired,
  message: PropTypes.node.isRequired,
  actions: PropTypes.array.isRequired,
  statusColor: PropTypes.string,
  statusContent: PropTypes.element,
  classes: PropTypes.object
};

export default withStyles(Banner, styles, { withTheme: true });
```

Create `app/imports/client/oro/util/Banner/index.js` (copy the copyright header):

```javascript
/* <copyright header here> */

/**
 * Banner
 */
import Banner from './Banner';

export default Banner;
```

- [ ] **Step 2: Verify it compiles**

oro is running with hot-reload. Confirm the build is clean: tail the oro server log and check there are no rspack/compile errors for the new files.
Run: `tail -n 20 /tmp/claude-1000/-home-clari-oro/60075f87-a6a5-463e-b6bd-41c1ab3d81e6/scratchpad/oro-start.log`
Expected: no `ERROR`/`Failed to compile` lines referencing `Banner`; the app still serves (`curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/` returns `200`).

- [ ] **Step 3: Commit**

```bash
cd /home/clari/oro
git add app/imports/client/oro/util/Banner/
git commit -m "feat(notifications): add Banner component for in-app notifications

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: useNotifications hook

**Files:**
- Create: `app/imports/client/oro/hooks/useNotifications.js`

**Interfaces:**
- Consumes: `Notifications` collection (`app/imports/lib/notifications.js`); publication `('notifications', { robotId })`.
- Produces: default-exported `useNotifications(robotId)` returning `{ notifications: Array, isLoading: Boolean }`.

- [ ] **Step 1: Create the hook**

Create `app/imports/client/oro/hooks/useNotifications.js` (copy the copyright header):

```javascript
/* <copyright header here> */

/**
 * Subscribes to and returns the in-app notifications for a single robot,
 * newest first. Returns an empty list when no robot is in view.
 */
import { useTracker } from 'meteor/react-meteor-data';
import { Meteor } from 'meteor/meteor';
import { Notifications } from '../../../lib/notifications';

const useNotifications = (robotId) => useTracker(() => {
  if (!robotId) {
    return { notifications: [], isLoading: false };
  }
  const handle = Meteor.subscribe('notifications', { robotId });
  const isLoading = !handle.ready();
  const notifications = Notifications.find({ robotId }, { sort: { ts: -1 } }).fetch();
  return { notifications, isLoading };
}, [robotId]);

export default useNotifications;
```

- [ ] **Step 2: Verify it compiles**

Run: `tail -n 20 /tmp/claude-1000/-home-clari-oro/60075f87-a6a5-463e-b6bd-41c1ab3d81e6/scratchpad/oro-start.log`
Expected: no compile error referencing `useNotifications`; `http://localhost:3000/` returns `200`. (The hook is exercised in Task 4 / Task 6.)

- [ ] **Step 3: Commit**

```bash
cd /home/clari/oro
git add app/imports/client/oro/hooks/useNotifications.js
git commit -m "feat(notifications): add useNotifications hook (per-robot subscription)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Notifications container + presentation

**Files:**
- Create: `app/imports/client/oro/Notifications/NotificationsComponent.js`
- Create: `app/imports/client/oro/Notifications/index.js`

**Interfaces:**
- Consumes: `readRobotProp` + `CTX_PROPS` (`app/imports/lib/context.js`); `useNotifications(robotId)` (Task 3); `Banner` (Task 2); methods `notifications.runManualAction` / `notifications.dismiss` (Branch 1).
- Produces: default-exported `Notifications({ context, enabled })`. Renders nothing when `!enabled`, no robot in view, or no notifications; otherwise renders the newest notification as a `Banner`.

- [ ] **Step 1: Create the presentation component**

Create `app/imports/client/oro/Notifications/NotificationsComponent.js` (copy the copyright header):

```javascript
/* <copyright header here> */

/**
 * Renders a single incident notification as a banner, mapping its manual actions
 * to buttons that run via the notifications methods. Meteor-aware only through
 * Meteor.call for running and dismissing.
 */
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Meteor } from 'meteor/meteor';
import { useTheme } from '@mui/material/styles';
import Banner from '../util/Banner';

const NotificationsComponent = ({ notification }) => {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const runAction = (actionId) => {
    setBusy(true);
    setError(null);
    Meteor.call(
      'notifications.runManualAction',
      { notificationId: notification._id, actionId },
      (err) => {
        setBusy(false);
        if (err) {
          setError(err.reason || err.message);
        }
      }
    );
  };

  const dismiss = () => {
    Meteor.call('notifications.dismiss', { notificationId: notification._id });
  };

  const actions = (notification.actions || []).map((action) => ({
    label: action.label,
    onClick: () => runAction(action.actionId),
    disabled: busy
  }));
  actions.push({ label: 'Dismiss', onClick: dismiss, disabled: false });

  const statusColor = theme.palette.severityColor
    && theme.palette.severityColor[notification.severity];
  const message = error
    ? `${notification.message} (action failed: ${error})`
    : notification.message;

  return (
    <Banner
      open
      message={message}
      actions={actions}
      statusColor={statusColor}
    />
  );
};

NotificationsComponent.propTypes = {
  notification: PropTypes.object.isRequired
};

export default NotificationsComponent;
```

- [ ] **Step 2: Create the container**

Create `app/imports/client/oro/Notifications/index.js` (copy the copyright header):

```javascript
/* <copyright header here> */

/**
 * Notifications container.
 *
 * Scopes to the robot currently in view (from the URL context) and renders the
 * newest in-app notification, when notifications are enabled by the user.
 */
import React from 'react';
import PropTypes from 'prop-types';
// ORO modules
import { readRobotProp, CTX_PROPS } from '../../../lib/context';
import useNotifications from '../hooks/useNotifications';
import NotificationsComponent from './NotificationsComponent';

const Notifications = ({ context, enabled }) => {
  const robotId = readRobotProp({ ctx: context, prop: CTX_PROPS.ROBOT_ID });
  const { notifications } = useNotifications(robotId);
  if (!enabled || !notifications.length) {
    return null;
  }
  return <NotificationsComponent notification={notifications[0]} />;
};

Notifications.propTypes = {
  context: PropTypes.object,
  enabled: PropTypes.bool
};

export default Notifications;
```

- [ ] **Step 3: Verify it compiles**

Run: `tail -n 20 /tmp/claude-1000/-home-clari-oro/60075f87-a6a5-463e-b6bd-41c1ab3d81e6/scratchpad/oro-start.log`
Expected: no compile error referencing `Notifications`; `http://localhost:3000/` returns `200`.

- [ ] **Step 4: Commit**

```bash
cd /home/clari/oro
git add app/imports/client/oro/Notifications/
git commit -m "feat(notifications): add Notifications container wiring run/dismiss

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Un-stub the slot and add the bell toggle

**Files:**
- Modify: `app/imports/client/oro/dashboardSelector/index.js`
- Modify: `app/imports/client/oro/dashboardSelector/DashboardSelector/DashboardSelector.js`

**Interfaces:**
- Consumes: `Notifications` container (Task 4); method `preferences.setNotificationsBell` (Task 1); `Preferences` collection; `context` from `useUrlContext`.
- Produces: the banner rendered in the existing `NotificationsClient` slot, gated by a per-user bell toggle in the tabs bar.

- [ ] **Step 1: Un-stub `NotificationsClient`**

In `app/imports/client/oro/dashboardSelector/index.js`, replace these two lines:

```javascript
// import NotificationsClient from '../Notifications';
const NotificationsClient = () => null;
```

with:

```javascript
import NotificationsClient from '../Notifications';
```

(Leave the `NotificationsClient={NotificationsClient}` prop pass in `DashboardContainer` unchanged.)

- [ ] **Step 2: Add Meteor imports and the bell preference to DashboardSelector**

In `app/imports/client/oro/dashboardSelector/DashboardSelector/DashboardSelector.js`, add to the imports:

```javascript
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff';
import { Preferences } from '../../../../lib/collections';
```

Inside the `DashboardSelector` function component, after `const [context, setContext] = useUrlContext();`, add:

```javascript
  // Per-user toggle for showing the incident notifications banner. Defaults to on.
  const notificationsEnabled = useTracker(() => {
    const userId = Meteor.userId();
    Meteor.subscribe('preferences', { keys: ['notificationsBell'] });
    const pref = Preferences.findOne('notificationsBell');
    const value = pref && userId ? pref[userId] : undefined;
    return value === undefined ? true : value;
  }, []);

  const toggleNotifications = useCallback(() => {
    Meteor.call('preferences.setNotificationsBell', !notificationsEnabled);
  }, [notificationsEnabled]);
```

- [ ] **Step 3: Render the bell in the tabs bar**

In `DashboardSelector.js`, inside `<TabsContainer>`, after the `</StyledTabs>` closing tag (and before `</TabsContainer>`), add the bell button:

```javascript
          <IconButton
            onClick={toggleNotifications}
            size="small"
            aria-label="toggle notifications"
            data-test="notifications-bell"
          >
            {notificationsEnabled ? <NotificationsActiveIcon /> : <NotificationsOffIcon />}
          </IconButton>
```

- [ ] **Step 4: Pass `context` and `enabled` to the slot**

In `DashboardSelector.js`, replace:

```javascript
          {!muteNotifications
            && NotificationsClient && (
              <NotificationsClient />
          )}
```

with:

```javascript
          {!muteNotifications
            && NotificationsClient && (
              <NotificationsClient context={context} enabled={notificationsEnabled} />
          )}
```

- [ ] **Step 5: Verify it compiles**

Run: `tail -n 25 /tmp/claude-1000/-home-clari-oro/60075f87-a6a5-463e-b6bd-41c1ab3d81e6/scratchpad/oro-start.log`
Expected: no compile error; `http://localhost:3000/` returns `200`. Open the app (logged in) — the bell appears in the dashboard tabs bar and toggles between the active and off icons when clicked, and the choice survives a reload (persisted per user).

- [ ] **Step 6: Commit**

```bash
cd /home/clari/oro
git add app/imports/client/oro/dashboardSelector/index.js \
        app/imports/client/oro/dashboardSelector/DashboardSelector/DashboardSelector.js
git commit -m "feat(notifications): un-stub notifications slot and add bell toggle

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Live end-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Ensure a clean notification state**

Resolve any leftover demo incidents so the banner starts empty:

```bash
PEER="TWU872ftOYIyCL9oV9wE3WccVkq12yfN"
curl -s -X POST http://localhost:3000/peer/alerts -H "content-type: application/json" \
  -d "{\"peerKey\":\"$PEER\",\"robotId\":\"flatland-ros2\",\"triggerId\":\"batteryLow\",\"resolve\":true}" -w " %{http_code}\n"
```

- [ ] **Step 2: Fire a manual-action incident**

```bash
PEER="TWU872ftOYIyCL9oV9wE3WccVkq12yfN"
curl -s -X POST http://localhost:3000/peer/alerts -H "content-type: application/json" \
  -d "{\"peerKey\":\"$PEER\",\"robotId\":\"flatland-ros2\",\"triggerId\":\"batteryLow\",\"name\":\"Battery\",\"level\":\"error\",\"message\":\"Battery low: 12%\",\"source\":\"status\"}" -w " %{http_code}\n"
```

Expected: `200`, and a notification doc exists:
```bash
docker run --rm --network host mongo:7 mongosh mongodb://localhost:3001/meteor --quiet \
  --eval 'printjson(db.notifications.find({robotId:"flatland-ros2"},{_id:0,actions:1,message:1}).toArray())'
```

- [ ] **Step 3: Verify the banner in the browser**

In the app, with a dashboard whose context selects `flatland-ros2` (robot/ops dashboard) and the bell ON, the banner shows the message with two buttons (**Dock (nearest)**, **Charging**) plus **Dismiss**. Toggling the bell OFF hides it; ON shows it again.

- [ ] **Step 4: Run a manual action from the banner and confirm it executed**

Click **Dock (nearest)** in the banner. Confirm the action ran as the logged-in user and was recorded on the alert:
```bash
docker run --rm --network host mongo:7 mongosh mongodb://localhost:3001/meteor --quiet \
  --eval 'const a=db.robot_alerts.findOne({robotId:"flatland-ros2",componentId:"batteryLow"}); printjson(a.executedActions)'
```
Expected: an entry `{ actionId: 'DockAuto', userId: <the logged-in user id>, ts: <number> }`. The oro log shows `Action exec: Publish to topic flatland-ros2 dock`.

- [ ] **Step 5: Dismiss and confirm removal**

Click **Dismiss**. The banner disappears and the notification doc is gone:
```bash
docker run --rm --network host mongo:7 mongosh mongodb://localhost:3001/meteor --quiet \
  --eval 'print(db.notifications.find({robotId:"flatland-ros2"}).count())'
```
Expected: `0`.

- [ ] **Step 6: Resolve the demo incident**

```bash
PEER="TWU872ftOYIyCL9oV9wE3WccVkq12yfN"
curl -s -X POST http://localhost:3000/peer/alerts -H "content-type: application/json" \
  -d "{\"peerKey\":\"$PEER\",\"robotId\":\"flatland-ros2\",\"triggerId\":\"batteryLow\",\"resolve\":true}" -w " %{http_code}\n"
```

---

## Self-Review

- **Spec coverage:** Banner (Task 2), useNotifications (Task 3), container + run/dismiss wiring (Task 4), slot un-stub + bell + per-user preference + method + test (Tasks 1, 5), live verification (Task 6). All spec units map to a task. ✅
- **Placeholder scan:** the only `<copyright header here>` markers are explicit instructions to copy the verbatim Apache header; all component code is inline and complete. No "TBD"/"handle errors"/"similar to". ✅
- **Type consistency:** `useNotifications(robotId)` returns `{ notifications, isLoading }` (Task 3) and the container reads `.notifications` (Task 4). Banner props `{ open, message, actions:[{label,onClick,disabled}], statusColor, statusContent }` are produced by `NotificationsComponent` and consumed by `Banner` identically. The method name `preferences.setNotificationsBell` matches between Task 1 (definition) and Task 5 (call). `notifications.runManualAction` / `notifications.dismiss` and the `{ notificationId, actionId }` / `{ notificationId }` shapes match Branch 1. `readRobotProp({ ctx, prop: CTX_PROPS.ROBOT_ID })` matches `RobotOfflineBar`. ✅
- **"entity"/companyId scrub:** companyId, ActionsButtons, url-navigation, billing/zeroData origins all dropped from the migrated Banner/hook/container. ✅
- **Risks:** (1) the bell preference is shared-doc-per-user-field; the method writes only `{ [this.userId]: enabled }` so users do not clobber each other (Task 1 test covers the merge). (2) `runManualAction` errors surface in the banner message rather than being swallowed (Task 4). (3) The banner is per-robot; with no robot in context it renders nothing (intended). (4) Client compilation is the verification gate for the UI tasks since oro runs server-only tests; each UI task checks the live build log and the app still serving.
