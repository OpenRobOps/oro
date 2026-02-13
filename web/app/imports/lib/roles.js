/**
 * Common constants and some client side functions for roles and permissions handling:
 * shared code for inorbitRoles module.
 *
 * #meteor3: Migrated. New functions use *async prefix. TODO last: Remove deprecated versions
 */
import { Meteor } from 'meteor/meteor';
import { Accounts } from 'meteor/accounts-base';
import { Mongo } from 'meteor/mongo';
import { isEmpty, isObject, isString, size } from 'lodash';
import sortBy from 'lodash/sortBy';
// InOrbit modules
import { renameKeys, applyDefaults } from './util';
import { Robots } from './collections';
import { ID_INORBIT, COLLECTIONS } from '../shared/constants';
import {
  parseResourceId, makeRoleId, SCOPE_SEPARATOR, ROLE_OWNER,
  ROLE_ADMIN, ROLE_MANAGER, ROLE_ENGINEER, ROLE_OPERATOR,
  ROLE_VIEWER, ALL_ROLE_DOCS, isBuiltInRole, RESOURCE_SINGLETONS
} from '../shared/roles';

/**
 * Default grants settings list
 * For more information you can check these docs
 * Default roles testing protocol:
 * https://docs.google.com/document/d/18gT-bUeEBDgCSYxlIImZ-XbNw8BUP-r6D3YYy5T3vHg/edit#
 * Roles-based permissions:
 * https://docs.google.com/document/d/1wSU1arRiMitm91NUqOupcqhCWReqw3kI4Ua6FPjzXj8/edit#heading=h.2zjmls30qtir
 */
const DEFAULT_SETTINGS_GRANTS_LIST = [
  RESOURCE_SINGLETONS.ACCOUNT,
  RESOURCE_SINGLETONS.ROLES,
  RESOURCE_SINGLETONS.USERS,
  RESOURCE_SINGLETONS.COLLECTIONS,
  RESOURCE_SINGLETONS.INCIDENTS,
  RESOURCE_SINGLETONS.DASHBOARDS,
  RESOURCE_SINGLETONS.ACTIONS,
  RESOURCE_SINGLETONS.DATASOURCES,
  RESOURCE_SINGLETONS.NAVIGATION,
  RESOURCE_SINGLETONS.INTEGRATIONS,
  RESOURCE_SINGLETONS.BILLING
];

/**
* Grants settings list for dev console
* It is simillar to the default list
* but here we are also covering api key tab
* permissions
*/
const DEFAULT_DEV_CONSOLE_GRANTS_LIST = [
  RESOURCE_SINGLETONS.ACCOUNT,
  RESOURCE_SINGLETONS.ROLES,
  RESOURCE_SINGLETONS.USERS,
  RESOURCE_SINGLETONS.COLLECTIONS,
  RESOURCE_SINGLETONS.INCIDENTS,
  RESOURCE_SINGLETONS.DASHBOARDS,
  RESOURCE_SINGLETONS.ACTIONS,
  RESOURCE_SINGLETONS.DATASOURCES,
  RESOURCE_SINGLETONS.NAVIGATION,
  RESOURCE_SINGLETONS.INTEGRATIONS,
  RESOURCE_SINGLETONS.BILLING,
  RESOURCE_SINGLETONS.APIS
];

// Roles collections is defined server-side only
const Roles = new Mongo.Collection(COLLECTIONS.ROLES);
const Users = Meteor.users; // Accounts.users?

/**
 * <roleId>: { // Any of ALL_ROLE_DOCS._id (see below) for built-in roles; or other unique ids
 *   lastUpdatedBy
 *   lastUpdatedTs
 *   label: string,
 *   grants: {
 *     <resourceId1>: [...permissions] // each permission is a string currently from ACCESS_LEVEL
 *     <resourceId2>: [...permissions]
 *     ...
 *   }
 * },
 * ...
 * }
 */

