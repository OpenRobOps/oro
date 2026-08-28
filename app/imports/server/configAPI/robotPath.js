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
 * `RobotPath` kind: styling of the paths the Navigation widget draws (`localization.paths.<id>`).
 * Writes `ui_preferences.map.robotPath` ({ elementList, elementValues }) at system or robot scope;
 * a robot-scope entry for a path id replaces the system entry for that id (see shared/robotPath.js).
 */
import Validator from 'fastest-validator';
import OroRoles from '../roles';
import { UIPreferences } from '../../lib/collections';
import {
  SchemaError, ValidationError, AuthorizationError, LIST_FORMAT_SHORT, KIND_ROBOT_PATH,
} from '../../shared/configAPI';
import { RESOURCE_SINGLETONS, ACCESS_LEVEL_CONFIGURE, isSystemUser } from '../../shared/roles';
import { ID_DEFAULT, ID_TYPE_SYSTEM_WIDE, ID_TYPE_ROBOT } from '../../shared/constants';
import { robotPathFromSpec, robotPathToSpec } from '../../shared/robotPath';

const assertAuthorized = async (user) => {
  if (!user) throw new AuthorizationError('Unauthorized');
  if (!isSystemUser(user) && !await new OroRoles().canAccessSystemElement(
    user._id, RESOURCE_SINGLETONS.FLEET, ACCESS_LEVEL_CONFIGURE,
  )) throw new AuthorizationError('Unauthorized');
};

const color = { type: 'string', pattern: /^#[0-9a-fA-F]{6}$/ };
const styleSchema = {
  type: 'object', strict: true,
  props: {
    label: { type: 'string', optional: true },
    pointColor: { type: 'array', items: color, min: 1, max: 3, optional: true },
    lineColor: { type: 'array', items: color, min: 1, max: 2, optional: true },
    pointWidth: { type: 'number', positive: true, optional: true },
    lineWidth: { type: 'number', positive: true, optional: true },
    isDashed: { type: 'boolean', optional: true },
    shouldPersist: { type: 'boolean', optional: true },
  },
};
const validator = new Validator({ useNewCustomCheckerFunction: true });
// `validator.validate(value, styleSchema)` rejects a non-root schema, so compile it once as a
// root schema and call that instead.
const validateStyle = validator.compile({ $$root: true, ...styleSchema });
const specValidator = validator.compile({
  $$strict: true,
  paths: {
    type: 'object',
    custom: (value, errors) => {
      const ids = Object.keys(value || {});
      if (!ids.length) errors.push({ type: 'pathsEmpty', message: 'paths must have at least one path id' });
      ids.forEach((id) => {
        if (!/^[a-zA-Z0-9_-]+$/.test(id)) errors.push({ type: 'pathId', message: `invalid path id "${id}"` });
        const res = validateStyle(value[id]);
        if (res !== true) res.forEach((e) => errors.push({ ...e, message: `paths.${id}: ${e.message}` }));
      });
      return value;
    },
  },
});

const entityFor = (id) => (id === ID_TYPE_SYSTEM_WIDE
  ? { entityType: ID_TYPE_SYSTEM_WIDE, entityId: ID_DEFAULT }
  : { entityType: ID_TYPE_ROBOT, entityId: id });
const idFor = (doc) => (doc.entityType === ID_TYPE_SYSTEM_WIDE ? ID_TYPE_SYSTEM_WIDE : doc.entityId);
const idOf = (configObject) => {
  const id = String(configObject?.metadata?.id || '');
  if (!id) throw new ValidationError('metadata.id is required');
  return id;
};

export class RobotPathConfigAPIHandler {
  constructor(configApi) { this._configApi = configApi; }
  isGlobalConfig = () => false;

  list = async ({ id = null, user, format = LIST_FORMAT_SHORT } = {}) => {
    await assertAuthorized(user);
    const docs = await UIPreferences.find({ 'map.robotPath': { $exists: true }, ...(id ? entityFor(id) : {}) }).fetchAsync();
    if (format === LIST_FORMAT_SHORT) return docs.map((doc) => ({ id: idFor(doc), label: idFor(doc) }));
    return docs.map((doc) => ({
      apiVersion: 'v0.1', kind: KIND_ROBOT_PATH, metadata: { id: idFor(doc) }, spec: robotPathToSpec(doc.map.robotPath),
    }));
  };

  apply = async ({ configObject, user }) => {
    await assertAuthorized(user);
    const id = idOf(configObject);
    const spec = configObject.spec || {};
    const validation = specValidator(spec);
    if (validation !== true) {
      throw new SchemaError(`RobotPath spec is invalid: ${validation.map((v) => v.message).join('; ')}`);
    }
    await UIPreferences.upsertAsync(entityFor(id), { $set: { 'map.robotPath': robotPathFromSpec(spec.paths) } });
  };

  clear = async ({ configObject, user }) => {
    await assertAuthorized(user);
    await UIPreferences.updateAsync(entityFor(idOf(configObject)), { $unset: { 'map.robotPath': '' } });
  };
}
export default RobotPathConfigAPIHandler;
