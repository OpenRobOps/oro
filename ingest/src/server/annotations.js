/**
 * (Incomplete) manager class for Spatial Annotations.
 *
 * NOTE(herchu) The only few methods here are copies from web/server/annotations, the actual
 * manager implemented in Meteor codebase. These few methods are provided here to provide
 * limited functionality for ingest-based services, mainly finding annotations for robots and
 * locations.
 */
import MongoManager from '../mongo';
import { ID_DEFAULT, ID_TYPE_ROBOT, ID_TYPE_SYSTEM_WIDE } from '../shared/constants';
import { COLLECTIONS } from '../shared/constants';

/**
 * Formats a mongodb document (from SpatialAnnotation) as an Annotation object to use in all APIs.
 * This object contains two sub-objects, `entity` and `annotation`.
 * The first one identifies the location/sublocation with { entityId, entityType, frameId },
 * and the second one is the annotation itself with { type, ...otherfields }
 *
 * Note that the `label` field from the db is renamed to annotationId -- this is an implementation
 * detail we don't want to expose externally.
 */
const formatAnnotationDocument = (doc) => {
  // note: discard the doc _id; disable the unused var warning
  // eslint-disable-next-line no-unused-vars
  const { _id, label, entityId, entityType, frameId, type, annotation } = doc;
  return {
    // note: frameId (sublocation id) is not strictly part of the `entity`, but it is included in
    // this object just to appear separately from the `annotation` definition (it is required to
    // know to which sublocation the annotation applies to.
    entity: { entityId, entityType, frameId },
    annotation: { annotationId: label, type, ...annotation }
  };
};

let instance;

export default class AnnotationsManager {
  constructor() {
    // Singleton pattern
    if (instance === undefined) {
      this.mongoManager = new MongoManager();
      this.annotationsColl = this.mongoManager.getCollection(COLLECTIONS.SPATIAL_ANNOTATIONS);
      // eslint-disable-next-line no-constructor-return
      return instance;
    }
  }

  /**
   * Finds and returns all spatial annotations for a sublocation.
   *
   * The annotation is asigned to either the location.
   * The sublocation is identified by frameId.
   *
   * @param {String} entityId The id of the location or robot
   * @param {String} entityType The type of entity to be annotated:
   *    ID_TYPE_COLLECTION or ID_TYPE_ROBOT
   * @param {String} frameId (optional) The id of the "sublocation"
   * @param {String} annotationId (optional) The user defined annotation identifier.
   *  (label field in MongoDB)
   * @param {Array} types Optional, a list of annotation types to query. These should contain
   *    only values from SPATIAL_ANNOTATION_TYPES (although it's not validated and will just
   *    result on an empty list returned if values are unknown).
   * @return {Array} A list of Annotation objects
   * @throws ValidationError if the entity does not accept annotations
   */
  findAnnotations = async ({ entityId, entityType, frameId, types, annotationId }) => {
    if (entityType != ID_TYPE_ROBOT && entityType != ID_TYPE_SYSTEM_WIDE) {
      throw new Error('Only defined for system wideand robots');
    }
    if (types && !Array.isArray(types)) {
      throw new Error('types must be an array');
    }
    const query = await this._makeAnnotationsQuery(
      { entityId, entityType, frameId, annotationId, types }
    );
    let annotations = await this.annotationsColl.find(query).toArray();
    if (entityType == ID_TYPE_ROBOT) {
      // NOTE(herchu) Annotations are not a config-manager type collection, but it does still have
      // *some* of its functionality: An annotation re-defined in a robot should opaque one
      // defined in the location. Also, nullified annotations should not be visible or listed
      // Filter results now (this could be implemented more efficiently - this is a first version)
      annotations = annotations.filter((a) => {
        if (a.type === null) { // filter out suppressed annotations, type == null
          return false;
        }
        if (a.entityType != ID_TYPE_ROBOT) { // keep system annotations if not redefined by robot
          return !annotations.find((b) => b.entityType == ID_TYPE_ROBOT && a.label == b.label);
        }
        return true;
      });
    }
    return annotations.map(formatAnnotationDocument);
  };

  // COPY from server/annotations
  /**
   * Helper method to create the query to retrieve annotations. It works both for system wide
   * (entityType == 'system') and robots (entityType == 'robot').
   *
   * It also validates its arguments and throws ValidationError if the entity is not accepted
   * for defining annotations.
   *
   * @param {String} entityId The id of the robot (or system wide: ignored)
   * @param {String} entityType The type of entity to be annotated: ID_TYPE_ROBOT or ID_TYPE_SYSTEM_WIDE
   * @param {String} frameId (optional) The id of the "sublocation" to search on
   * @param {String} annotationId (optional) The id of annotation, unique
   * @param {Array} types Optional, a list of annotation types to query. These should contain
   *    only values from SPATIAL_ANNOTATION_TYPES (although it's not validated and will just
   *    result on an empty list returned if values are unknown).
   * @return {Object} An object to use as mongodb query (the caller may add aditional filters later)
   * @throws ValidationError if the entity does not accept annotations
   */
  _makeAnnotationsQuery = async ({ entityId, entityType, frameId, annotationId, types }) => {
    const entities = [
      { entityId: ID_DEFAULT, entityType: ID_TYPE_SYSTEM_WIDE }
    ];
    if (entityType == ID_TYPE_ROBOT) {
      entities.push({ entityId, entityType });
    }
    const query = {
      $or: entities // the system itself and any robot annotation
    }
    // Includes types logic for "type" field
    if (types && Array.isArray(types)) {
      query.type = { $in: types };
    }
    if (frameId) { // sublocation id
      query.frameId = frameId;
    }
    if (annotationId) { // annotation id within a location (represented in the 'label' field)
      query.label = annotationId;
    }
    return query;
  };
}
