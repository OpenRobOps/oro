/**
 * API wrapper for Event (Audit) Log. It is an thin wrapper over our events ingest log component.
 *
 * ** THIS MODULE IS SHARED WITH INGEST, DO NOT IMPORT METEOR-ONLY CODE HERE!
 *
 * Events can be any object. Also from this module some constants are exported to annotate
 * events always the same way, including { module, eventType }
 *
 * Current implementation is API-based, so this module simply collects batches of events and
 * performs the HTTP REST API calls. In the future this can be replaced by a queue-based
 * implementation, without changing this module's interface.
 */
import axios from 'axios';
// InOrbit Modules
import {
  EventSchemas,
  EVENTS_API_PATH,
  EVENT_MODULES,
  EVENT_TYPES,
  EVENT_FIELD_MODULE,
  EVENT_FIELD_TYPE,
  getUserLoggingAttributes
} from '../lib/events';

// Maximum number of events to send in a single API call batch
const MAX_EVENTS_PER_BATCH = 20;
// Period to wait until sending queued to the API, in milliseconds
const API_REQUEST_WAIT_MS = 100;

// Validators for all event types - used only in buildEvent
const EVENT_VALIDATORS = {
  [EVENT_MODULES.LOCK]: EventSchemas.LockEvent,
  [EVENT_MODULES.ACTION]: EventSchemas.ActionEvent,
  [EVENT_MODULES.INCIDENT]: EventSchemas.IncidentEvent,
  [EVENT_MODULES.ALERT]: EventSchemas.AlertEvent,
  [EVENT_MODULES.SETTING]: EventSchemas.SettingEvent,
  [EVENT_MODULES.COLLECTION]: EventSchemas.CollectionEvent,
  [EVENT_MODULES.MISSION]: EventSchemas.MissionEvent,
  [EVENT_MODULES.TRAFFIC_MANAGEMENT]: EventSchemas.TrafficManagementZoneEvent,
};

/**
 * Convenience method to build event objects, which should always have a `module` as source
 * and an `eventType` -- the rest is a freeform object, `data`.
 */
const buildEvent = (module, type, data) => {
  const event = {
    [EVENT_FIELD_MODULE]: module,
    [EVENT_FIELD_TYPE]: type,
    ...data
  };
  try {
    const schema = EVENT_VALIDATORS[module];
    if (!schema) {
      console.error('Unrecognized event module: ' + module, event);
      return null;
    }
    schema.validate(event);
    return event;
  } catch (error) {
    console.error('Failed validation of event', error);
    return null;
  }
};

let instance;
export default class EventLog {
  constructor() {
    // Singleton Pattern
    if (instance === undefined) {
      instance = this;
    }
    this.enabled = false;
    this.url = undefined; // set by init()
    this.peerKey = undefined; // set by init()
    // the events queue is a simple array, with a timer to send them with a short delay
    this.eventsQueue = [];
    this.requestTimer = null;
    this.loggedErrors = new Set();
    // eslint-disable-next-line no-constructor-return
    return instance;
  }

  /**
   * Starts the event log queue..
   */
  init = ({
    enabled, peerKey, service, url
  }) => {
    if (!enabled) {
      this.enabled = false;
      return;
    }
    // Find and configure the peer api server. Give preference to `service` field
    // for k8s autodiscovery. If found, it uses the virtual IP of that service
    // from environment variables.
    // When not given, use (if available) the URL from configuration, which likely
    // includes a real domain name and goes through external network interfaces.
    if (service) {
      const hostVar = service + '_SERVICE_HOST';
      const host = process.env[hostVar];
      console.log('Configuing event log API against service: ' + service
        + ', using variable ' + hostVar + '=' + host);
      if (!host) {
        throw new Error('Env var ' + hostVar + ' not found or without value');
      }
      this.url = `http://${host}:80`;
    } else if (url) {
      console.log('Configuring event log API from url: ' + url);
      this.url = url;
    } else {
      throw new Error('Unable to configure peer API; unknown config');
    }
    if (this.url.substr(this.url.length - 1) == '/') {
      this.url = this.url.substr(0, this.url.length - 1);
    }
    this.peerKey = peerKey;
    if (!this.peerKey) {
      throw new Error('peerKey not provided to eventLog');
    }
    // Enable the service just now
    this.enabled = true;
  };

