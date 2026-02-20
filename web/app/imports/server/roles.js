/**
 * OroRoles: this class encapsulates ORO  specific roles and permissions definitions and usage.
 *
 * TODOS:
 *  - Add caching
 */
import { Meteor } from 'meteor/meteor';
import { isString, pick, capitalize } from 'lodash';
// ORO modules
import { ID_TYPE_ROBOT } from '../shared/constants';
import {
  ROLE_ADMIN, ROLE_MANAGER, ROLE_ENGINEER, ROLE_OPERATOR, ROLE_VIEWER,
  Roles
} from '../lib/roles';
import {
  parseResourceId, serializeResourceId, glueId, isSingletonResourceId,
  isRoleReadOnly,
  SCOPE_SEPARATOR, RESOURCE_TYPES, RESOURCE_SINGLETONS, RESOURCE_WILDCARD,
  ACCESS_LEVEL_VIEW, ACCESS_LEVEL_OPERATE, ACCESS_LEVEL_CONFIGURE,
} from '../shared/roles';
// import EventLog from './eventLogger';
// import { EVENT_TYPES, EVENT_SETTINGS_SECTION_NAMES, getUserName } from '../lib/events';

// field in Users collection containing roles. Not calling it 'roles' to avoid confusion
// with the Meteor roles (alanning:roles) package.
const ROLES_FIELD = 'userRoles';
const GRANTS_FIELD = 'grants';

/*
 * Default roles values. Added to DB during initialization.
 */
const STATIC_ROLES_CONFIG = {};
/* eslint-disable wrap-iife */
(function () { // Wrapping this code in a closure since abbreviations are added that make
  // All 'singletons' in this module are about Resources -- rename to make code shorter
  const SINGLETONS = RESOURCE_SINGLETONS;
  // C: prefix for system elements
  const C = RESOURCE_TYPES.SYSTEM + SCOPE_SEPARATOR;
  STATIC_ROLES_CONFIG[ROLE_VIEWER] = {
    [C + SINGLETONS.FLEET]: [ACCESS_LEVEL_VIEW], // view robots in fleet
  };
  STATIC_ROLES_CONFIG[ROLE_OPERATOR] = {
    ...STATIC_ROLES_CONFIG[ROLE_VIEWER],
    [glueId(RESOURCE_TYPES.ACTION, RESOURCE_WILDCARD)]: [ACCESS_LEVEL_OPERATE],
    [C + SINGLETONS.FLEET]: [ACCESS_LEVEL_OPERATE], // operate on robots in fleet
  };
  STATIC_ROLES_CONFIG[ROLE_ENGINEER] = {
    ...STATIC_ROLES_CONFIG[ROLE_OPERATOR],
    [C + SINGLETONS.FLEET]: [ACCESS_LEVEL_CONFIGURE], // add/remove robots from fleet
    [C + SINGLETONS.LOCKS]: [ACCESS_LEVEL_CONFIGURE], // break locks from other users
    // Navigation tab
    [C + SINGLETONS.NAVIGATION]: [ACCESS_LEVEL_CONFIGURE],
    // Robot Data tab
    [C + SINGLETONS.DATASOURCES]: [ACCESS_LEVEL_CONFIGURE],
    // Insights tab
    [C + SINGLETONS.INCIDENTS]: [ACCESS_LEVEL_CONFIGURE],
    [C + SINGLETONS.ACTIONS]: [ACCESS_LEVEL_CONFIGURE],
  };
  STATIC_ROLES_CONFIG[ROLE_MANAGER] = {
    ...STATIC_ROLES_CONFIG[ROLE_ENGINEER],
    [C + SINGLETONS.DASHBOARDS]: [ACCESS_LEVEL_CONFIGURE],
    // Mission Tracking
    [C + SINGLETONS.MISSIONS]: [ACCESS_LEVEL_CONFIGURE],
  };
  STATIC_ROLES_CONFIG[ROLE_ADMIN] = {
    ...STATIC_ROLES_CONFIG[ROLE_MANAGER],
    [C + SINGLETONS.USERS]: [ACCESS_LEVEL_CONFIGURE],
    // Note: Part of this is in the old Organization tab
    [C + SINGLETONS.ROLES]: [ACCESS_LEVEL_CONFIGURE],
    [C + SINGLETONS.INTEGRATIONS]: [ACCESS_LEVEL_CONFIGURE],
    // Experimental / API keys access
    [C + SINGLETONS.APIS]: [ACCESS_LEVEL_CONFIGURE],
  };
})();

// This "access levels" over resources (robots, systme elements)
const ACCESS_LEVEL_TYPES = [
  // must be in order, higher index elements grants all previous permissions too
  ACCESS_LEVEL_VIEW,
  ACCESS_LEVEL_OPERATE,
  ACCESS_LEVEL_CONFIGURE
];

