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
 * Alerts/Incidents collections and helper functions
 */
import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import SimpleSchema from 'simpl-schema';
import {
  sortIncidentsByRobotStatus,
  sortAlertsByRobotStatus,
  getIncidentMessage,
  getAlertMessage,
  INCIDENT_STATUS_NEW,
  INCIDENT_STATUS_RESOLVED,
  INCIDENT_STATUS_DISMISSED,
  INCIDENT_STATUS_OK,
  ALERT_STATUS_NEW,
  ALERT_STATUS_RESOLVED,
  ALERT_STATUS_OK,
  ICM_SEV_ALL,
  ICM_SEV_1,
  ICM_SEV_2,
  SEV0
} from '../shared/alerts';
import { COLLECTIONS, ID_TYPE_ROBOT } from '../shared/constants';

const DISTRIBUTION_SLACK = 'slack';
const DISTRIBUTION_INORBIT = 'app';
const DISTRIBUTION_OPSGENIE = 'opsgenie';
const DISTRIBUTION_WEBHOOK = 'webhook';
const DISTRIBUTION_GOOGLE_CHAT = 'googleChat';
const DISTRIBUTION_EMAIL = 'email';
const DISTRIBUTION_ALL = [DISTRIBUTION_INORBIT, DISTRIBUTION_SLACK, DISTRIBUTION_OPSGENIE,
  DISTRIBUTION_WEBHOOK, DISTRIBUTION_GOOGLE_CHAT, DISTRIBUTION_EMAIL];

/**
 * Returns the severity to use for alerts from an incident definition and an
 * event level.
 * @param {Object} params
 *  @typedef {IncidentConfiguration} params.incidentDefinition
 *  @typedef {String} params.level Event level SEV0 or SEV1
 */
const getSeverityForAlert = ({ incidentDefinition, level }) => {
  const def = incidentDefinition[level];
  if (def && def.severity && ICM_SEV_ALL.includes(def.severity)) {
    // The incident definition specifies a valid severity for this level.
    return incidentDefinition[level].severity;
  }
  // No severity specified, use ICM_SEV_1 for error level, else ICM_SEV_2
  return level == SEV0 ? ICM_SEV_1 : ICM_SEV_2;
};

/**
 * Compares two ICM severities and returns the the most severe one.
 *
 * @param {String} severityA
 * @param {String} severityB
 */
const maxSeverity = (severityA, severityB) => {
  if (!severityA) return severityB;
  if (!severityB) return severityA;
  // Rely on lexicographical order, most severe is equivalent to first in
  // lexicographical order
  return severityA < severityB ? severityA : severityB;
};

const Schemas = {};

const IncidentConfiguration = new Mongo.Collection(COLLECTIONS.INCIDENT_DEFINITIONS);

/**
 * Schema used for validation of an incident Definition, not of a full document!
 * this schema only shows what each Incident object will contain, the full document
 * will be of the schema:
 *   <IncidentID>: Object, of schema defined below
 *   <IncidentID2>: Object, schema defined below
 *   <...>
 */
