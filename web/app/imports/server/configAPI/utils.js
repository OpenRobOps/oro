/**
 * Configuration API Utility and helper functions (server-side)
 */
import { Meteor } from 'meteor/meteor';
// ORO modules
import OroRoles from '../roles';
import { AuthorizationError, ValidationError, SchemaError } from '../../shared/configAPI';
import { ID_TYPE_ROBOT, ID_TYPE_SYSTEM_WIDE } from '../../shared/constants';
import { ACCESS_LEVEL_VIEW, RESOURCE_TYPES } from '../../shared/roles';

// Fields for JSON responses
const API_RESPONSE_FIELD_MESSAGES = 'messages';

const buildApiMessage = (message, level = 'INFO') => (
  { message, level }
);

/**
 * Given an Error object caught from calling a Config API, it *returns* a Meteor.Error
 * with an appropriate message, that the called should later *throw*.
 * If the exception is not any of our own Config API exception classes, it returns a simple
 * Meteor.Error with "Internal error" message and it logs a console error for our own debugging.
 *
 * @param {Error} exception An error that has been caught
 * @returns {Meteor.Error}
 */
const translateConfigApiExceptionToMeteorError = (exception) => {
  if (exception instanceof ValidationError) {
    return new Meteor.Error(`Validation error: ${exception.message}`);
  } else if (exception instanceof AuthorizationError) {
    return new Meteor.Error('Unauthorized'); // no additional message (exception.message)
  } else if (exception instanceof SchemaError) {
    return new Meteor.Error(`Bad object schema: ${exception.message}`);
  } else {
    // Do not surface this error (which may contain internal information)
    console.log(`Uncaught Config API error: ${exception.message}`);
    return new Meteor.Error('Internal error');
  }
};

/**
 * Returns the list of entities that a given user has
 * access to.
 *
 * This is used to whitelist config objects to users that don't have access to the entire
 * fleet.
 *
 * @param {String} userId Identifies the user in a request
 * @param {Array} entitiesList List of entities { entityId, entityType, namespaceId }
 * @param {String} permissionLevel The permission level required (one of ACCESS_LEVEL_*)
 * @returns {Array} A subset of entitiesList
 */
const filterEntitiesWithAccess = async (
  userId, permissionLevel = ACCESS_LEVEL_VIEW
) => {
  // Separate entitiesList in 3 groups: 1) robots, 2) tags, 3) company+root (the company
  // is assumed to be accessible if this method is called). If there are other entity
  // types in the list, they are discarded -- when we add more, we need to add their logic
  // here.
  const robotIds = entitiesList
    .filter(({ entityType }) => entityType == ID_TYPE_ROBOT)
    .map(e => e.entityId);
  const otherEntities = entitiesList
    .filter(({ entityType }) => ID_TYPE_SYSTEM_WIDE == entityType);
  const accessibleRobotIds = await new OroRoles().getAccessibleRobotIds(
    userId,
    robotIds,
    permissionLevel
  );
  return [
    ...otherEntities,
    ...accessibleRobotIds.map(robotId => ({ entityId: robotId, entityType: ID_TYPE_ROBOT }))
  ];
};

export {
  scopeFilterToEntities,
  buildApiMessage,
  translateConfigApiExceptionToMeteorError,
  validateGatedSpecFeaturesOrThrow,
  API_RESPONSE_FIELD_MESSAGES,
  filterEntitiesWithAccess
};
