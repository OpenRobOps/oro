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
    ts: 1, message: 'battery critical', severity: ICM_SEV_1,
    event: { level: 'error', name: 'batteryLow', message: 'battery critical' }
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
