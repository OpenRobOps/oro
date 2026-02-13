/**
 * Common startup logic and helper functions for all server unit tests.
 *
 */
import { Meteor } from 'meteor/meteor';
import { MongoInternals } from 'meteor/mongo';
import { reject } from 'lodash';

/**
 * Utility function to reset (empty) the database, ONLY for testing purposes.
 * It is an alternative to (old) xolvio:cleaner Meteor package. That one is not async, nor it
 * uses the new Mongo APIs so it triggers deprecation warnings.
 *
 * This version was extracted from forum:
 * https://forums.meteor.com/t/import-mongointernals-in-meteor-react/34122/2
 */
const resetDatabase = async function (options = {}) {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error(
      'resetDatabase is not allowed outside of a development mode. Aborting.'
    );
  }

  let excludedCollections = ['system.indexes', 'system.views'];
  if (options.excludedCollections) {
    excludedCollections = excludedCollections.concat(
      options.excludedCollections
    );
  }

  const db = options.db || MongoInternals.defaultRemoteCollectionDriver().mongo.db;
  const collections = await db.collections();

  const appCollections = reject(collections, col => (
    col.collectionName.indexOf('velocity') === 0
      || col.collectionName.startsWith('view_') // our own views, cannot be dropped
      || excludedCollections.indexOf(col.collectionName) !== -1
  ));

  for await (const col of appCollections) {
    await col.deleteMany({});
  }
};

export {
  resetDatabase
};
