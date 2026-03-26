/**
 * DRAFT/STUB implementation for preferences manager. 
 */
import { Meteor } from 'meteor/meteor';
import { isString, isObject, isEmpty } from 'lodash';
import { Preferences } from '../lib/collections';

let instance;

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
};

export default PreferencesManager;
