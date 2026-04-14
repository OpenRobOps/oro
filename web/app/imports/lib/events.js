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
 * Events Utility file: shared with ingest
 * contains:
 *  - Constants for events, APIs, etc
 *  - Schemas for events
 *  - Utility Objects/Arrays
 */
import SimpleSchema from 'simpl-schema';
import { capitalizeString } from './util';

// Api endpoint to receive events queries
const EVENTS_API_PATH = '/api/v1/events';

// TODO(herchu) This constant MAY be configured via settings now. Support getting the right
const EVENT_FIELD_MODULE = 'module';
const EVENT_FIELD_TYPE = 'eventType';

const AUDIT_LOG_FILTERS = {
  [EVENT_FIELD_MODULE]: 'module',
  [EVENT_FIELD_TYPE]: 'eventType',
  userId: 'userId',
  robotId: 'robotId',
  actionId: 'actionId',
};

// Tags to use in events: EVENT_MODULES values are used in `module` field.
const EVENT_MODULES = {
  LOCK: 'lock',
  ACTION: 'action',
  INCIDENT: 'incident',
  ALERT: 'alert',
  SETTING: 'setting',
  MISSION: 'mission',
  TRAFFIC_MANAGEMENT: 'trafficManagement',
};

// Section names within the Settings module ("subtype" of EVENT_MODULES.SETTING)
const EVENT_SETTINGS_SECTION_NAMES = {
  ACTIONS: 'Actions',
  INCIDENTS: 'Incidents',
  ATTRIBUTES: 'Data Sources', // using "Attributes" module name, but different user facing label
  STATUS: 'Status',
  VISUALIZATION: 'Visualization',
  PERMISSIONS: 'Permissions', // All about Roles
  SYSTEM: 'System', // System settings
  MODULES: 'Modules', // For robot modules: topics, camera settings etc
  FLEET: 'Fleet', // Fleet settings (for now, used for removing robots)
  MISSIONS: 'Missions', // Mission Tracking settings (and in the future other Mission modules)
  TMZ: 'Traffic & Zones', // Traffic Management and zones
};

const EVENT_MODULES_ARRAY = Object.keys(EVENT_MODULES).map(mod => ({
  type: EVENT_FIELD_MODULE,
  value: EVENT_MODULES[mod],
  label: capitalizeString(EVENT_MODULES[mod] + ' events')
}));

// Labels to use in `eventType` field. They are defined here but modules are free to send any
// value; it is just recommended to keep them in a single place so we keep track of possible values.
const EVENT_TYPES = {
  LOCK_EXPIRED: 'lock.expired',
  LOCK_LOCKED: 'lock.locked',
  LOCK_UNLOCKED: 'lock.unlocked',
  ACTION_EXECUTED: 'action.executed',
  ACTION_FAILED: 'action.failed',
  INCIDENT_TRIGGER: 'incident.trigger',
  ALERT_TRIGGER: 'alert.trigger',
  SETTING_ADDED: 'setting.added',
  SETTING_REMOVED: 'setting.removed',
  SETTING_UPDATED: 'setting.updated',
  MISSION_DEFINITION_UPDATED: 'mission.definition.updated',
  MISSION_EXECUTED: 'mission.executed',
  MISSION_CANCELED: 'mission.canceled',
  MISSION_PAUSED: 'mission.paused',
  MISSION_RESUMED: 'mission.resumed',
  TRAFFIC_MANAGEMENT_ZONE_ENTERED: 'trafficManagement.zone.entered',
  TRAFFIC_MANAGEMENT_ZONE_EXITED: 'trafficManagement.zone.exited',
  TRAFFIC_MANAGEMENT_ZONE_STATE_CHANGED: 'trafficManagement.zone.stateUpdated',
};
const EVENT_TYPES_ARRAY = Object.keys(EVENT_TYPES).map(
  type => ({
    type: EVENT_FIELD_TYPE,
    value: EVENT_TYPES[type],
    label: capitalizeString(EVENT_TYPES[type].replace('.', ': '))
  })
);

