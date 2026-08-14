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
 * Ingest-side implementation of the Localization agent module
 */
import Jimp from 'jimp';
import moment from 'moment';
import { _ } from 'lodash';
import Long from 'long';
// ORO imports
import { AsyncCache } from '../../shared/simpleCache';
import RateLimiter from '../rateLimiter';
import MongoManager from '../../mongo';
import AnnotationsManager from '../annotations';
import { COLLECTIONS, MODULE_NAMES, SPATIAL_ANNOTATION_TYPES, ID_TYPE_ROBOT } from '../../shared/constants';
import { VITAL_POSE } from '../../shared/attributes';
import AttributesManager from '../attributes';
import MapsStorage from '../mapsStorage';
import { deltaIntDecodePoints } from '../../shared/arrayUtil';
// import { CONFIG_EXCHANGE, MODULES } from '../../shared/configUpdateBus';

// Time to keep ui preferences configuration cached
const CONFIG_CACHE_AGE_MS = moment.duration(10, 'minute').valueOf();
// Time to keep the spatial annotation cached
const SPATIAL_ANNOTATION_CACHE_AGE_MS = moment.duration(5, 'minute').valueOf();

// Technically mongo can store up to 16,777,216 bytes, but we use 12,000,000.
// When converting to base64 string the conversion rate is n(4/3) ~= 1.333...
// The real conversion is 12,582,912 bytes but we use 12,000,000 so there is some headroom
// for other keys and properties inside the document to insert.
const MAP_SIZE_LIMIT_IN_BYTES = 12 * 1000 * 1000;

// Original wine purple color for alpha gradient-based costmap representation
const GRADIENT_COLOR_DEFAULT = [162, 33, 127];

// frameId not available constant value
const FRAME_ID_NA = 'NA';

// Time related constants
const DAY_MS = 60 * 60 * 24 * 1000;
// Amount of time to look back to find a map with the same properties as to avoid
// uploading it again
const LAST_MAP_WINDOW_MS = DAY_MS * 4;
// Mapping with the different subobjects that co-exist in this module and in the localization
// collection in mongo
const LOCALIZATION_SUBOBJECTS = {
  POSE: 'robotPose',
  CONFIG: 'laserConfig',
  LASER: 'laserRanges',
  PATH: 'paths',
  COSTMAP: 'costmap',
  MAP: 'map'
};

// Version signature used for Path messages with DeltaInt encoding
// (these match values sent from agent, localization.py)
// eslint-disable-next-line no-unused-vars
const PATH_ENCODING_NONE = 0; // Unused in this file; used as default
const PATH_ENCODING_DELTA_INT = 1;

export default class RobotLocalizationModule {
  constructor({
    mqtt,
    objectsManager,
    timeseriesApi = null,
    workerQueue = null
  } = {}) {
    this.mqtt = mqtt;
    this.objectsManager = objectsManager;
    this.timeseriesApi = timeseriesApi;
    this.workerQueue = workerQueue;
  }

