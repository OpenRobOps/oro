/**
 * Implementation of maps persistence in our different storages, including
 * mongo, objects manager and timeseries.
 *
 * TODO Continue generalizing this storage fanout mechanism to become a
 * proper, reusable objects stream mechanism.
 * TODO there is related functionality still in localization that deserves
 * more analysis and consideration. It could belong here.
 */
import { _, pick } from 'lodash';
import sizeOf from 'image-size';
import crypto from 'crypto';
// InOrbit imports
import { toDotNotation } from '../lib/util';
import { COLLECTIONS, ID_TYPE_ROBOT, SPATIAL_ANNOTATION_TYPES } from '../shared/constants';

// Component name used for Objects Manager objects.
const OBJECTS_MANAGER_MAPS_COMPONENT_NAME = 'maps';

/**
 * Computes a hash for a map.
 * NOTE This data hash is not compatible with the ones calculated by the agent!
 * @param {Buffer} imgData Raw image data buffer
 * @param {Object} metadata
 * @returns
 */
function computeMapDataHash(imgData, metadata) {
  // NOTE: this guarantees a different hash if the image of metadata changes
  // NOTE: It's not the same algorithm used by the agent, since the agent
  // relies in `hash`, a Python specific function.
  return crypto.createHash('md5').update(imgData).update(JSON.stringify(metadata)).digest('hex');
}

/**
 * Get the dimensions of an image
 * @param {Buffer} imgData
 * @returns {Object} Object with width and height properties
 */
async function getImageDimensions(imgData) {
  const result = sizeOf(imgData);
  const { width, height } = result || {};
  if (!width || !height) throw new Error('Error reading image dimensions');
  return { width, height };
}

/**
 * Provides maps persistence logic, taking care of splitting and storing the data
 * in different storage backends.
 */
export default class MapsStorage {
  constructor({
    objectsManager,
    mongoManager,
    timeseriesApi,
  }) {
    this.objectsManager = objectsManager;
    this.localization = mongoManager.getCollection(COLLECTIONS.LOCALIZATION);
    this.annotations = mongoManager.getCollection(COLLECTIONS.SPATIAL_ANNOTATIONS);
    this._timeseriesApi = timeseriesApi;
  }

  /**
   * Persists map attributes, including its data if present in the `map` object.
   * Map is saved in the SpatialAnnotations and Localization collections.
   *
   * If map has no data but the optional `objectUrl` parameter is provided,
   * this method duplicates the map object that is already available in order
   * to maintain robot historical activity instead of asking for the map again.
   *
   * @param {String} robotId The robot this map belongs to.
   *  @typedef {Object} map
   *    @typedef {Object} metadata
   *      @typedef {String} label
   *      @typedef {String} mapId
   *      @typedef {String} frameId
   *      @typedef {String} dataHash
   *      @typedef {Integer} width
   *      @typedef {Integer} height
   *      @typedef {Integer} resolution
   *      @typedef {Integer} ts
   *      @typedef {Integer} x
   *      @typedef {Integer} y
   *    @typedef {Buffer} data Map binary data (Optional)
   *  @typedef {Boolean} isUpdate
   */
  async persistMap(robotId, map, isUpdate, copyObject = true) {
    if (MapsStorage.objectsManagerEnabled()) {
      if (map.metadata.objectUrl && copyObject) {
        // This map has been stored before so we need to create another object
        // on the ObjectManager. Copy it instead of asking the robot for it
        // NOTE(Mike) I don't understand why we need to copy this to a new object instead of
        // referencing the same objectUrl
        map.metadata.objectUrl = await this
          ._copyMapIntoObjectsManager(robotId, map, map.metadata.objectUrl);
      } else if (map.data) {
        // This is a new map, the agent sent it
        // Store map using Objects Manager
        map.metadata.objectUrl = await this._saveMapIntoObjectsManager(robotId, map);
      }
    }
    // using map annotation we could get the map data
    await this._saveMapAnnotation(robotId, map);
    // Save pointer to current map and map attributes (except map's binary data)
    const mapProperties = toDotNotation(map.metadata, 'map');
    await this._doUpdate(robotId, { defaultMap: map.metadata.label, ...mapProperties });

    // Label, objectUrl, and dataHash are stored in their specific fields in timeseries,
    // as they are all used for querying.
    // We still need any other map metadata available (width, resolution, ...) for reference
    // (e.g. display a previous map); they are stored separately as a single JSON string.
    const { objectUrl, label, dataHash } = map.metadata;

    // If map has no URL from lake storage yet, attempt to patch it from the map stored
    // in mongodb -- only if it matches exactly (label + hash)
    // NOTE(diegobatt): AFAIU, this is a hack that relies on persistMap being called by the
    // localization module knowing that the label + dataHash matches the one in annotations,
    // but this can change due to race condition, so this might need to be re-thought
    if (!objectUrl && dataHash) {
      const annotation = await this.annotations.findOne({
        entityId: robotId, label, 'map.dataHash': dataHash
      }, {
        projection: {
          'map.objectUrl': 1
        }
      });
      if (annotation) {
        map.metadata.objectUrl = annotation.map.objectUrl;
      }
    }
  }

