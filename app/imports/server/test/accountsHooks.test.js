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
 * Server unit tests for initial role assignment on account creation.
 */
import { Meteor } from 'meteor/meteor';
import { assert } from 'chai';
// ORO modules
import { initialRolesForUser } from '../accountsHooks';

// Just make sure this is not getting loaded in dev/prod
if (!Meteor.isTest) {
  throw new Error('This is TEST code only');
}

describe('initialRolesForUser', () => {
  it('grants admin when the email is in the admin list', () => {
    assert.deepEqual(initialRolesForUser('boss@inorbit.ai', ['boss@inorbit.ai']), ['admin']);
  });

  it('matches case-insensitively', () => {
    assert.deepEqual(initialRolesForUser('Boss@InOrbit.ai', ['boss@inorbit.ai']), ['admin']);
    assert.deepEqual(initialRolesForUser('boss@inorbit.ai', ['BOSS@INORBIT.AI']), ['admin']);
  });

  it('returns no roles when the email is not in the list', () => {
    assert.deepEqual(initialRolesForUser('user@inorbit.ai', ['boss@inorbit.ai']), []);
  });

  it('returns no roles when the admin list is empty or missing', () => {
    assert.deepEqual(initialRolesForUser('user@inorbit.ai', []), []);
    assert.deepEqual(initialRolesForUser('user@inorbit.ai', undefined), []);
    assert.deepEqual(initialRolesForUser('user@inorbit.ai'), []);
  });

  it('returns no roles when the user has no resolvable email', () => {
    assert.deepEqual(initialRolesForUser(null, ['boss@inorbit.ai']), []);
    assert.deepEqual(initialRolesForUser(undefined, ['boss@inorbit.ai']), []);
    assert.deepEqual(initialRolesForUser('', ['boss@inorbit.ai']), []);
  });
});
