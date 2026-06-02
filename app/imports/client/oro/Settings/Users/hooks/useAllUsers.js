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
 * useAllUsers: Subscribes to `users.all` and returns every user sorted by
 * createdAt (newest first).
 *
 * @returns {Object}
 *  isLoading: boolean - Whether the subscription is still loading
 *  data: Array - All users sorted by createdAt (newest first)
 */
import { useTracker } from 'meteor/react-meteor-data';
import { Meteor } from 'meteor/meteor';

const useAllUsers = () => useTracker(() => {
  const handle = Meteor.subscribe('users.all');
  const data = Meteor.users.find({}, { sort: { createdAt: -1 } }).fetch();
  return { isLoading: !handle.ready(), data };
}, []);

export default useAllUsers;