  /**
   * Copies robot's map data and metadata using Objects Manager.
   * This assumes the data is in PNG format.
   *
   * @param {String} robotId
   * @param {Object} map
   *   @property {Object} metadata
   *     @property {String} label
   *     @property {String} dataHash
   *     @property {Integer} width
   *     @property {Integer} height
   *     @property {Integer} resolution
   *     @property {Integer} ts
   *     @property {Integer} x
   *     @property {Integer} y
   *   @property {Buffer} data Map binary data
   * @param {String} objectUrl source object URL
   * @returns The ObjectUrl that can later be used to retrieve the map.
   */
  async _copyMapIntoObjectsManager(robotId, map, objectUrl) {
    return this.objectsManager.duplicate({
      component: OBJECTS_MANAGER_MAPS_COMPONENT_NAME,
      extension: 'png',
      objectUrl,
      metadata: { robotId, ...map.metadata }
    });
  }

  /**
   * Saves some robot's map data and metadata using Objects Manager.
   * This assumes the data is in PNG format.
   *
   * @param {String} robotId
   *  @typedef {Object} map
   *    @typedef {Object} metadata
   *      @typedef {String} label
   *      @typedef {String} dataHash
   *      @typedef {Integer} width
   *      @typedef {Integer} height
   *      @typedef {Integer} resolution
   *      @typedef {Integer} ts
   *      @typedef {Integer} x
   *      @typedef {Integer} y
   *      @typedef {Integer} formatVersion
   *    @typedef {Buffer} data Map binary data
   * @returns The ObjectUrl that can later be used to retrieve the map.
   */
  async _saveMapIntoObjectsManager(robotId, map) {
    if (!this.objectsManager) {
      console.warn('Warning: Objects Manager not enabled. Map not saved');
    }
    return this.objectsManager.create({
      component: OBJECTS_MANAGER_MAPS_COMPONENT_NAME,
      extension: 'png',
      data: map.data,
      metadata: { robotId, ...map.metadata }
    });
  }

  /**
   * Saves a robot's map data (depending on the settings) and metadata to the
   * SpatialAnnotations collections.
   *
   * @param {String} robotId
   *  @typedef {Object} map
   *    @typedef {Object} metadata
   *      @typedef {String} label
   *      @typedef {String} objectUrl
   *      @typedef {String} dataHash
   *      @typedef {Integer} width
   *      @typedef {Integer} height
   *      @typedef {Integer} resolution
   *      @typedef {Integer} ts
   *      @typedef {Integer} x
   *      @typedef {Integer} y
   *      @typedef {Integer} formatVersion
   *    @typedef {Buffer} data Map binary data (Optional)
   */
  async _saveMapAnnotation(robotId, map) {
    // Save the map subproperties one by one.
    // Otherwise, if we already had this map and the agent sends only metadata, we would
    // replace a good map with content with a new map object that doesn't have the data.
    const mapProperties = toDotNotation(map.metadata, 'map');
    if (map.data) {
      if (!MapsStorage._writeMapDataToMongoEnabled()) {
        // Don't write data to mongo if !writeMapDataToMongo
        mapProperties['map.data'] = null;
      } else {
        // Convert map Buffer to base64 string to store it in mongo
        mapProperties['map.data'] = map.data.toString('base64');
      }
    }
    // Store the map as an annotation
    console.log(`Saving map annotation for robot ${robotId}: `, mapProperties);
    await this.annotations.updateOne(
      { entityId: robotId, entityType: ID_TYPE_ROBOT, label: map.metadata.label },
      { $set: mapProperties },
      { upsert: true }
    );
  }