  /**
   * Shutdown for the module. Sends any pending events and stop accepting further calls.
   */
  shutdown = async () => {
    this._doSendEvents(); // send any event pendign in the queue
    this.enabled = false;
  };

  /**
   * Sends an individual event. The API is written to work with multiple events, so
   * it ends up calling sendEvents()
   */
  sendEvent = data => this.sendEvents([data]);

  /**
   * Sends a batch of events.
   * The method is not async; but it does not need to. Events are simply queued to be sent
   * later.
   */
  sendEvents = (dataArray) => {
    if (!dataArray.length) {
      return;
    }
    if (!this.enabled) { // ignore
      for (const evt of dataArray) {
        if (!this.loggedErrors.has(evt.eventType)) {
          this.loggedErrors.add(evt.eventType);
          console.error('Event log: Not enabled! Missed recording event of type', evt.eventType);
        }
      }
      return;
    }
    const queue = this.eventsQueue;
    const now = Date.now(); // default ts for any event without it
    dataArray.forEach((evt) => {
      if (evt) {
        queue.push({ ts: now, ...evt });
      }
    });
    // If there are too many events already queued, send them now.
    // Otherwise set a timeout callback (or wait for it if already set)
    if (queue.length >= MAX_EVENTS_PER_BATCH) {
      this._doSendEvents();
    } else if (!this.requestTimer) {
      this.requestTimer = setTimeout(this._doSendEvents, API_REQUEST_WAIT_MS);
    }
  };

  /**
   * Sends all queued events. Called from a timeout or when the events queue grows too much
   */
  _doSendEvents = async () => {
    if (this.requestTimer) {
      clearTimeout(this._requestTimer);
      this.requestTimer = null;
    }
    if (!this.eventsQueue.length) {
      return false; // nothing to do. Don't do an API call
    }
    const events = this.eventsQueue;
    this.eventsQueue = [];

    try {
      const res = await axios.post(this.url + EVENTS_API_PATH, {
        events,
        peerKey: this.peerKey
      });
      return res && res.status % 100 == 2;
    } catch (error) {
      console.error(`Event log: Failed sending event (code: ${error.code}):`, error.message);
      return false;
    }
  };

  /**
   * Logs all actions that are executed through the actions module.
   * @param {string} robotId An id that univocally identifies a robot.
   * @param {object} action Contains the main info about the action to be logged.
   * @param {string} userId Used to link the action to a given user.
   * @param {object} userProfile Used to link the action to a given user.
   * @param {object} extraParams Contains complementary info about the action to be logged.
   */
  logExecutedAction = async (robot, action, user, extraParams) => {
    try {
      const ts = Date.now();
      const loggedAction = {};
      Object.assign(loggedAction, action);
      Object.assign(loggedAction, extraParams);
      this.sendEvent(buildEvent(EVENT_MODULES.ACTION, EVENT_TYPES.ACTION_EXECUTED, {
        ...getUserLoggingAttributes(user),
        robotId: robot._id,
        robotName: await robot.getNameAsync(),
        ts,
        // EVENT_MODULES.ACTION specific fields
        actionId: loggedAction.actionId,
        type: loggedAction.type,
        label: loggedAction.label,
        action: loggedAction
      }));
    } catch (e) {
      // We don't want to stop the action execution if for some reason
      // the logging fails.
    }
  };

  /**
   * Logs all incidents generated by the alertsManager module.
   * @param {object} robot Contains info about a robot.
   * @param {string} triggerId Identifies the data source on which the incident has happened.
   * @param {object} event Contains info about the incident to be logged.
   */
  logIncident = async ({
    robot, triggerId, event, ts = Date.now()
  }) => {
    try {
      this.sendEvent(buildEvent(EVENT_MODULES.INCIDENT, EVENT_TYPES.INCIDENT_TRIGGER, {
        robotId: robot._id,
        robotName: await robot.getNameAsync(),
        ts,
        // EVENT_MODULES.INCIDENT specific fields
        triggerId,
        event
      }));
    } catch (e) {
      // We don't want to stop the action execution if for some reason
      // the logging fails.
    }
  };