  /**
   * Load module with the specified settings.
   *
   * NOTE(adamantivm) These settings would normally come from ingest settings.json,
   * and would represent the values under modules.robotLocalization.
   */
  load = async (settings = {}) => {
    // Parse settings with defaults
    const {
      poseRateLimiterMs = 1000,
      poseAndLaserRateLimiterMs = 1000,
      pathRateLimiterMs = 60000,
    } = settings;

    this.mapsStorage = new MapsStorage({
      objectsManager: this.objectsManager,
      mongoManager: new MongoManager(),
      timeseriesApi: this.timeseriesApi,
    });

    // Limit processing rates as a simplistic way to limit system performance impact of
    // potentially high frequency topics
    this._poseRateLimiter = new RateLimiter(poseRateLimiterMs);
    this._poseAndLasersRateLimiter = new RateLimiter(poseAndLaserRateLimiterMs);
    // Keep a map of rate limiters by max rate value so that we can use the appropriate one
    // for each path ID that has a different rate limit configuration
    this._pathRateLimiters = {};
    this.defaultPathRateLimitMs = pathRateLimiterMs;

    // Register to MQTT topics
    this.mqtt.registerListener('ros/loc/map2', this.onMapV2);
    this.mqtt.registerListener('ros/loc/data2', this.onPoseAndLaserData);
    this.mqtt.registerListener('ros/loc/config/0', this.onConfig(0));
    this.mqtt.registerListener('ros/loc/config/1', this.onConfig(1));
    this.mqtt.registerListener('ros/loc/config/2', this.onConfig(2));
    this.mqtt.registerListener('ros/loc/path', this.onPath);
    this.mqtt.registerListener('ros/loc/costmap', this.onCostmap);
    this.mqtt.registerListener('ros/loc/pose', this.onPose);

    this.MapMessage = this.mqtt.lookupType('oro.MapMessage');
    this.MapRequest = this.mqtt.lookupType('oro.MapRequest');
    // NOTE LocationAndPoseData is a poor message name. It has laser and pose data.
    this.LocationAndPoseMessage = this.mqtt.lookupType('oro.LocationAndPoseMessage');
    this.PoseMessage = this.mqtt.lookupType('oro.PoseMessage');
    this.PathDataMessage = this.mqtt.lookupType('oro.PathDataMessage');

    // UI Preferences collection changes very rarely, keeping for 10min
    this.uiPreferencesCfgCache = new AsyncCache({
      maxAge: CONFIG_CACHE_AGE_MS,
      maxSize: 1000,
      createFunction: this.getUIPreferencesConfig
    });
    // Cache robotId localization settings to avoid database queries
    this._agentModuleCache = new AsyncCache({
      maxAge: CONFIG_CACHE_AGE_MS,
      maxSize: 1000,
      createFunction: this._getAgentModuleConfig
    });

    this._spatialAnnotationCache = new AsyncCache({
      maxAge: SPATIAL_ANNOTATION_CACHE_AGE_MS,
      maxSize: 1000,
      createFunction: this._getSpatialAnnotation
    });

    this._localizationColl = new MongoManager().getCollection(COLLECTIONS.LOCALIZATION);
    this._annotationsColl = new MongoManager().getCollection(COLLECTIONS.SPATIAL_ANNOTATIONS);
    this.moduleStates = new MongoManager().getCollection(COLLECTIONS.MODULE_STATES);

    this.attributesMgr = new AttributesManager();
    this.annotationsMgr = new AnnotationsManager();
    // this._moduleStatesConfig = new ConfigManager(this.moduleStates);
    console.log('RobotLocalizationModule started with settings: ' + JSON.stringify(settings));
  };

  // getUIPreferencesConfig = async (entity) => {
  //   try {
  //     const result = await this._uiPreferencesCfg.getEntityConfig({
  //       entityId: entity.entityId,
  //       entityType: entity.entityType,
  //       fields: ['map.costmap']
  //     });
  //     return result;
  //   } catch (error) {
  //     throw Error('localization: Failed fetching ui preferences.', error);
  //   }
  // };

  /**
   * Returns a dictionary of spatial transformations for an entity.
   * @param {object} entity
   * @returns {object} Dictionary of spatial frame transformations for an entity. The keys are
   * robot world frame ids.
   */
  _getSpatialTransformationsConfig = async (entity) => {
    try {
      const result = await this._spatialTransformationsCfg.getEntityConfig({
        ...entity,
        fields: ['transformations']
      });
      return result.transformations || {};
    } catch (error) {
      throw Error('localization: Failed fetching spatial transformations.', error);
    }
  };

  /**
   * Query previous maps from objects data
   * @param {string} robotId Robot ID
   * @param {string} dataHash Map data hash
   * @param {string} mapId Map ID
   * @param {number} limit Query limit
   * @param {number} [startTs] Optional start timestamp
   * @param {number} [endTs] Optional end timestamp
   * @returns {Promise<Array>} Array of map objects from measurement
   */
  _queryPreviousMaps = async ({ robotId, dataHash, limit, startTs, endTs, mapId }) => {
    if (!this.timeseriesApi) {
      throw new Error('timeseriesApi is not initialized');
    }
    const result = await this.timeseriesApi.queryObjects({
      entityId: robotId,
      entityType: ID_TYPE_ROBOT,
      type: 'map',
      key: mapId,
      'dataFilter.dataHash': dataHash,
      startTs,
      endTs,
      limit,
      orderBy: '-time',
    });
    if (!result) {
      return [];
    }
    return result.map((row) => row?.data);
  };

