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
 * Hook to subscribe to the teleop publication.
 * @param {string} robotId - The ID of the robot to subscribe to.
 * @returns {void}
 */
import { useTracker } from 'meteor/react-meteor-data';
import { Meteor } from 'meteor/meteor';

/**
 * Refcounted load of RosTeleopAgentlet via the `teleop` publication.
 * Unsubscribe on unmount triggers requestLess on the server.
 */
const useTeleopSubscription = (robotId) => useTracker(() => {
  if (!robotId) return;
  Meteor.subscribe('teleop', { robotId });
}, [robotId]);

export default useTeleopSubscription;
