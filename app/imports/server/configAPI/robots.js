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
 * `Robot` configuration kind: declares a robot by id, with its identity fields (label).
 *
 * A real robot can be pre-registered this way before its agent ever connects; ingest owns
 * status, pose and telemetry from then on, and re-applying only touches the identity fields.
 *
 * With `ghost: true` the robot is a static demo placeholder: it is marked with the platform's
 * ghost sentinel (`updateStamp` / `ts` = HACK_GHOST_UPDATE_STAMP_VALUE, which the UI treats as
 * "never stale") and the spec may also carry `pose`, `attributes` and `statuses`, written once
 * into the same collections ingest would write for a live robot. Those fields are rejected on
 * non-ghost robots: this kind is not a way to feed live data.
 */
import Validator from 'fastest-validator';

import Robot from '../model/robot';
import OroRoles from '../roles';
import { Robots, RobotLocalization, RobotKeyValues } from '../../lib/collections';
import { AttrValues } from '../../lib/attributes';
import { RobotStatus } from '../../lib/status';
import { STATUS } from '../../shared/status';
import { HACK_GHOST_UPDATE_STAMP_VALUE } from '../../shared/constants';
import { VITAL_ONLINE } from '../../shared/attributes';
import {
  SchemaError, ValidationError, AuthorizationError, LIST_FORMAT_SHORT, KIND_ROBOT,
} from '../../shared/configAPI';
import { RESOURCE_SINGLETONS, ACCESS_LEVEL_CONFIGURE, isSystemUser } from '../../shared/roles';

const GHOST_TS = HACK_GHOST_UPDATE_STAMP_VALUE;
const GHOST_VERSION = 'ghost';
// Shown as the agent version until the real agent reports one
const UNKNOWN_VERSION = 'unknown';
const STATIC_DATA_FIELDS = ['pose', 'attributes', 'statuses'];
const STATUS_NAMES = ['OK', 'WARN', 'ERROR'];

// Same guard as isoRobots.js / moduleState.js: configure access on the fleet singleton.
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

const scalar = { type: 'multi', rules: ['string', 'number', 'boolean'] };
const RobotSpecSchema = {
  $$strict: true,
  label: { type: 'string', optional: true, empty: false },
  ghost: { type: 'boolean', optional: true },
  pose: {
    type: 'object',
    optional: true,
    strict: true,
    props: { x: 'number', y: 'number', theta: { type: 'number', optional: true } },
  },
  attributes: { type: 'record', optional: true, value: scalar },
  statuses: { type: 'record', optional: true, value: { type: 'enum', values: STATUS_NAMES } },
};
const specValidator = new Validator().compile(RobotSpecSchema);

const validateSpec = (spec) => {
  const validation = specValidator(spec);
  if (validation !== true) {
    throw new SchemaError(`Robot spec is invalid: ${validation.map((v) => v.message).join('; ')}`);
  }
  const staticFields = STATIC_DATA_FIELDS.filter((f) => spec[f] !== undefined);
  if (!spec.ghost && staticFields.length) {
    throw new SchemaError(
      `Robot spec fields ${staticFields.join(', ')} are only allowed on ghost robots (ghost: true)`);
  }
};

const stamped = (values, wrap = (v) => ({ value: v })) => Object.fromEntries(
  Object.entries(values).map(([k, v]) => [k, { ...wrap(v, k), ts: GHOST_TS }]));

export class RobotConfigAPIHandler {
  constructor(configApi) {
    this._configApi = configApi;
  }

  isGlobalConfig = () => false;

  list = async ({ id = null, user, format = LIST_FORMAT_SHORT } = {}) => {
    await assertAuthorized(user);
    const query = id ? { _id: id } : {};
    const docs = await Robots.find(query, { projection: { name: 1, updateStamp: 1 } })
      .fetchAsync();
    return docs.map((doc) => ({
      apiVersion: 'v0.1',
      kind: KIND_ROBOT,
      metadata: { id: doc._id, scope: '' },
      ...(format === LIST_FORMAT_SHORT ? {} : {
        spec: {
          label: doc.name,
          ...(doc.updateStamp === GHOST_TS ? { ghost: true } : {}),
        },
      }),
    }));
  };

  apply = async ({ configObject, user }) => {
    await assertAuthorized(user);
    const robotId = configObject.metadata.id;
    const spec = configObject.spec || {};
    validateSpec(spec);

    const existing = await Robots.findOneAsync({ _id: robotId }, { projection: { _id: 1 } });
    if (!existing) {
      await Robot.createAsync({
        robotId,
        name: spec.label || robotId,
        agentVersion: spec.ghost ? GHOST_VERSION : UNKNOWN_VERSION,
      });
    }
    const $set = {};
    if (spec.label) $set.name = spec.label;
    if (spec.ghost) {
      Object.assign($set, { updateStamp: GHOST_TS, 'status.agentOnline': true, version: GHOST_VERSION });
    }
    if (Object.keys($set).length) {
      await Robots.updateAsync({ _id: robotId }, { $set });
    }

    if (spec.ghost) {
      await this._writeGhostData(robotId, spec);
    }
    console.log(`Robot: applied ${spec.ghost ? 'ghost ' : ''}robot ${robotId}`);
  };

  // Static data a ghost carries, in the collections ingest writes for a live robot.
  _writeGhostData = async (robotId, { pose, attributes = {}, statuses = {} }) => {
    const upsert = (coll, $set) => coll.updateAsync({ _id: robotId }, { $set }, { upsert: true });
    await upsert(AttrValues, stamped({ ...attributes, [VITAL_ONLINE]: true }));
    await upsert(RobotKeyValues, stamped(attributes));
    await upsert(RobotStatus, stamped(statuses, (s, attrId) => ({ name: attrId, value: STATUS[s].value })));
    if (pose) {
      await upsert(RobotLocalization, {
        robotPose: { x: pose.x, y: pose.y, theta: pose.theta || 0, ts: GHOST_TS },
        robotPoseUpdatedTs: GHOST_TS,
      });
    }
  };

  clear = async ({ configObject, user }) => {
    await assertAuthorized(user);
    const robotId = configObject.metadata.id;
    const doc = await Robots.findOneAsync({ _id: robotId }, { projection: { updateStamp: 1, status: 1 } });
    if (!doc) {
      return;
    }
    const ghost = doc.updateStamp === GHOST_TS;
    if (!ghost && doc.status?.agentOnline) {
      throw new ValidationError(`Robot ${robotId} is online; it cannot be cleared`);
    }
    await Robots.removeAsync({ _id: robotId });
    if (ghost) {
      for (const coll of [AttrValues, RobotKeyValues, RobotStatus, RobotLocalization]) {
        await coll.removeAsync({ _id: robotId });
      }
    }
    console.log(`Robot: cleared ${ghost ? 'ghost ' : ''}robot ${robotId}`);
  };
}

export default RobotConfigAPIHandler;
