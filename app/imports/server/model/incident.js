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
 * Incident model.
 *
 * An incident represents a problem affecting a robot that needs attention.
 * Backed by the "incidents" collection.
 *
 * NOTE:Data is always backed by the collection and read/written every time
 * it is used.
 */
import { isArray, isEmpty } from 'lodash';
import Model from './model';
import { RobotAlerts, Incidents, maxSeverity } from '../../lib/alerts';
import { INCIDENT_STATUS_NEW, INCIDENT_STATUS_RESOLVED } from '../../shared/alerts';

export default class Incident extends Model {
  constructor(incidentId) {
    super(incidentId, Incidents);
  }

  static async load(incidentId) {
    const incident = new Incident(incidentId);
    await incident.loadFromDb();
    return incident;
  }

  async loadFromDb() {
    if (this._id) {
      // Load properties from the db to make them easily accessible
      const doc = await this._fetchAsync();
      Object.keys(doc).forEach((k) => { this[k] = this[k] || doc[k]; });
    }
  }

  /**
   * Adds a listener for any change in incidents. On incident creation or update
   * the listener is called with the incident and the previous status/severity.
   */
  static addListener(listener) {
    if (!Incident._listeners) {
      Incident._listeners = [];
    }
    Incident._listeners.push(listener);
  }

  /** Notifies listeners about an incident creation or update. */
  static notifyListeners = async (incident, { prevStatus, prevSeverity } = {}) => {
    if (!Incident._listeners) {
      return;
    }
    for (const listener of Incident._listeners) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await listener(incident, { prevStatus, prevSeverity });
      } catch (e) {
        console.warn(`There was an error notifying listener for incident ${incident?._id}`, e);
      }
    }
  };

  /** Removes all listeners. */
  static removeAllListeners() {
    Incident._listeners = [];
  }

  /**
   * Creates a new incident.
   *
   * @param {Object} params
   *  @param {String} params.robotId robot the incident is attached to
   *  @param {Array.<String>} params.componentsIds ids of components involved
   *  @param {String} params.severity ICM severity level
   *  @param {Object} params.event triggering event
   *  @param {String} params.label incident label
   *  @param {String} params.message incident message
   *  @param {String} params.description incident description
   *  @param {String} params.alias optional deduplication/external-system reference; if
   *    absent it is computed from the components
   *  @param {Number} params.ts incident start timestamp (ms)
   * @return {Promise<Incident>} the newly created incident
   */
  static async create({ robotId, componentsIds = [], severity, event, label, message,
    description, alias, ts }) {
    const now = ts ? new Date(ts) : new Date();
    if (!alias) {
      // All incidents have an alias so they can be deduplicated. See the index
      // created in app/imports/lib/alerts.js
      alias = isArray(componentsIds) && componentsIds.join();
    }
    const incidentDoc = {
      robotId,
      createdAt: now,
      updatedAt: now,
      componentsIds,
      status: INCIDENT_STATUS_NEW,
      severity,
      highestSeverity: severity,
      latestEvent: event,
      originalEvent: event,
      label,
      message,
      description,
      alias
    };
    const incidentId = await Incidents.insertAsync(incidentDoc);
    const incident = await Incident.load(incidentId);
    Incident.notifyListeners(incident);
    return incident;
  }

  /**
   * Creates a two-way link between an alert and this incident.
   * @param {Object} alert an alert document
   */
  linkAlert = async (alert) => {
    if (!this.alertsIds) {
      this.alertsIds = [];
    }
    if (!this.alertsIds.includes(alert._id)) {
      this.alertsIds.push(alert._id);
    }
    await Incidents.updateAsync({ _id: this.getId() }, { $addToSet: { alertsIds: alert._id } });
    // TODO: replace with alert.addLinkedIncident once alerts have a model class
    await RobotAlerts.updateAsync(
      { _id: alert._id },
      { $addToSet: { incidentsIds: this.getId() } }
    );
  };

  /**
   * Flags this incident as resolved.
   * @param {Object} [params]
   *  @param {Object} [params.event] event that triggered the resolution
   *  @param {Date} [params.resolvedAt] resolution date
   */
  resolve = async ({ event, resolvedAt = new Date() } = {}) => {
    await this.update({
      status: INCIDENT_STATUS_RESOLVED,
      event,
      resolvedAt,
      updateDate: resolvedAt
    });
  };

  /**
   * Updates severity, label, event, status, message, description and resolution
   * date. All fields are optional; absent fields keep their previous value.
   */
  update = async ({ severity, label, event, status, resolvedAt, message, description,
    updateDate = new Date() }) => {
    this.updatedAt = updateDate;
    const prevSeverity = this.severity;
    const prevStatus = this.status;
    this.severity = severity || this.severity;
    this.highestSeverity = maxSeverity(this.highestSeverity, this.severity);
    this.status = status || this.status;
    this.label = label || this.label;
    this.message = message || this.message;
    this.description = description || this.description;
    this.latestEvent = event || this.latestEvent;
    const $unset = {};
    const $set = {
      updatedAt: this.updatedAt,
      severity: this.severity,
      highestSeverity: this.highestSeverity,
      status: this.status,
      label: this.label,
      latestEvent: this.latestEvent,
      message: this.message,
      description: this.description
    };
    if (this.status == INCIDENT_STATUS_RESOLVED) {
      this.resolvedAt = resolvedAt || this.resolvedAt || new Date();
      $set.resolvedAt = this.resolvedAt;
    } else {
      delete this.resolvedAt;
      $unset.resolvedAt = 1;
    }
    const updateParams = { $set };
    if (!isEmpty($unset)) {
      updateParams.$unset = $unset;
    }
    const records = await Incidents.updateAsync(
      { _id: this.getId(), updatedAt: { $lte: this.updatedAt } },
      updateParams
    );
    if (records > 0) {
      Incident.notifyListeners(this, { prevStatus, prevSeverity });
    }
  };

  isResolved() {
    return this.status == INCIDENT_STATUS_RESOLVED;
  }
}
