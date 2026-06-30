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
 * Logs incident status/severity changes to the event log.
 * Registered as an Incident listener (see incidentsManagementSubsystem).
 */
import Robot from './model/robot';
import { STATUS } from '../shared/status';
import { INCIDENT_STATUS_RESOLVED } from '../shared/alerts';

export default class IncidentsEventLog {
  constructor(eventLog) {
    this._eventLog = eventLog;
  }

  handleIncidentEvent = async (incident, { prevStatus, prevSeverity } = {}) => {
    // Only log when something meaningful changed (or on creation, where prev is undefined).
    if (incident.status === prevStatus && incident.severity === prevSeverity) {
      return;
    }
    const robot = new Robot(incident.robotId);
    const triggerId = incident.componentsIds?.[0];
    // On resolution, log an OK-level event so the audit log reads "is now ok"
    // (the incident keeps its last real event in latestEvent).
    const event = incident.status === INCIDENT_STATUS_RESOLVED
      ? { ...incident.latestEvent, level: STATUS.OK.text }
      : incident.latestEvent;
    await this._eventLog.logIncident({ robot, triggerId, event });
  };
}
