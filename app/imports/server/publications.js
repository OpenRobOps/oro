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

import moment from 'moment';
import { Meteor } from 'meteor/meteor';
import { isString, isArray } from 'lodash';
// Oro modules
import OroRoles from '../server/roles';
import AgentManager from '../server/agentManager';
import { ACCESS_LEVEL_VIEW, ACCESS_LEVEL_OPERATE } from '../shared/roles';
import { queryIncidentsForRobots } from '../lib/alerts';
import { Robots, RobotKeyValues, RobotCustomData, RobotLocalization, SpatialAnnotations, SpatialTransformations, RobotDiagnostics, RobotModuleState, UIPreferences } from '../lib/collections';
import { ID_TYPE_AGENT, ID_TYPE_ROBOT } from '../shared/constants';
import { queryRobotAttributeValues } from '../lib/attributes';
import { VITAL_PING_RTT_AVG, VITAL_PING_RTT_LAST } from '../shared/attributes';
import ConfigManager from '../lib/configManagerAsync';
import RttManager from './rttManager';
import { mapsListQuery, mapSummary, ROBOT_MAPS_COLLECTION } from '../shared/maps';
import { uiPreferencesDocsFor } from './robotUiPreferences';
import { ROBOT_UI_PREFERENCES_COLLECTION } from '../shared/robotPath';

/**
 * Publish localization data (pose, map metadata + URL) for one or more robots.
 * The `lowBandwidth` flag omits laser ranges and paths to reduce data transfer.
 */
Meteor.publish('localization', async function ({ robotIds, lowBandwidth = false }) {
  if (!this.userId) {
    return this.ready();
  }
  if (!isArray(robotIds) || robotIds.length === 0) {
    return this.ready();
  }
  if (!await new OroRoles().canAccessRobots(this.userId, robotIds, ACCESS_LEVEL_VIEW)) {
    return this.error(new Meteor.Error('Unauthorized'));
  }
  const fields = {
    robotPose: 1,
    robotPoseUpdatedTs: 1,
    map: 1,
    mapUpdatedTs: 1,
    defaultMap: 1,
    laserConfig: 1,
    costmap: 1,
  };
  if (!lowBandwidth) {
    fields.laserRanges = 1;
    fields.laserRangesUpdatedTs = 1;
    fields.paths = 1;
    fields.pathsUpdatedTs = 1;
  }
  return RobotLocalization.find({ _id: { $in: robotIds } }, { fields });
});

/**
 * Publish the list of maps a robot can display (its own + system-wide) as lightweight summaries
 * into the client-only `robot_maps` collection (see ROBOT_MAPS_COLLECTION in shared/maps.js for
 * why these are not published as partial `spatial_annotations` docs).
 */
Meteor.publish('spatial_annotations.maps', async function ({ robotId }) {
  if (!this.userId || !robotId) {
    return this.ready();
  }
  if (!await new OroRoles().canAccessRobot(this.userId, robotId, ACCESS_LEVEL_VIEW)) {
    return this.error(new Meteor.Error('Unauthorized'));
  }
  const publishSummary = (method) => (doc) => {
    const summary = mapSummary(doc);
    if (summary) this[method](ROBOT_MAPS_COLLECTION, doc._id, summary);
  };
  const handle = await SpatialAnnotations.find(mapsListQuery(robotId), {
    fields: { 'map.data': 0, 'annotation.data': 0 },
  }).observeAsync({
    added: publishSummary('added'),
    changed: publishSummary('changed'),
    removed: (doc) => this.removed(ROBOT_MAPS_COLLECTION, doc._id),
  });
  this.onStop(() => handle.stop());
  return this.ready();
});

/**
 * Publish one map annotation (metadata + image data). `robotId` is the robot the viewer is
 * looking at (access check); the doc itself is `entityType/entityId/label`, which defaults to
 * that robot's own map but may name a system-scope map.
 * Clients use `objectUrl` when available, otherwise `data` (base64 PNG) as fallback.
 */