// Helper dictionary to turn permission levels into numeric values, for faster comparison
// TODO(herchu) All "ACCESS_LEVEL_*" names will turn into PERMISSION_* later.
// NOTE(herchu) For security and prevent ANY accidental modification, this structure is NOT
// exprorted - only built and used internally in this module.
const ACCESS_LEVEL_NONE = 'none'; // TODO(herchu) move to lib module
const PERMISSION_LEVEL_VALUES = {
  [ACCESS_LEVEL_NONE]: 0,
  [ACCESS_LEVEL_VIEW]: 1, // aka. "read"
  [ACCESS_LEVEL_OPERATE]: 2, // aka. "execute"
  [ACCESS_LEVEL_CONFIGURE]: 3, // aka. "write",
};


// Define publication for the roles document
// This way client can access roles aliases in the UI.
Meteor.publish('roles', async function () {
  if (!this.userId) { // User must be logged in
    return this.ready();
  }
  console.log("PUB roles: not implemented")
  return this.ready();
});

let instance;

class OroRoles {
  // Used only for dev environments, internal logging
  static _logging = false;

  constructor() {
    if (!instance) {
      this.rolesColl = Roles;
      this.usersColl = Meteor.users;
      instance = this;
    }
    // eslint-disable-next-line no-constructor-return
    return instance;
  }

  isLogging = () => this._logging;

  /**
   * Toggle debugging/experimental logging
   */
  setLogging = (isEnabled) => {
    this._logging = Boolean(isEnabled);
  };

  /**
   * Returns whether a subject (for now: a user) can access a given resource with
   * at least the given permission level.
   *
   * Note that since the core function `canAccessMultiple` is implemented as a check over
   * multiple resources, this function is just a wrapper of that one.
   */
  canAccess = async (
    subjectId,
    qualifiedResourceId,
    permissionLevel = ACCESS_LEVEL_VIEW
  ) => (
    this.canAccessMultiple(subjectId, [qualifiedResourceId], [permissionLevel])
  );

  /**
   * Convenience method to check for access to access a robot. It is just a wrapper over
   * canAccess() using an id such as `"robot/{robotId}"`.
   */
  canAccessRobot = async (
    subjectId,
    robotId,
    permissionLevel
  ) => (
    this.canAccessMultiple(subjectId, [glueId(ID_TYPE_ROBOT, robotId)], [permissionLevel])
  );

  /**
   * Returns whether a subject (for now: a user) can access a set of resources with
   * at least the given permission levels.
   *
   * The implementation is exactly the algorithm in the document linked below, just
   * asserting that _all_ requested permissions are granted. This is normally used
   * with just one resource (e.g. a robot, or a platform singleton element) but it can
   * also be used to check for a "dual" resurce check, for example both of 1) OP on a robot,
   * and 2) EXEC on locks.
   *
   * @param {string} subjectId The id of the subject requesting permission (normally a userId)
   * @param {array} qualifiedResourceIds A list of at least one qualified resourceId.
   * @param {array} permissionLevels A list of at least of permissions to request, for each
   *    of the corresponding resources. Each of them, if undefined, will default to
   *    ACCESS_LEVEL_VIEW;
   *    but for sanity checks this array must contain the same elements as qualifiedResourceIds
   */
  canAccessMultiple = async (subjectId, qualifiedResourceIds, permissionLevels) => {
    // If not logged-in, can't access
    if (!subjectId) {
      return false;
    }
    if (!Array.isArray(qualifiedResourceIds) || qualifiedResourceIds.length < 1) {
      throw new Error('canAccessMultiple: qualifiedResourceIds must be an array with at least one element');
    }
    if (!Array.isArray(permissionLevels)
        || qualifiedResourceIds.length != permissionLevels.length) {
      throw new Error('canAccessMultiple: permissionLevels must be an array with the same number of elements as qualifiedResourceIds');
    }
    // First parse the resources id, e.g. "robot/r1234" into objects { entityType, entityId }
    let parsedResources;
    try {
      parsedResources = qualifiedResourceIds.map(parseResourceId);
    } catch (e) {
      console.warn(e.message);
      return false;
    }
    // Fetch all users's permissions
    const roleIds = await this.fetchUserRoles(subjectId);
    if (!roleIds?.length) { // user has no roles, deny
      return false;
    }
    // Load the roles definitions
    const rolesConfig = await this.fetchRolesGrants(roleIds);
    return this._checkAccess({
      subjectId,
      rolesConfig,
      roleIds,
      parsedResources,
      permissionLevels
    });
  };