  /**
   * Processes a message sent by a robot to the `ros/loc/map2` topic. Stores
   * the map information, including its data if it was received and the map has
   * not been stored yet.
   *  Updates the corresponding SpatialAnnotation and Localization.
   *
   * @param {String} robotId Id of the robot that sent the message.
   * @param {Object} msg The message in `oro.MapMessage` protobuf format.
   * @param {Object} packet The mqtt-packet object with metadata about this object
   */
  onMapV2 = async (robotId, msg, packet) => {
    // When clearing retained messages, we will receive a zero-length
    // message that we need to ignore
    if (msg.length == 0) {
      return;
    }
    // Skip retained messages to avoid accidentally overriding good map data
    // NOTE(adamantivm) When a retained message is just sent, it arrives with retain=false
    if (packet && packet.retain) {
      console.log(`onMapV2: robotId=${robotId}, skipping retained message`);
      return;
    }
    // Parse all message parts
    const {
      map,
      mapTooLarge,
      isUpdate
    } = await this._parseMapV2Message(robotId, msg);
    const mustBePersisted = await this._mapDataMustBePersisted(robotId, map);
    console.log(`onMapV2: received:
        robotId=${robotId}
        mapId=${map.metadata && map.metadata.mapId}
        frameId=${map.metadata && map.metadata.frameId}
        hash=${map.metadata && map.metadata.dataHash}
        data=${map.data ? 'yes' : 'no'}
        isUpdate=${isUpdate ? 'yes' : 'no'}
        formatVersion=${map.metadata.formatVersion}`);
    if (map.data) {
      if (!mustBePersisted) {
        delete map.data;
      }
    } else if (!mapTooLarge && mustBePersisted) {
      // If we got an empty map from an agent post 1.15, request a new map
      const requestMsg = {
        label: map.metadata.label,
        // Turn map into a Long number (to encode as int64). Here we assume `dataHash` is
        // a string formed with decimal digits only: this field is created from parsing
        // the data_hash field in parseMapV2Message.
        // TODO(herchu) Expand protobuf protocol to send _either_ a numeric hash or a string hash,
        // when agents support computing better hashes (not numbers)
        dataHash: Long.fromString(map.metadata.dataHash)
      };

      // Is is possible that the map has been published and stored before, so instead of asking
      // to the robot to send it again, check if it is available on the `objects`
      // measurement storage.
      const prevMaps = await this._queryPreviousMaps({
        robotId,
        dataHash: map.metadata.dataHash,
        limit: 1,
        startTs: (Date.now() - LAST_MAP_WINDOW_MS),
        endTs: Date.now()
      });
      const mapObjectFromMeasurement = prevMaps?.[0];
      if (mapObjectFromMeasurement?.objectUrl) {
        // Update the objectUrl map metadata so the spatial annotation
        // is also updated with the existing map image
        map.metadata.objectUrl = mapObjectFromMeasurement.objectUrl;
        console.log(`onMapV2: robotId=${robotId}, map "${map.metadata.dataHash}" `
          + `(${map.metadata.objectUrl}) is already available. Agent request won't be send.`);
        await this.mapsStorage.persistMap(robotId, map, isUpdate);
        return;
      }
      console.log(`onMapV2: sending mapreq robotId=${robotId} label=${requestMsg.label} `
        + `dataHash=${requestMsg.dataHash.toString()}`);
      this.mqtt.publishProtobuf(robotId, 'ros/loc/mapreq', requestMsg, this.MapRequest, { qos: 2 });
      return;
    }
    await this.mapsStorage.persistMap(robotId, map, isUpdate);
  };

  /**
   * Parses and returns the different parts of a message that is in `oro.MapMessage`
   * protobuf format.
   *
   * @param {String} robotId Id of the robot that sent the message.
   * @param {Object} msg The message in `oro.MapMessage` protobuf format.
   * @returns { map, mapTooLarge, isUpdate }
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
   *    @typedef {Buffer} data Map binary data (Only if data is present in the message
   *      and mapTooLarge is false)
   *  @typedef {Boolean} mapTooLarge Flag to indicate that the map is too big to be
   *  stored. (see MAP_SIZE_LIMIT_IN_BYTES).
   */
  async _parseMapV2Message(robotId, msg) {
    const decodedMsg = this.MapMessage.decode(msg);
    const mapMetadata = await this._parseMapMessageFields(robotId, decodedMsg);
    // `mapData` will hold map.data unless the data is missing from message or
    // it is too large to be stored in database.
    const { mapData, mapTooLarge } = RobotLocalizationModule._getMapDataFromMessage(
      robotId,
      decodedMsg
    );
    const { isUpdate } = decodedMsg;
    return {
      map: { metadata: mapMetadata, data: mapData },
      mapTooLarge,
      isUpdate
    };
  }