/**
 * Given a "roles" object (as in Users collection) and an entityType string,
 * extracts all roles related to objects of the given type `entityType`, returning
 * an object with only those keys (type prefixes removed).
 *
 * @param rolesObject: Simply a dictionary with `<roleId> : <values>`.
 *
 * @param entityType: A string, used to find as prefix in roles keys. The prefix
 *    is stripped away from the keys.
 *
 * Example:
 * ```
 * extractRolesOfType("collection", {
 *   "collection/1234": [ "poweruser", "creator" ],
 *   "company/5678": [ "janitor" ],
 *   "__global_roles__": [ "don'task" ]
 * })
 * ```
 * will return a single-key object: `{ "1234": [ "poweruser", "creator" ] }`.
 */
const extractRolesOfType = (entityType, rolesObject) => {
  if (!isString(entityType)) {
    throw new Error('objectType must be a string');
  }
  if (!rolesObject) {
    // allow rolesObject to be null; users might have no roles at all
    return {};
  }
  if (!isObject(rolesObject)) {
    throw new Error('rolesObject must be an object');
  }
  return renameKeys(
    key => (key.startsWith(entityType + SCOPE_SEPARATOR) && key.substr(entityType.length + 1)),
    rolesObject
  );
};

/**
 * Find the last of possible ROLES that matches the company.
 * @param rolesObject: Simply a dictionary with `<roleId> : <values>`.
 *
 * @param companyId: A string that identifies a company.
 *
 * Example:
 * ```
 * findRoleInCompany({
 *   "collection/1234": [ "poweruser", "creator" ],
 *   "company/5678": [ "janitor", "operator" ],
 * }, 'iuhfer8u44')
 * ```
 * will return: `"operator"`.
 */
const findRoleInCompany = (rolesObject, companyId) => {
  const companyRoles = extractRolesOfType(ID_TYPE_COMPANY, rolesObject)[companyId] || [];
  // Pablo: just return the last role here:
  //  - If there's a single role, it will obviously work.
  //  - If there's an alias, it will be last in the
  // list (see setCompanyRole in server/inorbitRoles.js)
  return companyRoles[companyRoles.length - 1];
};

/*
 * Returns an object with { companyId, collections } with the primary companyId of a
 * robot and an array to all collections (not including "ALL") this robot belongs to.
 *
 * This is used to check access to a robot (returning both the company and collections
 * to avoid multiple db queries), as well as deciding how configuration settings need
 * to be applied (company, then collection 1, then collection 2, ...).
 */
const fetchRobotRealmAsync = async robotId => (
  // NOTE: Not using model/Robot to allow fetching both fields in a single query
  Robots.findOneAsync({ _id: robotId }, { fields: { _id: 1, companyId: 1, collections: 1 } })
);

/*
 * Returns an array with { _id, companyId, collections } with the primary companyId of a
 * each robot and an array to all collections (not including "ALL") the robot belongs to.
 * NOTE that the results come from the DB and are not necessarily sorted as the input,
 * the result could have less elements than robotIds if some robots don't exist
 * in the DB
 */
const fetchRobotsRealmsAsync = async robotIds => (
  // NOTE: Not using model/Robot to allow fetching both fields in a single query
  Robots.find(
    { _id: { $in: robotIds } },
    { fields: { _id: 1, companyId: 1, collections: 1 } }
  ).fetchAsync()
);

/**
 * Returns the roles that a user (given by the non-null user object) has in a given company.
 *
 * It normally returns an 1-element array, as we only assign one role per company.
 *
 * If it has no roles in that company; it just returns null or undefined.
 */
const getUserRoles = (user, companyId) => {
  if (!isString(companyId)) {
    throw new Error('companyId must be a string');
  }
  return user.roles && user.roles[ID_TYPE_COMPANY + SCOPE_SEPARATOR + companyId];
};

/**
 * NOTE: duplicate from server/inorbitRoles.js
 * Remove from that module and leave it here instead.
 */