  /**
   * Second part of canAccess(), assuming all arguments have been validated,
   * and documents loaded from the DB.
   *
   * @see canAccess for detailed description.
   *
   * INTERNAL to OroRoles. Use canAccess() instead
   */
  // eslint-disable-next-line class-methods-use-this
  _checkAccess = async ({
    subjectId, // optional, for logging only
    roleIds,
    rolesConfig,
    parsedResources,
    permissionLevels,
  }) => {
    let allGranted = true;
    // build this string only when this._logging is on
    const debugResources = this._logging ? parsedResources.map(r => `${r.resourceType}/${r.resourceId}`) : '';
    const targetResourcesIds = this.resolveTargetResourcesMany(parsedResources);
    for (let ix = 0; ix < parsedResources.length; ix++) {
      const permissionLevel = permissionLevels[ix] || ACCESS_LEVEL_VIEW; // arrays have same length
      const resourcesChain = targetResourcesIds[ix];
      const permissionGranted = OroRoles._permissionGrantedForResourcesChain({
        roleIds,
        rolesConfig,
        resourcesChain,
        permissionLevel
      });
      if (permissionGranted) {
        this._logging && console.debug(`_checkAccess(${subjectId},${debugResources},${permissionLevels}): ok on ${serializeResourceId(parsedResources[ix])}`);
      } else {
        allGranted = false;
        this._logging && console.debug(`_checkAccess(${subjectId},${debugResources},${permissionLevels}): DENY on ${serializeResourceId(parsedResources[ix])}`);
        break;
      }
    }
    this._logging && allGranted && console.debug(`_checkAccess(${subjectId},${debugResources},${permissionLevels}) => true`);
    return allGranted;
  };


  /**
   * Checks if a user with all roles from roleIds is allowed to access
   * resources that accessible through the chain resourcesChain.
   * Returns true if access is granted to ANY of the elements in resourcesChain
   *
   * @param {Array} resourcesChain
   * @param {Array} roleIds are all the roles the current user has
   * @param {Object} rolesConfig is the Roles config already retrieved
   *  (or a subset containing at least roleIds keys)
   * @param {String} permissionLevel The access level to check
   */
  static _permissionGrantedForResourcesChain = ({
    roleIds,
    rolesConfig,
    resourcesChain,
    permissionLevel
  }) => {
    const numericRequestedLevel = PERMISSION_LEVEL_VALUES[permissionLevel];
    for (const targetResourceId of resourcesChain) {
      for (const roleId of roleIds) {
        const roleObject = rolesConfig[roleId];
        const permissions = (roleObject || {})[targetResourceId];
        if (Array.isArray(permissions) && permissions.some(
          grantPermission => (PERMISSION_LEVEL_VALUES[grantPermission] >= numericRequestedLevel)
        )) {
          return true;
        }
      }
    }
    return false;
  };

  /**
   * Given a (parsed) qualified resource id of the form { resourceId, resourceType } it
   * returns the chain of all resources such that _any_ of them would
   * give access to the requested `parsedResourceId`.
   *
   * For example, requesting { entityType: 'robot', entityId: 'wall-e' }
   * could return:
   *  [ 'system/~fleet', 'robot/wall-e']
   * Note that the list always includes the original ID. In fact, most of the time it only includes
   * that id!
   *
   * @param (object) parsedResourceId an object with { entityId, entityType }
   * @return {array} An array of strings (qualified resource ids)
   */
  resolveTargetResources = (parsedResourceId) => {
    const { resourceType, resourceId } = parsedResourceId;
    const qualifiedResourceId = glueId(resourceType, resourceId);
    if (!resourceType || resourceType == RESOURCE_TYPES.SYSTEM) {
      // singleton. No chain
      return [qualifiedResourceId];
    } else if (resourceType == ID_TYPE_ROBOT) {
      return [
        glueId(RESOURCE_TYPES.SYSTEM, RESOURCE_SINGLETONS.FLEET),
        qualifiedResourceId,
      ]
    }
    // Default case: EVERY other resource type (not a robot) requires access to that specific
    // resource.
    // Since some resources allow granting access to one element specifically or all of them
    // (using RESOURCE_WILDCARD == '*', this case is handled here; for RESOURCE_TYPE.ACTION
    // uses wildcards
    return [
      glueId(resourceType, RESOURCE_WILDCARD),
      qualifiedResourceId
    ];
  };

