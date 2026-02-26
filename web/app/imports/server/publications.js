import moment from 'moment';
// Oro modules
import OroRoles from '../server/roles';
import { ACCESS_LEVEL_VIEW } from '../shared/roles';
import { queryIncidentsForRobots } from '../lib/alerts';
import { Robots } from '../lib/collections';
import { queryRobotAttributeValues } from '../lib/attributes';

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
