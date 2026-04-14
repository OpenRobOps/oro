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
 * useRobots — Hook to fetch all robots
 *
 * Subscribes to the robots publication and returns robots keyed by id.
 *
 * @returns {Object} - { isLoading, robotsById }
 *  isLoading: boolean - Whether the subscription is still loading
 *  robotsById: { [robotId]: robotData } - All robots indexed by _id
 */
import { useTracker } from 'meteor/react-meteor-data';
import { Meteor } from 'meteor/meteor';
import { Robots } from '../../../lib/collections';

const useRobots = () => useTracker(() => {
  const handle = Meteor.subscribe('robots', {});
  const robots = Robots.find({}).fetch();
  const robotsById = robots.reduce((acc, r) => { acc[r._id] = r; return acc; }, {});
  return { isLoading: !handle.ready(), robotsById };
}, []);

export default useRobots;
