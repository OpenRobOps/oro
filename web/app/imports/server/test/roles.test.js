/* eslint-disable function-call-argument-newline */
/* eslint-disable function-paren-newline */
/**
 * Server unit tests for Roles implementation (mainly roles.js packages)
 */
import { Meteor } from 'meteor/meteor';
import { Accounts } from 'meteor/accounts-base';
import chai, { assert, expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
// ORO modules
import { resetDatabase } from './setup';
import OroRoles from '../roles';
import { ROLE_ADMIN, ROLE_VIEWER, ROLE_MANAGER } from '../../lib/roles';
import {
  ACCESS_LEVEL_OPERATE, ACCESS_LEVEL_VIEW, ACCESS_LEVEL_CONFIGURE,
  RESOURCE_TYPES, RESOURCE_SINGLETONS,
  makeWildcardId, glueId, parseResourceId,
  RESOURCE_WILDCARD,
  ROLE_OPERATOR
} from '../../shared/roles';
import { ID_TYPE_ROBOT } from '../../shared/constants';
import { BOB_USER, WALL_E_ROBOT, createUser, createRobot } from './common';

// Just make sure this is not getting loaded in dev/prod
if (!Meteor.isTest) {
  throw new Error('This is TEST code only');
}

chai.use(chaiAsPromised);

// Use this to turn on logging to debug unit tests
const ORO_ROLES_LOGGING = false;

// Various IDs
const BOB_USER = 'b0b';
const STRANGER_USER = 'i-am-a-spy';
// Ready-to-use qualified ids
const ELEM_DASHBOARDS_QID = glueId(RESOURCE_TYPES.SYSTEM, RESOURCE_SINGLETONS.DASHBOARDS);
const ELEM_USERS_QID = glueId(RESOURCE_TYPES.SYSTEM, RESOURCE_SINGLETONS.USERS);
const ELEM_LOCKS_QID = glueId(RESOURCE_TYPES.SYSTEM, RESOURCE_SINGLETONS.LOCKS);
const WALL_E_ROBOT_QID = glueId(ID_TYPE_ROBOT, WALL_E_ROBOT);

// helper to create a batch of n robots. Returns the list of robotIds created
const createRobotsBatch = async (n, options = {}) => {
  const makeId = i => (`robot${i}`);
  let i;
  const robotIds = [];
  const from = options.from || 0;
  for (i = from; i < from + n; i++) {
    const id = makeId(i);
    // eslint-disable-next-line no-await-in-loop
    await createRobot({ id });
    robotIds.push(id);
  }
  robotIds.sort();
  return robotIds;
};


/**
 * Common initialization for all tests: resets db, returns an initialized instance of OroRoles
 */
const initializeSuite = async () => {
  await resetDatabase();
  const instance = new OroRoles();
  await instance.createDefaultRoles();
  instance.setLogging(ORO_ROLES_LOGGING);
  return instance;
}


describe('Basic role tests', () => {
  let instance;

  beforeEach(async () => {
    instance = await initializeSuite();
  });

  it('Viewers can only access allowed resources', async () => {
    await createUser();
    assert.isTrue(await instance.canAccess(
      BOB_USER,
      glueId(RESOURCE_TYPES.SYSTEM, RESOURCE_SINGLETONS.FLEET),
      ACCESS_LEVEL_VIEW
    ));
    // No other resources (e.g., ~dashboards) are accessible for Bob (even for viewing)
    assert.isFalse(await instance.canAccessSystemElement(
      BOB_USER,
      RESOURCE_SINGLETONS.DASHBOARDS,
      ACCESS_LEVEL_CONFIGURE
    ));
  });

  it('Admins can only access allowed resources', async () => {
    // Bob is now an admin!
    await createUser();
    await instance.setRole({ userId: BOB_USER, roleId: ROLE_ADMIN });
    assert.isTrue(await instance.canAccess(
      BOB_USER,
      glueId(RESOURCE_TYPES.SYSTEM, RESOURCE_SINGLETONS.FLEET),
      ACCESS_LEVEL_VIEW
    ));
    assert.isTrue(await instance.canAccess(
      BOB_USER,
      glueId(RESOURCE_TYPES.SYSTEM, RESOURCE_SINGLETONS.FLEET),
      ACCESS_LEVEL_OPERATE
    ));
    assert.isTrue(await instance.canAccess(
      BOB_USER,
      glueId(RESOURCE_TYPES.SYSTEM, RESOURCE_SINGLETONS.FLEET),
      ACCESS_LEVEL_CONFIGURE
    ));
    // And configure ~dashboards
    assert.isTrue(await instance.canAccessSystemElement(
      BOB_USER,
      RESOURCE_SINGLETONS.DASHBOARDS,
      ACCESS_LEVEL_CONFIGURE
    ));
  });

  it('non-user access is denied', async () => {
    assert.isFalse(await instance.canAccess(
      null,
      glueId(RESOURCE_TYPES.SYSTEM, RESOURCE_SINGLETONS.FLEET),
      ACCESS_LEVEL_VIEW
    ));
    assert.isFalse(await instance.canAccessSystemElement(
      null,
      RESOURCE_SINGLETONS.DASHBOARDS,
      ACCESS_LEVEL_VIEW
    ));
  });

  it('basic platform access is denied', async () => {
    // This time, Bob has no access at all. Deny
    await createUser();
    await instance.setRole({ userId: BOB_USER, roleId: null });
    assert.isFalse(await instance.canAccess(
      BOB_USER,
      glueId(RESOURCE_TYPES.SYSTEM, RESOURCE_SINGLETONS.FLEET),
      ACCESS_LEVEL_VIEW
    ));
  });
});

describe('roles: access objects in new roles modes', () => {
  let instance;

  beforeEach(async () => {
    instance = await initializeSuite();
  });

  it('can tell if a user has any valid role', async () => {
    await createUser();
    assert.isTrue(await instance.hasRole(BOB_USER));
    assert.isFalse(await instance.hasRole(STRANGER_USER));
  });

  it('default roles access to account elements', async () => {
    // This test asserts some permissions, as created by creation of default roles. For example,
    // users have no access to '~users' or '~billing' elements; while Admins have partial
    // access and Owners have full access.
    // NOTE: Each permission below is tested twice (to compare canAccessSystemElement() and the
    // lower level canAcess())

    // First create Bob with default role (ie. User)
    await createUser();
    // In the default roles, Bob cannot access billing or users config
    assert.isFalse(await instance.canAccessSystemElement(
      BOB_USER,
      RESOURCE_SINGLETONS.USERS,
      ACCESS_LEVEL_VIEW
    ));
    assert.isFalse(await instance.canAccess(BOB_USER, ELEM_USERS_QID, ACCESS_LEVEL_VIEW));

    // Being Manager now, Bob can configure dashboards but not invite users
    await instance.setRole({ userId: BOB_USER, roleId: ROLE_MANAGER });
    assert.isTrue(await instance.canAccessSystemElement(
      BOB_USER,
      RESOURCE_SINGLETONS.DASHBOARDS,
      ACCESS_LEVEL_CONFIGURE
    ));
    assert.isTrue(await instance.canAccess(BOB_USER, ELEM_DASHBOARDS_QID, ACCESS_LEVEL_CONFIGURE));
    assert.isFalse(await instance.canAccess(BOB_USER, ELEM_USERS_QID, ACCESS_LEVEL_CONFIGURE));

    // Finally as an Admin, Bob can configure/invite Users
    await instance.setRole({ userId: BOB_USER, roleId: ROLE_ADMIN });
    assert.isTrue(await instance.canAccessSystemElement(
      BOB_USER,
      RESOURCE_SINGLETONS.DASHBOARDS,
      ACCESS_LEVEL_CONFIGURE
    ));
    assert.isTrue(await instance.canAccessSystemElement(
      BOB_USER,
      RESOURCE_SINGLETONS.USERS,
      ACCESS_LEVEL_CONFIGURE
    ));
    assert.isTrue(await instance.canAccess(BOB_USER, ELEM_USERS_QID, ACCESS_LEVEL_CONFIGURE));
  });
});

describe('roles: use of canAccessRobot wrapper api', () => {
  let instance;

  beforeEach(async () => {
    instance = await initializeSuite();
  });

  it('grants robot Viewer ccess through a role', async () => {
    // Create Bob WITHOUT any permission
    await createUser();
    await createRobot();
    await instance.setRole({ userId: BOB_USER, roleId: null });
    // Make sure Bob has no access to these tags
    assert.isFalse(await instance.canAccessRobot(BOB_USER, WALL_E_ROBOT, ACCESS_LEVEL_VIEW));
    // Now assign viewer permission and try again
    await instance.setRole({ userId: BOB_USER, roleId: ROLE_VIEWER });
    assert.isTrue(await instance.canAccessRobot(BOB_USER, WALL_E_ROBOT, ACCESS_LEVEL_VIEW));
    assert.isFalse(await instance.canAccessRobot(BOB_USER, WALL_E_ROBOT, ACCESS_LEVEL_OPERATE));
    // Finally assign Operator access
    await instance.setRole({ userId: BOB_USER, roleId: ROLE_OPERATOR });
    assert.isTrue(await instance.canAccessRobot(BOB_USER, WALL_E_ROBOT, ACCESS_LEVEL_VIEW));
    assert.isTrue(await instance.canAccessRobot(BOB_USER, WALL_E_ROBOT, ACCESS_LEVEL_OPERATE));
  });
});

describe('roles: use of canAccessRobots wrapper apis', () => {
  let instance;

  beforeEach(async () => {
    instance = await initializeSuite();
  });

  it('Check grants multiple robots OP access using canAccessRobots', async () => {
    await createUser();
    // Create several robots
    const robotIds = await createRobotsBatch(10);
    // Make sure Bob has access to them invividually (and a nonexistent user does not)
    await Promise.all(robotIds.map(async (id) => {
      assert.isTrue(await instance.canAccessRobot(BOB_USER, id));
      assert.isFalse(await instance.canAccessRobot(STRANGER_USER, id));
    }));
    // Finally to the point of this test: canAccessRobots
    assert.isTrue(await instance.canAccessRobots(BOB_USER, robotIds, ACCESS_LEVEL_VIEW));
    assert.isFalse(await instance.canAccessRobots(BOB_USER, robotIds, ACCESS_LEVEL_OPERATE));
    assert.isFalse(await instance.canAccessRobots(STRANGER_USER, robotIds, ACCESS_LEVEL_VIEW));
    assert.isFalse(await instance.canAccessRobots(STRANGER_USER, robotIds, ACCESS_LEVEL_OPERATE));
    // If Bob is operator, now canAccessRobots(op) must succeed
    await instance.setRole({ userId: BOB_USER, roleId: ROLE_OPERATOR });
    assert.isTrue(await instance.canAccessRobots(BOB_USER, robotIds, ACCESS_LEVEL_VIEW));
    assert.isTrue(await instance.canAccessRobots(BOB_USER, robotIds, ACCESS_LEVEL_OPERATE));
  });

  it('can list all accessible robots with getAccessibleRobotIds()', async () => {
    await createUser();
    const allRobotIds = await createRobotsBatch(4);
    const accessible = await instance.getAccessibleRobotIds(
      BOB_USER,
      allRobotIds,
      ACCESS_LEVEL_VIEW
    );
    assert.equal(accessible.length, 4);
    // check from a different user
    const accessible2 = await instance.getAccessibleRobotIds(
      STRANGER_USER,
      allRobotIds,
      ACCESS_LEVEL_VIEW
    );
    assert.equal(accessible2.length, 0);
  });

  it('can list filter resources with internal _getAccessibleResources()', async () => {
    await createUser();
    const robotIds = await createRobotsBatch(4);
    const resources = robotIds.map(rId => glueId(ID_TYPE_ROBOT, rId));
    const permissions = Array(resources.length).fill(ACCESS_LEVEL_VIEW);
    const accessible = await instance._getAccessibleResources(BOB_USER, resources, permissions);
    assert.equal(accessible.length, 4);
  });
});

describe('roles: use of resolveTargetResources', () => {
  let instance;

  beforeEach(async () => {
    instance = await initializeSuite();
  });

  it('Check resolveTargetResources works for robots', async () => {
    const robotIds = await createRobotsBatch(6);
    const qualifiedResourceIds = robotIds.map(rId => glueId(ID_TYPE_ROBOT, rId));
    const parsedResources = qualifiedResourceIds.map(parseResourceId);
    const targetResources = await instance.resolveTargetResourcesMany(parsedResources);
    assert.lengthOf(targetResources, robotIds.length);
    for (let i = 0; i < robotIds.length; i++) {
      const expected = ['system/~fleet', `robot/${robotIds[i]}`];
      assert.sameMembers(targetResources[i], expected);
    }
  });
});

describe('roles: use of canAccessDual wrapper api', async () => {
  let instance;

  beforeEach(async () => {
    instance = await initializeSuite();
  });

  it('deny if user is not granted access to the singleton resource', async () => {
    // In this test case, the user has access to the robot but not on ~locks resource,
    // so canAccessDual will fail.
    await createUser();
    await createRobot();
    // assert the basic permissions (robot + singleton)
    assert.isTrue(await instance.canAccessRobot(
      BOB_USER,
      WALL_E_ROBOT,
      ACCESS_LEVEL_VIEW
    ));
    assert.isFalse(await instance.canAccessSystemElement(
      BOB_USER,
      RESOURCE_SINGLETONS.LOCKS,
      ACCESS_LEVEL_OPERATE
    ));
    // same assertion with the dual function canAccessDual
    assert.isFalse(await instance.canAccessDual(
      BOB_USER,
      RESOURCE_SINGLETONS.LOCKS,
      ACCESS_LEVEL_VIEW,
      WALL_E_ROBOT,
      ACCESS_LEVEL_OPERATE
    ));
  });

  it('allow if user is granted access to both the robot and the singleton', async () => {
    // This test complements the previous one, assuming Viewer roles does not have access
    // to ~locks, and modifies it to have it.
    await createUser({ });
    await createRobot();
    // modify Viewer role to access Locks singleton (as VIEW only, not sufficient yet)
    await instance.upsertGrant({
      roleId: ROLE_VIEWER,
      resourceId: ELEM_LOCKS_QID,
      permissions: [ACCESS_LEVEL_VIEW]
    });
    // assert the basic permissions (robot + singleton): This User has VIEW access to ~locks
    // singleton
    assert.isTrue(await instance.canAccessRobot(BOB_USER, WALL_E_ROBOT, ACCESS_LEVEL_VIEW));
    assert.isTrue(await instance.canAccessSystemElement(
      BOB_USER,
      RESOURCE_SINGLETONS.LOCKS,
      ACCESS_LEVEL_VIEW
    ));
    assert.isFalse(await instance.canAccessSystemElement(
      BOB_USER,
      RESOURCE_SINGLETONS.LOCKS,
      ACCESS_LEVEL_OPERATE
    ));
    // same assertion with the dual function canAccessDual
    assert.isFalse(await instance.canAccessDual(
      BOB_USER,
      RESOURCE_SINGLETONS.LOCKS,
      ACCESS_LEVEL_OPERATE,
      WALL_E_ROBOT,
      ACCESS_LEVEL_OPERATE
    ));
    // Now to finish the test, give CONFIG (and OP) access to ~locks (previously it was only
    // VIEW access); and assert that canAccessDual finally succeeds
    await instance.upsertGrant({
      roleId: ROLE_VIEWER,
      resourceId: ELEM_LOCKS_QID,
      permissions: [ACCESS_LEVEL_CONFIGURE]
    });
    // assert the basic permissions (robot + singleton): This User has VIEW access to ~locks
    // singleton
    assert.isTrue(await instance.canAccessSystemElement(
      BOB_USER,
      RESOURCE_SINGLETONS.LOCKS,
      ACCESS_LEVEL_CONFIGURE
    ));
    // same assertion with the dual function canAccessDual
    assert.isTrue(await instance.canAccessDual(
      BOB_USER,
      RESOURCE_SINGLETONS.LOCKS,
      ACCESS_LEVEL_OPERATE,
      WALL_E_ROBOT,
      ACCESS_LEVEL_VIEW
    ));
  });
});

describe('roles: use of resource wildcards vs specific elements', () => {
  let instance;

  beforeEach(async () => {
    instance = await initializeSuite();
  });

  it('grants actions access through a specific permission', async () => {
    // Create Bob as regular viewer
    await createUser();
    const actionQualifiedId1 = glueId(RESOURCE_TYPES.ACTION, 'someAction');
    const actionQualifiedId2 = glueId(RESOURCE_TYPES.ACTION, 'deniedAction');
    // Bob cannot yet execute actions
    assert.isFalse(await instance.canAccess(BOB_USER, actionQualifiedId1, ACCESS_LEVEL_VIEW));
    // Now give access to one specific action
    await instance.upsertGrant({
      roleId: ROLE_VIEWER,
      resourceId: actionQualifiedId1,
      permissions: [ACCESS_LEVEL_OPERATE]
    });
    // Now Bob can execute this specific action
    assert.isTrue(await instance.canAccess(BOB_USER, actionQualifiedId1, ACCESS_LEVEL_OPERATE));
    assert.isFalse(await instance.canAccess(BOB_USER, actionQualifiedId2, ACCESS_LEVEL_OPERATE));
  });

  it('grants actions access through a wildcard permission', async () => {
    await createUser();
    const actionQualifiedId = glueId(RESOURCE_TYPES.ACTION, 'someAction');
    // Bob cannot yet execute actions
    assert.isFalse(await instance.canAccess(BOB_USER, actionQualifiedId, ACCESS_LEVEL_VIEW));
    // Now give access to ALL actions
    await instance.upsertGrant({
      roleId: ROLE_VIEWER,
      resourceId: makeWildcardId(RESOURCE_TYPES.ACTION),
      permissions: [ACCESS_LEVEL_OPERATE]
    });
    // Now Bob can execute this specific action
    assert.isTrue(await instance.canAccess(BOB_USER, actionQualifiedId, ACCESS_LEVEL_OPERATE));
  });

  it('combine wildcard permission with canAccessMultiple', async () => {
    await createUser();
    await createRobot();
    const actionQualifiedId = glueId(RESOURCE_TYPES.ACTION, 'someAction');
    // Before starting make sure Bob already has access to the robot (it's not part of this test)
    assert.isTrue(await instance.canAccessRobot(
      BOB_USER,
      WALL_E_ROBOT,
      ACCESS_LEVEL_VIEW
    ));
    // Bob cannot yet execute actions
    assert.isFalse(await instance.canAccess(
      BOB_USER,
      actionQualifiedId,
      ACCESS_LEVEL_VIEW
    ));
    // Now give access to all actions
    await instance.upsertGrant({
      roleId: ROLE_VIEWER,
      resourceId: makeWildcardId(RESOURCE_TYPES.ACTION),
      permissions: [ACCESS_LEVEL_OPERATE]
    });
    // Now Bob can execute this specific action on a robot (requires 2 permissions at the same time)
    assert.isTrue(await instance.canAccessMultiple(
      BOB_USER,
      [actionQualifiedId, WALL_E_ROBOT_QID],
      [ACCESS_LEVEL_OPERATE, ACCESS_LEVEL_VIEW]
    ));
  });
});

describe('roles: Admin role is protected', async () => {
  let instance;
  beforeEach(async () => {
    instance = await initializeSuite();
  });

  it('cannot update or delete grants from Admin', async () => {
    const userId = BOB_USER;
    // First create Bob with default role (ie. User)
    await createUser();
    // Assign Bob to Admin role and assert it can configure dashboards
    await instance.setRole({ userId, roleId: ROLE_ADMIN });
    assert.isTrue(await instance.canAccess(BOB_USER, ELEM_DASHBOARDS_QID, ACCESS_LEVEL_CONFIGURE));
    // Attempt to modify a grant in this role, assert it throws
    await expect(instance.upsertGrant({
      roleId: ROLE_ADMIN,
      resourceId: ELEM_DASHBOARDS_QID,
      permissions: [ACCESS_LEVEL_VIEW]
    })).to.be.rejectedWith(Error, 'role admin cannot be edited');
    // // To make sure it did not modify the role, assert CONFIG level is still granted
    assert.isTrue(await instance.canAccess(BOB_USER, ELEM_DASHBOARDS_QID, ACCESS_LEVEL_CONFIGURE));
    // // Second part: Similarly, attempt to delete a grant in this role
    await expect(instance.deleteGrant({
      roleId: ROLE_ADMIN,
      resourceId: ELEM_DASHBOARDS_QID
    })).to.be.rejectedWith(Error, 'role admin cannot be edited');
    // To make sure it did not modify the role, assert CONFIG level is still granted
    assert.isTrue(await instance.canAccess(BOB_USER, ELEM_DASHBOARDS_QID, ACCESS_LEVEL_CONFIGURE));
  });

  it('can check if a user is an Admin', async () => {
    await createUser();
    assert.isFalse(await instance.isAdmin(BOB_USER));
    await instance.setRole({ userId: BOB_USER, roleId: ROLE_ADMIN });
    assert.isTrue(await instance.isAdmin(BOB_USER));
  });
});

describe('service users', () => {
  let instance;

  beforeEach(async () => {
    instance = await initializeSuite();
  });

  it.skip('creates service users and assign roles to them', async () => {
    // Create a service user; default permissions for now
    const serviceUserId = await createServiceUserAsync('test');
    const userDoc = await Meteor.users.findOneAsync({ _id: serviceUserId });
    // The default role for service user is Manager; which cannot configure Dashboards
    assert.isFalse(
      await instance.canAccess(serviceUserId, ELEM_DASHBOARDS_QID, ACCESS_LEVEL_CONFIGURE));
    // Give service user Admin role, and assert it can now configure dashboards
    await instance.setRole({ userId: serviceUserId, roleId: ROLE_ADMIN });
    assert.isTrue(
      await instance.canAccess(serviceUserId, ELEM_DASHBOARDS_QID, ACCESS_LEVEL_CONFIGURE));
  });
});

describe('roles: support functions', () => {
  let instance;

  beforeEach(async () => {
    instance = await initializeSuite();
  });

  it('can fetch a user\'s grants', async () => {
    const userId = BOB_USER;
    await createUser();
    await instance.setRole({ userId, roleId: ROLE_ADMIN });
    const grants = await instance.fetchUserGrants(userId);
    const assertGrant = (resourceType, resourceId, access) => {
      const qualResourceId = glueId(resourceType, resourceId);
      assert.property(grants, qualResourceId);
      assert.isArray(grants[qualResourceId]);
      assert.sameMembers(grants[qualResourceId], [access]);
    };
    assertGrant(RESOURCE_TYPES.SYSTEM, RESOURCE_SINGLETONS.LOCKS, ACCESS_LEVEL_CONFIGURE);
    assertGrant(RESOURCE_TYPES.SYSTEM, RESOURCE_SINGLETONS.INCIDENTS, ACCESS_LEVEL_CONFIGURE);
    assertGrant(RESOURCE_TYPES.ACTION, RESOURCE_WILDCARD, ACCESS_LEVEL_OPERATE);
  });

  it('parses roles configs into grants objects', async () => {
    const userId = BOB_USER;
    await createUser();
    await instance.setRole({ userId, roleId: ROLE_ADMIN });
    const rolesConfig = await instance.fetchRolesGrants([ROLE_ADMIN]);
    const grants = OroRoles.MergeRolesIntoGrants(rolesConfig);
    const assertGrant = (resourceType, resourceId, access) => {
      const qualResourceId = glueId(resourceType, resourceId);
      assert.property(grants, qualResourceId);
      assert.isArray(grants[qualResourceId]);
      assert.sameMembers(grants[qualResourceId], [access]);
    };
    assertGrant(RESOURCE_TYPES.SYSTEM, RESOURCE_SINGLETONS.LOCKS, ACCESS_LEVEL_CONFIGURE);
    assertGrant(RESOURCE_TYPES.SYSTEM, RESOURCE_SINGLETONS.INCIDENTS, ACCESS_LEVEL_CONFIGURE);
    assertGrant(RESOURCE_TYPES.ACTION, RESOURCE_WILDCARD, ACCESS_LEVEL_OPERATE);
    // NOTE: MergeRolesIntoGrants has a bug, it repeats elements in the returned array! e.g.
    // 'system/~locks': [ 'config', 'config', 'config', 'op', 'config' ]
    // (Only in case multiple roles are requested)
    // So this test does not assert for sameMembers() but only for contains()
    // TODO(herchu) We should fix this.
  });

  it('tests if a role is valid account', async () => {
    assert.isTrue(await instance.validRole(ROLE_ADMIN));
    assert.isFalse(await instance.validRole('foo'));
  });
});