  /**
   * Given a list of (parsed) qualified resource id of the form { entityId, entityType }
   * resolve the chain of all resources such that _any_ of them would give access to each resource
   * from parsedResourcesIds.
   *
   * @param (array) parsedResourcesIds each entry with { resourceId, resourceType }
   * @return {Promise<array>} Array of array of strings (qualified resource ids).
   *   Each describes the target resources for the corresponding resource in
   *   parsedResourcesIds.
   */
  resolveTargetResourcesMany = (parsedResourcesIds) => (
    parsedResourcesIds.map(this.resolveTargetResources)
  );


  /**
   *
   * Note that the choice of arguments matches closely those provided by
   * composite publication helper userGrantsCompositePublication():
   *
   * @param {Array} roleIds are all the roles the current user has in the platform
   * @param {Object} rolesConfig is the roles config, map from id to Role object
   * @param {String} permissionLevel The access level to check
   *
   * NOTE: Server-side only - used when documents have already been retrieved
   * (roleIds, rolesConfig)
   */
  userGrantsCanAccess = async ({
    roleIds,
    rolesConfig,
    qualifiedResourceId,
    permissionLevel = ACCESS_LEVEL_VIEW
  }) => {
    let parsedResource;
    try {
      parsedResource = parseResourceId(qualifiedResourceId);
    } catch (e) {
      console.warn('userGrantsCanAccess error parsing resource:', e.message);
      return false;
    }
    return this._checkAccess({
      roleIds,
      rolesConfig,
      parsedResources: [parsedResource],
      permissionLevels: [permissionLevel]
    });
  };

  /**
   * Fetches all grants of a user: First determines what are the
   * user roles in the platform (can be multiple), then merges them into a
   * single 'grants' object (dictionary from resource to list of permission
   * level) using MergeRolesIntoGrants.
   *
   * This method is NOT efficient; it is meant to be used as a one-time call
   * to know how to render a configuration screen. Do NOT use this to compute
   * permissions, which need to be efficient (and likely cached).
   */
  fetchUserGrants = async (userId) => {
    // Fetch all users's permissions - used to check access to individual
    // tags (only one doc retrieved from db).
    const roleIds  = await this.fetchUserRoles(userId);
    if (!roleIds?.length) { // user has no roles; deny
      return null;
    }
    // Load the roles definition (just those roles)
    const rolesConfig = await this.fetchRolesGrants(roleIds);
    // At this point, rolesConfig is a map from roleId (a role of this user) to
    // a set of permissions. If the user had multiple roles, merge all permissions
    // and return the result
    return OroRoles.MergeRolesIntoGrants(rolesConfig);
  };

  /**
   * Given an object whose keys are roleIds, assumed to be the roles of a user
   * with values being a Role object (ie. a mapping from
   * resource to list of permissions), it merges all these roles into a single
   * map from resourceId to list of permissions -- ie. a Grants set.
   */
  static MergeRolesIntoGrants = (roles) => {
    const result = {};
    if (!roles) { // if there were no roles at all; roles can be null
      return result;
    }
    Object.keys(roles).forEach((roleId) => {
      const roleObject = roles[roleId];
      roleObject && Object.keys(roleObject).forEach((resource) => {
        if (Array.isArray(roleObject[resource])) {
          if (!result[resource]) {
            result[resource] = roleObject[resource];
          } else {
            result[resource] = result[resource].concat(roleObject[resource]);
          }
        }
      });
    });
    return result;
  };

  /**
   * Shorter version for canAccess() used for platform 'singletons'.
   *
   * Example:
   *    canAccessSystemElement('bob', '~dashboards', 'config')
   * simply returns:
   *    canAccess('bob', 'oro/~dashboards', 'config')
   */
  canAccessSystemElement = async (
    subjectId,
    singletonId,
    permissionLevel = ACCESS_LEVEL_VIEW
  ) => {
    if (!isSingletonResourceId(singletonId)) {
      console.error('canAccessSystemElement can only be used with system elements');
      return false;
    }
    const res = await this.canAccess(
      subjectId,
      glueId(RESOURCE_TYPES.SYSTEM, singletonId),
      permissionLevel
    );
    this._logging && console.debug(`canAccessSystemElement(${subjectId},`
      + `${singletonId},${permissionLevel}) => ${res}`);
    return res;
  };

