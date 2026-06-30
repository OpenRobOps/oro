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
 * Reads and toggles the current user's in-app notifications bell flag (whether the
 * incident notifications banner is shown). Shared by the app header bell and the
 * dashboard notifications banner. Defaults to enabled when unset.
 */
import { useCallback } from 'react';
import { useTracker } from 'meteor/react-meteor-data';
import { Meteor } from 'meteor/meteor';
import { Preferences } from '../../../lib/collections';

const useNotificationsEnabled = () => {
  const enabled = useTracker(() => {
    const userId = Meteor.userId();
    Meteor.subscribe('preferences', { keys: ['notificationsBell'] });
    const pref = Preferences.findOne('notificationsBell');
    const value = pref && userId ? pref[userId] : undefined;
    return value === undefined ? true : value;
  }, []);

  const toggle = useCallback(() => {
    Meteor.call('preferences.setNotificationsBell', !enabled);
  }, [enabled]);

  return { enabled, toggle };
};

export default useNotificationsEnabled;