  /**
   * Logs all alerts generated by the alertsManager module.
   * @param {object} robot Contains info about a robot.
   * @param {string} triggerId Identifies the data source on which the alert has happened.
   * @param {object} event Contains info about the alert to be logged.
   */
  logAlert = async ({
    robot, triggerId, event
  }) => {
    // TODOto be re enabled
    return;
    try {
      this.sendEvent(buildEvent(EVENT_MODULES.ALERT, EVENT_TYPES.ALERT_TRIGGER, {
        robotId: robot._id,
        robotName: await robot.getNameAsync(),
        ts: Date.now(),
        triggerId,
        event
      }));
    } catch (e) {
      // We don't want to stop the action execution if for some reason
      // the logging fails.
    }
  };

  /**
   * Logs setting changes generated by the various modules that handles them.
   *
   * @param {string} settingGroupName A human readable string that identifies
   *     a settings section. Example: 'Incidents'.
   * @param {string} robotId (optional) The robot id, if this setting applies
   *     to a robot, for example tagging it
   * @param {string} robotName (optional) The robot name, if this setting
   *     applies to a robot (same as robotId)
   * @param {string} eventType Can be one of the options defined
   *     in web/lib/events.js at EVENT_TYPES (prefixed with SETTING_):
   *     e.g. "setting.added", "setting.removed", "setting.updated".
   * @param (object) data Is a module-dependent object with data representing
   *     what was added, modified, deleted; such as a diff of existing and
   *     new settings version.
   */
  logSetting = ({
    settingGroupName, settingName, user, eventType,
    robotId, robotName
  }) => {
    // TODO(herchu) Log this event change in data lake
    const ts = Date.now();
    this.sendEvent(buildEvent(EVENT_MODULES.SETTING, eventType, {
      settingGroupName,
      settingName,
      robotId,
      robotName,
      ts,
      ...getUserLoggingAttributes(user)
    }));
  };

  /**
   * Logs an action on Missions: defining, executing, cancelling, etc.
   *
   * @param {string} user A user doc from mongodb
   * @param {string} robotId (optional) The robot id, if this event applies to a robot (e.g.
   *     executing a mission)
   * @param {string} robotName (optional) The robot name, if this event applies to a robot
   *     (for example when launching a mission) (same as robotId)
   * @param {string} missionId (optional) The id of the mission being launched or cancelled
   * @param {string} missionLabel (optional) The label of the mission being defined, launched,
   *     cancelled, etc.
   * @param {string} eventType Can be one of the options defined
   *     in web/lib/events.js at EVENT_TYPES (prefixed with SETTING_):
   *     e.g. "mission.executed".
   */
  logMission = ({
    user,
    eventType,
    robotId,
    robotName,
    missionId,
    missionLabel
  }) => {
    const ts = Date.now();
    this.sendEvent(buildEvent(EVENT_MODULES.MISSION, eventType, {
      robotId,
      robotName,
      missionId,
      missionLabel,
      ts,
      ...getUserLoggingAttributes(user)
    }));
  };

  /**
   * Logs all events related to traffic management zones.
   *
   * @param {string} locationId The location ID.
   * @param {string} eventType The type of zone event (e.g., "zone.entered", "zone.exited").
   * @param {string} zoneId The unique identifier of the zone.
   * @param {string} zoneLabel The human-readable label of the zone.
   * @param {string} zoneState The current state of the zone.
   * @param {string} robotId The ID of the robot associated with the event.
   * @param {string} robotName The name of the robot associated with the event.
   * @param {string[]} robotInZoneIds The IDs of the robots currently in the zone.
   * @param {string[]} robotInZoneNames The names of the robots currently in the zone.
   * @param {number} ts The timestamp of the event (defaults to current time).
   */
  logZoneEvent = ({
    locationId,
    eventType,
    zoneId,
    zoneLabel,
    zoneState,
    robotId,
    robotName,
    robotInZoneIds,
    robotInZoneNames,
    locationLabel,
    ts = Date.now(),
  }) => {
    this.sendEvent(buildEvent(EVENT_MODULES.TRAFFIC_MANAGEMENT, eventType, {
      locationId,
      zoneId,
      zoneLabel,
      zoneState,
      robotId,
      robotName,
      robotInZoneIds,
      robotInZoneNames,
      locationLabel,
      ts,
    }));
  };
}

export {
  EVENT_TYPES,
  EVENT_MODULES,
  EVENT_FIELD_MODULE,
  EVENT_FIELD_TYPE,
  buildEvent,
};
