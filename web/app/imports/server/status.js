/**
 * Status Manager - Application Server side
 *
 * This module encapsulates the management of robot
 * status and alert generation.
 * Note the responsibility here is only for management and configuration
 * of status.
 * Processing and dispatching is in the ingest service.
 */
import { isEmpty } from 'lodash';
import { Meteor } from 'meteor/meteor';
import { isString } from 'lodash';
import { ACCESS_LEVEL_VIEW, COLLECTIONS } from '../shared/constants';
import { Robots, RobotStatus, RobotsWithStatus } from '../lib/collections';
import OroRoles from '../server/roles';
// InOrbit modules
import { AsyncCache } from './simpleCache';

import {
  StatusConfig,
} from '../lib/status';
// import AlertsManager from './alertsManager';
// import EventLog from './eventLogger';
// import { EVENT_TYPES, EVENT_SETTINGS_SECTION_NAMES } from '../lib/events';

let instance;
export default class RobotStatusManager {
  constructor() {
    // Singleton pattern
    if (instance === undefined) {
      instance = this;
      // this._alertsManager = new AlertsManager();
    }
    // eslint-disable-next-line no-constructor-return
    return instance;
  }

  init = async () => {
    // Ignored. Placeholder.
  };

  /**
   * Gets the status configuration
   */
  _doGetStatusConfig = async () => (
    (await StatusConfig.find({}).fetchAsync()).reduce((acc, doc) => {
      delete doc._id;
      acc[doc.attributeId] = doc;
      return acc;
    }, {})
  );

  _doFetchStatusConfig = async (attributeId) => (
    StatusConfig.findOneAsync({ attributeId })
  )


  _doSetStatusConfig = async ({ attributeId, ...statusConfig }) => (
    StatusConfig.upsertAsync({ attributeId }, { $set: statusConfig })
  );

  _doUnsetStatusConfig = async (attributeId) => (
    StatusConfig.removeAsync({ attributeId })
  );

  getStatusConfigs = async () => (
    this._doGetStatusConfig()
  );

  /**
   * Updates the status calculation configuration for a given attribute.
   *
   * statusConfig is an array of status evaluation objects (or false, to supress rules)
   * with the following elements:
   *
   * {
   *   functionName: "higherThan" - Name of the pre-defined function to use,
   *                                from AttributeStateFunctions.
   *                                @see ingest/src/server/status.js
   *   params: { a:val, b:val }   - Parameters to the evaluation function.
   *   status: STATUS_ERROR.value - Value returned in case the result of the function is true
   * }
   *
   * NOTE: evaluation objects will be sorted by status, ascending, and evaluated in that order.
   * The status for a given property will be set to the first evaluation function that evaluates
   * true.
   *
   * @param {object} user A User object with { _id, profile } (or userId) that authors this change.
   */
  setStatusConfig = async (
    attributeId,
    statusConfig,
    label,
    user = null,
    autoCreateIncident = true
  ) => {
    // Sort status functions by status
    // NOTE This won't scale to tweaking point settings
    const sortedConfig = statusConfig && statusConfig.sort((a, b) => (b.status - a.status));
    // Get the last config for this attribute status
    const lastConfig = await this._doFetchStatusConfig(attributeId)?.rules;
    // Update the configuration
    await this._doSetStatusConfig({ attributeId, rules: sortedConfig });

    // Create the incident by default only if this is a new status
    // TODO allow skipping creating the incident
    if (isEmpty(lastConfig) && autoCreateIncident) {
      // TODO create incident definition
      console.log("TODO createIncidentDefinition", attributeId)
      // await this.alertsManager.createIncidentDefinition({
      //   incidentId: attributeId,
      //   label,
      //   user
      // });
    }
    // TODO event log
    // new EventLog().logSetting({
    //   settingGroupName: EVENT_SETTINGS_SECTION_NAMES.STATUS,
    //   settingName: label,
    //   eventType: lastConfig[attributeId] ? EVENT_TYPES.SETTING_UPDATED : EVENT_TYPES.SETTING_ADDED,
    //   user
    // });
  };

  /**
   * Make a given attribute not used for status calculation 
   *
   * @param {object} user A User object with { _id, profile } (or userId) that authors this change.
   *
   * @return {object} The old status definition object with { status, attribute }
   */
  suppressStatusConfig = async (attributeId, user = null) => {
    const attribute = await this._doFetchStatusConfig(attributeId)?.rules;
    // We need to specifically set it to null in order to force
    // disable a higher-level default in the hierarchy.
    await this._doUnsetStatusConfig(attributeId);
    // remove related incident definitions
    console.log("TODO suppressIncidentDefinition / eventLog", attributeId)
    // this.alertsManager.suppressIncidentDefinition(attributeId);
    // oldStatus && new EventLog().logSetting({
    //   settingGroupName: EVENT_SETTINGS_SECTION_NAMES.STATUS,
    //   settingName: (attribute && attribute.label) || attributeId,
    //   eventType: EVENT_TYPES.SETTING_REMOVED,
    //   user
    // });
  };

  /**
   * Remove settings for the status calculation for a given attribute.
   */
  // eslint-disable-next-line class-methods-use-this
  clearStatusConfig = async (attributeId) => (
    this._doUnsetStatusConfig(attributeId)
  );
}

/**
 * Create (or replace) the MongoDB view that joins robots with their status.
 * The view is backed by the `robots` collection and $lookups into `robot_status`.
 */
async function ensureRobotsWithStatusView() {
	const db = Robots.rawDatabase();
	const viewName = COLLECTIONS.ROBOTS_WITH_STATUS;
	try {
		await db.createCollection(viewName, {
			viewOn: COLLECTIONS.ROBOTS,
			pipeline: [
				{
					$lookup: {
						from: COLLECTIONS.ROBOT_STATUS,
						localField: '_id',
						foreignField: '_id',
						as: '_statusDoc'
					}
				},
				{ $unwind: { path: '$_statusDoc', preserveNullAndEmptyArrays: true } },
				{
					$addFields: {
						statuses: { $ifNull: ['$_statusDoc', {}] }
					}
				},
				{ $unset: '_statusDoc' }
			]
		});
	} catch (err) {
		// View already exists — drop and recreate to pick up pipeline changes
		if (err.codeName === 'NamespaceExists') {
			await db.collection(viewName).drop();
			return ensureRobotsWithStatusView();
		}
		throw err;
	}
}

Meteor.startup(() => {
	ensureRobotsWithStatusView().catch(err => {
		console.error('Failed to create robots_with_status view:', err);
	});
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

/**
 * Publication: robots_with_status
 *
 * Publishes robot documents merged with their status data from the
 * view_robots_with_status MongoDB view. The view joins robots with
 * robot_status via $lookup so no application-level joining is needed.
 *
 * Meteor's poll-and-diff handles reactivity (views don't support oplog tailing).
 */
// eslint-disable-next-line prefer-arrow-callback
Meteor.publish('robots_with_status', function () {
	if (!this.userId) {
		return this.ready();
	}
	return RobotsWithStatus.find({}, { pollingIntervalMs: 3000 });
});
