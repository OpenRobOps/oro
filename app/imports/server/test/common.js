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
 * Some common functions and constants for tests
 */
import { Accounts } from 'meteor/accounts-base';
import { ROLE_VIEWER } from '../../shared/roles';
import { Robots } from '../../lib/collections';

// User ids
const BOB_USER = 'b0b';
const BOB_EMAIL = 'bob@scalable.com';
// Tags and collections ids
const HOOLI_TAG = 'h00li';
const WALL_E_ROBOT = 'wall-e';

// Helper function to create a test user
const createUser = async ({
  id = BOB_USER,
  name = 'Bob the operator',
  email = BOB_EMAIL,
  withRole = true // false -> don't add role
} = {}) => (
  Accounts.users.insertAsync({
    _id: id,
    profile: {
      name,
      email
    },
    userRoles: !withRole ? [] : [ROLE_VIEWER]
  })
);

// Helper function to create a robot 
const createRobot = async ({
  id = WALL_E_ROBOT,
  name = 'Wall-E'
} = {}) => (
  Robots.insertAsync({
    _id: id,
    name,
    status: { agentOnline: true },
    version: '1.0',
    updateStamp: Date.now()
  })
);

export {
  BOB_USER,
  WALL_E_ROBOT,
  HOOLI_TAG,
  createUser,
  createRobot,
};
