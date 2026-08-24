/**
 * Copyright 2026 InOrbit, Inc.
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

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

  it('creates a notification with no action buttons when the definition has no manualActions', async () => {
    await seedDefinition();
    const mgr = wire(fakeEngine());
    await mgr.createAlert({ robotId, triggerId: TRIGGER, event: EVENT, source: 'status' });
    const notification = await Notifications.findOneAsync({ robotId });
    expect(notification).to.be.ok;
    expect(notification.actions).deep.eq([]);
  });

  it('keeps the notification when the level changes to one without manualActions', async () => {
    // warning declares a manual action, error does not (e.g. error auto-docks)
    await IncidentConfiguration.insertAsync({
      _id: TRIGGER, triggerId: TRIGGER, label: 'Battery incident',
      error: { severity: ICM_SEV_1 },
      warning: { severity: ICM_SEV_1, manualActions: ['DockManual'] },
      ok: {}
    });
    const mgr = wire(fakeEngine());
    await mgr.createAlert({
      robotId, triggerId: TRIGGER, event: { ...EVENT, level: 'warning' }, source: 'status'
    });
    expect((await Notifications.findOneAsync({ robotId })).actions).to.have.length(1);
    // Escalation to error: banner stays, buttons go away
    await mgr.createAlert({ robotId, triggerId: TRIGGER, event: EVENT, source: 'status' });
    const notification = await Notifications.findOneAsync({ robotId });
    expect(notification).to.be.ok;
    expect(notification.actions).deep.eq([]);
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
