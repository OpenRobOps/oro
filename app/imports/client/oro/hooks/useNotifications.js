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

import { useTracker } from 'meteor/react-meteor-data';
import { Meteor } from 'meteor/meteor';
import { Notifications } from '../../../lib/notifications';

/**
 * Subscribes to and returns the in-app notifications across the fleet, newest
 * first. Notifications are shown fleet-wide, not scoped to a robot in view.
 */
const useNotifications = () => useTracker(() => {
  const handle = Meteor.subscribe('notifications');
  const isLoading = !handle.ready();
  const notifications = Notifications.find({}, { sort: { ts: -1 } }).fetch();
  return { notifications, isLoading };
}, []);

export default useNotifications;
