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

/* eslint-disable class-methods-use-this */
/**
 * Configuration API implementation for system-wide Module States.
 *
 * Manages the system layer of the module_states collection
 * (entityType='system', entityId='0'). All other documents in the collection
 * (robot/agent/client/user scoped) are ignored.
 *
 * Each config object maps 1:1 to a moduleName. The spec carries a blackbox
 * `state` object whose fields are spread into the mongo document on apply().
 */
import Validator from 'fastest-validator';
// ORO modules
import OroRoles from '../roles';
import {
  RESOURCE_SINGLETONS,
  ACCESS_LEVEL_CONFIGURE,
  isSystemUser
} from '../../shared/roles';
import {
  SchemaError,
  ValidationError,
  AuthorizationError,
  LIST_FORMAT_SHORT,
  LIST_FORMAT_FULL,
} from '../../shared/configAPI';
import { ID_DEFAULT, ID_TYPE_SYSTEM_WIDE } from '../../shared/constants';
import { RobotModuleState } from '../../lib/collections';

// Identification fields that scope this handler to system-wide module states.
const SYSTEM_FILTER = { entityType: ID_TYPE_SYSTEM_WIDE, entityId: ID_DEFAULT };

// The spec carries a single `state` object whose contents are intentionally
// not validated (blackbox). $$strict rejects any other top-level spec keys.
const ModuleStateSpecApplySchema = {
  $$strict: true,
  state: { type: 'object' },
};
const moduleStateSpecValidator = new Validator().compile(ModuleStateSpecApplySchema);

// Strip identification + mongo plumbing fields from a doc; everything else
// is part of the externally-visible state blob.
const docToState = ({
  // eslint-disable-next-line no-unused-vars
  _id, entityId, entityType, moduleName, ...state
}) => state;

const docToShortConfigObject = doc => ({ id: doc.moduleName });

const docToFullConfigObject = doc => ({
  apiVersion: 'v0.1',
  metadata: { id: doc.moduleName },
  spec: { state: docToState(doc) },
});

const assertAuthorized = async (user) => {
  if (!user) {
    throw new AuthorizationError('Unauthorized');
  }
  if (!isSystemUser(user) && !await new OroRoles().canAccessSystemElement(
    user._id,
    RESOURCE_SINGLETONS.FLEET,
    ACCESS_LEVEL_CONFIGURE,
  )) {
    throw new AuthorizationError('Unauthorized');
  }
};

export default class ModuleStateConfigAPIHandler {
  constructor(configApi) {
    if (!configApi) {
      throw new Error('reference to configApi must be received');
    }
    this._configApi = configApi;
  }

  /**
   * Module states are per-moduleName, not a single global config.
   */
  isGlobalConfig = () => false;

  /**
   * Lists system-wide module state documents.
   */
  list = async ({ id, user, format = LIST_FORMAT_SHORT }) => {
    await assertAuthorized(user);
    const query = { ...SYSTEM_FILTER };
    if (id) {
      query.moduleName = id;
    }
    const docs = await RobotModuleState.find(query).fetchAsync();
    if (format === LIST_FORMAT_SHORT) {
      return docs.map(docToShortConfigObject);
    }
    if (format === LIST_FORMAT_FULL) {
      return docs.map(docToFullConfigObject);
    }
    throw new ValidationError(`Invalid format ${format}`);
  };

  /**
   * Applies a module state. A null/missing spec suppresses (deletes) the doc.
   * When spec is present, the doc is fully replaced: fields removed from
   * spec.state disappear from mongo.
   */
  apply = async ({ configObject, user }) => {
    if (!configObject.metadata) {
      throw new ValidationError('Configuration object must have metadata');
    }
    await assertAuthorized(user);
    const moduleName = configObject.metadata.id;
    const { spec } = configObject;

    if (!spec) {
      await RobotModuleState.removeAsync({ ...SYSTEM_FILTER, moduleName });
      return;
    }

    const validation = moduleStateSpecValidator(spec);
    if (validation !== true) {
      throw new SchemaError(
        (validation.length && validation[0].message) || 'Invalid schema'
      );
    }

    // Spread state first so identification fields always win, even if the
    // caller accidentally includes them inside `state`.
    await RobotModuleState.upsertAsync(
      { ...SYSTEM_FILTER, moduleName },
      { ...spec.state, ...SYSTEM_FILTER, moduleName },
    );
  };

  /**
   * Deletes the matching system-wide module state document, if any.
   */
  clear = async ({ configObject, user }) => {
    if (!configObject.metadata) {
      throw new ValidationError('Configuration object must have metadata');
    }
    await assertAuthorized(user);
    const moduleName = configObject.metadata.id;
    await RobotModuleState.removeAsync({ ...SYSTEM_FILTER, moduleName });
  };
}
