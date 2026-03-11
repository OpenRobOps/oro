import { Meteor } from 'meteor/meteor';
import { isString } from 'lodash';
import { ACCESS_LEVEL_VIEW, COLLECTIONS } from '../shared/constants';
import { Robots, RobotStatus, RobotsWithStatus } from '../lib/collections';
import OroRoles from '../server/roles';

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