IncidentConfiguration.incidentElementSchema = new SimpleSchema({
  error: { type: Object, optional: false, defaultValue: {} },
  'error.distributions': Object,
  ['error.distributions.' + DISTRIBUTION_INORBIT]: { type: Boolean, defaultValue: true },
  ['error.distributions.' + DISTRIBUTION_OPSGENIE]: { type: Boolean, defaultValue: false },
  ['error.distributions.' + DISTRIBUTION_WEBHOOK]: { type: Boolean, defaultValue: false },
  ['error.distributions.' + DISTRIBUTION_GOOGLE_CHAT]: { type: Boolean, defaultValue: false },
  ['error.distributions.' + DISTRIBUTION_SLACK]: { type: SimpleSchema.oneOf(Array, Boolean), defaultValue: false },
  ['error.distributions.' + DISTRIBUTION_SLACK + '.$']: String,
  ['error.distributions.' + DISTRIBUTION_EMAIL]: { type: SimpleSchema.oneOf(Array, Boolean), optional: true },
  ['error.distributions.' + DISTRIBUTION_EMAIL + '.$']: String, // Email group name
  // List of action ids to run automatically when incident triggers
  'error.autoActions': { type: Array, optional: true },
  'error.autoActions.$': String,
  // List of action ids to offer as user options with incident notifications
  'error.manualActions': { type: Array, optional: true },
  'error.manualActions.$': String,
  // The severity of the error can be configured
  'error.severity': String,
  warning: { type: Object, optional: false, defaultValue: {} },
  'warning.distributions': Object,
  ['warning.distributions.' + DISTRIBUTION_INORBIT]: { type: Boolean, defaultValue: true },
  ['warning.distributions.' + DISTRIBUTION_OPSGENIE]: { type: Boolean, defaultValue: false },
  ['warning.distributions.' + DISTRIBUTION_WEBHOOK]: { type: Boolean, defaultValue: false },
  ['warning.distributions.' + DISTRIBUTION_GOOGLE_CHAT]: { type: Boolean, defaultValue: false },
  ['warning.distributions.' + DISTRIBUTION_SLACK]: { type: SimpleSchema.oneOf(Array, Boolean), defaultValue: false },
  ['warning.distributions.' + DISTRIBUTION_SLACK + '.$']: String,
  ['warning.distributions.' + DISTRIBUTION_EMAIL]: { type: SimpleSchema.oneOf(Array, Boolean), optional: true },
  ['warning.distributions.' + DISTRIBUTION_EMAIL + '.$']: String, // Email group name
  // List of action ids to run automatically when incident triggers
  'warning.autoActions': { type: Array, optional: true },
  'warning.autoActions.$': String,
  // List of action ids to offer as user options with incident notifications
  'warning.manualActions': { type: Array, optional: true },
  'warning.manualActions.$': String,
  // The severity of the warning can be configured
  'warning.severity': String,
  ok: { type: Object, optional: true, defaultValue: {} },
  'ok.distributions': Object,
  ['ok.distributions.' + DISTRIBUTION_INORBIT]: { type: Boolean, defaultValue: false },
  ['ok.distributions.' + DISTRIBUTION_OPSGENIE]: { type: Boolean, defaultValue: false },
  ['ok.distributions.' + DISTRIBUTION_WEBHOOK]: { type: Boolean, defaultValue: false },
  ['ok.distributions.' + DISTRIBUTION_GOOGLE_CHAT]: { type: Boolean, defaultValue: false },
  ['ok.distributions.' + DISTRIBUTION_SLACK]: { type: SimpleSchema.oneOf(Array, Boolean), defaultValue: false },
  ['ok.distributions.' + DISTRIBUTION_SLACK + '.$']: String,
  ['ok.distributions.' + DISTRIBUTION_EMAIL]: { type: SimpleSchema.oneOf(Array, Boolean), optional: true },
  ['ok.distributions.' + DISTRIBUTION_EMAIL + '.$']: String, // Email group name
  // List of action ids to run automatically when incident triggers
  'ok.autoActions': { type: Array, optional: true },
  'ok.autoActions.$': String,
  // List of action ids to offer as user options with incident notifications
  'ok.manualActions': { type: Array, optional: true },
  'ok.manualActions.$': String,
  label: { type: String, optional: true },
  // TriggerId will now hold the attributeId of who triggers this incident
  // When incidentDefinitions are expanded, this might change
  triggerId: String,
  // Optional template to generate labels, using custom_data values. For
  // example: "There was an incident in {{custom_data_source_name}}"
  labelTemplate: { type: String, optional: true },
}, {
  requiredByDefault: false,
  // Cleaning options for schema
  clean: {
    filter: true, // filter out keys passed that are not in schema
    autoConvert: false, // do NOT auto convert to schema type (doesn't turn false to [false])
    removeEmptyStrings: true, // turns "" to undefined
    trimStrings: true, // remove trailing white spaces
    getAutoValues: true, // inserts autoValues and default values if key is missing a value
  }
});

