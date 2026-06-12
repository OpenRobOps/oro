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

/*
 * UsersManager: encapsulates users-related server logic — publications and the
 * Meteor methods used to manage platform users (e.g. assigning roles).
 *
 * Role *definitions* and permission checks live in OroRoles (./roles); this
 * manager is the API surface (publications / methods) the client talks to.
 */
import { Meteor } from 'meteor/meteor';
import OroRoles from './roles';
import EventLog from './eventLog/eventLogger';
import { EVENT_SETTINGS_SECTION_NAMES, EVENT_TYPES, getUserName } from '../lib/events';
import {
  RESOURCE_SINGLETONS, ACCESS_LEVEL_VIEW, ACCESS_LEVEL_CONFIGURE,
  getRoleRank, getRolesRank,
} from '../shared/roles';
import { getUserSources } from '../shared/users';

let instance;
class UsersManager {
  constructor() {
    // Singleton Pattern
    if (instance === undefined) {
      instance = this;
    }
    // eslint-disable-next-line no-constructor-return
    return instance;
  }

  init = async () => {
    // Meteor methods to manage users
    Meteor.methods({
      'users.setUserRole': this._meteorSetUserRole,
      'users.reject': this._meteorRejectUser,
      'users.delete': this._meteorDeleteUser,
    });
    this._registerPublications();
  };

  /**
   * Registers users-related publications.
   *
   * NOTE: publish handlers must use plain `function () {}` so `this` binds to the
   * Subscription (giving access to `this.userId` / `this.ready()`), not the manager.
   */
  _registerPublications = () => {
    // Publishes the current user's profile and roles to the client.
    // Explicitly excludes services.* (OAuth tokens/secrets).
    Meteor.publish('user.details', function () {
      if (!this.userId) {
        return this.ready();
      }
      return Meteor.users.find(
        { _id: this.userId },
        {
          fields: {
            'profile.name': 1,
            'profile.email': 1,
            'profile.avatar': 1,
            userRoles: 1,
          },
        }
      );
    });

    // Lists every user. Admin-only — the User Moderation page consumes this and
    // must not be visible to non-admins (it exposes profile name/email + roles).
    //
    // `services` is read server-side only (it holds OAuth tokens / password
    // hashes) to derive the auth `sources`; it is stripped before publishing —
    // only the derived `sources` array reaches the client.
    Meteor.publish('users.all', async function () {
      if (!this.userId) {
        return this.ready();
      }
      // Requires at least VIEW access to the USERS system element. Fail the
      // subscription (not a silent empty list) so the client can replace the
      // section with a "no access" legend.
      if (!(await new OroRoles().canAccessSystemElement(
        this.userId, RESOURCE_SINGLETONS.USERS, ACCESS_LEVEL_VIEW
      ))) {
        return this.error(new Meteor.Error('Unauthorized'));
      }
      // eslint-disable-next-line no-unused-vars
      const stripServices = ({ services, ...rest }) => rest;
      const handle = await Meteor.users.find(
        {},
        {
          fields: {
            'profile.name': 1,
            'profile.email': 1,
            'profile.avatar': 1,
            emails: 1,
            userRoles: 1,
            createdAt: 1,
            lastSeenTs: 1,
            services: 1,
          },
          sort: { createdAt: -1 },
        }
      ).observeChangesAsync({
        added: (id, fields) => {
          // `added` carries the full projection: always derive `sources`.
          this.added('users', id, { ...stripServices(fields), sources: getUserSources(fields) });
        },
        changed: (id, fields) => {
          // `changed` carries only changed fields: re-derive `sources` only when
          // an input to it (services/emails) actually changed; otherwise leave
          // the previously published `sources` untouched (e.g. on role changes).
          const rest = stripServices(fields);
          if ('services' in fields || 'emails' in fields) {
            rest.sources = getUserSources(fields);
          }
          this.changed('users', id, rest);
        },
        removed: (id) => {
          this.removed('users', id);
        },
      });
      this.ready();
      this.onStop(() => handle.stop());
      return undefined;
    });
  };