const makeQueryUserRoles = (userId) => {
  if (!isString(userId)) {
    throw new Error('userId must be a string');
  }
  // Returned query includes _id, as it it necessary for reactive cursors
  return Meteor.users.find({ _id: userId }, { fields: { roles: 1 } });
};

/**
 * NOTE: duplicate from server/inorbitRoles.js (fetchUserRoles)
 * Remove from that module and leave it here instead.
 */
const getUserRolesByIdAsync = async userId => (
  (await makeQueryUserRoles(userId).fetchAsync())[0] || {}
);

/**
 * roleResourceId is of the form: 'role/companyId/roleId'
 * From this ID we get the companyId the role belongs to,
 * to be used as part of the realm the role is part of.
 * If the companyId is not derived due to a malformed id,
 * it throws a loud exception
 * @param {string} roleResourceId
 */
const fetchRoleRealm = (roleResourceId) => {
  const { companyId } = parseResourceId(roleResourceId);
  if (companyId) {
    return { companyId };
  } else {
    throw new Error('CompanyId missing from roleResourceId', roleResourceId);
  }
};

/**
 * Get from the user the realm associated to the given companyId.
 * The realm is an object with the form { companyId, roleIds }.
 *
 * @param {string} userId
 * @param {string} companyId optional, if not set infer a company from the user's data
 */
const fetchUserRealmAsync = async (userId, companyId) => {
  const rolesObject = await getUserRolesByIdAsync(userId);
  const companyRolesObject = (rolesObject.roles
    && extractRolesOfType(ID_TYPE_COMPANY, rolesObject.roles)) || {};

  // We have companyId: return realm for companyId and its roles
  if (companyId) {
    const roleIds = (companyRolesObject[companyId] || [])
      .map(roleName => makeRoleId(companyId, roleName));
    return { companyId, roles: roleIds };
  }

  // No companyId, no roles for any company: nothing to return
  if (isEmpty(companyRolesObject)) {
    return { companyId: null, roles: [] };
  }

  // No companyId, but user has roles for a single company: use that
  if (size(companyRolesObject) == 1) {
    [companyId] = Object.keys(companyRolesObject);
    console.warn(`fetchUserRealmAsync (user ${userId}): no companyId provided, using: ${companyId}`);
    return {
      companyId,
      roles: companyRolesObject[companyId].map(roleName => makeRoleId(companyId, roleName))
    };
  }

  // Ouch! No companyId, user has roles for many companies.
  // We try with the user's companyId, or pick an arbitrary company if user's companyId isn't set
  companyId = rolesObject.companyId || Object.keys(companyRolesObject)[0];
  console.warn(`fetchUserRealmAsync (user ${userId}): `
    + `no companyId provided for user with multiple companies, using: ${companyId}`);
  return {
    companyId,
    roles: companyRolesObject[companyId].map(roleName => makeRoleId(companyId, roleName))
  };
};

/**
 * Returns the company corresponding to the provided object.
 * The object can be a user (it returns the default company based on roles),
 * a location (in the future; would return the company it belongs to), a robot,
 * etc.
 *
 * The first implementation simply uses a users's document `roles` to determine
 * it from the companies it has access to; but this function could will other
 * arguments in the future (think: a URL, or an object derived from it; or a
 * robot, or an action) and still determine "which is the company we are
 * talking about".
 */