const RobotAlerts = new Mongo.Collection(COLLECTIONS.ROBOT_ALERTS);
if (Meteor.isDevelopment) {
  Schemas.robotAlerts = new SimpleSchema({
    // Creation timestamp, when the incident was first triggered
    // There is an index on this field, for efficient querying
    ts: Number,
    // Last time the alert was still occurring while in 'new' status
    updatedTs: { type: Number, optional: true },
    // Timestamp when this incident was closed (auto-resolved, or dismissed by user)
    // NOTE There is a TTL index on this field! So setting this field (even to null) qualifieds the document for expiration!
    resolvedTs: { type: Number, optional: true },
    // Robot Id
    robotId: String,
    // Computer-readable unique-by-robot identifier of the erroring component
    componentId: String,
    // two options (new, cleared) (More options can be supported in the future; refer to alerts.js)
    status: String,
    // Triggering event information
    event: Object,
    'event.level': String, // (warning, error, fatal)
    'event.name': String,
    'event.message': String,
    'event.attributeValue': { type: SimpleSchema.oneOf(Number, Boolean, Date, String), optional: true }, // NOTE: Order matters! if String comes first, numbers are saved as strings
    'event.formattedValue': { type: String, optional: true },
    // Original event information, in case `event` was updated
    originalEvent: { type: Object, optional: true },
    'originalEvent.level': String, // (warning, error, fatal)
    'originalEvent.name': String,
    'originalEvent.message': String,
    'originalEvent.attributeValue': { type: SimpleSchema.oneOf(Number, Boolean, Date, String), optional: true }, // NOTE: Order matters! if String comes first, numbers are saved as strings
    'originalEvent.formattedValue': { type: String, optional: true },
    // source: agent, analytics, user, server, ...)
    source: { type: String, optional: true },
    // label from incident definition
    label: { type: String, optional: true },
    // (manual) actions to be offered to users when notifying this incident
    actions: { type: Array, optional: true },
    'actions.$': { type: Object, blackbox: true },
    // Id of the slack messages associated to this incident
    slackMsgIds: { type: Object, optional: true, blackbox: true },
    // 'slackMsgIds.channelId': Array,
    // 'slackMsgIds.channelId.$': String,
    executedActions: { type: Array, optional: true },
    'executedActions.$': { type: Object, optional: true, blackbox: true },
    // { actionId: , slackResultSring: }
    // HACK(adamantivm) Used to flag manually fixed assist incidents
    // @see https://inorbit.atlassian.net/browse/IO-369
    hackAssistUpdated: { type: Boolean, optional: true },
    // Incidents linked to this alert
    incidentsIds: { type: Array, optional: true },
    'incidentsIds.$': { type: String },
    message: { type: String, optional: true },
    description: { type: String, optional: true },
    severity: { type: String, optional: true },
    highestSeverity: { type: String, optional: true },
    alias: { type: String, optional: true }, // maps InOrbit alerts to external Incident management systems IDs
  }, { requiredByDefault: true });
  RobotAlerts.attachSchema(Schemas.robotAlerts);
}
if (Meteor.isServer) {
  // Main index to guarantee uniqueness of a "new" alert on a given componentId with the same alias
  RobotAlerts.rawCollection().createIndex({ robotId: 1, componentId: 1, status: 1, alias: 1 },
    { unique: true, partialFilterExpression: { status: { $eq: "new" } } });

  // Unique "new" alert for a robot and alias
  RobotAlerts.rawCollection().createIndex({ robotId: 1, status: 1, alias: 1 },
    { unique: true, partialFilterExpression: { alias: { $exists: 1 }, status: { $eq: "new" } } });

  // Index for efficiently querying list of last (sorted by ts) incidents created for a set of entities (and allow pagination)
  RobotAlerts.rawCollection().createIndex({ ts: -1, robotId: 1 });
  // TTL index for removal of documents already resolved after 60 days
  RobotAlerts.rawCollection().createIndex({ resolvedTs: 1 }, { expireAfterSeconds: 86400 * 60 });
}

// Email integration schema stored in AlertsConfig.integrations.email
// Used for development schema validation only
const EmailIntegrationSchema = new SimpleSchema({
  name: { type: String },
  addresses: { type: Array },
  'addresses.$': { type: Object },
  'addresses.$.address': { type: String },
  timezone: { type: String, optional: true }
});

