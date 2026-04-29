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
 * Meteor-agnostic alerts library
*/
import { each, groupBy } from 'lodash';

const ALERT_STATUS_NEW = 'new';
const ALERT_STATUS_RESOLVED = 'resolved';
const ALERT_STATUS_OK = 'ok';

const INCIDENT_STATUS_NEW = 'new';
const INCIDENT_STATUS_RESOLVED = 'resolved';
const INCIDENT_STATUS_DISMISSED = 'dismissed';
const INCIDENT_STATUS_OK = 'OK';

const SEV0 = 'error';
const SEV1 = 'warning';
const SEV_OK = 'ok';
const SEV_ALL = [SEV0, SEV1, SEV_OK];

const ICM_NONE = 'none';
const ICM_SEV_0 = 'SEV 0';
const ICM_SEV_1 = 'SEV 1';
const ICM_SEV_2 = 'SEV 2';
const ICM_SEV_3 = 'SEV 3';
const ICM_SEV_ALL = [ICM_SEV_0, ICM_SEV_1, ICM_SEV_2, ICM_SEV_3];

const sortAlertsByRobotStatus = (incidentsArr, robotIds) => {
  // Sort alerts, first grouping them by robot (which should be pre-sorted)
  // then prioritized by their latest update, then time created and finally
  // if they got resolved or not
  const groups = groupBy(incidentsArr, 'robotId');
  let incidents = [];
  each(robotIds, (robotId) => {
    // filter robots that have no incidents
    if (groups[robotId]) {
      const robotsIncidents = groups[robotId].sort((a, b) => {
        const aTs = a.resolvedTs || a.updatedTs || a.ts;
        const bTs = b.resolvedTs || b.updatedTs || b.ts;
        // Both are resolved
        if (a.resolvedTs && b.resolvedTs) {
          return bTs - aTs;
        // One is resolved, prioritize unresolved one
        } else if (a.resolvedTs || b.resolvedTs) {
          return b.resolved ? -1 : 1;
        } else {
          // Neither is resolved, compare times
          return bTs - aTs;
        }
      });
      incidents = incidents.concat(robotsIncidents);
    }
  });
  return incidents;
};

const sortIncidentsByRobotStatus = (incidentsArr, robotIds) => {
  // Sort incidents, first grouping them by robot (which should be pre-sorted)
  // then prioritized by their latest update, then time created and finally
  // if they got resolved or not
  const groups = groupBy(incidentsArr, 'entityId');
  let incidents = [];
  each(robotIds, (robotId) => {
    // filter robots that have no incidents
    if (groups[robotId]) {
      const robotsIncidents = groups[robotId].sort((a, b) => {
        const aTs = a.resolvedAt || a.updatedAt || a.createdAt;
        const bTs = b.resolvedAt || b.updatedAt || b.createdAt;
        // Both are resolved
        if (a.resolvedAt && b.resolvedAt) {
          return bTs - aTs;
        // One is resolved, prioritize unresolved one
        } else if (a.resolvedAt || b.resolvedAt) {
          return b.resolvedAt ? -1 : 1;
        } else {
          // Neither is resolved, compare times
          return bTs - aTs;
        }
      });
      incidents = incidents.concat(robotsIncidents);
    }
  });
  return incidents;
};

/**
 * Returns an incident message. The message is read from the `message` attribute
 * or build from the incident's latest event if the attribute is not defined.
 *
 * @param {Object} incident
 */
const getIncidentMessage = incident => (incident && incident.message) || (incident && incident.latestEvent && incident.latestEvent.message);

/**
 * Returns an alert message. The message is read from the `message` attribute
 * or build from the alert's event if the attribute is not defined.
 *
 * @param {Object} alert
 */
const getAlertMessage = alert => alert.message || (alert.event && alert.event.message);

export {
  INCIDENT_STATUS_NEW,
  INCIDENT_STATUS_RESOLVED,
  INCIDENT_STATUS_DISMISSED,
  INCIDENT_STATUS_OK,
  ALERT_STATUS_NEW,
  ALERT_STATUS_RESOLVED,
  ALERT_STATUS_OK,
  sortIncidentsByRobotStatus,
  sortAlertsByRobotStatus,
  getIncidentMessage,
  getAlertMessage,
  SEV_OK,
  SEV0,
  SEV1,
  SEV_ALL,
  ICM_NONE,
  ICM_SEV_0,
  ICM_SEV_1,
  ICM_SEV_2,
  ICM_SEV_3,
  ICM_SEV_ALL,
};