  /**
   * Parses and returns map metadata from a `oro.MapMessage` decoded message.
   *
   * @param {String} robotId Id of the robot that sent the message.
   * @param {Object} msg The message DECODED from `oro.MapMessage` protobuf format.
   * @returns { map }
   *  @typedef {Object} mapMetadata
   *    @typedef {String} label
   *    @typedef {String} dataHash
   *    @typedef {Integer} width
   *    @typedef {Integer} height
   *    @typedef {Integer} resolution
   *    @typedef {Integer} ts
   *    @typedef {Integer} x
   *    @typedef {Integer} y
   *    @typedef {Integer} formatVersion
   */
  async _parseMapMessageFields(robotId, decodedMsg) {
    const mapMetadata = {
      x: decodedMsg.x,
      y: decodedMsg.y,
      width: decodedMsg.width,
      height: decodedMsg.height,
      resolution: decodedMsg.resolution,
      ts: decodedMsg.ts.toNumber(),
      frameId: decodedMsg.frameId || FRAME_ID_NA,
      // NOTE: Older robots may not send the formatVersion field. By default, set it to 1.
      // Otherwise the parsed value is 0 which is not a valid formatVersion.
      formatVersion: decodedMsg.formatVersion || 1,
    };

    mapMetadata.label = decodedMsg.label;
    // The dataHash field from protobuf is int64, represented with a Long (from 'long' library).
    // Do not cast it to Number, losing precision! We convert it to String and handle it as
    // a string everywhere else within ingest
    mapMetadata.dataHash = String(decodedMsg.dataHash);
    // NOTE: Since agent 3.18.0 the mapId is replacing the label as the map identifier in the metadata
    mapMetadata.mapId = decodedMsg.mapId || mapMetadata.label;

    return mapMetadata;
  }

  /**
   * Parses the data from a from a `oro.MapMessage` decoded message.
   *
   * @param {String} robotId Id of the robot that sent the message.
   * @param {Object} msg The message DECODED from `oro.MapMessage` protobuf format.
   * @returns { mapData, mapTooLarge }
   *  @typedef {Buffer} mapData Map binary data (Only if data is present in the message
   *    and mapTooLarge is false)
   *  @typedef {Boolean} mapTooLarge Flag to indicate that the map is too big to be
   *  stored. (see MAP_SIZE_LIMIT_IN_BYTES).
   */
  static _getMapDataFromMessage(robotId, decodedMsg) {
    let mapData;
    let mapTooLarge = false;
    // Check the map's data type and size to ensure it doesn't exceed mongo's limit
    if (
      decodedMsg && decodedMsg.pixels
      && (Buffer.isBuffer(decodedMsg.pixels) || ArrayBuffer.isView(decodedMsg.pixels))
      && decodedMsg.pixels.length > 0
    ) {
      const bufferSize = Buffer.byteLength(decodedMsg.pixels);
      const validBuffer = bufferSize <= MAP_SIZE_LIMIT_IN_BYTES;
      if (validBuffer) {
        mapData = decodedMsg.pixels;
      } else {
        mapTooLarge = true;
        console.warn(`Attempt to save map failed, robotId: ${robotId} `
          + `mapLabel: ${decodedMsg.label || ''}, bufferSize: ${bufferSize}`);
      }
    }
    return { mapData, mapTooLarge };
  }

  onPoseAndLaserData = async (robotId, msg) => {
    // Rate limiter note: Message de-serialization is done before rate-limiting because
    // limiting depends on the timestamp on the message and not the current time
    const decodedMsg = this.LocationAndPoseMessage.decode(msg);
    const ts = Number.parseInt(decodedMsg.ts.toNumber(), 10);
    // HACK(adamntivm) Limit data rate that is stored in Mongo DB
    // Higher rate needs to be taken directly from client via MQTT
    if (!this._poseAndLasersRateLimiter.accepts(robotId, ts)) {
      return;
    }

    const poseUpdates = {
      x: decodedMsg.posX,
      y: decodedMsg.posY,
      theta: decodedMsg.yaw,
      ts
    };
    await this._doUpdatePose(robotId, poseUpdates, ts);

    const laserUpdates = {};
    // Save the 'encoded' ranges (values and runs, skipping infinites and NaNs) in that format
    // to the DB. It gets decoded by the UI, to save bandwith.
    decodedMsg.lasers.forEach((a) => {
      laserUpdates[a.name] = { runs: a.ranges.runs, values: a.ranges.values, ts };
    });
    if (!_.isEmpty(laserUpdates)) {
      await this._doUpdate(robotId, laserUpdates, LOCALIZATION_SUBOBJECTS.LASER, ts);
    }
  };

