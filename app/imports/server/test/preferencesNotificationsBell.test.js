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
 * Tests that the per-user notifications bell flag is stored under the shared
 * 'notificationsBell' preferences document without clobbering other users.
 */
import { Meteor } from 'meteor/meteor';
import { expect } from 'chai';
// ORO modules
import { resetDatabase } from './setup';
import PreferencesManager from '../preferences';

if (!Meteor.isTest) {
  throw new Error('This is TEST code only');
}

describe('preferences: notifications bell flag', () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it('stores a per-user flag and merges across users', async () => {
    const manager = new PreferencesManager();
    await manager.setPreferences('notificationsBell', { userOne: false });
    await manager.setPreferences('notificationsBell', { userTwo: true });
    const doc = await manager.getPreferences('notificationsBell');
    expect(doc.userOne).eq(false);
    expect(doc.userTwo).eq(true);
  });
});
