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
 * Tests for AlertsDistribution driven end-to-end through AlertsManager.
 * A recording webhook client stands in for real HTTP delivery, so these tests
 * also exercise the level-changed signal on the alert update path.
 */
import { Meteor } from 'meteor/meteor';
import { expect } from 'chai';
// ORO modules
import { resetDatabase } from './setup';
import { createRobot } from './configAPI';
import { RobotAlerts, IncidentConfiguration, NotificationChannels } from '../../lib/alerts';
import { ICM_SEV_1, ICM_SEV_2 } from '../../shared/alerts';
import AlertsManager from '../alertsManager';
import AlertsDistribution from '../alertsDistribution';

if (!Meteor.isTest) {
  throw new Error('This is TEST code only');
}

const TRIGGER = 'batteryLow';
const ERROR_EVENT = {
  name: 'Battery', level: 'error', message: 'battery critical', attributeValue: 0.12, formattedValue: '12%'
};
const WARNING_EVENT = {
  name: 'Battery', level: 'warning', message: 'battery low', attributeValue: 0.3, formattedValue: '30%'
};

// A webhook client that records the (channel, payload) of every post instead of
// making a real request.
const recordingClient = () => {
  const calls = [];
  return {
    calls,
    post: async (channel, payload) => { calls.push({ channel, payload }); return true; }
  };
};

const seedChannel = (id, extra = {}) => NotificationChannels.insertAsync({
  _id: id, type: 'webhook', url: `https://hooks.example.com/${id}`, ...extra
});

const seedDefinition = async ({ error, warning, ok } = {}) => IncidentConfiguration.insertAsync({
  _id: TRIGGER,
  triggerId: TRIGGER,
  label: 'Battery incident',
  error: error || { severity: ICM_SEV_1 },
  warning: warning || { severity: ICM_SEV_2 },
  ok: ok || {}
});

// Wire a fresh AlertsManager with only the distribution listener attached.
const wire = (client) => {
  const mgr = new AlertsManager();
  mgr.removeAllAlertsListeners();
  const dist = new AlertsDistribution(client);
  mgr.addAlertsListener((...args) => dist.handleAlertEvent(...args));
  return mgr;
};

describe('AlertsDistribution', () => {
  let robotId;
  beforeEach(async () => {
    await resetDatabase();
    robotId = await createRobot('r2d2');
  });
  afterEach(() => {
    new AlertsManager().removeAllAlertsListeners();
  });

  it('posts to the level channels when an alert opens', async () => {
    await seedChannel('ops-webhook');
    await seedDefinition({ error: { severity: ICM_SEV_1, notificationChannels: ['ops-webhook'] } });
    const client = recordingClient();
    await wire(client).createAlert({ robotId, triggerId: TRIGGER, event: ERROR_EVENT, source: 'status' });

    expect(client.calls).to.have.length(1);
    expect(client.calls[0].channel._id).eq('ops-webhook');
    expect(client.calls[0].payload.status).eq('open');
  });

  it('does not post on a same-level update (value tick, no level change)', async () => {
    await seedChannel('ops-webhook');
    await seedDefinition({ error: { severity: ICM_SEV_1, notificationChannels: ['ops-webhook'] } });
    const client = recordingClient();
    const mgr = wire(client);
    await mgr.createAlert({ robotId, triggerId: TRIGGER, event: ERROR_EVENT, source: 'status' });
    await mgr.createAlert({
      robotId, triggerId: TRIGGER, event: { ...ERROR_EVENT, attributeValue: 0.11, formattedValue: '11%' }, source: 'status'
    });

    expect(client.calls).to.have.length(1);
  });

  it('posts again on escalation (warning to error)', async () => {
    await seedChannel('ops-webhook');
    await seedDefinition({
      error: { severity: ICM_SEV_1, notificationChannels: ['ops-webhook'] },
      warning: { severity: ICM_SEV_2, notificationChannels: ['ops-webhook'] }
    });
    const client = recordingClient();
    const mgr = wire(client);
    await mgr.createAlert({ robotId, triggerId: TRIGGER, event: WARNING_EVENT, source: 'status' });
    await mgr.createAlert({ robotId, triggerId: TRIGGER, event: ERROR_EVENT, source: 'status' });

    expect(client.calls).to.have.length(2);
    expect(client.calls[1].payload.status).eq('open');
    expect(client.calls[1].payload.severity).eq(ICM_SEV_1);
  });

  it('posts a resolved payload to the union of level channels on resolve', async () => {
    await seedChannel('ops-webhook');
    await seedChannel('ok-webhook');
    await seedDefinition({
      error: { severity: ICM_SEV_1, notificationChannels: ['ops-webhook'] },
      ok: { notificationChannels: ['ok-webhook'] }
    });
    const client = recordingClient();
    const mgr = wire(client);
    await mgr.createAlert({ robotId, triggerId: TRIGGER, event: ERROR_EVENT, source: 'status' });
    await mgr.resolveAlert({ robotId, triggerId: TRIGGER });

    const resolvedCalls = client.calls.filter(c => c.payload.status === 'resolved');
    expect(resolvedCalls.map(c => c.channel._id).sort()).deep.eq(['ok-webhook', 'ops-webhook']);
  });

  it('skips (and does not throw on) a channel id with no channel document', async () => {
    await seedDefinition({ error: { severity: ICM_SEV_1, notificationChannels: ['ghost'] } });
    const client = recordingClient();
    await wire(client).createAlert({ robotId, triggerId: TRIGGER, event: ERROR_EVENT, source: 'status' });

    expect(client.calls).to.have.length(0);
  });

  it('does not post when the level has no channels configured', async () => {
    await seedChannel('ops-webhook');
    await seedDefinition({ error: { severity: ICM_SEV_1 } });
    const client = recordingClient();
    await wire(client).createAlert({ robotId, triggerId: TRIGGER, event: ERROR_EVENT, source: 'status' });

    expect(client.calls).to.have.length(0);
  });

  it('posts to every channel when a level has multiple', async () => {
    await seedChannel('chan-a');
    await seedChannel('chan-b');
    await seedDefinition({ error: { severity: ICM_SEV_1, notificationChannels: ['chan-a', 'chan-b'] } });
    const client = recordingClient();
    await wire(client).createAlert({ robotId, triggerId: TRIGGER, event: ERROR_EVENT, source: 'status' });

    expect(client.calls.map(c => c.channel._id).sort()).deep.eq(['chan-a', 'chan-b']);
  });

  it('builds a self-describing payload', async () => {
    await seedChannel('ops-webhook');
    await seedDefinition({ error: { severity: ICM_SEV_1, notificationChannels: ['ops-webhook'] } });
    const client = recordingClient();
    await wire(client).createAlert({ robotId, triggerId: TRIGGER, event: ERROR_EVENT, source: 'status' });

    const alert = await RobotAlerts.findOneAsync({ robotId, componentId: TRIGGER });
    const p = client.calls[0].payload;
    expect(p.status).eq('open');
    expect(p.severity).eq(ICM_SEV_1);
    expect(p.robotId).eq(robotId);
    expect(p.componentId).eq(TRIGGER);
    expect(p.alertId).eq(alert._id);
    expect(p.value).eq(0.12);
    expect(p.formattedValue).eq('12%');
    expect(p.message).to.be.a('string');
    expect(p.ts).to.be.a('number');
  });
});
