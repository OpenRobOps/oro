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
import { ACCESS_LEVEL_OPERATE } from '../shared/roles';
import ActionsEngine from './actions';

export default class NotificationsManager {
  constructor(actionsEngine) {
    this._actionsEngine = actionsEngine || new ActionsEngine();
  }

  // Removing the notification is enough: the alerts listener only updates an
  // existing notification on later events, so a dismissed one is not re-created.
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
    // The operator acted on the call-to-action: record it and remove the
    // notification now (the incident stays open until it clears, but the
    // notification's job is done; the listener won't re-create it on updates).
    await RobotAlerts.updateAsync(
      { _id: notification.alertId },
      { $push: { executedActions: { actionId, userId: user?._id, ts: Date.now() } } }
    );
    await Notifications.removeAsync({ _id: notificationId });
    return result;
  };
}

// Publishes the in-app notifications across the fleet, newest first. The caller
// must be logged in and have a role; notifications are shown fleet-wide (like the
// incident list), not scoped to a single robot in view.
Meteor.publish('notifications', async function publishNotifications() {
  if (!await new OroRoles().hasRole(this.userId)) {
    return this.ready();
  }
  return Notifications.find({}, { sort: { ts: -1 } });
});

Meteor.methods({
  'notifications.dismiss': async function dismissNotification({ notificationId }) {
    check(notificationId, String);
    // Notifications are fleet-wide; require a role to dismiss (matches the publication).
    if (!await new OroRoles().hasRole(this.userId)) {
      throw new Meteor.Error('Unauthorized');
    }
    return new NotificationsManager().dismiss({ notificationId });
  },
  'notifications.runManualAction': async function runManualAction({ notificationId, actionId }) {
    check(notificationId, String);
    check(actionId, String);
    const notification = await Notifications.findOneAsync({ _id: notificationId });
    if (!notification) {
      throw new Meteor.Error('notification-not-found', `No notification ${notificationId}`);
    }
    // Running the action operates the robot; require operate access to it.
    if (!await new OroRoles().canAccessRobot(this.userId, notification.robotId, ACCESS_LEVEL_OPERATE)) {
      throw new Meteor.Error('Unauthorized', `Not authorized to run actions on robot ${notification.robotId}`);
    }
    const user = await Meteor.userAsync();
    return new NotificationsManager().runManualAction({ notificationId, actionId, user });
  }
});
