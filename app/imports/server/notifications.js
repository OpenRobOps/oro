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
 * NotificationsManager plus the in-app notifications publication and methods.
 *
 * Manual actions run as the logged-in user (resolved from this.userId). An action
 * can only be run if it is one of the actions carried by the notification.
 */
import { Meteor } from 'meteor/meteor';
import { check } from 'meteor/check';
// ORO modules
import { RobotAlerts } from '../lib/alerts';
import { Notifications } from '../lib/notifications';
import OroRoles from './roles';
import { ACCESS_LEVEL_VIEW } from '../shared/roles';
import ActionsEngine from './actions';

export default class NotificationsManager {
  constructor(actionsEngine) {
    this._actionsEngine = actionsEngine || new ActionsEngine();
  }

  dismiss = async ({ notificationId }) => Notifications.removeAsync({ _id: notificationId });

  runManualAction = async ({ notificationId, actionId, user }) => {
    const notification = await Notifications.findOneAsync({ _id: notificationId });
    if (!notification) {
      throw new Meteor.Error('notification-not-found', `No notification ${notificationId}`);
    }
    const allowed = (notification.actions || []).some((a) => a.actionId === actionId);
    if (!allowed) {
      throw new Meteor.Error('action-not-allowed', `Action ${actionId} is not on this notification`);
    }
    const result = await this._actionsEngine.runAction({
      actionId,
      context: { robotId: notification.robotId },
      user
    });
    if (result?.errors) {
      throw new Meteor.Error('action-failed', JSON.stringify(result.errors));
    }
    await RobotAlerts.updateAsync(
      { _id: notification.alertId },
      { $push: { executedActions: { actionId, userId: user?._id, ts: Date.now() } } }
    );
    return result;
  };
}

// Publishes the in-app notifications for a single robot, newest first.
// The caller must be logged in and have view access to the robot.
Meteor.publish('notifications', async function publishNotifications({ robotId } = {}) {
  if (!this.userId) { // User must be logged in
    return this.ready();
  }
  if (!await new OroRoles().canAccessRobot(this.userId, robotId, ACCESS_LEVEL_VIEW)) {
    throw new Meteor.Error(`User not authorized to view robot's ${robotId} notifications`);
  }
  return Notifications.find({ robotId }, { sort: { ts: -1 } });
});

Meteor.methods({
  'notifications.dismiss': async function dismissNotification({ notificationId }) {
    check(notificationId, String);
    if (!this.userId) {
      throw new Meteor.Error('Unauthorized');
    }
    return new NotificationsManager().dismiss({ notificationId });
  },
  'notifications.runManualAction': async function runManualAction({ notificationId, actionId }) {
    check(notificationId, String);
    check(actionId, String);
    if (!this.userId) {
      throw new Meteor.Error('Unauthorized');
    }
    const user = await Meteor.userAsync();
    return new NotificationsManager().runManualAction({ notificationId, actionId, user });
  }
});