  /**
   * Callback handler for /loc/pose topic, including only pose data;
   * it comes from PoseAgentlet.
   * See also onLocalizationAndPoseData, which is sent from LocalizationAgentlet
   *
   * TODO(herchu) This is reported by PoseAgentlet and should live in its own module
   * (not localization.js)
   */
  onPose = async (robotId, msg) => {
    // Rate limiter note: Message de-serialization is currently done before rate-limiting, to
    // account for batch-processing modes where the timestamp depends on the message
    // and not the current time - See IO-5895
    const decodedMsg = this.PoseMessage.decode(msg);
    const { poses } = decodedMsg;
    // NOTE(herchu) While the protobuf msg allows sending multiple poses for future
    // implementations (different frames), we only proses one here
    const pose = poses && poses.length && poses[0];
    if (pose) {
      const ts = Number.parseInt(pose.ts.toNumber(), 10);
      // HACK(herchu) Limit data rate that is stored in Mongo DB
      // Higher rate needs to be taken directly from client via MQTT
      if (!this._poseRateLimiter.accepts(robotId, ts)) {
        return;
      }
      const poseUpdates = {
        x: pose.posX + (pose.offsetX || 0),
        y: pose.posY + (pose.offsetY || 0),
        theta: pose.yaw,
        ts
      };
      if (pose.frameId) {
        poseUpdates.frameId = pose.frameId;
      }
      // Gets frameId from updates
      const { frameId } = poseUpdates;
      // Creates an UTM Map if it doesn't exist for the given robot
      await this._createUtmMapIfNeeded({ robotId, frameId });
      await this._doUpdatePose(robotId, poseUpdates, ts);
    }
  };

  onCostmap = async (robotId, msg) => {
    console.log('onCostmap: robotId=', robotId, 'msg=', msg);
    // Costmaps. Since agent ver 1.1.9
    // Decode the mqtt MapMessage
    const decodedMsg = this.MapMessage.decode(msg);
    // Get the ui preferences for the costmap, to prepare the image accordingly

    try {
      const uiPreferences = await this.uiPreferencesCfgCache.get({
        entityId: robotId, entityType: ID_TYPE_ROBOT
      });
      const costmapPreference = (uiPreferences && uiPreferences.map && uiPreferences.map.costmap)
        || null;

      // If the config does not exist, or is missing values
      // we utilize the defaults shown here.
      // @see web/lib/collections.js for details on the possible values
      const {
        lethalThreshold,
        lethalColor,
        borderThreshold,
        borderColor,
        gradientEndColor = GRADIENT_COLOR_DEFAULT,
        alphaValue = 1,
        isAlphaGradient = true
      } = costmapPreference || {};

      // TODO Confirm that each color is exactly an array with three numbers

      // If there is no gradientColorTo defined, then make it the same as the from so that
      // all data points end up being a uniform color.
      // NOTE(adamantivm) This is done on a separate destructuring call in order to use another
      // property as a default value for this one.
      const { gradientStartColor = gradientEndColor } = costmapPreference || {};

      // Do some postprocessing on the costmap image. Costmaps get sent in grayscale (with
      // very low bpp, to save bandwidth): transform this to color, add some color
      // gradient, restore transparency and convert back to PNG.
      // TODO(Joaker): Perform the same size check performed in onMapV2 to make sure costmap size
      // does not exceed mongo's limit
      Jimp.read(Buffer.from(decodedMsg.pixels), (err, img) => {
        img.rgba(true); // Set RGB mode - costmaps are sent greyscale
        img.scan(0, 0, img.bitmap.width, img.bitmap.height, function (x, y, idx) {
          // x, y is the position of this pixel on the image
          // idx is the start position of this rgba tuple in the bitmap Buffer
          // this is the image
          // => R is [idx], G is [idx+1], B is [idx+2], A is [idx+3]
          // rgba values run from 0 - 255

          // Costmap cell value in the range 0-254
          const value = this.bitmap.data[idx];

          // The agent sends the alpha channel as 0 for unknown cells.
          // We represent that always as a transparent pixel.
          if (this.bitmap.data[idx + 3] == 0) {
            this.bitmap.data[idx + 3] = 0;
            // No further processing required
            return;
          }

          // Otherwise, alpha is calculated according to the configuration
          if (isAlphaGradient) {
            // Use the color intensity (probability of obstacle) as alpha.
            // This will make 'no obstacle' zones completely transparent and
            // 'walls' completely opaque.
            this.bitmap.data[idx + 3] = value * alphaValue;
          } else {
            this.bitmap.data[idx + 3] = 255 * alphaValue;
          }

          // scale values from 0-254 to 0-100 for color ranges
          const scaledValue = value / 2.54;
          // Lethal obstacles range
          if (lethalThreshold && scaledValue >= lethalThreshold) {
            this.bitmap.data[idx] = lethalColor[0];
            this.bitmap.data[idx + 1] = lethalColor[1];
            this.bitmap.data[idx + 2] = lethalColor[2];
            // Border/edge obstacles range
          } else if (borderThreshold && scaledValue >= borderThreshold
            && scaledValue < lethalThreshold) {
            this.bitmap.data[idx] = borderColor[0];
            this.bitmap.data[idx + 1] = borderColor[1];
            this.bitmap.data[idx + 2] = borderColor[2];
            // Gradient range
          } else {
            // Gradient between gradientStartColor and gradientEndColor based on
            // the value of the occupancy grid cell
            const p = value / 254;
            const q = 1 - p;
            for (let rgb = 0; rgb < 3; rgb++) {
              this.bitmap.data[idx + rgb] = gradientEndColor[rgb] * p + gradientStartColor[rgb] * q;
            }
          }
        });
        // Get the images's buffer and write to DB
        // NOTE(diegobatt): This callback is not awaiting the db update
        img.getBuffer(Jimp.MIME_PNG, (err2, buffer) => {
          if (err2) {
            console.error('Could not write costmap jimp buffer', err2);
            return;
          }
          const ts = decodedMsg.ts.toNumber();
          const costmapUpdates = {
            x: decodedMsg.x,
            y: decodedMsg.y,
            theta: decodedMsg.theta,
            width: decodedMsg.width,
            height: decodedMsg.height,
            resolution: decodedMsg.resolution,
            ts,
            data: buffer.toString('base64') // it was a node Buffer object
          };
          this._doUpdate(robotId, costmapUpdates, LOCALIZATION_SUBOBJECTS.COSTMAP, ts);
        });
      });
    } catch (error) {
      throw Error('Error handling costmap', error);
    }
  };

