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