  /**
   * Shorter version for canAccess() checking for two simultaneous permissions:
   *   - a singleton (with a given access level)
   *   - a specific robot (with its own access level too)
   * This is a shortcut for canAccessMultiple, just building qualified appropriately.
   *
   * Example:
   *    canAccessDual('bob', '~locks', 'op', 'wall-e', 'config')
   * would be equivalent to:
   *    canAccessMultiple('bob',
   *      ['ori/~locks', 'robot/wall-e'],
   *      ['op', 'config'])
   */
  canAccessDual = async (
    subjectId,
    singletonId,
    singletonPermissionLevel,
    robotId,
    robotPermissionLevel
  ) => {
    // let's be strict about arguments; even if they are all strings, making sure
    // they match known values to prevent incorrect calls to this api.
    if (!isSingletonResourceId(singletonId)) {
      console.error('canAccessDual can only be used with system elements');
      return false;
    }
    if (!PERMISSION_LEVEL_VALUES[singletonPermissionLevel]) {
      console.error('canAccessDual invalid access level for singleton object');
      return false;
    }
    if (!PERMISSION_LEVEL_VALUES[robotPermissionLevel]) {
      console.error('canAccessDual invalid access level for robot');
      return false;
    }
    const res = await this.canAccessMultiple(
      subjectId,
      [
        glueId(RESOURCE_TYPES.SYSTEM, singletonId),
        glueId(ID_TYPE_ROBOT, robotId)
      ],
      [
        singletonPermissionLevel,
        robotPermissionLevel
      ]
    );
    // NOTE(herchu) leave this logging until finishing canAccess** functions testing
    this._logging && console.info(
      'canAccessDual',
      subjectId,
      singletonId,
      singletonPermissionLevel,
      robotId,
      robotPermissionLevel,
      '=>',
      res
    );
    return res;
  };

  canAccessRobots = async (subjectId, robotIds, permissionLevel = ACCESS_LEVEL_VIEW) => {
    if (!Array.isArray(robotIds)) {
      throw new Error('robotIds must be an array');
    }
    if (!robotIds.length) {
      return true;
    }
    return this.canAccessMultiple(
      subjectId,
      robotIds.map(robotId => glueId(RESOURCE_TYPES.ROBOT, robotId)),
      // eslint-disable-next-line no-unused-vars
      robotIds.map(_ => permissionLevel)
    );
  };

  /**
   * Returns the lsit of robotIds that can be accessed by a user (given a permission level).
   * Normally this is the entire fleet or no robots; but customizing roles could result
   * in different subsets.
   *
   * @param {string} userId
   * @param {array} robotIds list of robot Ids to narrow down according to access level
   * @param {string} accessLevel access level
   * @return {Promise<array>} subset of `robotIds` or `null` if user is not logged in.
   * API 3.0
   */
  getAccessibleRobotIds = async (userId, robotIds, accessLevel) => {
    // Validate params
    if (!isString(userId)) {
      throw new Error('userId must be a string');
    }
    if (!Array.isArray(robotIds)) {
      throw new Error('robotIds must be an array');
    }
    if (!ACCESS_LEVEL_TYPES.includes(accessLevel)) {
      throw new Error('accessLevel must be a valid access level');
    }

    const resources = robotIds.map(r => glueId(ID_TYPE_ROBOT, r));
    // eslint-disable-next-line no-unused-vars
    const accessLevels = robotIds.map(r => accessLevel);
    const accessible = await this._getAccessibleResources(userId, resources, accessLevels);
    if (!accessible) {
      return [];
    }
    return accessible.map(a => a.resourceId);
  };

  /**
   * Returns a list of parsedResources from the qualifiedResourceIds that the user
   * can access with the specified permissions.
   *
   * This function is very similar to canAccessMultiple.
   *
   * @param {string} userId
   * @param {array} qualifiedResourceIds A list of qualified resourceId.
   * @param {array} permissionLevels A list of permissions to request, for each
   *    of the corresponding resources. Each of them, if undefined, will default to
   *    ACCESS_LEVEL_VIEW;
   *    but for sanity checks this array must contain the same elements as qualifiedResourceIds
   *
   * @returns {Promise<array>} List of parsed resources that are accessible
   */
  _getAccessibleResources = async (
    userId,
    qualifiedResourceIds,
    permissionLevels
  ) => {
    // If not logged-in, can't access
    if (!userId) {
      return false;
    }
    if (!Array.isArray(qualifiedResourceIds)) {
      throw new Error('getAccessibleResources: qualifiedResourceIds must be an array with at least one element');
    }
    if (!Array.isArray(permissionLevels)
        || qualifiedResourceIds.length != permissionLevels.length) {
      throw new Error('getAccessibleResources: permissionLevels must be an array with the same number of elements as qualifiedResourceIds');
    }
    if (qualifiedResourceIds.length == 0) {
      return [];
    }
    // First parse the resources id, e.g. "robot/r1234" into objects { entityType, entityId }
    let parsedResources;
    try {
      parsedResources = qualifiedResourceIds.map(parseResourceId);
    } catch (e) {
      console.warn(e.message);
      return false;
    }
    const roleIds = await this.fetchUserRoles(userId);
    if (!roleIds?.length) { // user has no roles; deny
      return false;
    }
    const rolesConfig = await this.fetchRolesGrants();
    return this._getAccessible({
      rolesConfig,
      roleIds,
      parsedResources,
      permissionLevels
    });
  };

