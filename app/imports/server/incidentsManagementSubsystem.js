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
 * Wires the incidents management subsystem: alerts feed incidents, and incident
 * changes are recorded in the event log.
 */
import AlertsManager from './alertsManager';
import IncidentsFromAlertsIntegration from './incidentsFromAlertsIntegration';
import IncidentsEventLog from './incidentsEventLog';
import EventLog from './eventLog/eventLogger';
import Incident from './model/incident';

export function initIncidentsManagement() {
  // Alerts create/update/resolve incidents.
  const incidentsFromAlertsIntegration = new IncidentsFromAlertsIntegration();
  new AlertsManager().addAlertsListener(
    (...args) => incidentsFromAlertsIntegration.handleAlertEvent(...args)
  );
  // Incident changes are logged to the event log.
  const incidentsEventLog = new IncidentsEventLog(new EventLog());
  Incident.addListener(incidentsEventLog.handleIncidentEvent);
}
