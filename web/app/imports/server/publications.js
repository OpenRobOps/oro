import moment from 'moment';
import { Meteor } from 'meteor/meteor';
import { isString, isArray } from 'lodash';
// Oro modules
import OroRoles from '../server/roles';
import { ACCESS_LEVEL_VIEW } from '../shared/roles';
import { queryIncidentsForRobots } from '../lib/alerts';
import { Robots, RobotKeyValues, RobotCustomData, RobotStatus, UIPreferences } from '../lib/collections';
import { queryRobotAttributeValues } from '../lib/attributes';
import { AGG_STATUS_FIELD } from '../lib/status';
import {
  DEFAULT_FLAGS_STRING,
  FLAG_ERROR,
  FLAG_OFFLINE,
  FLAG_OK,
  FLAG_WARNING,
  STATUS
} from '../shared/status';
import { COLLECTIONS } from '../shared/constants';

Meteor.publish('attributes.values', async function ({ robotId, attributes, pollingIntervalMs = 10000 }) {
  if (!this.userId) {
    return this.ready();
  }
  if (!await new OroRoles().canAccessRobot(this.userId, robotId, ACCESS_LEVEL_VIEW)) {
    return this.error(new Meteor.Error('Unauthorized'));
  }
  return queryRobotAttributeValues({ robotId, attributes, pollingIntervalMs });
});

Meteor.publish('robots', async function ({
  options = {},
  maxOfflineMs
}) {
  if (!this.userId) { // User must be logged in
    return this.ready();
  }
  // TODO if we want to limit robots visibility, filter them here
  const query = {};
  if (maxOfflineMs) {
    // Match robots which are online or have been offline for at most maxOfflineMs milliseconds
    query.$or = [
      { updateStamp: { $gt: Date.now() - maxOfflineMs } },
      { 'status.agentOnline': true } // always include online robots
    ];
  }
  return Robots.find(query, options);
});

Meteor.publish('incidents.list', async function ({
  robotIds, startTs, endTs, severities, componentId
}) {
  if (!this.userId) { // User must be logged in
    return this.ready();
  }
  if (robotIds && !await new OroRoles().canAccessRobots(this.userId, robotIds, ACCESS_LEVEL_VIEW)) {
    return this.error(new Meteor.Error('Unauthorized'));
  }
  // TODO: Create list of accessible robotIds if not provided
  // Time cap query to "1 week ago"
  const minStartTs = moment().subtract(1, 'weeks').valueOf();
  const startDate = moment(startTs);
  if (!startTs || !startDate.isValid() || startTs < minStartTs) {
    startTs = minStartTs;
  }
  // Optional startTs/timeRangeMs parameters (although note that minStartTs above guarantees
  // we add at least one of them)
  const filter = {
    createdAt: {}
  };
  if (startTs && startDate.isValid()) {
    filter.createdAt.$gte = startDate.toDate();
  }
  const endDate = moment(endTs);
  if (endTs && endDate.isValid()) {
    filter.createdAt.$lte = endDate.toDate();
  }
  // If filtering by severities (a list options), add the filter. Note that highestSeverity
  // is the same criteria used in the UI for client side filtering (it is not 'severity')
  if (Array.isArray(severities) && severities.length) {
    filter.highestSeverity = { $in: severities };
  }
  if (componentId) {
    filter.componentsIds = componentId; // componentsIds doc field is array; this filter means "any"
  }
  // In all cases, sort results by timestamp so if MAX_INCIDENTS_LIMIT is reached, the latest
  // are still displayed
  const MAX_INCIDENTS_LIMIT = 100; // TODO(herchu) move constant elsewhere. Make it configurable?
  return queryIncidentsForRobots({
    robotIds,
    filter,
    limit: MAX_INCIDENTS_LIMIT,
    sort: { createdAt: -1 }
  });
});