// Used in alertsManager to identify actions triggered by the system.
// TODO deprecate this in favor of web/imports/shared/roles.js getSystemUser()
const SYSTEM_USER_ID = 'oro';
// Used to identify actions that do not have (for some reason) userId.
const UNKNOWN_USER_ID = 'UnknownUser';
// Used to identify actions that are triggered via webhook.
const EXTERNAL_USER_ID = 'ExternalUser';
// Used to identify actions that are triggered from slack.
const SLACK_USER_ID = 'SlackUser';

const TAGS_AND_FIELDS_WHITELIST = {
  [EVENT_MODULES.LOCK]: {
    includedTags: {
      robotId: true,
      userId: true,
      ts: true
    },
    includedFields: {
      robotName: true,
      userName: true,
      userEmail: true
    }
  },
  [EVENT_MODULES.ACTION]: {
    includedTags: {
      robotId: true,
      userId: true,
      ts: true,
      actionId: true,
      type: true
    },
    includedFields: {
      robotName: true,
      userName: true,
      userEmail: true,
      label: true,
      failureReason: true
    }
  },
  actionInsideAction: {
    includedFields: {
      // fields from RunScript
      fileName: true,
      args: true,
      executionId: true,
      // fields from PublishToTopic
      message: true,
      // fields from CameraToggles
      cameraNumber: true
    }
  },
  [EVENT_MODULES.INCIDENT]: {
    includedTags: {
      robotId: true,
      ts: true,
      triggerId: true
    },
    includedFields: {
      robotName: true
    }
  },
  incidentEvent: {
    includedFields: {
      name: true,
      level: true,
      formattedValue: true
    }
  },
  [EVENT_MODULES.ALERT]: {
    includedTags: {
      robotId: true,
      ts: true,
      triggerId: true
    },
    includedFields: {
      robotName: true
    }
  },
  alertEvent: {
    includedFields: {
      name: true,
      level: true,
      formattedValue: true
    }
  },
  [EVENT_MODULES.SETTING]: {
    includedTags: {
      settingGroupName: true,
      settingName: true,
      robotId: true,
      userId: true,
      ts: true,
    },
    includedFields: {
      robotName: true,
      userName: true,
      userEmail: true
    }
  },
  [EVENT_MODULES.MISSION]: {
    includedTags: {
      robotId: true,
      userId: true,
      missionDefinitionId: true,
      ts: true,
    },
    includedFields: {
      robotName: true,
      userName: true,
      userEmail: true,
      missionLabel: true,
      missionId: true,
    }
  },
  [EVENT_MODULES.TRAFFIC_MANAGEMENT]: {
    includedTags: {
      robotId: true,
      ts: true,
    },
    includedFields: {
      robotName: true,
      locationLabel: true,
      zoneLabel: true,
      zoneId: true,
      zoneState: true,
      robotInZoneIds: true,
      robotInZoneNames: true,
      robotIdsInZone: true,
      robotNamesInZone: true,
    }
  }
};

// Object to hold all the schemas for events
const EventSchemas = {};

// General Event schema
EventSchemas.Event = new SimpleSchema({
  module: String,
  eventType: String,
  ts: Number,
});

// User data: necessary info to identify a user
EventSchemas.UserData = new SimpleSchema({
  userId: String,
  userName: { type: String, optional: true },
  userEmail: { type: String, optional: true }
});

// Robot data: info needed to identify a robot
EventSchemas.RobotData = new SimpleSchema({
  robotId: String,
  robotName: { type: String, optional: true }
});
EventSchemas.OptionalRobotData = new SimpleSchema({
  robotId: { type: String, optional: true },
  robotName: { type: String, optional: true }
});

// Lock event: uses user data and robot data + a lock blackbox object for metadata
EventSchemas.LockEvent = new SimpleSchema({
  lock: {
    type: Object, blackbox: true
  }
});
EventSchemas.LockEvent.extend(EventSchemas.Event);
EventSchemas.LockEvent.extend(EventSchemas.UserData);
EventSchemas.LockEvent.extend(EventSchemas.RobotData);

EventSchemas.ActionEvent = new SimpleSchema({
  actionId: String,
  type: String,
  label: String,
  actionType: { type: String, optional: true },
  failureReason: { type: String, optional: true },
  action: {
    type: Object, blackbox: true, optional: true
  }
});
EventSchemas.ActionEvent.extend(EventSchemas.Event);
EventSchemas.ActionEvent.extend(EventSchemas.UserData);
EventSchemas.ActionEvent.extend(EventSchemas.RobotData);

