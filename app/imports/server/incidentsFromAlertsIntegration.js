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
 * Creates and updates incidents in response to alert changes.
 *
 * Registered as an AlertsManager listener (see incidentsManagementSubsystem).
 */
import { RobotAlerts, getAlertMessage } from '../lib/alerts';
import { ALERT_STATUS_RESOLVED, INCIDENT_STATUS_NEW } from '../shared/alerts';
import Incident from './model/incident';

const getFirstLinkedIncident = (alert) => alert.incidentsIds?.[0];

export default class IncidentsFromAlertsIntegration {
  handleAlertEvent = async (alertMsg) => {
    const alert = await RobotAlerts.findOneAsync({ _id: alertMsg._id });
    if (!alert) {
      console.warn(`IncidentsFromAlertsIntegration could not find RobotAlert ${alertMsg?._id}`);
      return;
    }
    await this.processAlert(alert);
  };

  processAlert = async (alert) => {
    if (getFirstLinkedIncident(alert)) {
      await this._updateIncidentFromAlert(alert);
    } else {
      await this._createIncidentFromAlert(alert);
    }
  };

  _createIncidentFromAlert = async (alert) => {
    const incident = await Incident.create({
      ts: alert.ts,
      robotId: alert.robotId,
      componentsIds: [alert.componentId],
      severity: alert.severity,
      event: alert.event,
      label: alert.label,
      message: getAlertMessage(alert),
      description: alert.description,
      alias: alert.alias || alert._id
    });
    await incident.linkAlert(alert);
    return incident;
  };

  _updateIncidentFromAlert = async (alert) => {
    const incidentId = getFirstLinkedIncident(alert);
    if (!incidentId) {
      return null;
    }
    const incident = await Incident.load(incidentId);
    const alertLastUpdateTs = alert.resolvedTs || alert.updatedTs || alert.ts;
    const updateDate = alertLastUpdateTs ? new Date(alertLastUpdateTs) : new Date();
    if (alert.status === ALERT_STATUS_RESOLVED) {
      await incident.resolve({ event: alert.event, resolvedAt: updateDate });
    } else {
      await incident.update({
        severity: alert.severity,
        event: alert.event,
        label: alert.label,
        status: INCIDENT_STATUS_NEW,
        message: getAlertMessage(alert),
        description: alert.description,
        updateDate
      });
    }
    return incident;
  };
}
