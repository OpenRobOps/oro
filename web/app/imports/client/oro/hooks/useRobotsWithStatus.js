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
import { RobotsWithStatus, AGG_STATUS_FIELD } from '../../../lib/status';
import { statusFilterToValues } from '../../../shared/status';

/**
 * Subscribes to the robots_with_status publication and returns robot documents
 * merged with their status data.
 *
 * The publication filters server-side and embeds AGG_STATUS_FIELD in each
 * document. We use find() here to guard against extra documents arriving from
 * other widget subscriptions to the same collection.
 *
 * @param {object} params
 * @param {Array}   params.statusList   - List of status attribute IDs to display.
 * @param {string}  params.statusFilter - Optional status filter string (e.g. 'ewo').
 * @returns {{ robots: object[], isLoading: boolean }}
 */
const useRobotsWithStatus = ({ statusList, statusFilter }) => useTracker(() => {
  const handle = Meteor.subscribe('robots_with_status', { statusList, statusFilter });

  const allowedValues = statusFilterToValues(statusFilter);
  const robots = RobotsWithStatus.find(
    { [AGG_STATUS_FIELD]: { $in: allowedValues } }
  ).fetch();

  return { robots, isLoading: !handle.ready() };
}, [statusList, statusFilter]);

export default useRobotsWithStatus;