  /**
   * Second part of getAccessible(), assuming all arguments have been validated,
   * and documents loaded from the DB.
   *
   * @see getAccessible for detailed description.
   *
   */
  _getAccessible = async ({
    roleIds,
    rolesConfig,
    parsedResources,
    permissionLevels,
  }) => {
    const accessible = [];
    const targetResourcesIds = await this.resolveTargetResourcesMany(parsedResources);
    for (let ix = 0; ix < parsedResources.length; ix++) {
      const permissionLevel = permissionLevels[ix] || ACCESS_LEVEL_VIEW; // arrays have same length
      const resourcesChain = targetResourcesIds[ix];
      const permissionGranted = OroRoles._permissionGrantedForResourcesChain({
        roleIds,
        rolesConfig,
        resourcesChain,
        permissionLevel
      });
      if (permissionGranted) {
        accessible.push(parsedResources[ix]);
      }
    }
    return accessible;
  };

  // eslint-disable-next-line class-methods-use-this
  assignRolesToUser = async (userId, rolesObject) => (
    // TODO(herchu) add validations!
    Promise.all(Object.entries(rolesObject).map(async ([resource, roles]) => (
      // Note that our resources (e.g. "ori/~fleet" are @alanning/roles' groups (3rd arg)
      this.Roles.addUsersToRoles(userId, roles, resource)
    )))
  );

  /**
   * Creates the default roles for the invited users
   */
  static CreateDefaultUserRoles = () => (
    // Invited users will have op access level over the fleet, and manager on the platform
    {
      [ORO_ROLES_KEY]: [ROLE_VIEWER]
    }
  );

  /**
   * Given a role, return its properties.
   *
   * @param  {string} roleId
   * @return {Promise<object>} Null if the role is not valid, otherwise an { _id, label, grants } object
   */
  fetchRole = async (roleId) => (
     (await this.fetchRoles([roleId]))[roleId]
  );

  /**
   * Determine whether a role is valid in the platform.
   *
   * @param {string} role
   * @return whether role is valid
   */
  validRole = async (roleId) => (
    (await this.fetchRole(roleId)) != null
  );


  /**
   * Assigns role roleId to user userId.
   *
   * @param {object} user A User object with { _id, profile } (or userId) that authors this change.
   */
    setRole = async ({ userId, roleId, user }) => (
      this.setRoles({ userId, roleIds: roleId ? [roleId] : null, user })
    )

  /**
   * Assigns role roleId to user userId.
   *
   * @param {object} user A User object with { _id, profile } (or userId) that authors this change.
   */
  setRoles = async ({ userId, roleIds, user }) => {
    if (!isString(userId)) {
      throw new Error('userId is required');
    }
    if (roleIds !== null && !Array.isArray(roleIds)) {
      throw new Error('roleIds must be an array or null');
    }
    const rolesConfigs = await this.fetchRoles(roleIds);
    if (roleIds && !roleIds.every(roleId => rolesConfigs[roleId])) {
      throw new Error(`Invalid roles: ${roleIds.join(', ')}`);
    }
    const targetUser = await Meteor.users.findOneAsync({ _id: userId });
    if (!targetUser) {
      throw new Error(`Attempted set permissions on a nonexistent user  ${userId}`);
    }

    const roleLabels = roleIds
      ? roleIds.map(roleId => rolesConfigs[roleId].label || roleId).join(', ')
      : 'none';
    await this.usersColl.updateAsync(userId, { $set: { [ROLES_FIELD]: roleIds } });
    if (user) { // log the event
      new EventLog().logSetting({
        settingGroupName: EVENT_SETTINGS_SECTION_NAMES.PERMISSIONS,
        settingName: `Granted ${roleLabel} role to ${getUserName(targetUser)}`,
        eventType: EVENT_TYPES.SETTING_UPDATED,
        user
      });
    }
  };


