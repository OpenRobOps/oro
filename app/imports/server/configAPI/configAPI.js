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
 * Configuration API
 */
import Validator from 'fastest-validator';
import { isEmpty, isObject } from 'lodash';
// ORO Modules
import IncidentsConfigAPIHandler from './incidentDefinitions';
import NotificationChannelsConfigAPIHandler from './notificationChannels';
// import RobotCameraAPIHandler from './robotCamera';
import DataSourcesConfigAPIHandler from './dataSourceDefinitions';
import ActionConfigAPIHandler from './actionDefinitions';
import DashboardsConfigAPIHandler from './dashboards';
import StatusConfigAPIHandler from './statusDefinitions';
import ModuleStateConfigAPIHandler from './moduleState';
import IsoRobotConfigAPIHandler from './isoRobots';
import SpatialAnnotationConfigAPIHandler from './spatialAnnotation';
// import MissionTrackingAPIHandler from './missionTracking';
import RobotFootprintConfigAPIHandler from './robotFootprint';
import SpatialTransformationConfigAPIHandler from './spatialTransformation';
// import PreferencesConfigAPIHandler from './preferences';
import {
  ValidationError,
  SchemaError,
  LIST_FORMAT_SHORT,
  LIST_FORMAT_FULL,
  KIND_ACTION_DEFINITION,
  KIND_STATUS_DEFINITION,
  KIND_DATASOURCE_DEFINITION,
  KIND_ROBOT_CAMERA,
  KIND_INCIDENT_DEFINITION,
  KIND_NOTIFICATION_CHANNEL,
  KIND_MISSION_TRACKING,
  KIND_ROBOT_FOOTPRINT,
  KIND_PREFERENCES,
  CONFIG_API_GLOBAL_ID,
  buildConfigObjectApplySchema,
  buildConfigObjectClearSchema,
  buildListFiltersSchema,
  KIND_DASHBOARD_DEFINITION,
  KIND_MODULE_STATE,
  KIND_ISO_ROBOT,
  KIND_SPATIAL_ANNOTATION,
  KIND_SPATIAL_TRANSFORMATION,
} from '../../shared/configAPI';
import { getSystemUser } from '../../shared/roles';
// import PeerApiKindHandler from './peerApiKindHandler';

const configObjectApplyValidator = new Validator().compile(buildConfigObjectApplySchema());
const configObjectClearValidator = new Validator().compile(buildConfigObjectClearSchema());
const listFiltersValidator = new Validator().compile(buildListFiltersSchema());
// In full format, the returned object follows the same rules as an input object in an
// `apply` operation, meaning whatever the `list` output is, it can be reapplied without
// modifications.
// Validate the output format using the same schema as the `apply` input + the case where the
// output is a root object.
const fullListOutputValidator = new Validator().compile(buildConfigObjectApplySchema(true, true));

const CONFIG_API_DUMMY_SCOPE_ID = '';

let instance;

/**
 * Main entry point for config as code operations.
 * This class leverages other classes that implement the handling of specific
 * object kinds.
 */
export default class ConfigAPI {
  constructor() {
    if (instance === undefined) {
      instance = this;
    }
    // eslint-disable-next-line no-constructor-return
    return instance;
  }

  /**
   * Initializes this processor
   *
   * @param {object} kindsManagersMap maps object kinds to managers that handle them.
   *  By default all implemented kinds are used, but overriding this can be useful
   *  during testing.
   */
  init = (options) => {
    const { peerApiKinds, kindsHandlersMap, ...moreArgs } = options || {};
    if (moreArgs && !isEmpty(moreArgs)) {
      // NOTE(herchu) strict check for NOT receiving other arguments, as this init() method
      // previously received positional arguments; and this will catch any older API call.
      throw new Error('Bad arguments', moreArgs);
    }
    this._kindsHandlers = kindsHandlersMap || {
      [KIND_INCIDENT_DEFINITION]: new IncidentsConfigAPIHandler(this),
      [KIND_NOTIFICATION_CHANNEL]: new NotificationChannelsConfigAPIHandler(this),
      // [KIND_ROBOT_CAMERA]: new RobotCameraAPIHandler(this),
      [KIND_DATASOURCE_DEFINITION]: new DataSourcesConfigAPIHandler(this),
      [KIND_STATUS_DEFINITION]: new StatusConfigAPIHandler(this),
      [KIND_ACTION_DEFINITION]: new ActionConfigAPIHandler(this),
      [KIND_DASHBOARD_DEFINITION]: new DashboardsConfigAPIHandler(this),
      [KIND_MODULE_STATE]: new ModuleStateConfigAPIHandler(this),
      [KIND_ISO_ROBOT]: new IsoRobotConfigAPIHandler(this),
      [KIND_SPATIAL_ANNOTATION]: new SpatialAnnotationConfigAPIHandler(this),
      [KIND_SPATIAL_TRANSFORMATION]: new SpatialTransformationConfigAPIHandler(this),
      // [KIND_MISSION_TRACKING]: new MissionTrackingAPIHandler(this),
      [KIND_ROBOT_FOOTPRINT]: new RobotFootprintConfigAPIHandler(this),
      // [KIND_PREFERENCES]: new PreferencesConfigAPIHandler(this),
    };
    isObject(peerApiKinds) && Object.keys(peerApiKinds).forEach((kind) => {
      if (kind in this._kindsHandlers) {
        throw new Error(`Handler for kind ${kind} is already registered`);
      }
      this._kindsHandlers[kind] = new PeerApiKindHandler(kind, peerApiKinds[kind]);
    });
    return this;
  };

