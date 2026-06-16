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
 * Unit tests for shared user helpers.
 */
import { Meteor } from 'meteor/meteor';
import { assert } from 'chai';
// ORO modules
import { missingAdminEmails } from '../../shared/users';

// Just make sure this is not getting loaded in dev/prod
if (!Meteor.isTest) {
  throw new Error('This is TEST code only');
}

// Convenience to build a minimal user document with a given email, optionally
// stored under emails[] instead of profile.email.
const userWithProfileEmail = email => ({ profile: { email } });
const userWithEmailsArray = address => ({ emails: [{ address }] });

describe('missingAdminEmails', () => {
  it('returns admin emails that are not present in the user list', () => {
    const users = [userWithProfileEmail('alice@inorbit.ai')];
    assert.deepEqual(
      missingAdminEmails(users, ['alice@inorbit.ai', 'boss@inorbit.ai']),
      ['boss@inorbit.ai'],
    );
  });

  it('returns an empty list when every admin email is registered', () => {
    const users = [
      userWithProfileEmail('alice@inorbit.ai'),
      userWithProfileEmail('boss@inorbit.ai'),
    ];
    assert.deepEqual(missingAdminEmails(users, ['boss@inorbit.ai']), []);
  });

  it('matches case-insensitively', () => {
    const users = [userWithProfileEmail('Boss@InOrbit.ai')];
    assert.deepEqual(missingAdminEmails(users, ['boss@inorbit.ai']), []);
  });

  it('preserves the configured casing of missing emails', () => {
    assert.deepEqual(missingAdminEmails([], ['Boss@InOrbit.ai']), ['Boss@InOrbit.ai']);
  });

  it('matches against emails stored in the emails[] array', () => {
    const users = [userWithEmailsArray('boss@inorbit.ai')];
    assert.deepEqual(missingAdminEmails(users, ['boss@inorbit.ai']), []);
  });

  it('de-duplicates repeated admin emails', () => {
    assert.deepEqual(
      missingAdminEmails([], ['boss@inorbit.ai', 'BOSS@inorbit.ai']),
      ['boss@inorbit.ai'],
    );
  });

  it('returns all admin emails when there are no users', () => {
    assert.deepEqual(
      missingAdminEmails([], ['a@inorbit.ai', 'b@inorbit.ai']),
      ['a@inorbit.ai', 'b@inorbit.ai'],
    );
  });

  it('returns an empty list when adminEmails is empty or missing', () => {
    const users = [userWithProfileEmail('alice@inorbit.ai')];
    assert.deepEqual(missingAdminEmails(users, []), []);
    assert.deepEqual(missingAdminEmails(users, undefined), []);
    assert.deepEqual(missingAdminEmails(users), []);
  });

  it('tolerates a missing user list', () => {
    assert.deepEqual(missingAdminEmails(undefined, ['boss@inorbit.ai']), ['boss@inorbit.ai']);
  });

  it('ignores blank/invalid admin email entries', () => {
    assert.deepEqual(missingAdminEmails([], ['', null, undefined]), []);
  });
});