const getDefaultCompanyId = ({ user }) => {
  if (isObject(user)) {
    // If a user is provided (the only option from now!) use its `roles` element.
    // Note that this should be the least preferred option (e.g. if robot was
    // provided, use that info first)
    const companies = extractRolesOfType(ID_TYPE_COMPANY, user.roles);
    const companyIds = Object.keys(companies);
    if (!companyIds.length) {
      // The `roles` element is not provided; cannot determine a company
      return null;
    } else {
      // Deciding only from the `roles` object of a user. Normally there is only
      // one company the user has explicit access to, so return that one. If there
      // are multiple of them, we simply return the first one -- but this is likely
      // wrong: This needs to be revisited when we support multiple companies'
      // roles for users.
      // TODO(herchu): Change this logic to support finding the 'default' company
      // of a user -- if no robot or url or other object was given as a hint.
      if (companyIds.length > 1) {
        console.error('User has roles in multiple companies; '
          + 'getTargetCompanyId is not sufficient to return primary company');
        // HACK(adamantivm) Until this situation is resolved, revert back to the
        // userId hack.
        // @see https://inorbit.atlassian.net/browse/IO-399
        if (user.companyId) {
          return user.companyId;
        }
      }
      return companyIds[0];
    }
  } else {
    //
    throw new Error('no subject provided string');
  }
};

/**
 * Returns the company corresponding to the provided service user.
 * This is a similar function to getDefaultCompanyId; but it only works for service users and it
 * only decides the account based on the assigned roles.
 *
 * Note that service users (ie. "API keys") cannot belong to multiple accounts/companies; as they
 * cannot be invited or join companies. So the logic is based only on `roles`, and it is assumed
 * there are roles for only one company (else: it fails).
 */
const getServiceUserCompanyId = (user) => {
  if (isObject(user)) {
    // Keep only `roles` field and discard the rest (ie. companyId or defaultCompanyId),
    // and let getDefaultCompanyId implement the logic based on roles.
    const { roles } = user;
    return getDefaultCompanyId({ user: { roles } });
  } else {
    //
    throw new Error('no subject provided string');
  }
};

/**
 * This function lists all roles available to a company; including built-in roles, aliases, etc.
 * For accounts without configured custom roles, the ALL_ROLE_DOCS list is used (Owner, Admin, User)
 * just for backwards compatibility.
 *
 * The result is a list of Role objects with { _id, properties, ...grants }, where `properties`
 * contains { label, comment, alias, isBuiltIn }, and `grants` (all other fields) are the
 * actual role's grants, a map from resourceId to list of permissions. This object format is
 * defined here:
 *   https://docs.google.com/document/d/1wSU1arRiMitm91NUqOupcqhCWReqw3kI4Ua6FPjzXj8/edit#heading=h.teateeomxgmb
 * Notes on properties fields:
 *   - isBuiltIn is not part of the DB representation - it is injected by this function just to
 *     distinguish default from custom roles
 *   - alias roles are soon to be deprecated; although they are still supported and handled by
 *     this method.
 *
 * Note that the result is not sorted by any criteria. Normally we list built-in roles first,
 * and using a 'order' property to include the highest in the hierarchy first. Use sortRoles()
 * on the output of this function to sort by that criteria.
 */
const listCompanyRolesAsync = async (companyId) => {
  // TODO(Pablo):
  // Next five lines are a replica of fetchCompanyRoles (server/inorbitRoles).
  // Should we move fetchCompanyRoles to this lib module?
  const mixedRoles = await CompanyRoles.find({
    companyId: { $in: [companyId, ID_INORBIT] }
  }).fetchAsync();
  const rootRoles = mixedRoles.find(doc => doc.companyId == ID_INORBIT) || {};
  const companyRoles = mixedRoles.find(doc => doc.companyId == companyId) || {};
  const mergedRoles = applyDefaults(companyRoles, rootRoles);
  delete mergedRoles._id;
  delete mergedRoles.companyId;

  // HACK(herchu): If there are no roles found in the DB, return a list of defaults from
  // ALL_ROLE_DOCS. This should NOT be necessary once all accounts have custom roles properly
  // created in the DB
  if (isEmpty(mergedRoles)) {
    return ALL_ROLE_DOCS.map(({ _id, label, comment }) => ({
      _id,
      properties: { label, comment, isBuiltIn: true }
    }));
  }

  return Object.entries(mergedRoles).reduce(
    (acc, [roleId, { properties = {}, ...grants }]) => {
      acc.push({
        _id: roleId,
        properties: {
          // since client code uses `aliasOf` but DB contains `alias`, we add this field here;
          // it ends up duplicated in this object. This is temporary anyway -- aliases are going
          // to be deprecated soon
          aliasOf: properties.alias,
          isBuiltIn: isBuiltInRole(roleId),
          ...properties
        },
        ...grants
      });
      return acc;
    },
    []
  );
};