  /**
   * Executes an apply operation to impact a configuration object as a user
   */
  apply = async ({ configObject = {}, user }) => {
    if (!user) {
      throw new Error('Configuration can only be applied on behalf of users, no user provided');
    }
    // HACK: For compatibility with InOrbit's CLI, we accept and ignore a scope field in the config object,
    if (configObject?.metadata?.scope) {
      delete configObject.metadata.scope;
    }
    // Basic schema validation
    const validation = configObjectApplyValidator(configObject);
    if (validation !== true) {
      throw new SchemaError((validation.length && validation[0].message) || 'Invalid schema');
    }
    const { kind } = configObject;
    const kindHandler = this.getHandler(kind);
    if (!kindHandler) {
      throw new ValidationError(`Unsupported object kind ${kind}`);
    }
    this.validateGlobalConfigOnly(kindHandler, configObject.metadata.id);
    return kindHandler.apply({ configObject, user });
  };

  /**
   * Executes an clear operation to impact a configuration object as a user
   */
  clear = async ({ configObject = {}, user }) => {
    if (!user) {
      throw new Error('Configuration can only be cleared on behalf of users, no user provided');
    }
    // Basic schema validation
    const validation = configObjectClearValidator(configObject);
    if (validation !== true) {
      throw new SchemaError((validation.length && validation[0].message) || 'Invalid schema');
    }
    const { kind } = configObject;
    const kindHandler = this.getHandler(kind);
    if (!kindHandler) {
      throw new ValidationError(`Unsupported object kind ${kind}`);
    }
    this.validateGlobalConfigOnly(kindHandler, configObject.metadata.id);
    return kindHandler.clear({ configObject, user });
  };

  /**
   * Lists configuration objects that match a filter and optionally an id.
   * The output format depends on the format option.
   */
  list = async ({
    user,
    kind,
    id,
    includeAll,
    format = LIST_FORMAT_SHORT
  }) => {
    if (!user) {
      throw new Error('Configuration can only be applied on behalf of users, no user provided');
    }
    // Basic filters validation
    const validation = listFiltersValidator({
      kind,
      id,
      format
    });
    if (validation !== true) {
      throw new SchemaError((validation.length && validation[0].message) || 'Invalid schema');
    }
    const kindHandler = this.getHandler(kind);
    if (!kindHandler) {
      throw new ValidationError(`Unsupported object kind ${kind}`);
    }
    if (id) { // If an id is received to list(), it must the the unique 'all' id
      this.validateGlobalConfigOnly(kindHandler, id);
    }
    const items = await kindHandler.list({ id, user, format, includeAll });
    if (!Array.isArray(items)) {
      throw new Error(`Internal error in ${kind}.list(): return value should be a list`);
    }
    let result = items.map(i => ({
      ...i,
      kind
    }));
    if (format === LIST_FORMAT_FULL) {
      // Validate the list output format, ensuring it can be reapplied as input.
      // Note that it doesn't validate the actual content of the output spec.
      // Objects that fail validation are not included in the result.
      result = result.reduce((acc, configObject) => {
        const outputValidation = fullListOutputValidator(configObject);
        if (outputValidation !== true) {
          console.error(
            `invalid output format in ${kind}.list() for config object with id "${configObject?.metadata?.id}": `
            + `${outputValidation.map(v => v.message).join(', ')}`
          );
          return acc;
        } else {
          acc.push(configObject);
          return acc;
        }
      }, []);
    } else {
      
    }
    // HACK: For compatibility with InOrbit's CLI, we append a scope field to all results
    result.forEach(i => { 
      if (!i.metadata) {
        i.scope = CONFIG_API_DUMMY_SCOPE_ID;
      } else {
        i.metadata.scope = CONFIG_API_DUMMY_SCOPE_ID;
      }
    });
    return result;
  };

  /**
   * Validates that the element `id` string is acceptable for the given kindHandler. Normally
   * every id is accepted, except for "singleton" handlers such as Mission Tracking, where only
   * one configuration exists and we force the id to be "all" (CONFIG_API_GLOBAL_ID constant).
   */
  validateGlobalConfigOnly = (kindHandler, id) => {
    if (kindHandler.isGlobalConfig() && id != CONFIG_API_GLOBAL_ID) {
      throw new ValidationError(`Config only applies globally: id must be "${CONFIG_API_GLOBAL_ID}"`);
    }
  };

  /**
   * Returns the keys of the kindsHandlers object, This is nothing more than an array with
   * all the names of the kinds defined in the kindsHandlers
   */
  getKinds = () => {
    if (!this._kindsHandlers) {
      throw new Error('ConfigAPI class not initialized');
    }
    return Object.keys(this._kindsHandlers);
  };

  /**
   * Returns the the handler for a specific Kind, if there is one registered.
   * It returns undefined if the handler for that type does was not yet configured or does
   * not exist.
   */
  getHandler = (kind) => {
    if (!this._kindsHandlers) {
      throw new Error('ConfigAPI class not initialized');
    }
    return this._kindsHandlers[kind];
  };

  /**
   * Returns the user id for the given user.
   * @param {Object} user - Optional user object. If provided, returns the user's id.
   * @returns {string} The user's id.
   */
  getUserId = async (user = null) => {
    if (!user) {
      return getSystemUser()._id;
    }
    return user._id;
  };
}
