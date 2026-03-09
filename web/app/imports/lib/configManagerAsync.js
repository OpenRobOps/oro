/* eslint-disable class-methods-use-this */
/**
 * Configuration Manager.
 */
import { isEmpty, isString, isObject } from 'lodash';
import { applyDefaults } from './util';
import {
  ID_TYPE_SYSTEM_WIDE,
  ID_TYPE_ROBOT,
  ID_TYPE_ROLE,
  ID_TYPE_USER,
  ID_DEFAULT
} from '../shared/constants';

// Type hierarchy, modeled as partial order.
//
// For every configuration entry c: priority(c) > priority(c.parent)
//
// The bottom priority goes for ID_TYPE_SYSTEM_WIDE (root of the partial order tree)
// Note 1: Cached depth, so we don't have to compute it for every query.
// Note 2: Depth starts from 1, reserving 0 for type ids not in hierarchy
//         (making them even less prioritary than the root of the tree).
const TYPE_HIERARCHY_TREE = {
  [ID_TYPE_SYSTEM_WIDE]: { _id: ID_TYPE_SYSTEM_WIDE, depth: 1 }, // Root, no parent
  [ID_TYPE_ROBOT]: { _id: ID_TYPE_ROBOT, depth: 2, parent: ID_TYPE_SYSTEM_WIDE },
  [ID_TYPE_ROLE]: { _id: ID_TYPE_ROLE, depth: 2, parent: ID_TYPE_SYSTEM_WIDE },
  [ID_TYPE_USER]: { _id: ID_TYPE_USER, depth: 3, parent: ID_TYPE_ROLE }
};

/**
 * Helper function to validate a value is a nonempty string (sufficient to use for entity ids)
 */
const isIdString = (s) => s && isString(s);


const _typeDepth = (type) => {
  if (type in TYPE_HIERARCHY_TREE) {
    return TYPE_HIERARCHY_TREE[type].depth;
  }
  return 0;
};

// Convenience entity object for getting system level settings
const ROOT_ENTITY = { entityId: ID_DEFAULT, entityType: ID_TYPE_SYSTEM_WIDE };

export {
  ID_DEFAULT, ROOT_ENTITY, ID_TYPE_SYSTEM_WIDE, ID_TYPE_ROBOT, ID_TYPE_ROLE, ID_TYPE_USER
};

export default class ConfigManager {
  constructor(collection) {
    this._coll = collection;
  }

  /**
   * Sort function to determine which config object goes first.
   * Both arguments obj1 and obj2 must contain { entityType, entityId }.
   *
   * It returns negative, 0 or positive number as criteria to sort an array,
   * so that it ends up with:
   *  - the most specific (robot level) settings first,
   *  - then collections (in the reverse order they appear in the robot realm),
   *  - then the company
   *  - finally system wide settings.
   *
   * @param obj1 A config object with { entityId, entityType } and any number of
   *    other fields
   * @param obj2 A config object with { entityId, entityType } and any number of
   *    other fields
   */
  _checkObjectHierarchy = (obj1, obj2) => {
    // TODO(pablo):
    // Now hierarchy is a partial order. Should we throw if types aren't comparable?
    // That would require traversing the tree, making sorting expensive. So not
    // checking for the moment. Although this method traverses arrays anyway
    // in case entity types are collections or roles.
    const typeDiff = _typeDepth(obj2.entityType) - _typeDepth(obj1.entityType);
    if (typeDiff !== 0) {
      // if entityType is different,
      return typeDiff;
    } else {
      // ideally, this should never happen (leads to undefined order)
      // but printing warnings or failing here (at a function called gazillion times)
      // may be also too bad
      return 0;
    }
  };

  /**
   * Returns the entity types that are higher in the hierarchy.
   * Used to fill in missing parameters.
   *
   * @param {string} type type name
   * @returns types higher in hierarchy than the given type. Return null if type no in hierarchy.
   */
  _getHigherLevelTypes = (type) => {
    if (!(type in TYPE_HIERARCHY_TREE)) {
      return null;
    }

    // Traverse from corresponding entry up to the top node
    const higherTypes = [];
    for (
      let tyDef = TYPE_HIERARCHY_TREE[type];
      tyDef;
      tyDef = tyDef.parent && TYPE_HIERARCHY_TREE[tyDef.parent]) {
      if (tyDef._id != type) {
        higherTypes.push(tyDef._id);
      }
    }

    return higherTypes;
  };