Meteor.publish('robot.key_values', async function ({ robotId, pollingIntervalMs = 10000 }) {
  if (!this.userId) {
    return this.ready();
  }
  if (!await new OroRoles().canAccessRobot(this.userId, robotId, ACCESS_LEVEL_VIEW)) {
    return this.error(new Meteor.Error('Unauthorized'));
  }
  const options = {};
  if (pollingIntervalMs && !Number.isNaN(pollingIntervalMs) && pollingIntervalMs > 50) {
    options.pollingIntervalMs = pollingIntervalMs;
  }
  return RobotKeyValues.find({ _id: robotId }, options);
});

Meteor.publish('custom_data', async function ({ robotId }) {
  if (!this.userId) {
    return this.ready();
  }
  if (!await new OroRoles().canAccessRobot(this.userId, robotId, ACCESS_LEVEL_VIEW)) {
    return this.error(new Meteor.Error('Unauthorized'));
  }
  return RobotCustomData.find({ robotId });

});
/**
 * Publish details (Robot object) for a single or multiple robots
 *robot.details
 * See also 'robot.getDetails' Meteor method, for one-time operations.
 */
Meteor.publish('robot.details', async function ({ robotId, robotIds }) {
  // check arguments
  if (robotId && robotIds) {
    console.warn('robot.details: bad params');
    return this.error(new Meteor.Error('wrong-parameter', 'only one of robotId and robotIds can be provided'));
  }
  if (robotId) {
    // publish data for a single robot
    if (!isString(robotId)) {
      console.warn('robot.details: bad params');
      return this.error(new Meteor.Error('wrong-parameter', 'robotId must be a string'));
    }
    robotIds = [robotId];
  } else if (robotIds) {
    // publish data for a single robot
    if (!isArray(robotIds)) {
      console.warn('robot.details: bad params');
      return this.error(new Meteor.Error('wrong-parameter', 'robotIds must be an array'));
    }
    // in the special case there is only one element, set robotId to be used
    // in the cursor query below
    if (robotIds.length == 1) {
      [robotId] = robotIds;
    }
  } else {
    // No robotId(s) are received when viewing a new company (zero data), do not log it the error
    return this.ready();
  }
  // check permissions
  if (!this.userId) { // User must be logged in
    console.warn('robot.details: not logged in');
    return this.ready();
  }
  // at this point robotIds is always populated with a list (can be a single element),
  // so permissions check can use canAccessRobots (plural!)
  if (!await new OroRoles().canAccessRobots(this.userId, robotIds)) {
    if (robotId && robotId != ZERO_ROBOT._id) {
      console.warn(`Unauthorized (robot.details): userId: ${this.userId}, robotIds: ${robotIds}`);
    }
    return this.error(new Meteor.Error('Unauthorized'));
  }
  // For efficiency, build the query differently if this is a single or multiple
  // robots query
  if (robotId) {
    return Robots.find({ _id: robotId });
  } else {
    return Robots.find({ _id: { $in: robotIds } });
  }
});

/**
 * Check whether the given status letter is in the robot status string.
 */
const isInRobotStatusString = (statusLetter, robotStatus = DEFAULT_FLAGS_STRING) => (
  robotStatus.includes(statusLetter)
);

/**
 * Returns true if the robot's aggregated status value matches the statusFilter string.
 */
const satisfiesStatusFilter = (statusFilter, aggStatusValue) => {
  switch (aggStatusValue) {
    case STATUS.ERROR.value:
      return isInRobotStatusString(FLAG_ERROR, statusFilter);
    case STATUS.WARN.value:
      return isInRobotStatusString(FLAG_WARNING, statusFilter);
    case STATUS.OK.value:
      return isInRobotStatusString(FLAG_OK, statusFilter);
    default:
      return isInRobotStatusString(FLAG_OFFLINE, statusFilter);
  }
};

/**
 * Publication: robots_with_status
 *
 * Publishes robot documents merged with their status data into the
 * view_robots_with_status collection, filtering by statusFilter.
 *
 * Simplified port from inorbit: polls MongoDB robot_status instead of Redis,
 * no collections/tags filtering, no UIPreferences lookup.
 *
 * Parameters:
 *   statusList   {string[]} - Attribute IDs to include in status computation
 *   statusFilter {string}   - Flag string (e.g. 'ewo') controlling which status levels to show
 */
