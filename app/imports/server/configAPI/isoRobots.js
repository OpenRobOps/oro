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
 * Gate 2 of ISO 21423 robot onboarding: admission to the fleet.
 *
 * Applying an `IsoRobot` configuration object creates the ORO `robots` document that admits a
 * robot; clearing it revokes admission. Ingest's `AdmittedRoster` polls that collection, so the
 * robot document IS the admission record — there is no separate `approved` flag to drift.
 *
 * `metadata.id` is the robot's ISO entity uuid AND its ORO robot id: `VALID_ID_REGEXP`
 * (`app/imports/shared/constants.js:160-161`) accepts a canonical UUID verbatim, so no mapping
 * table is needed anywhere in the integration.
 *
 * Chosen over a bespoke REST route because ORO has none for robot creation, and operators already
 * drive this integration's other prerequisites (ActionDefinitions, DataSourceDefinitions) through
 * the config API.
 */
import Validator from 'fastest-validator';

import Robot from '../model/robot';
import { Robots } from '../../lib/collections';
import { SchemaError, ValidationError, LIST_FORMAT_SHORT } from '../../shared/configAPI';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * ISO 21423 protocol namespace; must match the SDK's `ROOT_NAMESPACE`
 * (`ts-sdk/src/types/constants.ts:1`). Redeclared here, the same way `isoMqttConfig.js:58` does,
 * rather than imported from `@openrobops/iso21423`: that package's built `dist/` chunks import
 * bare `@swc/helpers/_/*` specifiers that aren't declared as one of its runtime dependencies, so
 * they resolve fine for the server bundle (which walks up from the symlinked package into this
 * app's own node_modules) but fail to resolve for the client test bundle, which Rspack builds by
 * following the symlink to its real path outside this app's node_modules tree entirely. That's an
 * upstream packaging gap in the SDK, out of scope for this app-side change.
 */
const ROOT_NAMESPACE = '/ISO_21423/v1';

/**
 * The value stored as an ISO robot's `version` (the UI's agent-version column).
 *
 * Derived from the protocol namespace rather than hardcoded outright (decision 12), so a future
 * `/v2` protocol namespace changes this by editing one constant above, and the recorded version
 * can never quietly drift from the wire it was derived from.
 */
const ISO_VERSION = `iso-21423-${ROOT_NAMESPACE.split('/').pop()}`;   // 'iso-21423-v1'

const IsoRobotSpecSchema = {
  $$strict: true,
  label: { type: 'string', optional: true, empty: false },
  manufacturerName: { type: 'string', optional: true, empty: false },
  hostname: { type: 'string', optional: true, empty: false },
};
const specValidator = new Validator().compile(IsoRobotSpecSchema);

/**
 * Builds the robot's display name, in descending order of what the operator actually told us.
 * `Robot.createAsync` requires a non-empty name (`app/imports/lib/collections.js:38`).
 */
const nameFor = (uuid, spec) => {
  if (spec.label) return spec.label;
  if (spec.manufacturerName) return `${spec.manufacturerName} ${uuid.slice(0, 8)}`;
  return uuid;
};

export class IsoRobotConfigAPIHandler {
  constructor(configApi) {
    this._configApi = configApi;
  }

  /** Scoped system-wide: an ISO robot is admitted to the deployment, not to one entity's config. */
  isGlobalConfig = () => false;

  /**
   * Lists admitted ISO robots — the `robots` documents whose `_id` is a UUID. Wire robots have
   * operator-chosen ids and are deliberately invisible to this kind.
   *
   * @returns {Promise<Array<Object>>} config objects in the same shape `apply` accepts
   */
  list = async ({ id = null, format = LIST_FORMAT_SHORT } = {}) => {
    const query = id ? { _id: id } : {};
    const docs = await Robots.find(query, { projection: { name: 1, hostname: 1 } }).fetchAsync();
    return docs
      .filter((doc) => UUID_RE.test(String(doc._id)))
      .map((doc) => ({
        apiVersion: 'v0.1',
        kind: 'IsoRobot',
        metadata: { id: doc._id, scope: 'system/0' },
        ...(format === LIST_FORMAT_SHORT
          ? {}
          : { spec: { label: doc.name, ...(doc.hostname ? { hostname: doc.hostname } : {}) } }),
      }));
  };

  /**
   * Admits a robot, or updates an already-admitted one's display fields. Idempotent.
   *
   * @throws {ValidationError} when `metadata.id` is not a UUID
   * @throws {SchemaError} when the spec carries unknown keys
   */
  apply = async ({ configObject }) => {
    const uuid = String(configObject?.metadata?.id || '').toLowerCase();
    if (!UUID_RE.test(uuid)) {
      throw new ValidationError(
        `IsoRobot metadata.id must be the robot's ISO entity UUID (got "${configObject?.metadata?.id}")`);
    }
    const spec = configObject.spec || {};
    const validation = specValidator(spec);
    if (validation !== true) {
      throw new SchemaError(
        `IsoRobot spec is invalid: ${validation.map((v) => v.message).join('; ')}`);
    }

    const name = nameFor(uuid, spec);
    const existing = await Robots.findOneAsync({ _id: uuid });
    if (existing) {
      // Re-apply updates only what this kind owns; ingest owns status/updateStamp.
      const $set = { name };
      if (spec.hostname) $set.hostname = spec.hostname;
      await Robots.updateAsync({ _id: uuid }, { $set });
      return;
    }
    await Robot.createAsync({
      robotId: uuid,
      name,
      agentVersion: ISO_VERSION,
      hostname: spec.hostname,
    });
    console.log(`IsoRobot: admitted ISO robot ${uuid} ("${name}")`);
  };

  /**
   * Revokes admission by deleting the robot document. Ingest stops observing it on its next roster
   * refresh, and the broker credential (Gate 1) is deliberately left in place — revoking fleet
   * membership is not the same decision as revoking the ability to publish, and
   * `mqtt_credentials.suspended` is the control for the latter.
   */
  clear = async ({ configObject }) => {
    const uuid = String(configObject?.metadata?.id || '').toLowerCase();
    if (!UUID_RE.test(uuid)) {
      throw new ValidationError('IsoRobot metadata.id must be the robot\'s ISO entity UUID');
    }
    await Robots.removeAsync({ _id: uuid });
    console.log(`IsoRobot: revoked ISO robot ${uuid}`);
  };
}

export { ISO_VERSION };
export default IsoRobotConfigAPIHandler;
