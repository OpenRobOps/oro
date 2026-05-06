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
 * Class to wrap access to logs
 */
import { Mongo } from 'meteor/mongo';
import SimpleSchema from 'simpl-schema';
// ORO modules
import { COLLECTIONS } from '../../shared/constants';
import OroRoles from '../roles';
import { ACCESS_LEVEL_VIEW, RESOURCE_TYPES, RESOURCE_SINGLETONS, glueId } from '../../shared/roles';

// Collection (serverside only; we don't publish data but use a meteor method for easier switching to http)
// TODO Consider adding an expiration index
const EventLog = new Mongo.Collection(COLLECTIONS.EVENT_LOG);
const COMMON_FIELDS = ['module', 'eventType', 'userId', 'userName', 'userEmail', 'robotId', 'robotName', 'ts']
const EventLogSchema = new SimpleSchema({
  // top level event data (mandatory)
  module: { type: String, optional: false },
  eventType: { type: String, optional: false },
  ts: { type: Number, optional: false },
  // user data (optional)
  userId: { type: String, optional: true },
  userName: { type: String, optional: true },
  userEmail: { type: String, optional: true },
  // robot data (optional)
  robotId: { type: String, optional: true },
  robotName: { type: String, optional: true },
  // module-specific data, blackbox
  eventData: { type: Object, optional: true, blackbox: true }
});
if (Meteor.isDevelopment) {
  EventLog.attachSchema(EventLogSchema);
}
if (Meteor.isServer) {
  EventLog.rawCollection().createIndex({ ts: 1 });
  EventLog.rawCollection().createIndex({ module: 1, ts: 1 });
}


let instance;

class AuditLogManager {
  _store = null;

  constructor() {
    // Only construct an instance if it hasn't been done yet
    if (instance === undefined) {
      instance = this;
    }
    // eslint-disable-next-line no-constructor-return
    return instance;
  }

  init = async ({ eventStore }) => {
    if (!eventStore) {
      throw new Error('eventStore is required');
    }
    this._store = eventStore;
    Meteor.methods({
      'auditLogs.get': this._meteorGetAuditLog
    });
  }

  _meteorGetAuditLog = async function ({ startTs, endTs, robotId, eventType, limit = 100 }) {
    if (robotId) {
      if (!await new OroRoles().canAccessRobot(this.userId, robotId, ACCESS_LEVEL_VIEW)) {
        throw new Meteor.Error(`User not authorized to read audit logs from robot ${robotId}`);
      }
    } else { // logs from all robots; require access to entire fleet
      if (!await new OroRoles().canAccess(
        this.userId,
        glueId(RESOURCE_TYPES.SYSTEM, RESOURCE_SINGLETONS.FLEET),
        ACCESS_LEVEL_VIEW
      )) {
        throw new Meteor.Error(`User not authorized to read fleet audit logs`);
      }
    }
    return new AuditLogManager()._store.findEvents({ startTs, endTs, robotId, eventType, limit });
  }
}

export default AuditLogManager;
export { EventLog };