  static _writeMapDataToMongoEnabled() {
    // Only disable mongo if the split's value is "objects-manager"
    // This also makes mongo the default for unknown values
    return true; // TODO: Make this configurable so we use real object stores (google storage or others)
  }

  static objectsManagerEnabled() {
    return false; // TODO: Make this configurable so we use real object stores (google storage or others)
  }

  _doUpdate = async (robotId, updates) => {
    if (_.isEmpty(updates)) {
      console.warn('Warning: No updates after processing localization MQTT update', { robotId });
      return;
    }
    // Save the localization data
    // NOTE(diegobatt): If messages are coming online, we just do an upsert. But if this is under
    // batch processing, we split the upsert into an insert (in case the document not exists) and
    // an update that takes place only if the last updated value was previous than the message
    // coming in the batch
    // TODO(diegobatt): This pattern is complex and repeated. Think about how to make it abstract
    updates.mapUpdatedTs = updates['map.ts'] || Date.now();
    await this.localization.updateOne({ _id: robotId }, { $set: updates }, { upsert: true });
  };

  /**
   * Persists a map from an image.
   *
   * @param {string} entityType
   * @param {string} entityId
   * @param {Object} metadata
   * @param {Buffer} imgData
   */
  async persistImageAsMap(robotId, metadata, imgData) {
    const { width, height } = await getImageDimensions(imgData);

    const dataHash = metadata.dataHash || computeMapDataHash(imgData, metadata);

    const map = {
      data: imgData,
      metadata: {
        ...metadata,
        width,
        height,
        dataHash
      }
    };
    return this.persistMap(robotId, map);
  }

  /**
   * Persists a map from an image using the V2 API, that support maps that belong to any entity
   * and stores maps using the same schema as other annotations.
   *
   * @param {object} robotId
   * @param {object} map
   * @param {Buffer} imgData
   */
  async persistImageAsMapV2({ robotId, map, imgData }) {
    if (!map?.mapId) {
      throw new Error('mapId is required');
    }
    if (!map?.frameId) {
      throw new Error('frameId is required');
    }
    const annotation = pick(map, ['label', 'x', 'y', 'resolution', 'extraMetadata', 'dataHash',
      'formatVersion']);

    if (imgData) {
      if (!MapsStorage.objectsManagerEnabled()) {
        throw new Error('persistImageAsMapV2 is not supported without Objects Manager');
      }
      const { width, height } = await getImageDimensions(imgData);
      const dataHash = map.dataHash || computeMapDataHash(imgData, map);
      const formatVersion = map.formatVersion || 1;
      const objectUrl = await this.objectsManager.create({
        component: OBJECTS_MANAGER_MAPS_COMPONENT_NAME,
        extension: 'png',
        data: imgData,
        metadata: { ...map, ...robotId, width, height, dataHash }
      });
      Object.assign(annotation, {
        width,
        height,
        dataHash: annotation.dataHash || dataHash,
        objectUrl,
        formatVersion
      });
    }

    await this.annotations.updateOne(
      { ...entity, label: map.mapId, frameId: map.frameId, type: SPATIAL_ANNOTATION_TYPES.MAP },
      { $set: { annotation } },
      { upsert: true }
    );
  }
}
