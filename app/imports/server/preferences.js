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
 * DRAFT/STUB implementation for preferences manager. 
 */
import { Meteor } from 'meteor/meteor';
import { isString, isObject, isEmpty } from 'lodash';
import { Preferences } from '../lib/collections';
import OroRoles from './roles';

let instance;

// Key of the preferences document owned by a user
const userPreferencesKey = (userId) => `user:${userId}`;

class PreferencesManager {
    constructor() {
        if (instance === undefined) {
            instance = this;
        }
        return instance;
    }


    getPreferences = async (key) => {
        if (!isString(key) || !key) {
            throw new Error('key must be a non-empty string');
        }
        return await Preferences.findOneAsync({ _id: key });
    }

    setPreferences = async (key, value) => {
        if (!isString(key) || !key) {
            throw new Error('key must be a non-empty string');
        }
        if (!isObject(value)) {
            throw new Error('value must be an object');
        }
        if (isEmpty(value)) {
            // nothing to do. Return; code belows assume non-empty object
            return;
        }
        if (value._id && value._id !== key) {
            throw new Error('value._id, if given, must be the same as key');
        }
        // note that if the preferences document contains other fields, they
        // are not overwritten. The caller should make sure to send undefined 
        // values for fields to be removed (or nulls if preferred, to overwrite)
        const update = Object.keys(value).reduce((acc, key) => {
            if (value[key] !== undefined) {
                acc.$set[key] = value[key];
            } else {
                acc.$unset[key] = true;
            }
            return acc;
        }, { $set: {}, $unset: {} });
        if (isEmpty(update.$set)) {
            delete update.$set;
        }
        if (isEmpty(update.$unset)) {
            delete update.$unset;
        }
        return await Preferences.upsertAsync({ _id: key }, update);
    }

    getUserPreferences = async (userId) => {
        if (!isString(userId) || !userId) {
            throw new Error('userId must be a non-empty string');
        }
        return await this.getPreferences(userPreferencesKey(userId));
    }

    setUserPreferences = async (userId, value) => {
        if (!isString(userId) || !userId) {
            throw new Error('userId must be a non-empty string');
        }
        // entityId/entityType let clients find the document without knowing
        // the key scheme
        return await this.setPreferences(userPreferencesKey(userId), {
            ...value,
            entityId: userId,
            entityType: 'user',
        });
    }
};

Meteor.methods({
    /**
     * Sets UI preferences for the logged-in user, e.g. { theme: 'monokai' }.
     * Only known fields are stored.
     */
    'preferences.setUserUi': async function (ui) {
        if (!this.userId || !await new OroRoles().hasRole(this.userId)) {
            throw new Meteor.Error('Unauthorized');
        }
        if (!isObject(ui) || !isString(ui.theme)) {
            throw new Meteor.Error('ui must be an object with a string `theme`');
        }
        await new PreferencesManager().setUserPreferences(this.userId, { ui: { theme: ui.theme } });
    },
});

/**
 * Publishes the logged-in user's own preferences document.
 */
Meteor.publish('userPreferences', async function () {
    if (!this.userId || !await new OroRoles().hasRole(this.userId)) {
        console.warn(`Unauthorized (userPreferences): userId: ${this.userId}`);
        return this.error(new Meteor.Error('Unauthorized'));
    }
    return Preferences.find({ _id: userPreferencesKey(this.userId) });
});

/**
 * Publishes system wide preferences.
 * Argument `keys` tell which preferences are to be published. 
 * Alternatively (deprecated) argument `fields` tell which fields or preferences are to be published
 * (for compatibility with old code; we should use `keys` instead)
 */
Meteor.publish('preferences', async function ({ keys, fields = null }) {
    // Choose proper entity type based on parameters
    if (!await new OroRoles().hasRole(this.userId)) {
        console.warn(`Unauthorized (preferences): userId: ${this.userId}`);
        return this.error(new Meteor.Error('Unauthorized'));
    }
    if (!keys) {
        if (fields) {
            console.warn('preferences: deprecated argument `fields` is used; use `keys` instead');
        }
        keys = fields;
    }
    if (!Array.isArray(keys)) {
        throw new Meteor.Error('keys must be an array');
    }
    return Preferences.find({ _id: { $in: keys } });
});

export default PreferencesManager;