  onConfig = (laserId) => async (robotId, msg) => {
    // When clearing retained messages, we will receive a zero-length
    // message that we need to ignore
    if (msg.length == 0) {
      return;
    }

    let [tsSec, x, y, theta, aMin, aMax, rMin, rMax, numRanges] = msg.toString().split('|');
    [tsSec, numRanges] = [tsSec, numRanges].map((l) => Number.parseInt(l, 10));
    [x, y, theta, aMin, aMax, rMin, rMax] = [x, y, theta, aMin, aMax, rMin, rMax]
      .map((l) => Number.parseFloat(l));

    const configUpdates = {
      [laserId]: {
        tsSec,
        transform: { x, y, theta },
        angle: { min: aMin, max: aMax },
        range: { min: rMin, max: rMax },
        numRanges
      }
    };
    await this._doUpdate(
      robotId,
      configUpdates,
      LOCALIZATION_SUBOBJECTS.CONFIG,
      tsSec * 1000,
      true
    );
  };

  onPath = async (robotId, msg) => {
    const decodedMsg = this.PathDataMessage.decode(msg);
    // Get cached config per robot
    const { storePath, rateLimitMsPerPath = {} } = {} // TODO re-enable await this._agentModuleCache.get(robotId);

    // Filter empty and rate limited paths
    const paths = ((decodedMsg && decodedMsg.paths) || []).filter(({ pathId, ts }) => {
      const pathTs = ts && Number.parseInt(ts, 10);
      const rateLimiter = this._getPathRateLimiter(rateLimitMsPerPath[pathId]);
      return pathId && rateLimiter.accepts(`${robotId}/${pathId}`, pathTs);
    });

    // Skip processing if there are no paths to process after decoding and rate limiting
    if (paths.length == 0) {
      return;
    }

    // If necessary, decode paths
    for (const path of paths) {
      if (path.encodingVersion == PATH_ENCODING_DELTA_INT) {
        // Paths use IntDelta encoding (see arrayUtil.js). Decode them into { x, y } points
        // and discard the encoded version.
        path.points = deltaIntDecodePoints(path.encodedPoints.xs, path.encodedPoints.ys);
        delete path.encodedXs;
        delete path.encodedYs;
      }
    }

    // Build the updates for localization db object
    // Collect points, from each protobuf PathPoint object
    const updates = {};
    paths.forEach((path) => {
      // Let updates target inner fields individually, to avoid
      // replacing the whole paths object.
      updates[path.pathId] = {
        points: path.points.map((p) => ({ x: p.x, y: p.y })),
        ts: path.ts && Number.parseInt(path.ts, 10),
      };
      if (path.frameId) {
        updates[path.pathId].frameId = path.frameId;
      }
    });
    // Store the paths in mongo
    const msgTs = decodedMsg.ts && Number.parseInt(decodedMsg.ts, 10);
    // NOTE: Request per-key updates to avoid overwriting paths that weren't
    // provided in this call
    console.log("onPath: updates=", updates);
    await this._doUpdate(robotId, updates, LOCALIZATION_SUBOBJECTS.PATH, msgTs, true);

    // Store the paths, if enabled for the robot
    if (!storePath) {
      return;
    }

    for (const path of paths) {
      const extraTags = { pathId: path.pathId };
      if (path.frameId) {
        extraTags.frameId = path.frameId;
      }
      // Save the path to timeseries
      if (this.timeseriesApi) {
        // eslint-disable-next-line no-await-in-loop
        await this.timeseriesApi.saveObject({
          entityId: robotId,
          entityType: ID_TYPE_ROBOT,
          type: 'path',
          key: path.pathId,
          data: {
            frameId: path.frameId,
            points: path.points.map((p) => ({ x: p.x, y: p.y }))
          },
          time: path.ts && Number.parseInt(path.ts, 10),
        });
      }
    }
  };