// Alerts and Incident Configurations
const AlertsConfig = new Mongo.Collection(COLLECTIONS.ALERTS_CONFIG);
if (Meteor.isDevelopment) {
  Schemas.alertsConfig = new SimpleSchema({
    // Alert system generalized settings
    createAlerts: Boolean,
    opsgenieEnabled: Boolean,
    opsgenieConfigured: Boolean,
    slackEnabled: Boolean,
    slackConfigured: Boolean,
    webhookEnabled: Boolean,
    webhookConfigured: Boolean,
    incidentsRestApiEnabled: Boolean,
    googleChatEnabled: Boolean,
    googleChatConfigured: Boolean,
    // Optional flag determining if an alert being triggered shortly after
    // a similar incident is considered to be the same incident. By default,
    // (if value is absent) there is a 10 (minutes) timeout that prevents
    // from creating too many incident objects in a robot is entering and leaving
    // an error/alert condition continously.
    // We configure this flag manually for some customers if they don't want
    // this feature. A value <=0 disables "reopening" feature completely.
    incidentReopenTimeoutMinutes: { type: Number, optional: true },

    // SENSITIVE INFORMATION: configurations for the different integrations
    integrations: Object,
    // Slack integration
    'integrations.slackId': String,
    // Simple array of the channel names
    'integrations.slackChannels': Array,
    'integrations.slackChannels.$': String,
    // Objects of channel names as keys and channel ids as values
    'integrations.slackChannelIds': { type: Object, blackbox: true },
    'integrations.slackConfig': Object,
    'integrations.slackConfig.appToken': String,
    'integrations.slackConfig.scope': String,
    'integrations.slackConfig.appInfo': Object,
    'integrations.slackConfig.appInfo._id': String,
    'integrations.slackConfig.appInfo.teamName': String,
    'integrations.slackConfig.appInfo.teamId': String,
    'integrations.slackConfig.webHook': Object,
    'integrations.slackConfig.webHook.channel': String,
    'integrations.slackConfig.webHook.channel_id': String,
    'integrations.slackConfig.webHook.configuration_url': String,
    'integrations.slackConfig.webHook.url': String,
    'integrations.slackConfig.botInfo': Object,
    'integrations.slackConfig.botInfo._id': String,
    'integrations.slackConfig.botInfo.token': String,
    'integrations.opsgenieConfig': { type: Object, optional: true },
    'integrations.opsgenieConfig.apiKey': String,
    // OpsGenie endpoint host: US or EU. Integration service default is US.
    'integrations.opsgenieConfig.host': { type: String, optional: true },
    'integrations.opsgenieIncomingConfig': { type: Object, optional: true },
    'integrations.opsgenieIncomingConfig.token': String,
    'integrations.webhookConfig': { type: Object, optional: true },
    'integrations.webhookConfig.host': String,
    'integrations.webhookConfig.apiKey': String,
    'integrations.googleChatConfig': { type: Object, optional: true },
    'integrations.googleChatConfig.endpoint': String,
    'integrations.emailConfig': { type: Object, optional: true },
    'integrations.emailConfig.groups': { type: Array, optional: true },
    'integrations.emailConfig.groups.$': EmailIntegrationSchema,
  }, { requiredByDefault: false });
  AlertsConfig.attachSchema(Schemas.alertsConfig);
}