  /**
   * Prepares a query for a given configuration parameter configuration.
   * Used by getConfig and to produce an appropriate publication
   * @see getEntityConfig
    */
  makeEntityQuery = async ({
    entityId, entityType, conditions = null, fields = null
  }) => {
    if (!isIdString(entityId) || !isIdString(entityType)) {
      throw new Error('Both `entityId` and `entityType` must be provided');
    }
    // get higher level types
    const higherLevels = this._getHigherLevelTypes(entityType);
    const entities = [];
    // if there are higherLevels, start adding them to the entities to query
    if (higherLevels) {
      // System defaults
      if (higherLevels.includes(ID_TYPE_SYSTEM_WIDE)) {
        entities.push(ROOT_ENTITY);
      }
    }
    // Add the entity in question as the last entity
    entities.push({
      entityId,
      entityType,
    });
    const query = { $or: entities };
    if (conditions) {
      Object.assign(query, conditions);
    }

    // Create a fields projection including all requested fields
    const filters = !Array.isArray(fields) || fields.length === 0
      ? {}
      : fields.reduce(
        (acc, f) => { acc[f] = 1; return acc; },
        { entityId: 1, entityType: 1, _id: 1 }
      );
    const projection = { fields: filters };
    // fetch and sort the configurations for the different levels of the hierarchy
    console.log("makeEntityQuery", query, projection)
    return this._coll.find(query, projection);
  };

  /**
   * Fetches a configuration for an entity, applying defaults when necessary from
   * configurations of higher level
   * @param  {string} entityId   Id of the entity (robotId, companyId, etc)
   * @param  {string} entityType type of the entity (robot, fleet, company, etc)
   * @param  {object} conditions conditions of the query,
   *                             e.g: {moduleName: "RosLocalizationAgentlet"}
   *                             e.g.2: {robot.status: 20},
   *                             e.g.3: {otherField: {$exists: true}}
   * @param  {array} fields      An array of the fields to be returned from the config,
   *                             returns the complete config if no field is passed
   *                             e.g.: ["map_topic", "laser_topic", "costmap_topic"]
   *                             e.g.2: ["robot.status"]
   * @param  {string} groupingKey The name of a key that will be used to group different
   *                              configurations before merging.
   *                              e.g.: "moduleName". Used if the collection is organized
   *                              with a document per [groupingKey]. Each document will be
   *                              placed in a key with the value of groupingKey for that
   *                              document.
   * @return {object} An object with the complete configuration for the entity.
   *                  It includes all defaults for higher level configurations
   *                  meaning: robots will take fields (when missing) from fleet,
   *                  company, root, etc
   */
  getEntityConfig = async (
    { entityId, entityType, conditions, fields, groupingKey }
  ) => {
    console.log("getEntityConfig", entityId, entityType, conditions, fields, groupingKey)
    if (!isIdString(entityId) || !isIdString(entityType)) {
      throw new Error('Missing entityId/entityType');
    }
    // fetch and sort the configurations for the different levels of the hierarchy
    const query = await this.makeEntityQuery({
      entityId, entityType, conditions, fields
    });
    const configArray = (await query.fetchAsync()).sort(this._checkObjectHierarchy);
    // reduce the configurations array to a final object with all the default applied
    const config = configArray.reduce((acc, value) => {
      delete value._id;
      delete value.entityId;
      delete value.entityType;
      if (groupingKey) {
        const group = value[groupingKey];
        delete value[groupingKey];
        value = isEmpty(value) ? {} : { [group]: value };
      }
      return applyDefaults(acc, value);
    }, {});
    return config;
  };

  /**
   * Sets a configuration on a particular entity, defined by an entityId and entityType.
   *
   * @param  {string} entityId   Id of the entity (robotId, companyId, etc)
   * @param  {string} entityType type of the entity (robot, fleet, company, etc)
   * @param  {object} conditions conditions of the query, e.g: {moduleName:
   *                  "RosLocalizationAgentlet"}, e.g.2: {robot.status: 20},
   *                  e.g.3: {otherField: {$exists: true}}
   * @param  {object} newConfig  this is an object holding the keys to be written.
   *                  ex: passing { state: { key1: value1 }} will make state be exactly
   *                  {key1: value1} pasing { "state.key1": value1 } will only change the key1 in
   *                  the state, so the state will not change any other key that is not passed.
   *                  Any key with value `undefined` will be a $unset (deleting it from the
   *                  mongo document)
   *
   * NOTE - Replacement for setConfig (Feb'24). This definition is (for now) incomplete and just
   * a wrapper of setConfig. It will be completed later
   *
   * @param {*} params See setConfig
   * @returns
   */
  setEntityConfig = async ({ entityId, entityType, conditions = null, newConfig }) => {
    if (newConfig == undefined) {
      return Error('Invalid newConfig passed to setConfig:' + newConfig);
    }
    if (isObject(newConfig)) {
      if (!isEmpty(newConfig)) {
        const query = { ...conditions, entityId, entityType };
        const set = {};
        const unset = {};
        const options = {};
        // Separate update by valid values ($set) and deletions (undefined, $unset)
        Object.keys(newConfig).forEach((k) => {
          // HACK(adamantivm) simpl-schema will filter out dotted path notation inserts
          // If we detect any dotted path notation parameter, disable filtering
          if (k.indexOf('.')) {
            options.filter = false;
          }
          if (newConfig[k] === undefined) {
            unset[k] = true;
          } else {
            set[k] = newConfig[k];
          }
        });
        const update = {};
        if (!isEmpty(set)) {
          update.$setOnInsert = { entityId, entityType };
          update.$set = set;
        }
        if (!isEmpty(unset)) {
          update.$unset = unset;
        }
        await this._coll.upsertAsync(query, update, options);
        return true;
      } else {
        return true;
      }
    }
    return true;
  };