EventSchemas.IncidentEvent = new SimpleSchema({
  triggerId: String,
  event: {
    type: Object, blackbox: true
  }
});
EventSchemas.IncidentEvent.extend(EventSchemas.Event);
EventSchemas.IncidentEvent.extend(EventSchemas.RobotData);

EventSchemas.AlertEvent = new SimpleSchema({
  triggerId: String,
  event: {
    type: Object, blackbox: true
  }
});
EventSchemas.AlertEvent.extend(EventSchemas.Event);
EventSchemas.AlertEvent.extend(EventSchemas.RobotData);

EventSchemas.SettingEvent = new SimpleSchema({
  settingGroupName: String,
  settingName: String
});
EventSchemas.SettingEvent.extend(EventSchemas.Event);
EventSchemas.SettingEvent.extend(EventSchemas.UserData);
// Normally settings are NOT about robots, but in some cases it may contain a robot
EventSchemas.SettingEvent.extend(EventSchemas.OptionalRobotData);

EventSchemas.MissionEvent = new SimpleSchema({
  missionLabel: { type: String, optional: true },
  missionId: { type: String, optional: true },
  missionDefinitionId: { type: String, optional: true },
});
EventSchemas.MissionEvent.extend(EventSchemas.Event);
EventSchemas.MissionEvent.extend(EventSchemas.UserData);
EventSchemas.MissionEvent.extend(EventSchemas.OptionalRobotData);

EventSchemas.TrafficManagementZoneEvent = new SimpleSchema({
  zoneId: String,
  zoneLabel: { type: String, optional: true },
  zoneState: { type: String, optional: true },
  robotId: { type: String, optional: true },
  robotName: { type: String, optional: true },
  robotInZoneIds: { type: Array, optional: true },
  'robotInZoneIds.$': String,
  robotInZoneNames: { type: Array, optional: true },
  'robotInZoneNames.$': String,
  locationLabel: { type: String, optional: true },
});
EventSchemas.TrafficManagementZoneEvent.extend(EventSchemas.Event);


/**
 * Helper function to return the ID from a User object, normally containing { _id, profile }
 * although also { userId } is supported.
 * If the provided object is null, it returns UNKNOWN_USER_ID (This is used in logging functions).
 *
 * @param {object} Optional, the user object.
 */
const getUserId = user => (
  (user && user.userId) || (user && user._id) || UNKNOWN_USER_ID
);
  
/**
 * Helper function to return a user from a User object, normally containing
 * { _id, profile }.
 * It selects profile.name field. If the user has no profile or no name, it returns null.
 *
 * @param {object} user Optional, the user object.
 */
const getUserName = user => (
  (user && user.profile && user.profile.name) || null
);

/**
 * Helper function to return a user email from a User object, normally containing
 * { _id, profile }.
 * It selects profile.name field. If the user has no profile or no email, it returns null.
 *
 * @param {object} user Optional, the user object.
 */
const getUserEmail = user => (
  (user && user.profile && user.profile.email) || null
);

/**
 * Helper function to return the three fields from users that get logged in event functions
 * for query and display from queries: { userId, userName, userEmail }. Any of the
 * fields in the user object can be missing (even the object can be null), and defaults will
 * be used. See getUserId, getUserName and getUserEmail.
 *
 * @param {object} user Optional, a user object.
 */
const getUserLoggingAttributes = user => ({
  userId: getUserId(user),
  userName: getUserName(user),
  userEmail: getUserEmail(user)
});
  
export {
  EventSchemas,
  EVENT_MODULES,
  EVENT_SETTINGS_SECTION_NAMES,
  EVENT_TYPES,
  EVENTS_API_PATH,
  EVENT_FIELD_MODULE,
  EVENT_FIELD_TYPE,
  AUDIT_LOG_FILTERS,
  EVENT_MODULES_ARRAY,
  EVENT_TYPES_ARRAY,
  SYSTEM_USER_ID,
  UNKNOWN_USER_ID,
  EXTERNAL_USER_ID,
  SLACK_USER_ID,
  TAGS_AND_FIELDS_WHITELIST,
  getUserId,
  getUserName,
  getUserEmail,
  getUserLoggingAttributes
};