  /**
   * Helper method that wraps the updates in a document to be inserted into the localization
   * collection. Also, it adds a updatedTs for each subobject
   *
   * @param {String}  robotId Id of the robot that sent the message.
   * @param {Object}  updates Object with the updated values
   * @param {String}  subobject One of the LOCALIZATION_SUBOBJECTS to wrap the updates in
   * @param {Double}  ts Update timestamp
   * @param {Boolean} multiple Use dot notation to submit an update for each key inside the
   *                  updates object. Useful for subobjects that hold multiple instances
   *                  such as PATH
   */
  _doUpdate = async (robotId, updates, subobject, ts = Date.now(), multiple = false) => {
    if (_.isEmpty(updates)) {
      console.warn('Warning: No updates after processing localization MQTT update', { robotId, subobject });
      return;
    }

    // Record the time at which data for this subobject was last written
    const updateTsAttribute = subobject + 'UpdatedTs';
    const subobjectUpdates = {
      [updateTsAttribute]: ts
    };
    // For some subobjects, we must update each key individually
    // to avoid overwriting keys that weren't provided in this call
    if (multiple) {
      Object.keys(updates).forEach((key) => {
        subobjectUpdates[`${subobject}.${key}`] = updates[key];
      });
    } else {
      subobjectUpdates[subobject] = updates;
    }
    if (!["laserRanges", "robotPose", "laserConfig"].includes(subobject)) { // FIXME remove debugging
        console.log("_doUpdate", robotId, subobject, subobjectUpdates)
    }
    await this._localizationColl.updateOne(
      { _id: robotId },
      { $set: subobjectUpdates },
      { upsert: true }
    );
  };

  /**
   * doUpdate abstraction for poses, as those messages also need to be sent through the attributes
   * manager
   *
   * @param {String} robotId Id of the robot that sent the message.
   * @param {Object} updates Object with the updated values
   * @param {Double} ts Update timestamp
   */
  _doUpdatePose = async (robotId, updates, ts = Date.now()) => {
    if (_.isEmpty(updates)) {
      console.warn('Warning: No updates after processing localization MQTT pose update', { robotId });
      return;
    }
    // NOTE We could use a different function instead of _doUpdatePose() for robots that
    // don't use spatial transformations to save some computations. For example we could have
    // a dictionary that for a robotId gives us the right version of _doUpdatePose() to be used.
    // TODO enable transformations
    // updates = await this._transformRobotPoseToSublocationWorldFrame(robotId, updates);
    await this._doUpdate(robotId, updates, LOCALIZATION_SUBOBJECTS.POSE, ts);
    // Additionally save the robot pose as a regular attribute
    await this.attributesMgr.saveAttributeValues({
      robotId,
      attributeValues: {
        [VITAL_POSE]: {
          value: updates,
          ts
        }
      },
      ts,
      skip: { status: true } // do not evaluate statuses
    });
  };

  /**
   * Returns if the provided map's data must be persisted. This depends on if the
   * map's data is already stored in mongo or objects manager (depending on the
   * settings) or not.
   *
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
   *    @typedef {Buffer} data
   * @param {String} robotId The robot this map belongs to.
   */
  async _mapDataMustBePersisted(robotId, map) {
    const annotation = await this._annotationsColl.findOne({
      entityId: robotId,
      entityType: ID_TYPE_ROBOT,
      label: map.metadata.label,
      'map.data': { $exists: true }
    }, { projection: { 'map.dataHash': 1, 'map.objectUrl': 1, preventUpdates: 1, 'map.formatVersion': 1 } });
    if (annotation && annotation.preventUpdates) {
      // HACK: Added a flag `preventUpdates` on spatial_annotations: Even if
      // the hashes do not match, this flag will prevent any updates
      return false;
    }
    const haveMap = annotation?.map?.dataHash !== undefined
      && annotation.map.dataHash == map.metadata.dataHash
      // formatVersion is optional. undefined (legacy) is considered to be 1,
      // although _parseMapMessageFields should have defaulted it already.
      && ((annotation.map.formatVersion || 1) === (map.metadata.formatVersion || 1))
      // If we are configured to store maps in ObjectsManager, but there is no
      // objectUrl, we don't have the map
      && (annotation.map.objectUrl || !MapsStorage.objectsManagerEnabled());
    console.info(`onMapV2: Map with hash "${map.metadata.dataHash}" will be persisted:`
      + ` ${haveMap ? 'NO' : 'YES'}`);
    // NOTE While the following is technically correct, it
    // requires to project the map.data in the query, so it may cause
    // a performance penalty.
    //    This could be useful only in the case we deactivate storing maps'
    // data in mongo and then re enable it.
    // &&
    // (annotation.map.data != null || !this.settings.writeMapDataToMongo);
    return !haveMap;
  }