const Incidents = new Mongo.Collection(COLLECTIONS.INCIDENTS);
if (Meteor.isDevelopment) {
  Schemas.incidents = new SimpleSchema({
    _id: String,
    createdAt: Date,
    updatedAt: { type: Date, optional: true },
    // Expiration time is set to 60 days after resolution
    resolvedAt: { type: Date, optional: true },
    // Alerts linked to this incident
    alertsIds: { type: Array, optional: true },
    'alertsIds.$': { type: String },
    // Robot associated with the incident
    robotId: String,
    // Components affected by the incident
    componentsIds: { type: Array, optional: true },
    'componentsIds.$': { type: String },
    // two options (new, cleared) (More options will be supported in the future; refer to alerts.js)
    status: String,
    // Severity of the incident
    severity: String,
    // Triggering event information
    latestEvent: Object,
    'latestEvent.level': String, // (warning, error, fatal)
    'latestEvent.name': String,
    'latestEvent.message': String,
    'latestEvent.attributeValue': { type: SimpleSchema.oneOf(Number, Boolean, Date, String), optional: true }, // NOTE: Order matters! if String comes first, numbers are saved as strings
    'latestEvent.formattedValue': { type: String, optional: true },
    // Original event information, in case `latestEvent` was updated
    originalEvent: { type: Object, optional: true },
    'originalEvent.level': String, // (warning, error, fatal)
    'originalEvent.name': String,
    'originalEvent.message': String,
    'originalEvent.attributeValue': { type: SimpleSchema.oneOf(Number, Boolean, Date, String), optional: true }, // NOTE: Order matters! if String comes first, numbers are saved as strings
    'originalEvent.formattedValue': { type: String, optional: true },
    // label from incident definition
    label: { type: String, optional: true },
    message: { type: String, optional: true },
    description: { type: String, optional: true },
    highestSeverity: { type: String, optional: true },
    alias: { type: String, optional: true }, // maps InOrbit incidents to external Incident management systems IDs
  }, { requiredByDefault: true });
  Incidents.attachSchema(Schemas.incidents);
}
if (Meteor.isServer) {
  // Index for efficiently querying list of last (sorted by ts) incidents created for a set of robots
  Incidents.rawCollection().createIndex({ createdAt: -1, robotId: 1 });
  // TTL index for removal of incidents 60 days after they are resolved
  Incidents.rawCollection().createIndex({ resolvedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 60 });
}

/**
 * Query to find all incidents from a set of robots. It returns a cursor
 * (it does not perform the fetch(), to be used from subscription).
 *
 * NOTE: this function will be removed when the UI use Incidents instead of
 * RobotAlerts. It will be replaced by queryIncidentsForRobots
 */
const queryRobotIncidents = ({ robotIds, filter = {} }) => {
  return RobotAlerts.find({ robotId: { $in: robotIds }, ...filter });
};

/**
 * Fetches all robot incidents from a set of robots.
 *
 * NOTE: this function will be removed when the UI use Incidents instead of
 * RobotAlerts. It will be replaced by fetchIncidentsForRobots
 */
const fetchRobotIncidents = ({ robotIds, filter }) => {
  const incidentsArr = queryRobotIncidents({ robotIds, filter }).fetch();
  return incidentsArr;
}

/**
 * Query to find all incidents from a set of robots. It returns a cursor
 * (it does not perform the fetch(), to be used from subscription).
 */
const queryIncidentsForRobots = ({ robotIds, filter = {}, limit = 100, sort }) => (
  Incidents.find(
    {
      ... ( robotIds && { robotId: { $in: robotIds } }),
      ...filter
    },
    { limit, sort }
  )
);

/**
 * Fetches all robot incidents from a set of robots.
 */
const fetchIncidentsForRobots = ({ robotIds, filter, limit }) => {
  const incidentsArr = queryIncidentsForRobots({ robotIds, filter, limit }).fetch();
  return incidentsArr;
}

export {
  // Constants
  DISTRIBUTION_SLACK,
  DISTRIBUTION_INORBIT,
  DISTRIBUTION_OPSGENIE,
  DISTRIBUTION_WEBHOOK,
  DISTRIBUTION_GOOGLE_CHAT,
  DISTRIBUTION_EMAIL,
  DISTRIBUTION_ALL,
  INCIDENT_STATUS_DISMISSED,
  INCIDENT_STATUS_NEW,
  INCIDENT_STATUS_RESOLVED,
  INCIDENT_STATUS_OK,
  ALERT_STATUS_NEW,
  ALERT_STATUS_RESOLVED,
  ALERT_STATUS_OK,
  // Queries
  queryRobotIncidents,
  fetchRobotIncidents,
  queryIncidentsForRobots,
  fetchIncidentsForRobots,
  // Sorts
  sortIncidentsByRobotStatus,
  sortAlertsByRobotStatus,
  // Utility functions
  getIncidentMessage,
  getAlertMessage,
  getSeverityForAlert,
  maxSeverity,
  // Collections
  AlertsConfig,
  RobotAlerts,
  IncidentConfiguration,
  Incidents
};
