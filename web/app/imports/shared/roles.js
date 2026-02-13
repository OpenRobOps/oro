/**
 * Support constants and basic functions (non Meteor) for Roles functionality
 * implemented in lib/inorbitRoles and server/inorbitRoles.
 *
 * See Roles document:
 * https://docs.google.com/document/d/1wSU1arRiMitm91NUqOupcqhCWReqw3kI4Ua6FPjzXj8/edit
 */
import { isString } from 'lodash';
import { ID_TYPE_ROLE } from './constants';

/*
 * Role IDs
 */
const ROLE_ADMIN = 'admin';
const ROLE_MANAGER = 'manager';
const ROLE_ENGINEER = 'engineer';
const ROLE_OPERATOR = 'operator';
const ROLE_VIEWER = 'viewer';

const ALL_ROLE_DOCS = [
  // Most relevant to least relevant (first one found is shown in UI)
  { _id: ROLE_ADMIN, label: 'Administrator', comment: 'Administrator access' },
  { _id: ROLE_MANAGER, label: 'Manager', comment: 'Team lead or manager' },
  { _id: ROLE_ENGINEER, label: 'Engineer', comment: 'Roboticist or software developer' },
  { _id: ROLE_OPERATOR, label: 'Operator', comment: 'Responsible for robot monitoring/interventions' },
  { _id: ROLE_VIEWER, label: 'Viewer', comment: 'View only access' }
];

/**
 * System user is used to identify events and actions triggered by the system.
 */
const SYSTEM_USER_ID = 'oro';
const SYSTEM_USER_NAME = 'OpenRobOps';
const SYSTEM_USER_EMAIL = 'oro@openrobops.org';

/**
 * Returns the system user object that can be used where a user object is expected
 * @returns {object}
 */
const getSystemUser = () => ({
  _id: SYSTEM_USER_ID,
  profile: { name: SYSTEM_USER_NAME, email: SYSTEM_USER_EMAIL }
});

/**
 * Checks if the provided user is the system user
 * @param {object} user
 * @returns {boolean}
 */
const isSystemUser = user => user && user._id === SYSTEM_USER_ID;

/**
 * Resource Types are used as the first element in a fully qualified resource
 * id. For example "robot/wall-e".
 *
 * They have overlap with ID_TYPE_xx constants, but it is not necessary nor
 * it should be assumed they are the same values.
 */
const RESOURCE_TYPES = {
  // This string is 'company' for compatibility purposes; but these are
  // "system" or account elements.
  SYSTEM: 'system',
  ROBOT: 'robot',
  DASHBOARD: 'dashboard',
  ACTION: 'action'
};

/**
 * The resource 'singletons' represent a single resource within a company
 * (account); such as "the billing parameters", "the API access" or
 * "integrations with 3rd party tools".
 *
 * This is mostly used to separate access to parts of the config screens, but
 * also other concepts like "using locks" are represented here. For a more
 * detailed definition, see design doc.
 *
 * All of these _singletons_ are prefixed with '~' to distinguish from any
 * other id. See also

 * @see isSingletonResourceId() function.
 */
const RESOURCE_SINGLETONS = {
  // Access to APIs
  APIS: '~apis',
  // Access to using locks (locking a robot, or breaking a lock)
  LOCKS: '~locks',
  // Anything related to adding and removing robots from the account's fleet: Getting
  // API keys to add robots, removing robots, etc.
  FLEET: '~fleet',
  // Config related, from here and on. Note that some of the resources below
  // also require a different permission and work together: for example adding
  // a data source requires CONFIG access on the robot/tag/fleet, in addition
  // to CONFIG access to '~datasources'
  // Account gives access to top level account details such as name and logo
  // (which are not that important) but also in the future any top level
  // operation such as removing the account.
  ACCOUNT: '~account',
  // Roles configuration, assigning permissions to roles
  ROLES: '~roles',
  // Users invites and assigning roles to users
  USERS: '~users',
  // Allows editing Statuses, Alerts, Incidents
  INCIDENTS: '~incidents',
  // Dashboards configurations
  DASHBOARDS: '~dashboards',
  // Allows defining actions
  ACTIONS: '~actions',
  // Navigation section. ROS topics, etc.
  NAVIGATION: '~navigation',
  // Data sources config section
  DATASOURCES: '~datasources',
  // Missions definitions and mission tracking configuration
  MISSIONS: '~missions',
  // Integrations config section
  INTEGRATIONS: '~integrations',
};

/*
 * Access levels (for resources: robots, collections, config screens, ...)
 */
const ACCESS_LEVEL_VIEW = 'view';
const ACCESS_LEVEL_OPERATE = 'op'; // a.k.a. EXECUTE
const ACCESS_LEVEL_CONFIGURE = 'config';
const ALL_ACCESS_LEVEL_DOCS = [
  { _id: ACCESS_LEVEL_VIEW, label: 'Viewer' },
  { _id: ACCESS_LEVEL_OPERATE, label: 'Operator' },
  { _id: ACCESS_LEVEL_CONFIGURE, label: 'Full config access' }
];

/**
 * Tells if a resource id corresponds to a 'singleton' element of the account.
 *
 * @see RESOURCE_SINGLETONS
 */
const isSingletonResourceId = id => id && id[0] == '~';

/*
 * We are starting to qualify element names in Meteor.users' `roles` element, in the form
 * "entityType/entityId".
 * The two components are separated by the "/" symbol.
 * For now, this is only applied to collections; permissions on companies are left unqualified as
 * in the initial version (so a raw hexa ID means it's a company).
 * e.g. `{ collection/123acb456: [ "viewer" ] }`
 *
 * NOTE: This constant is also used in ingest for activation pipelines; don't modify it.
 */