  /**
   * Gets the ingest module configuration for this robot ID.
   * Returns an object with pre-processed keys relevant to ingest processing:
   *
   * {
   *   storePath,          // If true, store paths
   *   rateLimitMsPerPath  // Dictionary of rate limits by path ID
   * }
   *
   * @param {String} robotId
   */
  _getAgentModuleConfig = async (robotId) => {
    // eslint-disable-next-line camelcase
    const {
      store_path: storePath = false,
      path_topics: pathTopics = {}
    } = await this._moduleStatesConfig.getEntityConfig({
      entityId: robotId,
      entityType: ID_TYPE_ROBOT,
      conditions: {
        moduleName: MODULE_NAMES.ROS_LOCALIZATION_AGENTLET
      },
      fields: ['store_path', 'path_topics']
    }) || {};

    // Pick 'ingest_rate_limit_ms' from each path_topic and create a map of rateLimitMs by path ID
    const rateLimitMsPerPath = {};
    Object.keys(pathTopics).forEach((pathId) => {
      if ('ingest_rate_limit_ms' in pathTopics[pathId]) {
        rateLimitMsPerPath[pathId] = pathTopics[pathId].ingest_rate_limit_ms;
      }
    });

    const robotIngestConfig = {
      storePath,
      rateLimitMsPerPath
    };
    return robotIngestConfig;
  };

  /**
   * Returns a rate limiter with the given rate limit configuration
   */
  _getPathRateLimiter = (rateLimitMs = this.defaultPathRateLimitMs) => {
    if (!(rateLimitMs in this._pathRateLimiters)) {
      this._pathRateLimiters[rateLimitMs] = new RateLimiter(rateLimitMs);
    }
    const rateLimiter = this._pathRateLimiters[rateLimitMs];
    return rateLimiter;
  };

  /**
   * Creates a spatial annotation if the robot sending UTM Poses doesn't have the
   * UTM Zone created for the frameId that has been sent.
   * This is used by onPose function, since the UTM poses (from gps.js module)
   * are being sent to the ros/loc/pose topic and the GPSAgentlet doesn't send any map data
   * to ros/loc/map2.
   * @param {String} robotId
   * @param {String} frameId
   */
  _createUtmMapIfNeeded = async ({ robotId, frameId }) => {
    // FrameId format used by UTM Poses
    const utmFrameIdFormat = /(utm)[-][0-9]+/g;
    // If the frameId has UTM format, creates the spatial annotation if needed
    if (frameId && frameId.match(utmFrameIdFormat)) {
      const annotationId = await this._spatialAnnotationCache.get({ robotId, frameId });
      if (!annotationId) {
        const utmZone = frameId.split('-')[1];
        const map = {
          metadata: {
            label: frameId,
            mapId: frameId,
            frameId,
            utmZone,
            type: 'navsat',
            projection: 'utm',
            dataHash: `navsat-${frameId}`
          }
        };
        // This message is not a map correction, no needs for a backward
        // search for spurious points
        const isUpdate = false;
        // Stores map data
        // Sending copyObject = true or false is the same in this case because
        // UTM maps don't have objectUrl!
        await this.mapsStorage.persistMap(robotId, map, isUpdate, false);
      }
    }
  };

  /**
   * Gets the spatial annnotation corresponding to the map with `frameId` for the robot sent to
   * the ros/loc/pose topic
   * @param {String} robotId
   * @param {String} frameId
   * @returns annotationId
   */
  _getSpatialAnnotation = async ({ robotId, frameId }) => {
    const types = [SPATIAL_ANNOTATION_TYPES.MAP];
    const annotations = await this.annotationsMgr.findAnnotations(
      { robotId, annotationId: frameId, types }
    );
    const annotationId = annotations.length && annotations[0].annotation?.annotationId
      ? annotations[0].annotation.annotationId
      : null;
    return annotationId;
  };
}