  /**
   * Unsets configurations  on a particular entityID and entityType.
   *
   * @param  {string} options.entityId   Id of the entity (robotId, companyId, etc)
   * @param  {string} options.entityType type of the entity (robot, fleet, company, etc)
   * @param  {object} options.conditions conditions of the query,
   *                                     e.g: { moduleName: "RosLocalizationAgentlet" }
   *                                     e.g.2: { robot.status: 20 },
   *                                     e.g.3: { otherField: { $exists: true } }
   * @param  {object} options.fields     an object holding the keys to be unset.
   *                                     e.g.: passing { state: { key1: value }} will unset state
   *                                     (any value is ignored)
   *                                     passing { "state.key1": value1 } will unset key1
   *                                     in state (any other config will remain)
   */
  clearEntityConfig = async ({ entityId, entityType, conditions = null, fields }) => {
    return this.clearConfig({ entityId, entityType, conditions, fields });
  };

  /**
   * Returns the configuration defined at an exact level, without using the
   * configuration hierarchy.
   *
   * @see ConfigManager.getEntityConfigAtLevels
  */
  getEntityConfigAtLevel = async ({ entityId, entityType, fields }) => {
    const entity = { entityType, entityId };
    assertUniqueIdFields(entity);
    const config = await this.getEntityConfigAtLevels({
      entitiesList: [entity],
      fields
    });
    return config[0] || {};
  };

  /**
   * Returns the configurations defined at some exact levels, without using the
   * configuration hierarchy. This is similar to ConfigManager.getConfigAtLevel,
   * but for a list of levels instead of just one.
   *
   * @param {array} entitiesList  List of entities of the form { entityId, entityType }
   * @param {array} fields Optional list of fields to project (it returns all fields by default)
   * @param {object} conditions Optional query conditions to use as filter.
   *                            e.g: { moduleName: "RosLocalizationAgentlet" }
   *                            e.g #2: { robot.status: 20 },
   *                            e.g #3: { otherField: { $exists: true } }
   *
   * @see ConfigManager.getConfigAtLevel
   *
   * @deprecated Use getEntityConfigAtLevels
   */
  getConfigAtLevels = async ({ entitiesList, fields, conditions }) => {
    if (!Array.isArray(entitiesList)) {
      // FIXME(PLATFORM-228) We should throw an exception if no entities list is given! An $or filter
      // below returns ALL entities in the DB. We should definitely fix this; but many unit
      // tests rely in this 'backdoor'
      // We should throw:
      //   throw new Error('entitiesList must be an array');
      // Let's fix this before we finish setConfig reimplementation.
      console.warn('No entitiesList given for getConfigAtLevels - This is wrong! And will break in next version');
    }
    const filters = !fields || fields.length === 0
      ? {}
      : fields.reduce(
        (acc, f) => { acc[f] = 1; return acc; },
        { entityId: 1, entityType: 1, _id: 1 }
      );
    const projection = { fields: filters };
    return (await this._coll.find({
      ...conditions, $or: entitiesList
    }, projection).fetchAsync()) || [];
  };

  /**
   * Returns the configurations defined at some exact levels, without using the
   * configuration hierarchy. This is similar to ConfigManager.getConfigAtLevel,
   * but for a list of levels instead of just one.
   *
   * @param {array} entitiesList  List of entities of the form { entityId, entityType }
   * @param {array} fields Optional list of fields to project (it returns all fields by default)
   * @param {object} conditions Optional query conditions to use as filter.
   *                            e.g: { moduleName: "RosLocalizationAgentlet" }
   *                            e.g #2: { robot.status: 20 },
   *                            e.g #3: { otherField: { $exists: true } }
   *
   * @see ConfigManager.getConfigAtLevel
   */
  getEntityConfigAtLevels = async ({ entitiesList, fields, conditions }) => {
    entitiesList.forEach(assertUniqueEntityFields);
    const filters = !fields || fields.length === 0
      ? {}
      : fields.reduce(
        (acc, f) => { acc[f] = 1; return acc; },
        { entityId: 1, entityType: 1, _id: 1 }
      );
    const projection = { fields: filters };
    return (await this._coll.find({
      ...conditions, $or: entitiesList
    }, projection).fetchAsync()) || [];
  };
}
