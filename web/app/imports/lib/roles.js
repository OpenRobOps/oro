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
 * Common constants and some client side functions for roles and permissions handling:
 * shared code for Roles module.
 *
 * #meteor3: Migrated. New functions use *async prefix. TODO last: Remove deprecated versions
 */
import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
// ORO modules
import { COLLECTIONS } from '../shared/constants';
import {
  ROLE_ADMIN, ROLE_MANAGER, ROLE_ENGINEER, ROLE_OPERATOR,
  ROLE_VIEWER, ALL_ROLE_DOCS,
} from '../shared/roles';

// Roles collections is defined server-side only
const Roles = new Mongo.Collection(COLLECTIONS.ROLES);
const Users = Meteor.users; // Accounts.users?

export {
  Roles,
  Users,

  ROLE_ADMIN,
  ROLE_MANAGER,
  ROLE_ENGINEER,
  ROLE_OPERATOR,
  ROLE_VIEWER,
  ALL_ROLE_DOCS,
};
