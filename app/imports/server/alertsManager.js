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
 * Alerts manager.
 *
 * Receives alert create/resolve requests (from ingest via /peer/alerts), looks up
 * the global incident definition for the trigger, deduplicates / reopens alerts in
 * the RobotAlerts collection, and notifies listeners. Turning alerts into incidents
 * is done by listeners (see incidentsFromAlertsIntegration).
 *
 * NOTE: notifications (Slack/email/etc.) and auto/manual actions are intentionally
 * not handled here yet.
 */
import Robot from './model/robot';
import {
  RobotAlerts, IncidentConfiguration, getSeverityForAlert, maxSeverity
} from '../lib/alerts';
import { ALERT_STATUS_NEW, ALERT_STATUS_RESOLVED } from '../shared/alerts';

// Reopen window: if a problem clears and recurs within this window, the same alert
// is reused instead of opening a new one. Hardcoded (not configurable for now).
const ALERT_REOPEN_MINUTES = 10;
const ALERT_SOURCE_EXTERNAL = 'external';

let instance;
export default class AlertsManager {
  constructor() {
    // Singleton pattern
    if (instance === undefined) {
      instance = this;
      this._alertsListeners = [];
    }
    return instance;
  }

  addAlertsListener = (listener) => {
    this._alertsListeners.push(listener);
  };

  // Mainly for tests: drop all registered listeners.
  removeAllAlertsListeners = () => {
    this._alertsListeners = [];
  };

  _notifyAlertsListeners = async (alert, options = {}) => {
    for (const listener of this._alertsListeners) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await listener(alert, options);
      } catch (e) {
        console.warn(`Error on _notifyAlertsListeners for alert ${alert?._id}`, e);
      }
    }
  };

  // Incident definitions are global, keyed by triggerId.
  findIncidentDefinitionForTrigger = async (triggerId) => (
    IncidentConfiguration.findOneAsync({ _id: triggerId })
  );

  findRobotDetails = async (robotId) => {
    let robot;
    let robotName;
    try {
      robot = new Robot(robotId);
      robotName = await robot.getNameAsync();
    } catch (e) {
      console.warn(`Error retrieving robot ${robotId} details`);
    }
    return { robot, robotName };
  };

  buildIncidentLabel = ({ robotName, incidentDefinition, triggerId }) => {
    let label = incidentDefinition.label ? String(incidentDefinition.label) : String(triggerId);
    if (incidentDefinition.labelTemplate) {
      // Minimal template support: substitute {{robotName}}.
      label = String(incidentDefinition.labelTemplate)
        .replace(/\{\{\s*robotName\s*\}\}/g, robotName || '');
    }
    return label;
  };

  _buildAlertMessage = (robotName, event, label) => {
    if (!robotName) {
      return event?.message;
    }
    return `${robotName} - ${label}${event.message === label ? '' : `: ${event.message}`}`;
  };

  createAlert = async ({ robotId, triggerId, event, source, alias, ts = Date.now() }) => {
    const incidentDefinition = await this.findIncidentDefinitionForTrigger(triggerId);
    // Stop if there's no definition, or it's not defined for this event's level.
    if (!incidentDefinition?.[event.level]) {
      return false;
    }
    const { robotName } = await this.findRobotDetails(robotId);
    const label = this.buildIncidentLabel({ robotName, incidentDefinition, triggerId });
    const message = this._buildAlertMessage(robotName, event, label);
    const description = event?.message;

    let alert = await this._findOpenAlert({ robotId, componentId: triggerId, alias });
    if (alert) {
      await this._updateOpenAlert({ alert, event, incidentDefinition, label, message, description, ts });
    } else {
      alert = await this._findAlertToReopen(robotId, triggerId, alias, source);
      if (alert) {
        await this._reopenAlert({ alert, event, incidentDefinition, label, message, description, ts });
      } else {
        await this._createNewAlert({
          robotId, triggerId, alias, event, source, label, incidentDefinition, message, description, ts
        });
      }
    }
    return undefined;
  };

  resolveAlert = async ({ robotId, triggerId, alias, ts = Date.now() }) => {
    const alert = await this._findOpenAlert({ robotId, componentId: triggerId, alias });
    if (!alert) {
      return;
    }
    await RobotAlerts.updateAsync(
      { _id: alert._id },
      { $set: { status: ALERT_STATUS_RESOLVED, resolvedTs: ts } }
    );
    const resolved = await RobotAlerts.findOneAsync({ _id: alert._id });
    await this._notifyAlertsListeners(resolved);
  };

  _findOpenAlert = async ({ robotId, componentId, alias }) => {
    if (alias) {
      return RobotAlerts.findOneAsync({ robotId, alias, status: ALERT_STATUS_NEW });
    }
    return RobotAlerts.findOneAsync({ robotId, componentId, status: ALERT_STATUS_NEW });
  };

  _findAlertToReopen = async (robotId, triggerId, alias, source) => {
    if (source === ALERT_SOURCE_EXTERNAL) {
      return null;
    }
    const ageCutoff = Date.now() - ALERT_REOPEN_MINUTES * 60 * 1000;
    return RobotAlerts.findOneAsync(
      { robotId, componentId: triggerId, alias, source, resolvedTs: { $gte: ageCutoff } },
      { sort: [['resolvedTs', -1]] }
    );
  };

  _createNewAlert = async ({
    robotId, triggerId, alias, event, source, label, incidentDefinition, message, description, ts = Date.now()
  }) => {
    const severity = getSeverityForAlert({ incidentDefinition, level: event.level });
    const alertId = await RobotAlerts.insertAsync({
      robotId,
      componentId: triggerId,
      status: ALERT_STATUS_NEW,
      ts,
      message,
      description,
      event,
      source,
      label,
      severity,
      highestSeverity: severity,
      alias
    });
    const alert = await RobotAlerts.findOneAsync({ _id: alertId });
    await this._notifyAlertsListeners(alert);
  };

  _updateOpenAlert = async ({ alert, event, incidentDefinition, label, message, description, ts = Date.now() }) => {
    const severity = getSeverityForAlert({ incidentDefinition, level: event.level });
    const highestSeverity = maxSeverity(alert.severity, severity);
    const $set = {
      updatedTs: ts, event, message, description, label, severity, highestSeverity, status: ALERT_STATUS_NEW
    };
    if (!alert.originalEvent) {
      $set.originalEvent = alert.event;
    }
    await RobotAlerts.updateAsync({ _id: alert._id }, { $set, $unset: { resolvedTs: true } });
    const updated = await RobotAlerts.findOneAsync({ _id: alert._id });
    await this._notifyAlertsListeners(updated, { isUpdate: true });
  };

  _reopenAlert = async ({ alert, event, incidentDefinition, label, message, description, ts = Date.now() }) => {
    const severity = getSeverityForAlert({ incidentDefinition, level: event.level });
    const highestSeverity = maxSeverity(alert.severity, severity);
    const $set = {
      updatedTs: ts, event, message, description, label, severity, highestSeverity, status: ALERT_STATUS_NEW
    };
    if (!alert.originalEvent) {
      $set.originalEvent = alert.event;
    }
    await RobotAlerts.updateAsync({ _id: alert._id }, { $set, $unset: { resolvedTs: true } });
    const updated = await RobotAlerts.findOneAsync({ _id: alert._id });
    await this._notifyAlertsListeners(updated);
  };
}
