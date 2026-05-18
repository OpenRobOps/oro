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
 * Utility functions and constants used in ConfigAPItests.
 */
import { Accounts } from 'meteor/accounts-base';
// ORO modules
import { Robots } from '../../lib/collections';
import { ROLE_VIEWER } from '../roles';

const BOB_USER = 'b0b';
// Creates a robot 
export const createRobot = async (robotName = 'r2d2') => (
  Robots.insertAsync({
    name: robotName,
    version: '0.1',
    status: { agentOnline: true },
    updateStamp: Date.now(),
  })
);
// Helper function to create a test user
export const createUser = async ({
  id = BOB_USER, 
  name = 'User', 
  role = ROLE_VIEWER
} = {}) => {
  await Accounts.users.insertAsync({
    _id: id,
    profile: {
      name
    },
    userRoles: role ? [role] : []
  });
  return Accounts.users.findOneAsync({ _id: id });
};