Meteor.publish('spatial_annotations.map', async function ({
  robotId, entityType = 'robot', entityId, label = 'map',
}) {
  if (!this.userId || !robotId) {
    return this.ready();
  }
  if (!await new OroRoles().canAccessRobot(this.userId, robotId, ACCESS_LEVEL_VIEW)) {
    return this.error(new Meteor.Error('Unauthorized'));
  }
  if (!['robot', 'system'].includes(entityType)) {
    return this.error(new Meteor.Error('wrong-parameter', 'entityType must be "robot" or "system"'));
  }
  const id = entityType === 'system' ? '0' : (entityId || robotId);
  if (entityType === 'robot' && id !== robotId) {
    return this.error(new Meteor.Error('Unauthorized'));
  }
  return SpatialAnnotations.find({ entityType, entityId: id, label });
});

/**
 * Publish frame transformations relevant to a robot: its own overrides and the system-wide set.
 */
Meteor.publish('spatial_transformations', async function ({ robotId }) {
  if (!this.userId || !robotId) {
    return this.ready();
  }
  if (!await new OroRoles().canAccessRobot(this.userId, robotId, ACCESS_LEVEL_VIEW)) {
    return this.error(new Meteor.Error('Unauthorized'));
  }
  return SpatialTransformations.find({
    $or: [{ entityType: 'robot', entityId: robotId }, { entityType: 'system', entityId: '0' }],
  });
});

/**
 * Publish each robot's RESOLVED `{ pose, robotPath }` UI preferences (configured over
 * ISO-reported) into the client-only `robot_ui_preferences` collection. Resolution runs
 * server-side so the widget stays a plain renderer; recomputed for the whole set whenever a
 * relevant ui_preferences or robots document changes (these change rarely, so a full recompute
 * per change is fine).
 */
