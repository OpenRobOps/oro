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
 * Configuration API implementation for Incident Definitions.
 *
 * Incident definitions are global and keyed by triggerId (the attribute id that
 * triggers the incident). They are stored in the IncidentConfiguration collection
 * with _id === triggerId. This handler only manages configuration; creating and
 * resolving incidents is handled elsewhere (the creation engine).
 *
 * NOTE about namings:
 *  - "incident definition" is the stored document (see IncidentConfiguration).
 *  - "config object" is the API-level object ({ metadata, spec }); its schema
 *    differs from the stored document, so this module converts between them.
 */
import Validator from 'fastest-validator';
// ORO modules
import OroRoles from '../roles';
import {
  RESOURCE_SINGLETONS, ACCESS_LEVEL_CONFIGURE, isSystemUser
} from '../../shared/roles';
import {
  SchemaError, ValidationError, AuthorizationError,
  LIST_FORMAT_SHORT, LIST_FORMAT_FULL
} from '../../shared/configAPI';
import { IncidentConfiguration } from '../../lib/alerts';
import { ICM_SEV_ALL } from '../../shared/alerts';

// Supports per-level severity, autoActions (run automatically) and manualActions
// (ids of actions an operator runs by hand from an in-app notification).
// The `ok` block has no manual actions (a resolved incident has nothing to act on).
const ACTION_IDS = {
  type: 'array', optional: true, items: { type: 'string', empty: false }
};

const LEVEL_BLOCK = {
  type: 'object',
  optional: true,
  strict: true,
  props: {
    severity: { type: 'enum', values: ICM_SEV_ALL, optional: true },
    autoActions: ACTION_IDS,
    manualActions: ACTION_IDS
  }
};

const IncidentDefinitionSpecApplySchema = {
  $$strict: true,
  label: { type: 'string', optional: true, empty: false },
  labelTemplate: { type: 'string', optional: true, empty: false },
  error: LEVEL_BLOCK,
  warning: LEVEL_BLOCK,
  ok: { type: 'object', optional: true, strict: true, props: { autoActions: ACTION_IDS } }
};

const incidentDefinitionSpecValidator = new Validator().compile(IncidentDefinitionSpecApplySchema);

/**
 * Converts a config object into the stored incident definition document.
 */
const configObjectToIncidentDefinition = (configObject) => {
  const { spec } = configObject;
  const triggerId = configObject.metadata.id;
  const def = { _id: triggerId, triggerId };
  if (spec.label !== undefined) { def.label = spec.label; }
  if (spec.labelTemplate !== undefined) { def.labelTemplate = spec.labelTemplate; }
  if (spec.error) { def.error = { ...spec.error }; }
  if (spec.warning) { def.warning = { ...spec.warning }; }
  if (spec.ok) { def.ok = { ...spec.ok }; }
  return def;
};

/** Converts a stored definition into a LIST_FORMAT_SHORT list item. */
const incidentDefinitionToListItem = (def) => ({
  id: def._id,
  label: def.label || '',
  suppressed: false
});

/** Converts a stored definition into a LIST_FORMAT_FULL config object. */
const incidentDefinitionToConfigObject = (def) => ({
  metadata: { id: def._id },
  apiVersion: 'v0.1',
  spec: {
    label: def.label,
    labelTemplate: def.labelTemplate,
    error: def.error,
    warning: def.warning,
    ok: def.ok
  }
});

export default class IncidentsConfigAPIHandler {
  constructor(configApi) {
    if (!configApi) {
      throw new Error('reference to configApi must be received');
    }
    this._configApi = configApi;
  }

  // Definitions are individual config elements (one per triggerId), not a single global object.
  isGlobalConfig = () => false;

  apply = async ({ configObject, user }) => {
    if (!configObject.metadata) {
      throw new ValidationError('Configuration object must have metadata');
    }
    if (!isSystemUser(user) && (
      !await new OroRoles().canAccessSystemElement(
        user._id,
        RESOURCE_SINGLETONS.INCIDENTS,
        ACCESS_LEVEL_CONFIGURE))) {
      throw new AuthorizationError('Unauthorized');
    }
    const { spec } = configObject;
    const triggerId = configObject.metadata.id;
    if (spec) {
      const validation = incidentDefinitionSpecValidator(spec);
      if (validation !== true) {
        throw new SchemaError((validation.length && validation[0].message) || 'Invalid schema');
      }
      const def = configObjectToIncidentDefinition(configObject);
      await IncidentConfiguration.updateAsync({ _id: triggerId }, { $set: def }, { upsert: true });
    } else {
      // Null spec means suppress: remove the definition.
      await IncidentConfiguration.removeAsync({ _id: triggerId });
    }
  };

  clear = async ({ configObject, user }) => {
    if (!configObject.metadata) {
      throw new ValidationError('Configuration object must have metadata');
    }
    if (!await new OroRoles().canAccessSystemElement(
      user._id,
      RESOURCE_SINGLETONS.INCIDENTS,
      ACCESS_LEVEL_CONFIGURE)) {
      throw new AuthorizationError('Unauthorized');
    }
    await IncidentConfiguration.removeAsync({ _id: configObject.metadata.id });
  };

  list = async ({ id, user, format = LIST_FORMAT_SHORT }) => {
    if (!isSystemUser(user) && !await new OroRoles().hasRole(user._id)) {
      throw new AuthorizationError('Unauthorized');
    }
    const defs = id
      ? [await IncidentConfiguration.findOneAsync({ _id: id })].filter(Boolean)
      : await IncidentConfiguration.find({}).fetchAsync();
    if (format === LIST_FORMAT_SHORT) {
      return defs.map(incidentDefinitionToListItem);
    } else if (format === LIST_FORMAT_FULL) {
      return defs.map(incidentDefinitionToConfigObject);
    }
    throw new ValidationError(`Invalid format ${format}`);
  };
}

export {
  configObjectToIncidentDefinition,
  incidentDefinitionToListItem,
  incidentDefinitionToConfigObject
};
