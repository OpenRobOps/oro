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
 * Collections, constants and client-side functions to support actions.
 */
import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import SimpleSchema from 'simpl-schema';
import { isObject } from 'lodash';
// ORO modules
import { COLLECTIONS } from '../shared/constants';
import { isActionDisabledLocked } from './lock';
import {
  ACTION_UPDATE_USER_FIELDS,
  ACTION_TYPES,
  NAVIGATE_TO_ACTION_ID,
  RELOCALIZE_ACTION_ID,
  TELEOP_ACTION_ID,
  NAVIGATE_PATH_ID,
  CANCEL_NAV_GOAL_ID,
  ARGNAME_SCRIPT_FILENAME,
  ARGNAME_PUBLISH_MESSAGE,
  ARGNAME_GO_URL,
  ARGNAME_GO_PATH,
  createInternalActionId,
  CAMERA_TOGGLE_ID
} from '../shared/actions';

/*
 * Schema for action templates, each of the `template` field in action definitions below.
 */
const ActionTemplateSchema = new SimpleSchema({
  label: { type: String, required: true },
  lock: { type: Boolean, required: false },
  internal: { type: Boolean, required: false, defaultValue: false },
  client: { type: Boolean, required: false, defaultValue: false },
  disableAddingArgs: { type: Boolean, required: false, defaultValue: false },
  context: { type: Object, blackbox: true, required: false, defaultValue: {} },
  elementList: { type: Array, blackbox: true, required: false, defaultValue: [] },
  'elementList.$': { type: String, required: true },
  elementValues: { type: Object, required: false, defaultValue: {}, blackbox: true }
});

const Schemas = {};

const ActionDefinitions = new Mongo.Collection(COLLECTIONS.ACTION_DEFINITIONS);
/*
 * This schema contains lots of fields and details... Refer to design doc:
 *
 * _id: string // actionId
 * type: string, // type from ACTION_TYPES
 * label: string, // human readable, user set name
 * description: string (optional), // human readable, action description
 * icon: string,    // Icon for this action. Could be anything that goes into the 'src' field
 *                  // of an img, such as a base64 data or an image URL.
 * tooltip: string, // Tooltip text for the action
 * order: number,   // If present, used to sort actions by numerical order
 * client: bool (optional), // (default: false) if this is a client-side action
 * isTemplate: bool (optional) // if this action is a system template, not to be used directly
 * context: { // context on which or for which this action will execute -- normally a robot
 *   robotId: null, // optional; if action applies to a robot, placeholder for robotId
 *   fleetId ?
 * },
 * confirmation { // if confirmation is needed. See design doc
 *   required: bool,
 *   message: string,
 *   buttonLabel: string
 * }
 * widgets: [array of widget names to embed the action in],
 * elementList: [array of argument names]
 * elementValues: { // values (constants) or placeholders
 *   // for each argument required by this action
 *   arg1: { value: _, type: _, label: _ }
 *   ...
 * }
 * disableAddingArgs: bool, optional // if user can add more args to this template
 * createdTs: Number // creation timestamp
 * updatedTs: Number // last updte timestamp
 */


const ActionTokens = new Mongo.Collection(COLLECTIONS.ACTION_TOKENS);
Schemas.ActionTokens = new SimpleSchema({
  actionId: String,
  // TODO(herchu) define exact meaning; or completely remove
  sourceId: { type: String, optional: true },
  type: String,
  label: String,
  target: { type: String, optional: true },
  context: { type: Object, blackbox: true },
  elementList: Array,
  // eslint-disable-next-line indent
    'elementList.$': String,
  elementValues: { type: Object, blackbox: true },
  nonce: { type: String, optional: true },
  createdTs: Number,
  lock: { type: Boolean, optional: true },
  confirmation: { type: Object, optional: true },
  description: { type: String, optional: true },
  // eslint-disable-next-line indent
    'confirmation.required': Boolean
}, { requiredByDefault: true });
if (Meteor.isDevelopment) {
  ActionTokens.attachSchema(Schemas.ActionTokens);
}
if (Meteor.isServer) {
  ActionTokens.rawCollection().createIndex({ sourceId: 1 });
  ActionTokens.rawCollection().createIndex({ createdTs: 1 });
  ActionTokens.rawCollection().createIndex({ nonce: 1, actionId: 1 }, { unique: true });
}

export {
  // Action types, schemas and system IDs
  ActionTemplateSchema,
  ACTION_UPDATE_USER_FIELDS,
  ACTION_TYPES,
  NAVIGATE_TO_ACTION_ID,
  RELOCALIZE_ACTION_ID,
  TELEOP_ACTION_ID,
  NAVIGATE_PATH_ID,
  CANCEL_NAV_GOAL_ID,
  CAMERA_TOGGLE_ID,
  // Collections
  ActionDefinitions,
  ActionTokens,
  // Special arguments
  ARGNAME_SCRIPT_FILENAME,
  ARGNAME_PUBLISH_MESSAGE,
  ARGNAME_GO_URL,
  ARGNAME_GO_PATH,
  // Utility functions
  createInternalActionId,
};