  /**
   * Add a new or update an existing grant for the given role.
   *
   * @param {string} roleId role to update
   * @param {string} resourceId resource to add
   * @param {array} permissions array of permissions for the given resourceId
   * @return {Promise<object>} resulting full role object: { _id, label, grants }
   */
  upsertGrant = async ({ roleId, resourceId, permissions }) => {
    if (!isString(roleId)) {
      throw new Error('roleId must be a string');
    }
    if (isRoleReadOnly(roleId)) {
      throw new Error(`role ${roleId} cannot be edited`);
    }
    if (!isString(resourceId)) {
      throw new Error('resourceId must be a string');
    }
    try { // validate the resouce is well formed
      parseResourceId(resourceId);
    } catch (e) {
      throw new Error('invalid resourceId');
    }
    if (!Array.isArray(permissions) && permissions !== null) {
      throw new Error('permissions must be an array or null');
    }
    if (permissions && !permissions.every(permission => ACCESS_LEVEL_TYPES.includes(permission))) {
      throw new Error('each element of permissions must be a valid access level');
    }
    // Check if role does exist
    const existingRoles = await this.fetchRoles();
    if (!existingRoles[roleId]) {
      return { error: 'Role does not exist' };
    }
    // Update the role definition
    await this.rolesColl.upsertAsync(
      { _id: roleId },
      {
        $set: {
        [`${GRANTS_FIELD}.${resourceId}`]: permissions
        }
      }
    );
    // Build return value; the complete and updated role definition
    const role = existingRoles[roleId];
    role[resourceId] = permissions;
    role._id = roleId;
    return role;
  };

  /**
   * Delete a grant for some role.
   *
   * @param {string} roleId role to update
   * @param {string} resourceId Id of resource for which to revoke access
   * @return {Promise<object>} resulting full role object: { _id, properties, ...grants }
   */
  deleteGrant = async ({ roleId, resourceId }) => {
    if (!isString(roleId)) {
      throw new Error('roleId must be a string');
    }
    if (isRoleReadOnly(roleId)) {
      throw new Error(`role ${roleId} cannot be edited`);
    }
    if (!isString(resourceId)) {
      throw new Error('resourceId must be a string');
    }
    try { // validate the resouce is well formed
      parseResourceId(resourceId);
    } catch (e) {
      throw new Error('invalid resourceId');
    }
    const existingRoles = await this.fetchRoles();
    // Check if role does exist
    if (!existingRoles[roleId]) {
      return { error: 'Role does not exist' };
    }
    // Update the role definition. Note that instead of $unset, we explicitly nullify
    // the grant so it can no longer inherit from a root or default config
    await this.rolesColl.upsertAsync(
      { _id: roleId },
      {
        $unset: {
          [`${GRANTS_FIELD}.${resourceId}`]: 1
        }
      }
    );
    // Build return value; the complete and updated role definition
    const role = existingRoles[roleId];
    role[resourceId] = null;
    role._id = roleId;
    return role;
  };

  /**
   * Builds a query to retrieve roles documents.
   * Note that these seldom change. This should be cached in the Roles module.
   */
  // eslint-disable-next-line class-methods-use-this
  makeQueryRoles = (roleIds) => {
    if (roleIds && !Array.isArray(roleIds)) {
      throw new Meteor.Error('roleIds must be an array');
    }
    // Returned query includes _id, as it it necessary for reactive cursors
    return Roles.find(roleIds ? { _id: { $in: roleIds } } : {});
  };

  /**
   * Builds a query to retrieve a user's permissions (roles elements).
   *
   * This is a helper function for fetchUserRoles, and is also used from composite
   * publications which actual output queries depend on users permissions. This allows
   * building a cursor that will change when user permissions change.
   */
  // eslint-disable-next-line class-methods-use-this
  makeQueryUserRoles = (subjectId) => {
    if (!isString(subjectId)) {
      throw new Meteor.Error('subjectId must be a string');
    }
    // Returned query includes _id, as it it necessary for reactive cursors
    return Meteor.users.find(
      { _id: subjectId },
      { fields: { [ROLES_FIELD]: 1 } }
    );
  };

  /**
   * Fetches and returns all roles of a user, granting permissions to different
   * objects. The returned object is a list of the user's roleIds (normally just one).
   */
  fetchUserRoles = async subjectId => (
    (await this.makeQueryUserRoles(subjectId).fetchAsync())?.[0]?.[ROLES_FIELD] || []
  );

  /**
   * Fetches and returns the Roles configured in the platform.
   *
   * @return {Promise<object>} An object with `{ roleId: [grants] }` with the grants for
   * each role.
   */
  fetchRolesGrants = async (roleIds = null) => {
    const rolesConfig = await this.fetchRoles();
    return (roleIds || Object.keys(rolesConfig)).reduce((acc, id) => {
      acc[id] = rolesConfig[id][GRANTS_FIELD] || [];
      return acc;
    }, {});
  };

  /**
   * Fetches and returns the Roles configured in the platform.
   *
   * @return {Promise<object>} An object with `{ roleId: { label, grants, ... } }`
   * with all roles configurations.
   */
  fetchRoles = async (roleIds = null) => {
    const docs = await (this.makeQueryRoles(roleIds).fetchAsync());
    return docs.reduce((acc, doc) => {
      acc[doc._id] = doc;
      return acc;
    }, {});
  };

