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