// eslint-disable-next-line prefer-arrow-callback
Meteor.publish('robots_with_status', async function ({ statusList, statusFilter }) {
  if (!this.userId) {
    return this.ready();
  }

  const collectionName = COLLECTIONS.ROBOTS_WITH_STATUS;
  const attrIds = Array.isArray(statusList) && statusList.length ? statusList : [];

  const calculateAggregatedStatusValue = statuses => (
    attrIds.reduce((agg, attrId) => Math.max(agg, statuses?.[attrId]?.value || 0), 0)
  );

  const extractStatuses = (statusDoc) => {
    const statuses = {};
    attrIds.forEach((attrId) => {
      if (statusDoc[attrId]) statuses[attrId] = statusDoc[attrId];
    });
    return statuses;
  };

  const robotIds = new Set();

  const robotCollHandle = await Robots.find({}).observeChanges({
    added: (id, doc) => {
      this.added(collectionName, id, { ...doc, statuses: {} });
      robotIds.add(id);
    },
    changed: async (id, doc) => {
      const statusDoc = await RobotStatus.findOneAsync({ _id: id });
      const statuses = statusDoc ? extractStatuses(statusDoc) : {};
      const aggStatusValue = calculateAggregatedStatusValue(statuses);
      if (satisfiesStatusFilter(statusFilter, aggStatusValue)) {
        doc[AGG_STATUS_FIELD] = aggStatusValue;
        doc.statuses = statuses;
        this.changed(collectionName, id, doc);
      } else {
        this.removed(collectionName, id);
        robotIds.delete(id);
      }
    },
    removed: (id) => {
      this.removed(collectionName, id);
      robotIds.delete(id);
    }
  });

  let running = true;

  const updateFleetRobotStatus = async () => {
    if (!running || !robotIds.size) return;

    const statusDocs = await RobotStatus.find(
      { _id: { $in: Array.from(robotIds) } }
    ).fetchAsync();

    statusDocs.forEach((statusDoc) => {
      const id = statusDoc._id;
      if (!robotIds.has(id)) return;
      const statuses = extractStatuses(statusDoc);
      const aggStatusValue = calculateAggregatedStatusValue(statuses);
      if (satisfiesStatusFilter(statusFilter, aggStatusValue)) {
        this.changed(collectionName, id, { [AGG_STATUS_FIELD]: aggStatusValue, statuses });
      } else {
        this.removed(collectionName, id);
        robotIds.delete(id);
      }
    });
  };

  const pollingIntervalMs = 3000;
  const intervalHandle = setInterval(updateFleetRobotStatus, pollingIntervalMs);
  updateFleetRobotStatus();

  this.onStop(() => {
    running = false;
    clearInterval(intervalHandle);
    robotCollHandle.stop();
  });

  return this.ready();
});

/**
 * Publication: ui.preferences
 *
 * Publishes UIPreferences documents, projecting only the requested widget fields.
 */
Meteor.publish('ui.preferences', function ({ widget }) {
  if (!this.userId) {
    return this.ready();
  }
  const projection = {};
  if (Array.isArray(widget)) {
    widget.forEach(w => { projection[w] = 1; });
  }
  return UIPreferences.find({}, { fields: projection });
});

Meteor.methods({
  /**
   * Returns full status data for a robot, used for tooltip details in FleetStatusWidget.
   */
  // eslint-disable-next-line object-shorthand
  async 'status.getDetailedStatus'({ robotId }) {
    if (!isString(robotId)) {
      throw new Meteor.Error('robotId must be a string');
    }
    if (!this.userId) {
      throw new Meteor.Error('Unauthorized');
    }
    if (!await new OroRoles().canAccessRobot(this.userId, robotId, ACCESS_LEVEL_VIEW)) {
      throw new Meteor.Error('Unauthorized');
    }
    return RobotStatus.findOneAsync({ _id: robotId });
  }
});
