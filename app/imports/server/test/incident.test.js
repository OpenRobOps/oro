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
 * Incident model unit tests.
 */
import { Meteor } from 'meteor/meteor';
import { expect } from 'chai';
// ORO modules
import { resetDatabase } from './setup';
import {
  INCIDENT_STATUS_NEW, INCIDENT_STATUS_RESOLVED, RobotAlerts,
  ALERT_STATUS_NEW, getIncidentMessage
} from '../../lib/alerts';
import { ICM_SEV_1, ICM_SEV_2 } from '../../shared/alerts';
import Incident from '../model/incident';

// Just make sure this is not getting loaded in dev/prod
if (!Meteor.isTest) {
  throw new Error('This is TEST code only');
}

const ROBOT_ID = 'wall-e';

const ORIGINAL_EVENT = {
  name: 'ROS Diagnostics',
  level: 'error',
  message: 'current value = 2',
  attributeValue: 2,
  formattedValue: '2'
};

const OTHER_EVENT = {
  name: 'Another thing',
  level: 'warning',
  message: 'some message',
  attributeValue: 1,
  formattedValue: '1'
};

async function createAlert() {
  const alertId = await RobotAlerts.insertAsync({
    robotId: ROBOT_ID,
    event: ORIGINAL_EVENT,
    componentId: 'yyy',
    ts: Date.now(),
    status: ALERT_STATUS_NEW
  });
  return RobotAlerts.findOneAsync(alertId);
}

const baseIncidentArgs = (overrides = {}) => ({
  robotId: ROBOT_ID,
  severity: ICM_SEV_1,
  label: 'test',
  event: ORIGINAL_EVENT,
  componentsIds: ['yyy'],
  message: 'message',
  description: 'description',
  ...overrides
});

describe('incidents', () => {
  beforeEach(async () => {
    await resetDatabase();
    Incident.removeAllListeners();
  });
  afterEach(() => Incident.removeAllListeners());

  it('can be created and persisted', async () => {
    const incident = await Incident.create(baseIncidentArgs({
      message: 'some message', description: 'a description'
    }));

    expect(incident).instanceOf(Incident);
    expect(incident).to.not.have.property('resolvedAt');
    expect(incident.createdAt).instanceOf(Date);
    expect(incident.updatedAt).instanceOf(Date);
    expect(incident.status).eq(INCIDENT_STATUS_NEW);
    expect(incident.severity).eq(ICM_SEV_1);
    expect(incident.highestSeverity).eq(ICM_SEV_1);
    expect(incident.label).eq('test');
    expect(incident.robotId).eq(ROBOT_ID);
    expect(incident.originalEvent).deep.eq(ORIGINAL_EVENT);
    expect(incident.latestEvent).deep.eq(ORIGINAL_EVENT);
    expect(incident.componentsIds).deep.eq(['yyy']);
    expect(incident.message).eq('some message');
    expect(incident.description).eq('a description');

    const persisted = await Incident.load(incident._id);
    expect(persisted.robotId).eq(ROBOT_ID);
    expect(persisted.status).eq(INCIDENT_STATUS_NEW);
    expect(persisted.highestSeverity).eq(ICM_SEV_1);
    expect(persisted.originalEvent).deep.eq(ORIGINAL_EVENT);
    expect(persisted).to.not.have.property('resolvedAt');
  });

  it('links alerts to incidents (two-way)', async () => {
    const incident = await Incident.create(baseIncidentArgs());
    const alert = await createAlert();
    await incident.linkAlert(alert);
    expect(incident.alertsIds).contain(alert._id);
    const incidentFromDb = await Incident.load(incident._id);
    expect(incidentFromDb.alertsIds).contain(alert._id);
    const alertFromDb = await RobotAlerts.findOneAsync(alert._id);
    expect(alertFromDb.incidentsIds).contain(incident._id);
  });

  it('resolving sets status and resolvedAt, keeps originalEvent', async () => {
    const incident = await Incident.create(baseIncidentArgs());
    await incident.resolve({ event: OTHER_EVENT });
    const fromDb = await Incident.load(incident._id);
    expect(fromDb.resolvedAt).instanceOf(Date);
    expect(fromDb.status).eq(INCIDENT_STATUS_RESOLVED);
    expect(fromDb.originalEvent).deep.eq(ORIGINAL_EVENT);
    expect(fromDb.latestEvent).deep.eq(OTHER_EVENT);
    expect(fromDb.highestSeverity).eq(ICM_SEV_1);
  });

  it('updates fields and tracks highestSeverity', async () => {
    const incident = await Incident.create(baseIncidentArgs());
    await incident.update({
      severity: ICM_SEV_2, label: 'new label', event: OTHER_EVENT,
      message: 'new message', description: 'new description'
    });
    const fromDb = await Incident.load(incident._id);
    expect(fromDb.severity).eq(ICM_SEV_2);
    expect(fromDb.highestSeverity).eq(ICM_SEV_1); // SEV 1 more severe than SEV 2
    expect(fromDb.label).eq('new label');
    expect(fromDb.originalEvent).deep.eq(ORIGINAL_EVENT);
    expect(fromDb.latestEvent).deep.eq(OTHER_EVENT);
    expect(fromDb.status).eq(INCIDENT_STATUS_NEW);
    expect(fromDb.message).eq('new message');
  });

  it('reopening clears resolvedAt and sets status back to new', async () => {
    const incident = await Incident.create(baseIncidentArgs());
    await incident.resolve({ event: OTHER_EVENT });
    await incident.update({
      status: INCIDENT_STATUS_NEW, severity: ICM_SEV_1, label: 'l', event: OTHER_EVENT
    });
    const fromDb = await Incident.load(incident._id);
    expect(fromDb.resolvedAt).to.be.undefined;
    expect(fromDb.status).eq(INCIDENT_STATUS_NEW);
  });

  it('listeners receive create/update notifications with previous state', async () => {
    const notifications = [];
    Incident.addListener((incident, prev) => notifications.push({ incident, prev }));
    const incident = await Incident.create(baseIncidentArgs());
    expect(notifications[0]).deep.eq(
      { incident, prev: { prevStatus: undefined, prevSeverity: undefined } }
    );
    await incident.update({ status: INCIDENT_STATUS_NEW, severity: ICM_SEV_1, event: OTHER_EVENT });
    expect(notifications[1]).deep.eq(
      { incident, prev: { prevStatus: INCIDENT_STATUS_NEW, prevSeverity: ICM_SEV_1 } }
    );
    await incident.resolve();
    expect(notifications[2]).deep.eq(
      { incident, prev: { prevStatus: INCIDENT_STATUS_NEW, prevSeverity: ICM_SEV_1 } }
    );
    expect(notifications).to.have.length(3);
  });
});

describe('incidents utility functions', () => {
  beforeEach(async () => {
    await resetDatabase();
    Incident.removeAllListeners();
  });
  afterEach(() => Incident.removeAllListeners());

  it('getIncidentMessage returns the incident message when defined', async () => {
    const incident = await Incident.create(baseIncidentArgs({ message: 'some message' }));
    expect(getIncidentMessage(incident)).eq('some message');
  });

  it('getIncidentMessage falls back to the latest event message', async () => {
    const incident = await Incident.create(baseIncidentArgs({ message: undefined }));
    expect(getIncidentMessage(incident)).eq(ORIGINAL_EVENT.message);
  });
});
