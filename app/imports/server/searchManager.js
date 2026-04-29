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
 * Module to handle back-end logic for entity searching
 * It provides the API to which we can connect either
 * the Client (with meteor method)
 * or third parties to search for entities (not yet supported)
 *
 * As of Feb 2021, it supports searching for:
 * - robot
 * - collections
 */

import { Meteor } from 'meteor/meteor';
import { escapeRegExp, isArray, isFinite, pick } from 'lodash';
// ORO modules
import { Robots } from '../lib/collections';
import { ID_TYPE_ROBOT } from '../shared/constants';

let instance;
class SearchManager {
  constructor() {
    // Singleton pattern
    if (instance === undefined) {
      instance = this;
      // Meteor methods to add, edit or remove attributes and mappings
      Meteor.methods({
        'search.entities': this._meteorGetEntityList,
      });
    }
    // eslint-disable-next-line no-constructor-return
    return instance;
  }

  async init() {
    // Do nothing. Placeholder.
  }

  async _meteorGetEntityList({ entityTypes, queryString, filters, fields, options = {} }) {
    // TODO/login
    // if (!this.userId) {
    //   throw new Meteor.Error('userId missing or invalid');
    // }
    if (!Array.isArray(entityTypes) || entityTypes.length <= 0) {
      throw new Meteor.Error('entityTypes must be an array of length > 0.', entityTypes);
    }
    const result = await new SearchManager().getEntityList({
      userId: this.userId, entityTypes, queryString, filters, fields, options
    });
    return result;
  }

  /**
   * Fetches a list of entities a user has access to.
   * the list is actually returned as an object where each key is a
   * requested entity type.
   *
   * @param userId (string): The user performing the query
   *    Their access to data will checked on a per entity basis
   *    (collections before robots for example)
   *
   * @param entityTypes (array): Entity types for which to search.
   *    Supported entity types:
   *      - robot
   *
   * @param queryString (string): user input to limit search results.
   *    It is sanitized internally.
   *
   * @param fields (object): key should be an entity Type,
   *    it must contain the schema as an array of what fields
   *    are desired to be in the data field of the object
   *    to be returned in the 'data' field for the entity type
   *
   * @param options (object): different options for how to manipulate the results
   * supported options:
   *    - limit: how many entries to return, it will have a hard limit enforced
   */
  getEntityList = async ({
    userId, entityTypes, queryString, fields = {}, options = {}
  }) => {
    // TODO/login
    // if (!userId) {
    //   throw Error('userId missing and required to fetch entities.');
    // }
    if (!Array.isArray(entityTypes) || entityTypes.length <= 0) {
      throw Error('entityTypes must be a non-empty array.', entityTypes);
    }
    // List of all entities fetched
    let entityList = [];
    // destructuring and defaults for various parameters for the query
    const {
      limit = 15
    } = options;
    const { [ID_TYPE_ROBOT]: robotFields } = fields;

    // We organize the entities to be searched by type.
    // Here we iterate over each type in the given array
    // and call forth the methods required to fetch those entities
    for (const entityType of entityTypes) {
      switch (entityType) {
        case ID_TYPE_ROBOT:
          // eslint-disable-next-line no-await-in-loop
          entityList = entityList.concat(await this.getUsersRobots({
            userId,
            queryString,
            options: { limit, fields: robotFields }
          }));
          break;
        default:
          console.error('Unsupported entity type provided', entityType);
      }
    }
    return entityList;
  };

  /**
   * Performs a search and fetch for robots to which a user has access to.
   * It limits said search with a query string and different filters
   * such as a specific collection(s)
   */
  getUsersRobots = async ({
    userId, queryString, options
  }) => {
    // TODO roles limit which robots are visible, apply to filter
    let { limit = 15 } = options;
    const { fields = [] } = options;
    // Hard-coding a strong limit at 50 robots
    if (!(isFinite(limit) && limit <= 50)) {
      limit = 50;
      console.error('search query limit not valid or outside range', limit);
    }
    if (fields && !isArray(fields)) {
      throw Error('fields must be an array', fields);
    }
    // Sanitize the query string, removing mongo operators such as $
    let query = {};
    if (queryString) {
      const sanitizedString = escapeRegExp(queryString);
      // NOTE (pisti) It is a FACT that this is not a high performance query,
      // case-insensitivity FORCES mongo to not be able to use indexes.
      query = {
        $and: [
          query,
          { $or: [
            {
              name: { $regex: sanitizedString, $options: 'i' }
            }, {
              _id: { $regex: sanitizedString, $options: 'i' }
            }
          ] }
        ]
      };
    }
    // To utilize collation, we have to break out of Meteor's wrapper over the
    // mongo node driver using raw collection. This leads to changes in syntax
    // and in using await/async to handle asynchronous calls
    const robotsRaw = await Robots.rawCollection()
      .find(query)
      .collation({ locale: 'en' })
      .sort({ name: 1 })
      .limit(limit)
      .toArray();
    // The processing below is in memory, to remain performant we have to
    // always mantain a limit on results
    const robotsProcessed = robotsRaw.map(r => ({
      entityId: r._id,
      entityType: ID_TYPE_ROBOT,
      label: r.name || r._id,
      data: pick(r, fields)
    }));
    return robotsProcessed;
  };
}

export default SearchManager;