  /**
   * Assigns a role to a user. A null/empty `roleId` clears the user's roles
   * (leaving them as a pending member with no access).
   *
   * @param {string} userId The user whose role is being set
   * @param {string} roleId The role to assign (or null/empty to clear roles)
   * @param {object} user The user authoring the change (used for audit logging)
   */
  setUserRole = async ({ userId, roleId, user }) => {
    const oroRoles = new OroRoles();
    // Validate the role exists so we surface a clean Meteor.Error to the client
    if (roleId && !(await oroRoles.validRole(roleId))) {
      throw new Meteor.Error(`Invalid role: ${roleId}`);
    }
    const targetUser = await Meteor.users.findOneAsync({ _id: userId });
    if (!targetUser) {
      throw new Meteor.Error(`User not found: ${userId}`);
    }
    // Prevent privilege escalation: the role being assigned must not be higher than
    // the acting user's own (highest) role. Skipped for internal/system callers
    // (no `user`). Clearing roles (null roleId) ranks 0, so it is always allowed.
    if (user && getRoleRank(roleId) > getRolesRank(user.userRoles)) {
      throw new Meteor.Error('Cannot assign a role higher than your own');
    }
    // Delegate the actual persistence to OroRoles (which owns the userRoles field).
    await oroRoles.setRole({ userId, roleId });
    // Audit-log the change
    if (user) {
      const role = roleId ? await oroRoles.fetchRole(roleId) : null;
      new EventLog().logSetting({
        settingGroupName: EVENT_SETTINGS_SECTION_NAMES.PERMISSIONS,
        settingName: roleId
          ? `Granted ${role?.label || roleId} role to ${getUserName(targetUser)}`
          : `Removed roles from ${getUserName(targetUser)}`,
        eventType: EVENT_TYPES.SETTING_UPDATED,
        user,
      });
    }
    return true;
  };

  /**
   * Meteor call to assign a role to a user. Invoked from the User Moderation UI
   * as `users.setUserRole(userId, roleId)`.
   *
   * Only users with CONFIGURE access on the USERS system element (admins) may
   * change roles.
   */
  async _meteorSetUserRole(userId, roleId) {
    if (!await new OroRoles().canAccessSystemElement(
      this.userId, RESOURCE_SINGLETONS.USERS, ACCESS_LEVEL_CONFIGURE
    )) {
      throw new Meteor.Error('User not authorized to manage users');
    }
    return new UsersManager().setUserRole({
      userId,
      roleId,
      user: await Meteor.userAsync(),
    });
  }

  /**
   * Removes a user from the database and audit-logs it. Shared by rejecting
   * pending users and deleting existing ones; `action` is the verb used in the
   * audit log entry.
   *
   * @param {string} userId The user to remove
   * @param {object} user The user authoring the change (used for audit logging)
   * @param {string} action Verb describing the removal (e.g. 'Deleted')
   */
  // eslint-disable-next-line class-methods-use-this
  _removeUser = async ({ userId, user, action }) => {
    const targetUser = await Meteor.users.findOneAsync({ _id: userId });
    if (!targetUser) {
      throw new Meteor.Error(`User not found: ${userId}`);
    }
    await Meteor.users.removeAsync({ _id: userId });
    // Audit-log the change
    if (user) {
      new EventLog().logSetting({
        settingGroupName: EVENT_SETTINGS_SECTION_NAMES.PERMISSIONS,
        settingName: `${action} user ${getUserName(targetUser)}`,
        eventType: EVENT_TYPES.SETTING_UPDATED,
        user,
      });
    }
    return true;
  };

  /**
   * Rejects a user. For now this simply removes the user from the database
   * (used to reject pending registrations).
   *
   * @param {string} userId The user to reject/remove
   * @param {object} user The user authoring the change (used for audit logging)
   */
  rejectUser = async ({ userId, user }) => (
    this._removeUser({ userId, user, action: 'Rejected and removed' })
  );

  /**
   * Deletes an existing user, removing it from the database.
   *
   * @param {string} userId The user to delete
   * @param {object} user The user authoring the change (used for audit logging)
   */
  deleteUser = async ({ userId, user }) => (
    this._removeUser({ userId, user, action: 'Deleted' })
  );

  /**
   * Meteor call to reject (delete) a user. Invoked from the User Moderation UI
   * as `users.reject(userId)`.
   *
   * Only users with CONFIGURE access on the USERS system element (admins) may
   * reject users, and a user may not reject themselves.
   */
  async _meteorRejectUser(userId) {
    if (!await new OroRoles().canAccessSystemElement(
      this.userId, RESOURCE_SINGLETONS.USERS, ACCESS_LEVEL_CONFIGURE
    )) {
      throw new Meteor.Error('User not authorized to manage users');
    }
    if (userId === this.userId) {
      throw new Meteor.Error('You cannot reject your own user');
    }
    return new UsersManager().rejectUser({
      userId,
      user: await Meteor.userAsync(),
    });
  }

  /**
   * Meteor call to delete an existing user. Invoked from the User Moderation UI
   * as `users.delete(userId)`.
   *
   * Only users with CONFIGURE access on the USERS system element (admins) may
   * delete users, and a user may not delete themselves.
   */
  async _meteorDeleteUser(userId) {
    if (!await new OroRoles().canAccessSystemElement(
      this.userId, RESOURCE_SINGLETONS.USERS, ACCESS_LEVEL_CONFIGURE
    )) {
      throw new Meteor.Error('User not authorized to manage users');
    }
    if (userId === this.userId) {
      throw new Meteor.Error('You cannot delete your own user');
    }
    return new UsersManager().deleteUser({
      userId,
      user: await Meteor.userAsync(),
    });
  }
}

export default UsersManager;