  /**
   * Determine whether a user, given its Id, has any role in the platform.
   * (Disabled/Removed users do not have roles and will get denied all access)
   *
   * @param {string} userId user Id
   * @return {Promise<boolean>} whether the given user has _any_ role in the platform
   *
   */
  hasRole = async (userId) => (
    Boolean((await this.fetchUserRoles(userId))?.length)
  );

  /**
   * Create and persist built-in roles.
   * This method is to be called when initializing the platform.
   */
  // eslint-disable-next-line class-methods-use-this
  createDefaultRoles = async () => {
    // Remove any role not in the defaults just in case
    await Roles.removeAsync({
      _id: { $nin: Object.keys(STATIC_ROLES_CONFIG) }
    });
    // (Re)create the default roles
    for (const roleId of Object.keys(STATIC_ROLES_CONFIG)) {
      await Roles.upsertAsync({
        _id: roleId,
      }, {
        grants: STATIC_ROLES_CONFIG[roleId],
        label: capitalize(roleId)
      });
    }
  };

  /**
   * Determines if a given user (determined by its id) is an Admin. Being an
   * Admin is the _only_ specific role question we should make; as we give Admin a special
   * treatment to make sure no one promotes his/herself to admin, or non-admin taking
   * out the admin role from someone else.
   */
  isAdmin = async (userId) => {
    const roleIds = await this.fetchUserRoles(userId);
    return Array.isArray(roleIds) && roleIds.includes(ROLE_ADMIN);
  };
}

Meteor.methods({
  /**
   * Publish the set of grants (permissions on resources) for the current user
   */
  'roles.getUserGrants': async function () {
    if (!this.userId) { // User must be logged in
      throw new Meteor.Error('Unauthorized');
    }
    throw new Error('Not implemented')
  },
});

/**
 * Helper function to build composite publications based on the current user's
 * permissions: Since such publications depend on the user's roles,
 * and then on what grants each of those have, normally we
 * build a composite publication to resolve it and keep the results reactive
 * to role/permission changes.
 *
 * To use this function, do the following _in a publication code_, where
 * `this` is already bound to the publication object:
 * ```
 * return userGrantsCompositePublication.call(this,
 *   function({ userGrants }) {
 *     // Your code here... regular publication code
 *     // Here, `this` is still bound to the publication.
 *   }
 * });
 * ```
 *
 * That code snippet properly binds `this`. Then `userGrantsCompositePublication`
 * while compose a composite publication, and ultimately call `publish`
 * function with arguments `{ roleIds, rolesConfig, userGrants }`:
 *   - userGrants is an object with the set of all grants of this user,
 *     for example { 'system/~dashboards': ['config'], 'action/*': ['op'] }`
 *   - roleIds is an array with the role ids (normally just one)
 *   - rolesConfig are the roles { roleId, { label, grants ... }}
 *
 * Normally if user's permissions is what matter to the publication, the arguments
 * { roleIds, rolesConfig } can be ignored, and instead userGrants is used.
 */
const userGrantsCompositePublication = function (publish) {
  if (!this.userId) { // User must be logged in
    return this.ready();
  }
  const { userId } = this;
  return {
    find() {
      // root query (cursor) retrieves user's permissions on collections.
      // when they change, the second query (children) will be updated
      return OroRoles.makeQueryUserRoles(userId);
    },
    children: [{
      async find(user) {
        // user is the User object. We need to determine its roles; and this turns
        // result in another cursor for the third layer of the publication
        const roles = user?.[ROLES_FIELD];
        if (!Array.isArray(roles) || !roles.length) {
          // No roles. Stop the publication here
          return this.ready();
        }
        // And now find that role definition. The roles object can be big;
        // fetch only those roles (normally one) the user is in
        return OroRoles.makeQueryRoles(roles);
      },
      children: [{
        // in this find(), rolesConfig is the result of the previous find(), and second argument
        // is the top level find() result, see https://github.com/Meteor-Community-Packages/meteor-publish-composite
        find(rolesConfig, user) {
          const roleIds = user?.[ROLES_FIELD];
          const userGrants = OroRoles.MergeRolesIntoGrants(
            pick(rolesConfig, roleIds)
          );
          return publish.call(this, { userGrants, roleIds, rolesConfig });
        }
      }]
    }]
  };
};

export default OroRoles;
export {
  // Re-export since many modules already depend on this. Prefer importing shared/roles!
  ROLE_VIEWER, ROLE_MANAGER, ROLE_ADMIN,
  ACCESS_LEVEL_VIEW, ACCESS_LEVEL_OPERATE, ACCESS_LEVEL_CONFIGURE,
  userGrantsCompositePublication,
  Roles, // Only exported for unit tests
};