Meteor.publish('robot_ui_preferences', async function ({ robotIds }) {
  if (!this.userId || !isArray(robotIds) || robotIds.length === 0) {
    return this.ready();
  }
  if (!await new OroRoles().canAccessRobots(this.userId, robotIds, ACCESS_LEVEL_VIEW)) {
    return this.error(new Meteor.Error('Unauthorized'));
  }
  let published = {};
  const refresh = async () => {
    const docs = await uiPreferencesDocsFor(robotIds);
    Object.entries(docs).forEach(([id, doc]) => {
      if (published[id]) this.changed(ROBOT_UI_PREFERENCES_COLLECTION, id, doc);
      else this.added(ROBOT_UI_PREFERENCES_COLLECTION, id, doc);
    });
    published = docs;
  };
  // ponytail: any change to an input → recompute all robotIds (tiny sets, rare changes).
  const onChange = { added: refresh, changed: refresh, removed: refresh };
  const handles = await Promise.all([
    UIPreferences.find({ $or: [{ entityType: 'system', entityId: '0' }, { entityType: 'robot', entityId: { $in: robotIds } }] },
      { fields: { 'map.pose': 1, 'map.robotPath': 1 } }).observeChangesAsync(onChange),
    Robots.find({ _id: { $in: robotIds } }, { fields: { footprint: 1 } }).observeChangesAsync(onChange),
  ]);
  await refresh();
  this.onStop(() => handles.forEach((h) => h.stop()));
  return this.ready();
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
  if (!robotId) {
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
  if (!robotId) {
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
    // No robotId(s) are received (zero data), do not log it the error
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

// Published by the teleop UI to load RosTeleopAgentlet on
// demand. Refcounted via AgentManager.requestMore / requestLess so the module
// stays loaded while any operator is viewing teleop and unloads when none are.
Meteor.publish('teleop', async function ({ robotId }) {
  if (!this.userId) {
    return this.ready();
  }
  if (!await new OroRoles().canAccessRobot(this.userId, robotId, ACCESS_LEVEL_OPERATE)) {
    console.warn(`Unauthorized (teleop): userId: ${this.userId}, robotId: ${robotId}`);
    return this.error(new Meteor.Error('Unauthorized'));
  }
  const runlevel = 5;
  await new AgentManager().requestMore(robotId, 'RosTeleopAgentlet', runlevel);
  this.onStop(async () => {
    await new AgentManager().requestLess(robotId, 'RosTeleopAgentlet', runlevel);
  });
  return this.ready();
});

// Publish the latest diagnostics entry
Meteor.publish('diagnostics', async function ({ robotId }) {
  // Verify the logged-in user has access to this robot
  if (!await new OroRoles().canAccessRobot(this.userId, robotId, ACCESS_LEVEL_VIEW)) {
    console.warn(`Unauthorized (diagnostics): userId: ${this.userId}, robotId: ${robotId}`);
    return this.error(new Meteor.Error('Unauthorized'));
  }
  // Inform we need diagnostics for this robot
  const runLevel = 5;
  await new AgentManager().requestMore(robotId, 'RosDiagnosticsAgentlet', runLevel);
  this.onStop(async () => {
    await new AgentManager().requestLess(robotId, 'RosDiagnosticsAgentlet', runLevel);
  });
  return RobotDiagnostics.find({ _id: robotId });
});

/**
 * High-rate RTT publication for the teleop ConnectionQuality gauge.
 * Triggers an active ping loop while subscribed; stops when no subscribers remain.
 */
Meteor.publish('robot.connectionQuality', async function ({ robotId }) {
  if (!isString(robotId)) {
    return this.error(new Meteor.Error('wrong-parameter', 'robotId must be a string'));
  }
  if (!this.userId) {
    return this.error(new Meteor.Error('User is not logged in'));
  }
  if (!await new OroRoles().canAccessRobot(this.userId, robotId, ACCESS_LEVEL_VIEW)) {
    console.warn(`Unauthorized (robot.connectionQuality): userId: ${this.userId}, robotId: ${robotId}`);
    return this.error(new Meteor.Error('Unauthorized'));
  }
  new RttManager().startPing(robotId);
  this.onStop(() => {
    new RttManager().stopPing(robotId);
  });
  // RTT is written by RttManager as robot attribute values (pingAvg/pingLast) and read here
  // through the standard attribute-values pipeline. Polls at 1s — only subscribed while the
  // ConnectionQuality bar is visible.
  return queryRobotAttributeValues({
    robotId,
    attributes: [VITAL_PING_RTT_AVG, VITAL_PING_RTT_LAST],
    pollingIntervalMs: 1000,
  });
});

/**
 * Publication to send an individual robot's module_states.
 * Note that module states for this robot _and its company_ are published (as well as any
 * collection) the robot belongs to, if we had RobotModuleStates working on this type of
 * entities too).
 * The RobotModuleState elements are not exactly the docs from the DB, but instead having
 * merged the hierarchical configurations.
 *
 * @param moduleName (string, optional) is an specific module to be published
 *    (e.g. RosImageAgentlet). If not given, all module states for the robot are published.
 */
Meteor.publish('robot.module_states', async function ({
  robotId,
  moduleName
}) {
  if (!this.userId) { // User must be logged in
    return this.ready();
  }
  if (!isString(robotId)) {
    console.warn('robot.module_states: bad params ');
    return this.error(new Meteor.Error('wrong-parameter', 'robotId must be a string'));
  }
  if (moduleName && !isString(moduleName)) {
    console.warn('robot.module_states: bad params ');
    return this.error(new Meteor.Error('wrong-parameter', 'moduleName must be a string'));
  }
  if (!await new OroRoles().canAccessRobot(this.userId, robotId, ACCESS_LEVEL_VIEW)) {
    console.warn('robot.module_states: unauthorized ');
    return this.error(new Meteor.Error('Unauthorized'));
  }

  const pubHandle = await new ConfigManager(RobotModuleState).publishEntityConfig({
    publication: this,
    entityId: robotId,
    entityType: ID_TYPE_ROBOT,
    groupingKey: 'moduleName',
    conditions: { moduleName }
  })
  this.ready();
  this.onStop(() => pubHandle.stop());
});

// Publication to send only module states with entityType `agent`
Meteor.publish('robot.agent_module_states', async function ({
  robotId,
  moduleName
}) {
  if (!this.userId) { // User must be logged in
    console.warn('robot.agent_module_states: not logged in ');
    return this.ready();
  }
  if (moduleName && !isString(moduleName)) {
    console.warn('robot.agent_module_states: bad params ');
    return this.error(new Meteor.Error('wrong-parameter', 'moduleName must be a string'));
  }
  if (!await new OroRoles().canAccessRobot(this.userId, robotId, ACCESS_LEVEL_VIEW)) {
    console.warn('robot.agent_module_states: unauthorized ');
    return this.error(new Meteor.Error('Unauthorized'));
  }

  const pubHandle = await new ConfigManager(RobotModuleState).publishEntityConfig({
    publication: this,
    entityId: robotId,
    entityType: ID_TYPE_AGENT,
    groupingKey: 'moduleName',
    conditions: { moduleName }
  })
  this.ready();
  this.onStop(() => pubHandle.stop());
});