/**
 * @deprecated Use listCompanyRolesAsync instead
 *
 * NOTE: This is a copy of listCompanyRolesAsync, just using old fetch() (non-async).
 *
 * We CANNOT use Meteor.wrapAsync to share implementations since this only works serverside,
 * and this function is used in the client.
 */
const listCompanyRoles = (companyId) => {
  // TODO(Pablo):
  // Next five lines are a replica of fetchCompanyRoles (server/inorbitRoles).
  // Should we move fetchCompanyRoles to this lib module?
  const mixedRoles = CompanyRoles.find({
    companyId: { $in: [companyId, ID_INORBIT] }
  }).fetch();
  const rootRoles = mixedRoles.find(doc => doc.companyId == ID_INORBIT) || {};
  const companyRoles = mixedRoles.find(doc => doc.companyId == companyId) || {};
  const mergedRoles = applyDefaults(companyRoles, rootRoles);
  delete mergedRoles._id;
  delete mergedRoles.companyId;

  // HACK(herchu): If there are no roles found in the DB, return a list of defaults from
  // ALL_ROLE_DOCS. This should NOT be necessary once all accounts have custom roles properly
  // created in the DB
  if (isEmpty(mergedRoles)) {
    return ALL_ROLE_DOCS.map(({ _id, label, comment }) => ({
      _id,
      properties: { label, comment, isBuiltIn: true }
    }));
  }

  return Object.entries(mergedRoles).reduce(
    (acc, [roleId, { properties = {}, ...grants }]) => {
      acc.push({
        _id: roleId,
        properties: {
          // since client code uses `aliasOf` but DB contains `alias`, we add this field here;
          // it ends up duplicated in this object. This is temporary anyway -- aliases are going
          // to be deprecated soon
          aliasOf: properties.alias,
          isBuiltIn: isBuiltInRole(roleId),
          ...properties
        },
        ...grants
      });
      return acc;
    },
    []
  );
};

/**
 * Sort function to define an order of roles to display.
 * Built-in roles have an 'order' property set (from higher ranked role Owner, first, to User);
 * this is in `properties.order` which can be used to define any sorting e.g. user defined sorting
 * in the future.
 * Any other role is sorted alphabetically just so there is _any_ defined sorting, not random.
 *
 * @param {array} roles is a list of Roles objects with a { properties } property, with label and
 *    other fields (see listCompanyRoles)
 */
const sortRoles = roles => (
  sortBy(
    roles,
    [
      role => ((role && role.properties && role.properties.isBuiltIn) ? 0 : 1),
      'properties.order',
      'properties.label'
    ]
  )
);

export {
  Roles,
  Users,

  ROLE_OWNER,
  ROLE_ADMIN,
  ROLE_MANAGER,
  ROLE_ENGINEER,
  ROLE_OPERATOR,
  ROLE_VIEWER,
  ALL_ROLE_DOCS,
  DEFAULT_SETTINGS_GRANTS_LIST,
  DEFAULT_DEV_CONSOLE_GRANTS_LIST,

  extractRolesOfType,
  findRoleInCompany,
  fetchRobotRealmAsync,
  fetchRobotsRealmsAsync,

  getUserRoles,
  makeQueryUserRoles,

  getDefaultCompanyId,
  getServiceUserCompanyId,

  listCompanyRolesAsync,
  listCompanyRoles, // deprecated, Meteor 2.x
  sortRoles,
  fetchUserRealmAsync,
  fetchRoleRealm
};
