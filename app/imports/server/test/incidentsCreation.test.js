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
 * End-to-end tests for the incidents creation engine:
 * AlertsManager -> IncidentsFromAlertsIntegration -> Incident.
 */
import { Meteor } from 'meteor/meteor';
import { expect } from 'chai';
// ORO modules
import { resetDatabase } from './setup';
import { createRobot } from './configAPI';
import {
  RobotAlerts, Incidents, IncidentConfiguration, ALERT_STATUS_NEW, ALERT_STATUS_RESOLVED
} from '../../lib/alerts';
import { INCIDENT_STATUS_NEW, INCIDENT_STATUS_RESOLVED, ICM_SEV_1 } from '../../shared/alerts';
import { STATUS } from '../../shared/status';
import AlertsManager from '../alertsManager';
import IncidentsFromAlertsIntegration from '../incidentsFromAlertsIntegration';
import IncidentsEventLog from '../incidentsEventLog';
import Incident from '../model/incident';

if (!Meteor.isTest) {
  throw new Error('This is TEST code only');
}

const TRIGGER = 'batteryLow';
const EVENT = {
  name: 'Battery', level: 'error', message: 'battery critical', attributeValue: 2, formattedValue: '2%'
};

const seedDefinition = async () => IncidentConfiguration.insertAsync({
  _id: TRIGGER, triggerId: TRIGGER, label: 'Battery incident', error: { severity: ICM_SEV_1 }, warning: {}
});

const wire = () => {
  const mgr = new AlertsManager();
  mgr.removeAllAlertsListeners();
  Incident.removeAllListeners();
  const integration = new IncidentsFromAlertsIntegration();
  mgr.addAlertsListener((...args) => integration.handleAlertEvent(...args));
  return mgr;
};

describe('incidents creation engine', () => {
  let robotId;
  beforeEach(async () => {
    await resetDatabase();
    robotId = await createRobot('r2d2');
  });
  afterEach(() => {
    new AlertsManager().removeAllAlertsListeners();
    Incident.removeAllListeners();
  });

  it('does nothing when no definition exists for the trigger', async () => {
    const mgr = wire();
    const result = await mgr.createAlert({ robotId, triggerId: TRIGGER, event: EVENT, source: 'status' });
    expect(result).eq(false);
    expect(await RobotAlerts.find({}).countAsync()).eq(0);
    expect(await Incidents.find({}).countAsync()).eq(0);
  });

  it('creates an alert and an incident when a definition exists', async () => {
    await seedDefinition();
    const mgr = wire();
    await mgr.createAlert({ robotId, triggerId: TRIGGER, event: EVENT, source: 'status' });

    const alert = await RobotAlerts.findOneAsync({ robotId, componentId: TRIGGER });
    expect(alert.status).eq(ALERT_STATUS_NEW);
    expect(alert.severity).eq(ICM_SEV_1);

    const incident = await Incidents.findOneAsync({ robotId });
    expect(incident.status).eq(INCIDENT_STATUS_NEW);
    expect(incident.severity).eq(ICM_SEV_1);
    expect(incident.componentsIds).deep.eq([TRIGGER]);
    expect(incident.alertsIds).contain(alert._id);
    expect(alert.incidentsIds).contain(incident._id);
  });

  it('does not duplicate: re-firing updates the same alert and incident', async () => {
    await seedDefinition();
    const mgr = wire();
    await mgr.createAlert({ robotId, triggerId: TRIGGER, event: EVENT, source: 'status' });
    await mgr.createAlert({
      robotId, triggerId: TRIGGER, event: { ...EVENT, message: 'still critical' }, source: 'status'
    });
    expect(await RobotAlerts.find({ robotId }).countAsync()).eq(1);
    expect(await Incidents.find({ robotId }).countAsync()).eq(1);
  });

  it('resolves the incident when the alert resolves', async () => {
    await seedDefinition();
    const mgr = wire();
    await mgr.createAlert({ robotId, triggerId: TRIGGER, event: EVENT, source: 'status' });
    await mgr.resolveAlert({ robotId, triggerId: TRIGGER });

    const alert = await RobotAlerts.findOneAsync({ robotId, componentId: TRIGGER });
    expect(alert.status).eq(ALERT_STATUS_RESOLVED);
    const incident = await Incidents.findOneAsync({ robotId });
    expect(incident.status).eq(INCIDENT_STATUS_RESOLVED);
    expect(incident.resolvedAt).to.be.ok;
  });

  it('reopens a recently-resolved alert within the window (same incident)', async () => {
    await seedDefinition();
    const mgr = wire();
    await mgr.createAlert({ robotId, triggerId: TRIGGER, event: EVENT, source: 'status' });
    await mgr.resolveAlert({ robotId, triggerId: TRIGGER });
    // Fire again shortly after: should reopen the same alert, not create a new one.
    await mgr.createAlert({ robotId, triggerId: TRIGGER, event: EVENT, source: 'status' });

    expect(await RobotAlerts.find({ robotId }).countAsync()).eq(1);
    const alert = await RobotAlerts.findOneAsync({ robotId });
    expect(alert.status).eq(ALERT_STATUS_NEW);
    expect(await Incidents.find({ robotId }).countAsync()).eq(1);
    const incident = await Incidents.findOneAsync({ robotId });
    expect(incident.status).eq(INCIDENT_STATUS_NEW);
  });
});

describe('IncidentsEventLog', () => {
  const ACTIVE = {
    robotId: 'r2d2', componentsIds: ['batteryLow'], status: INCIDENT_STATUS_NEW,
    severity: ICM_SEV_1, latestEvent: { name: 'Battery', level: 'error', message: 'm' }
  };

  it('logs the real event level while the incident is active', async () => {
    const logged = [];
    const el = new IncidentsEventLog({ logIncident: async (a) => logged.push(a) });
    await el.handleIncidentEvent(ACTIVE, { prevStatus: undefined, prevSeverity: undefined });
    expect(logged).to.have.length(1);
    expect(logged[0].triggerId).eq('batteryLow');
    expect(logged[0].event.level).eq('error');
  });

  it('logs an OK-level event when the incident resolves', async () => {
    const logged = [];
    const el = new IncidentsEventLog({ logIncident: async (a) => logged.push(a) });
    await el.handleIncidentEvent(
      { ...ACTIVE, status: INCIDENT_STATUS_RESOLVED },
      { prevStatus: INCIDENT_STATUS_NEW, prevSeverity: ICM_SEV_1 }
    );
    expect(logged).to.have.length(1);
    expect(logged[0].event.level).eq(STATUS.OK.text);
  });

  it('does not log when neither status nor severity changed', async () => {
    const logged = [];
    const el = new IncidentsEventLog({ logIncident: async (a) => logged.push(a) });
    await el.handleIncidentEvent(ACTIVE, { prevStatus: INCIDENT_STATUS_NEW, prevSeverity: ICM_SEV_1 });
    expect(logged).to.have.length(0);
  });
});