const SCOPE_SEPARATOR = '/';

/*
 * This RESOURCE_WILDCARD '*' is not a specific resource but rather an indication of _any_
 * resource of a given type. For example, granting OP access on
 *    actions/{companyId}/*
 * allows executing _any_ action.
 *
 * Note that this is NOT a regular expression! It's simply a constant; any other
 * string could habe been used.
 */
const RESOURCE_WILDCARD = '*';

/**
 * Construct a role Id associated to a given company.
 *
 * @param {string} companyId
 * @param {string} roleId
 */
const makeRoleId = (companyId, roleId) => {
  if (!isString(companyId)) {
    throw new Error('makeRoleId: missing company Id');
  }
  if (!isString(roleId)) {
    throw new Error('makeRoleId: missing role name');
  }
  return `${ID_TYPE_ROLE}${SCOPE_SEPARATOR}${companyId}${SCOPE_SEPARATOR}${roleId}`;
};

/**
 * Returns a qualifiedResourceId from a list of parts. It simply glues all arguments with '/'.
 *
 * NOTE(herchu) This function could be implemented using `arguments` pseudo-array but it turns out
 * the conversions necessary are more complex than simply checking for 2, at most 3, string
 * arguments.
 *
 * @param (string) arg1, arg2... Each of the qualified id parts, e.g., ['robot', 'wall-e']
 */
const glueId = (arg1, arg2 = null) => {
  // NOTE(herchu): the check for not containing '/' in each part is necessary, but also
  // has slight performance cost. Consider removing it in the future (after we are sure
  // implementation works)
  if (!arg1 || arg1.indexOf('/') >= 0) {
    console.error('arg1 error in glueId', arg1, arg2);
    throw new Error('Invalid arg1 argument to build a qualified id: ' + arg1);
  }
  if (!arg2 || arg2.indexOf('/') >= 0) {
    console.error('arg2 error in glueId', arg1, arg2);
    throw new Error('Invalid arg2 argument to build a qualified id: ' + arg2);
  }
  return arg2 ? `${arg1}${SCOPE_SEPARATOR}${arg2}` : arg1;
};

/**
 * Construct the pseudo-id representing "any element of a given resource type".
 *
 * Example:
 * ```
 * makeWildcardId(RESOURCE_TYPES.ACTIONS) == 'action/*'
 * ```
 *
 * @param {string} resourceType One of RESOURCE_TYPES
 *
 */
const makeWildcardId = (resourceType) => {
  if (!isString(resourceType) || (resourceType in RESOURCE_TYPES)) {
    throw new Error('makeWildcardId: missing or invalid resource type');
  }
  return glueId(resourceType, RESOURCE_WILDCARD);
};

/**
 * Parses a qualified resource id (of the form resourceType/companyId/resourceId) into
 * an object with three components: { resourceType, companyId }.
 *
 * @param (string) qualifiedResourceId A qualified resource id of the form "type/id" or "~singleton"
 *
 * @return (object) a parsed resource id with { resourceType, resourceId }
 */
const parseResourceId = (qualifiedResourceId) => {
  const parts = qualifiedResourceId.split(SCOPE_SEPARATOR);
  if (!qualifiedResourceId || (parts.length != 2 && (parts.length != 1 || parts[0][0] != '~'))) {
    throw new Error('Invalid resource id: ' + qualifiedResourceId);
  }
  // NOTE(herchu) This parses only these ids of these types:
  //  <type>/<entityId> : qualified id
  //  ~<name> : singleton id
  if (parts.length == 1) {
    return {
      // resourceType: add a constant? "singleton"?
      resourceType: RESOURCE_TYPES.SYSTEM,
      resourceId: parts[0]
    }
  } else {
    return {
      resourceType: parts[0],
      resourceId: parts[1]
    }
  };
};

/**
 * Converts a parsed resource id with { resourceType, resourceId, companyId }
 * into a string `resourceType/companyId/resourceId`.
 * This function is the converse of parseResourceId
 */
const serializeResourceId = (parsedResourceId) => {
  const { companyId, resourceId, resourceType } = parsedResourceId;
  if (companyId && resourceType !== RESOURCE_TYPES.SYSTEM) {
    return `${resourceType}/${companyId}/${resourceId}`;
  } else {
    // old resources with 2 elements (see comment in parseResourceId)
    return `${resourceType}/${resourceId}`;
  }
};

/**
 * Determines what role(s) cannot be edited.
 * A synonym of "this is the Admin role", which we disallow editing to make sure
 * permissions are kept consistent (at least this role will always keep all its grants).
 */
const isRoleReadOnly = roleId => (roleId == ROLE_ADMIN);

export {
  // Constants
  RESOURCE_TYPES,
  RESOURCE_SINGLETONS,
  RESOURCE_WILDCARD,
  ACCESS_LEVEL_VIEW,
  ACCESS_LEVEL_OPERATE,
  ACCESS_LEVEL_CONFIGURE,
  ALL_ACCESS_LEVEL_DOCS,
  ROLE_ADMIN,
  ROLE_MANAGER,
  ROLE_ENGINEER,
  ROLE_OPERATOR,
  ROLE_VIEWER,
  ALL_ROLE_DOCS,
  // Parsing resources
  isSingletonResourceId,
  SCOPE_SEPARATOR,
  parseResourceId,
  serializeResourceId,
  glueId,
  makeRoleId,
  makeWildcardId,
  // Roles semantics
  grantsAnyAccess, // used for UI rendering
  clientGrantsSpecificAccess, // used for UI rendering
  isBuiltInRole,
  isRoleReadOnly,
  // System user
  getSystemUser,
  isSystemUser
};
