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
 * Server-only collections
 */
import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import SimpleSchema from 'simpl-schema';
import { COLLECTIONS } from '../shared/constants';

// Our copy of the generated MQTT credentials
const MqttLogins = new Mongo.Collection(COLLECTIONS.MQTT_CREDENTIALS);
if (Meteor.isDevelopment) {
  MqttLogins.schema = new SimpleSchema({
    robotId: { type: String, required: false },
    username: String,
    password: String,
    encryptedPassword: { type: String, required: false },
    superuser: { type: Boolean, required: false },
    acls: { type: Array, required: false },
    'acls.$': { type: Object },
    'acls.$.topic': { type: String },
    'acls.$.acc': { type: SimpleSchema.Integer },
    // New field added in 1.20.0. Optional after 4.3.0 to support late binding.
    brokerId: { type: String, required: false },
    // NOTE The following three properties can currently only be
    // set manually in the DB, there is no UI for configuration.
    // TODO Unfold these into a hierarchical configuration capable
    // collection.
    hostname: { type: String, required: false },
    port: { type: String, required: false },
    websocket_port: { type: String, required: false },
    tsCreated: Number,
    tsUsed: { type: Number, required: false }, // Last time it was used
    // If suspended is false, the credentials will never be sent back
    // to the client, returning instead a 403 response on the mqtt_config endpoint.
    // See web/server/model/company.js#suspendAccountAsync and Accounts management doc:
    // https://docs.google.com/document/d/1U6VGCRJg6lwatwl-V5AUQqn2YhhYqiZ25gMd4Qbxe_g/
    suspended: { type: Boolean, required: false },
    // If brokerCredentialsPending == true, then the credentials weren't created
    // in the broker, for example due to an API error.
    brokerCredentialsPending: { type: Boolean, required: false },
    status: { type: String, required: false }
  }, { requiredByDefault: true });
  MqttLogins.attachSchema(MqttLogins.schema);
}
MqttLogins.rawCollection().createIndex({ username: 1 }, { unique: true, partialFilterExpression: { username: { $exists: 1 } } });
// NOTE This index was replaced in app-server version 4.3.0 to make unique optional
// Makes robotId unique only if it is present
MqttLogins.rawCollection().createIndex({ robotId: 1 },
  { unique: true, partialFilterExpression: { robotId: { $exists: true } } });


export {
  MqttLogins,
};
