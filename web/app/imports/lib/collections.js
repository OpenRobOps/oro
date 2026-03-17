/**
 * Server-Client collections and corresponding schemas
 */
import { Meteor } from 'meteor/meteor';
import 'meteor/aldeed:collection2/static';
import { Mongo } from 'meteor/mongo';
import SimpleSchema from 'simpl-schema';
import { COLLECTIONS } from '../shared/constants';

const Schemas = {};

const SystemStatus = new Mongo.Collection(COLLECTIONS.SYSTEM_STATUS);
const Robots = new Mongo.Collection(COLLECTIONS.ROBOTS);
Schemas.status = new SimpleSchema({
  agentOnline: Boolean,
  value: { type: Number, optional: true }
});

Schemas.robot = new SimpleSchema({
  _id: String,
  name: String,
  // hostname comes from the robot's hostname, often the same as the name
  // but can be different if the robot name has been modified from the UI
  hostname: { type: String, optional: true },
  status: Schemas.status,
  version: String,
  variant: { type: String, optional: true },
  updateStamp: Number,
  // lock determines if a user (there can only be one) currently holds a Lock on this robot
  // the lock is valid if `locked` field is tue AND expirationTs has not yet been reached.
  // {
  //   userId: string
  //   userName: string
  //   locked: bool
  //   lockedTs: number
  //   expirationTs: number
  // }
  lock: { type: Object, blackbox: true, optional: true },
  // optional per-robot key. By default the account key is used
  robotKey: { type: String, optional: true },
}, { requiredByDefault: true });
if (Meteor.isDevelopment) {
  Robots.attachSchema(Schemas.robot);
}
if (Meteor.isServer) {
  Robots.rawCollection().createIndex({ 'lock.expirationTs': 1 });
  Robots.rawCollection().createIndex({ name: 1 }, {
    collation: { locale: 'en' }
  });
}

const RobotDiagnostics = new Mongo.Collection(COLLECTIONS.DIAGNOSTICS);
// TODO (Pisti2010): Review and finish robotDiagnostics schema (below),
// Schemas.robotDiagnostics = new SimpleSchema({
//   _id: String,
//   robotId: String,
//   stamp: String,
//   statusList: String, // TODO (Pisti2010): change into nested schema
// });

// A collection to hold the latest vitals information for a
// given robot. Aimed to replaced sys properties in the Robot collection.
const RobotVitals = new Mongo.Collection(COLLECTIONS.ROBOT_VITALS);
Schemas.robotVitals = new SimpleSchema({
  // RTT measurments, populated by RttManager
  sysNetRtt: { type: Object, optional: true },
  'sysNetRtt.ts': Number,
  'sysNetRtt.min': Number,
  'sysNetRtt.avg': Number,
  'sysNetRtt.max': Number,
  'sysNetRtt.mdev': Number,
  // Agent clock drift estimation, populated by RttManager
  sysNetAgentTimeDelta: { type: Object, optional: true },
  'sysNetAgentTimeDelta.ts': Number,
  'sysNetAgentTimeDelta.value': Number,
}, { requiredByDefault: true });
if (Meteor.isDevelopment) {
  RobotVitals.attachSchema(Schemas.robotVitals);
}

const RobotLocalization = new Mongo.Collection(COLLECTIONS.LOCALIZATION);
// TODO: Figure out how to include paths and lasers structure in this schema
Schemas.RobotLocalization = new SimpleSchema({
  _id: { type: String, required: true },
  robotPose: Object,
  'robotPose.x': Number,
  'robotPose.y': Number,
  'robotPose.theta': Number,
  'robotPose.frameId': String,
  'robotPose.ts': Number,
  robotPoseUpdatedTs: Number,
  laserConfig: Object,
  laserConfigUpdatedTs: Number,
  laserRanges: { type: Object, blackbox: true },
  laserRangesUpdatedTs: Number,
  costmap: Object,
  'costmap.x': Number,
  'costmap.y': Number,
  'costmap.theta': Number,
  'costmap.width': Number,
  'costmap.height': Number,
  'costmap.resolution': Number,
  'costmap.ts': Number,
  'costmap.data': String,
  costmapUpdatedTs: Number,
  map: Object,
  'map.dataHash': String,
  'map.frameId': String,
  'map.label': String,
  'map.mapId': String,
  'map.objectUrl': String,
  'map.resolution': Number,
  'map.ts': Number,
  'map.width': Number,
  'map.height': Number,
  'map.x': Number,
  'map.y': Number,
  'map.formatVersion': { type: Number, allowedValues: [1, 2], optional: true },
  mapUpdatedTs: Number,
  defaultMap: String,
  paths: { type: Object, blackbox: true },
  pathsUpdatedTs: Number
}, { requiredByDefault: false });
if (Meteor.isDevelopment) {
  RobotLocalization.attachSchema(Schemas.RobotLocalization);
}

// Collection for robot states
// NOTE: states for options (Available states) should be declared above in the state  Options schema
const RobotModuleState = new Mongo.Collection(COLLECTIONS.MODULE_STATES);
Schemas.robotModuleState = new SimpleSchema({
  entityId: { type: String, optional: false }, // robotId
  moduleName: { type: String, optional: false }, // Ros<module>Agentlet: RosTeleopAgentlet, ...
  entityType: { type: String, optional: false }, // user, agent
  runlevel: Number, // Agent reported runlevel
  minRunlevel: Number, // User set minimal runlevel
  loaded: Boolean,
  // System Module specific keys:
  battery_source: Object,
  // source to get battery from (diagnostics, custom data)
  'battery_source.type': { type: String, optional: false },
  'battery_source.diagnostics_namespace': String, // diagnostics type specific fields
  'battery_source.diagnostics_key_voltage': String,
  'battery_source.diagnostics_key_percent': String,
  optional_disk_sources: { type: Object, blackbox: true }, // optional disk sources to monitor
  // optional network interfaces to monitor
  optional_network_interfaces: { type: Object, blackbox: true },
  // Events Module specific keys:
  // Maximum rate and bytes per second before dropping events
  max_msg_rate_count: { type: Number, optional: true },
  max_msg_rate_bytes: { type: Number, optional: true },
  // Last time an incoming event was dropped due to throttling
  // (reported by the agent)
  msg_dropped_time: { type: Number, optional: true },
  // Map Module specific Keys:
  map_topic: String,
  map_config: { type: Object, optional: true },
  // ROS 2 QoS configuration:
  // ros_qos: {
  //   history: <Number>,
  //   depth: <Number>,
  //   durability: <Number>,
  //   reliability: <Number>
  // }
  // max rate the agent will be processing map updates
  'map_config.max_rate': { type: Number, optional: true },
  map_truncate_time: Number,
  // WARNING (FlorGrosso): Use this with care and if you really know what
  // you are doing. Ignores the 'map_published' flag and processes
  // localization data even if the map hasn't been published by the agent.
  disable_map_published_flag: { type: Boolean, optional: true },
  // Flag to prevent map uploads when a different map_topic is configured just before
  // the map image is uploaded.
  map_prevent_outdated_upload: { type: Boolean, optional: true },
  // Localization Module specific Keys:
  path_topic: String,
  path_topics: { type: Object, blackbox: true },
  // {
  //   <path_id>: {
  //     topic: <ROS topic>,
  //     ingest_rate_limit_ms: <Number>  Ingest: use a custom rate limit for this path ID
  //   }
  // }
  paths_config: { type: Object, optional: true },
  // Flag indicating whether the path should be downsampled
  'paths_config.should_downsample': Boolean,
  // max rate the agent will be capturing path updates
  'paths_config.max_rate': Number,
  // Max length of path message to be published by the agent
  'paths_config.max_length': Number,
  // Max number of points that will be processed per path. Paths larger
  // than this size will get only the first max_input_path_length'
  // points processed and the rest discarded.
  'paths_config.max_input_path_length': Number,
  // Indicates if the path should be simplified through decimation
  // algorithms or not.
  'paths_config.should_simplify': Boolean,
  // Indicates whether the path simplification should preserve high
  // quality or not (apply an extra decimation algorithm).
  'paths_config.simplify_high_quality': Boolean,
  // Tolerance for the simplification algorithm
  'paths_config.simplify_tolerance': Number,
  // Log processing stats on the agent log (time elapsed)
  'paths_config.log_processing_stats': Boolean,
  // Encoding for paths (PATH_ENCODING_* constants): 0=list of (float) points, 1=DeltaInt
  'paths_config.encoding_version': Number,
  // When DeltaInt encoding is used (see encoding_version), max bits to use per encoded number
  'paths_config.encoding_max_bits': Number,
  // If present and true, paths will be saved in timeseries for display in Time Capsule
  store_path: { type: Boolean, optional: true },
  costmap_topic: String,
  laser_topic: String,
  laser2_topic: String,
  set_pose_topic: String,
  nav_goal_topic: String,
  nav_path_topic: String,
  nav_goal_max_delay_ms: Number,
  // When a 'cancel nav goal' action is issued, predict the robot's
  // pose 'nav_goal_cancel_lag_secs' in the future and send a move
  // base goal to it.
  cancel_nav_goal_lag_secs: Number,
  robot_frame: String,
  // Teleop module specific Keys:
  cmd_vel_topic: String, // current topic for teleop
  linear_vel: Number,
  angular_vel: Number,
  base_frame: String,
  odom_frame: String,
  publish_zero_vel: Boolean, // publish 0,0,0 vel at end of teleoperation
  zero_vel_threshold: Number, // The number of vel commands to send before publishing a zero_vel
  state: String, // ready, moving, blocked
  unsafeMode: Boolean, // Locks teleop, preventing continous commands
  // Camera Agentlet Module specific keys:
  camera_preset: String,
  camera_topic0: String, // TODO: (Pisti): remove this, deprecated for agents previous to 1.2.9
  camera_topic1: String, // TODO: (Pisti): remove this, deprecated for agents previous to 1.2.9
  // TODO (Flor_Grosso): remove camera_topics from schema (deprecated - v1.2.11)
  camera_topics: { type: Object, blackbox: true },
  // This schema is defined this was as an attempt to prevent simpleSchema to not
  // filter out updates using the syntaxt cameras_config.0
  // this attempt failed and I ended disabling the schema even in development mode.
  cameras_config: { type: SimpleSchema.oneOf(Object, Array), blackbox: true },
  'cameras_config.$': { type: Object, blackbox: true },
  // { <camera_id>:
  //   { topic: ROS Topic,
  //     output_encoding: <'mono8', 'rgb8'>,
  //     compressed: <Boolean>, // Whether the image type is compressed or not
  //     quality: < Number >,  // Common values for are: 5, 10, 20, 30 (it varies between encodings)
  //     rate: <0.1, 2.0>,     // [Hz]
  //     is_on: <true/false>,
  //     img_width: <Number>,  // Width for img sent by the agent. Default is 320.
  //     img_height: <Number>, // Height for img sent by the agent. Default is 240
  //     contrast: <Number>,   // Contrast control (Open CV: 1.0-3.0, PIL: 0->1 brighter, 0 = black
  //                           // & 1 = unchanged). Optional, will be used only if set.
  //     brightness: <Number>  // Brightness control (Open CV: 0-100, PIL: 0->1 more contrast,
  //                           // 0 = black & 1 = unchanged). Optional, will be used only if set.
  //     TODO (Flor_Grosso): consider defining resizing parameters so that
  //     aspect ratio is preserved.
  //   }
  // }
  // NOTE: camera_id is a number from 0 to n
  secondary_camera_on: Boolean, // NOTE: will be deprecated when navigation detail is live
  // - View-only selections (don't need to be sent to the agent)
  cameraViewOn: Boolean,
  highSpeed: Boolean,
  high_rate_jpg_quality: Number,
  selectedCam: String,
  clientOverrides: { type: Object, blackbox: true },
  // Rosbag Module specific keys:
  recordingOn: Boolean,
  // TODO rename: available_rosbags to something else
  available_rosbags: Array, // rosbags currently stored in the robot
  'available_rosbags.$': String,
  topics_to_record: Array, // topics to record in rosbags
  'topics_to_record.$': String,
  max_hdd_usage_gb: Number,
  current_hdd_usage_gb: Number,
  paths: Array,
  'paths.$': Object, // schema of the configuration
  'paths.$.path': { type: String, optional: false },
  'paths.$.extension': String,
  sync_rate_hz: Number,
  upload_rate_hz: Number,
  databags_limit: Number,
  // Custom Data Module specific keys
  custom_data_sources: Array, // Array of all data source configurations
  'custom_data_sources.$': Object, // schema of the configuration
  'custom_data_sources.$.id': { type: String, optional: false },
  'custom_data_sources.$.name': String, // label of the data source
  'custom_data_sources.$.type': { type: String, optional: false }, // type of data source: key_value, text_file, image_file
  'custom_data_sources.$.topic': { type: String, optional: false }, // key/value topic: Default: /.../custom_data/<custom-field>
  'custom_data_sources.$.sampling_mode': { type: String, optional: false }, // One of "regular", diff"
  'custom_data_sources.$.max_interval': Number, // send updated keys at least every these number of seconds - used in sampling_mode = diff
  'custom_data_sources.$.include_keys': Array, // apply sampling mode only to these keys, use a default configuration for the rest.
  'custom_data_sources.$.include_keys.$': String,
  'custom_data_sources.$.exclude_keys': Array, // apply sampling mode to all keys except the ones listed here (these use a default configuration).
  'custom_data_sources.$.exclude_keys.$': String,
  'custom_data_sources.$.path': String, // path to file of sources
  'custom_data_sources.$.diagnostics_name': String, // name of the component reporting
  'custom_data_sources.$.diagnostics_key': String, // label to look for within the ROS KeyValue.msg
  'custom_data_sources.$.force_key': String, // ket/value: a string to force as a key for this custom data field.
  custom_image_config: Object,
  'custom_image_config.width': Number, // output image width
  'custom_image_config.height': Number, // output image height
  'custom_image_config.jpg_quality': Number, // output image jpg quality [0 ... 100]
  'custom_image_config.skip_conversion': Boolean, // True if source encoding is kept for output image,
  custom_image_config_by_id: { type: Object, blackbox: true },
  // { <custom data id>:
  //  { width: Number, // output image width
  //    height: Number, // output image height
  //    jpg_quality: Number, // output image quality ([0 ... 100] for JPG/JPEG and [0...9] for PNG)
  //    TODO (Flor_Grosso): migrate this to just "quality", since other encodings are now supported
  //    skip_conversion: Boolean, // true if source encoding should be preserved
  // }
  custom_text_file_config: { type: Object, blackbox: true },
  // {
  //  <custom data id>: {
  //      read_order: String, // the order in which the text file will be read (‘head’ or ‘tail’)
  //      bytes_per_msg: Number, // number of bytes to read per update.
  // }
  // ROS monitoring Module specific keys:
  ros_topic_monitor: { type: Object, blackbox: true }, // dict. of actions indexed by topic name
  ros_param_monitor: { type: Object, blackbox: true }, // dict. of actions indexed by param name
  ros_node_monitor: { type: Object, blackbox: true }, // dictionary of actions indexed by node name
  // Topic where we are listening the diagnostics data. Usually /diagnostics_agg or /diagnostics
  diagnostics_topic: String,
  api_webserver_port: Number,
  spatial_annotations: Object,
  'spatial_annotations.publication_mode': String, // costmap, yaml, octomap
  'spatial_annotations.publication_params': Object,
  // where to take the base map from [costmap mode]
  'spatial_annotations.publication_params.source_topic': { type: String, optional: true },
  // where to publish data to [topic & costmap mode]
  'spatial_annotations.publication_params.output_topic': { type: String, optional: true },
  // path to place the yaml file [YAML mode]
  'spatial_annotations.publication_params.output_path': { type: String, optional: true },
  // [YAML mode]
  'spatial_annotations.publication_params.param_name': { type: String, optional: true },
  'spatial_annotations.map': Object,
  'spatial_annotations.map.checksum': String, // checksum of the map provided by localizationAgentlet
  'spatial_annotations.annotations': Array, // polygons' data, add one entry for each
  'spatial_annotations.annotations.$': Object,
  'spatial_annotations.annotations.$.type': String, // NO_GO_ZONE, etc
  'spatial_annotations.annotations.$.label': String, // label for the polygon given by the user
  'spatial_annotations.annotations.$.cost': Number, // value to fill the polygon with
  'spatial_annotations.annotations.$.data': Array, // Polygon's vertices, in map coordinates.
  'spatial_annotations.annotations.$.data.$': Array,
  'spatial_annotations.annotations.$.data.$.$': Number,
  // Rosout Module specific keys:
  rosout_verbosity_level: String, // Valid values: FATAL, ERROR, WARN, INFO, DEBUG
  // CustomCommandsAgentlet specific keys:
  // timeout for script execution (applies for the whole custom commands module), in SECONDS
  script_execution_timeout: Number,
  script_max_parallel_execs: Number, // max number of scripts than can be executed simultaneously
  script_concurrent_execs: String, // 'enabled', 'disabled', 'disabled_for_same_args'
  clean_env: Boolean, // indicates whether to run script actions on a clean environment or not.
  // True by default.
  //
  // PoseAgentlet specific keys:
  //
  map_frame: { type: String, optional: true }, // "from" frame for pose
  // robot_frame: { type: String, optional: true } // "to" frame - NOTE: already enumerated above
  // DKDashBuffer agentlet
  video_buffer: { type: Object, optional: true },
  'video_buffer.depth_s': Number,
  'video_buffer.output_dir': String,
  video_encoder_default: { type: Object, optional: true },
  'video_encoder_default.lowlatency': Number,
  'video_encoder_default.fps': Number,
  video_segment: { type: Object, optional: true },
  'video_segment.gop_per_seg': Number,
  'video_segment.duration_s': Number,
  // GPS Agentlet Module specific keys:
  // Available NavSatFix topics for the agent to subscribe to
  available_navsatfix_topics: Array,
  'available_navsatfix_topics.$': String,
  // Available GPSFix topics for the agent to subscribe to
  available_gpsfix_topics: Array,
  'available_gpsfix_topics.$': String,
  // GPS topic that the agent should subscribe to.
  gps_topic: Object,
  // {
  //   topic: String,
  //   msg_type: String <- sensor_msgs/msg/NavSatFix or gps_msgs/msg/GPSFix
  // }
  'gps_topic.topic': String,
  'gps_topic.msg_type': String
}, { requiredByDefault: false });
// schema that holds the available state arrays
Schemas.robotModuleState.extend(Schemas.robotModuleStateOptions);
if (Meteor.isDevelopment) {
  // TODO (Pisti) investigate why this schema is cleaning documents when handling
  // cameras_config insertions and updates
  // RobotModuleState.attachSchema(Schemas.robotModuleState);
}
// NOTE: The RobotModuleState collection has a custom index defined on Migration 07
// The index is ({ entityId: 1, moduleName: 1, entityType: 1 }, { unique: true })

const RobotLogs = new Mongo.Collection(COLLECTIONS.LOGS);

const RobotAgentFiles = new Mongo.Collection(COLLECTIONS.ROBOT_AGENT_FILES);
Schemas.robotAgentFiles = new SimpleSchema({
  robotId: String,
  type: String,
  fileName: String,
  size: Number,
  ts: Number,
  storedInRobot: Boolean,
  uploading: Boolean,
  url: String,
}, { requiredByDefault: true });
if (Meteor.isDevelopment) {
  RobotAgentFiles.attachSchema(Schemas.robotAgentFiles);
}
if (Meteor.isServer) {
  RobotAgentFiles.rawCollection().createIndex({ robotId: 1, fileName: 1 }, { unique: true });
}

const CameraImages = new Mongo.Collection(COLLECTIONS.CAMERA_IMAGES);
Schemas.cameraImage = new SimpleSchema({
  robotId: String,
  cameraId: String,
  ts: Number,
  width: Number,
  height: Number,
  data: String,
}, { requiredByDefault: true });
if (Meteor.isDevelopment) {
  CameraImages.attachSchema(Schemas.cameraImage);
}
if (Meteor.isServer) {
  CameraImages.rawCollection().createIndex({ robotId: 1, cameraId: 1 }, { unique: true });
}

const RobotCustomData = new Mongo.Collection(COLLECTIONS.CUSTOM_DATA);
/*
  robotId: string
  customField: string (this is basically the ID of this document for this robot)
  customData: Object (support for: text, _image)
  details: Object (additional details sent by the agent.
                    txt files: totalFileSize, blobSize, blobOffset )
 */
if (Meteor.isServer) {
  RobotCustomData.rawCollection().createIndex({ robotId: 1, customField: 1 }, { unique: true });
}

// TODO(herchu) This collection is deprecated, remove after IO-876
const RobotCustomDataKeyValues = new Mongo.Collection(COLLECTIONS.CUSTOM_DATA_KEY_VALUES);
/*
  robotId: string
  customField: identifies the particular custom data element
  key: String: the custom key
  value: String: the custom value
  ts: updated timestamp, in milliseconds
 */
if (Meteor.isServer) {
  RobotCustomDataKeyValues.rawCollection().createIndex(
    { robotId: 1, customField: 1, key: 1 },
    { unique: true }
  );
}

const RobotKeyValues = new Mongo.Collection(COLLECTIONS.ROBOT_KEY_VALUES);
/*
  _id: string (the robotId)
  // Next are all last k-v values as a map from keys (e.g. topic name) to last-seen value with ts
  ...<key>: { value: (last value), ts: Number }
 */

const RobotCustomScript = new Mongo.Collection(COLLECTIONS.CUSTOM_SCRIPT);
Schemas.robotCustomScript = new SimpleSchema({
  robotId: String,
  executionId: String, // Identifies the specific instance of a script execution
  // TODO: Rename fileName to executionId
  fileName: String,
  argOptions: { type: Array, optional: true }, // Array of options needed for script execution
  'argOptions.$': String,
  // NOTE: Don't save script contents here, this needs to be redesigned/moved
  // to a separate collection
  // content of the script to save in the robot and execute
  scriptContents: { type: String, optional: true },
  // 'To be started', 'Running', 'Finished', 'Aborted'
  executionStatus: { type: String, optional: true },
  // Message with details about execution, e.g. errors like "Script is already executing"
  executionStatusDetails: { type: String, optional: true },
  // updated timestamp when a command was sent to the agent (run or save file)
  ts: { type: Number, optional: true },
  // timestamp when the agent sent back the execution output, in milliseconds
  updatedTs: { type: Number, optional: true },
  returnCode: { type: String, optional: true },
  stdout: { type: String, optional: true },
  stderr: { type: String, optional: true },
  // Timestamp when ingest received the message from the agent
  serverTime: { type: Date, optional: true },
  // Id of the robot the result of the script execution should be reported to if any
  // Used when scripts are executed from IoC proxy robots
  reportResultToId: { type: String, optional: true },
}, { requiredByDefault: true });
if (Meteor.isDevelopment) {
  RobotCustomScript.attachSchema(Schemas.robotCustomScript);
}
if (Meteor.isServer) {
  RobotCustomScript.rawCollection().createIndex({ robotId: 1, fileName: 1 }, { unique: true });
  // Retain updates only for half an hour. If we want further retention, we need to add different
  // logic to copy the updates, output, etc. to a different longer-term collection
  RobotCustomScript.rawCollection().createIndex({ serverTime: 1 }, { expireAfterSeconds: 30 * 60 });
}

const DataDisplayConfig = new Mongo.Collection(COLLECTIONS.DATA_DISPLAY_CONFIG);
/**
 *  TODO: Add unofficial schema
 */

/**
 * UI Preferences Design doc:
 * https://docs.google.com/document/d/1qWklxC2yHz9NiCSXeQPTjB3vbrHvlRoEPux6AEHRmuw/edit
 *
// TODO Collection UIPreferences MUST be moved to ./uiPreferences.js!
//              (It's a big change as it is imported from everywhere and it requires testing)
 */
const UIPreferences = new Mongo.Collection(COLLECTIONS.UI_PREFERENCES);
Schemas.uiPreferences = new SimpleSchema({
  entityId: { type: String, optional: false },
  entityType: { type: String, optional: false },
  /**
   * `htmlTitlePattern`: allows to use a template with the HTML title to be displayed
   */
  htmlTitlePattern: { type: String, optional: true },
  /**
   * `actions`: Object that organizes ui preferences related to actions
   * embeddedActions: Object that organizes what actions to show in ui widgets
   * the keys of the object represent specific view/widgets of our application.
   *  embeddedActions.navigationDetail: [Array of Action ids]
   */
  actions: { type: Object, blackbox: true },
  /**
   * `appBar`: Configures elements in the top application bar
   *
   * logo: {
   *   data: Base64 String representation of the image,
   *   file: {
   *     lastModifiedTs: Last modified date in milliseconds,
   *     name: Name of the file uploaded,
   *     size: Size of the Base64 String image,
   *     type: Type of Mime file (usually image/*),
   *     webkitRelativePath: The path relative to the webkit (usually ""),
   *   }
   */
  appBar: { type: Object, optional: true, blackbox: true },
  /**
   * `cameras` element: Hidden configuration feature to rename cameras and show a
   * user label instead of simply "1", "2", etc. This object contains cameras by id
   * (where id is "0", "1", ..., see module states):
   *
   * <cameraId>: {
   *   label: string,
   *   distinguished: boolean, // if the image is shown larger, in top left
   *                           // corner, in Manual Override cameras mode
   *   rotation: Number,
   *   mirror: boolean,
   *   customField: string // id of img custom field to display in snapshot mode
   *   config_overrides: {
   *     focus: {           // We use 'focus' and 'hide' but arbitrary names can also
   *       img_width: 1920, // be used. These identify a given override profile.
   *       img_height: 1024 // On each profile we have the attributes from the
   *     },                 // cameras_cofig state for the RosImageAgentlet that
   *     hide: {            // we want to override.
   *       is_on: false
   *     }
   *   }
   * }
   * _all_: {     // Camera preferences that apply to all cameras
   *   recentTs:  // (milliseconds). Don't show camera images older than this.
   *              // defaults to 5000.
   *   config_overrides: {}  // Can be specified for all cameras or individually
   * }
   */
  cameras: { type: Object, optional: true, blackbox: true },
  /**
   * `map` element: configuration feature to update map related settings. This
   * includes objects rendered within the localization view.
   *
   * robotPath: {
   *   elementList: [<pathId0>, <pathId1>, ..., <pathIdN>],
   *   elementValues: {
   *     <pathId0>: {
   *        hex color codes for nav path points; max. 3 elements with:
   *        [0]: current data, [1]: recent data, [2]: stale data
   *       pointColor: Array,
   *        hex color codes for nav path lines; max. 2 elements with:
   *        [0]: current data, [1]: recent data
   *       lineColor: Array,
   *       pointWidth: Number,
   *       lineWidth: Number,
   *        Indicates whether the path should persist or fade with time
   *       shouldPersist: <Boolean>
   *     },
   *     ...,
   *     <pathIdN> : {...}
   *   }
   * }
   *
   * Schema for the Costmap UI Preferences.
   * See https://docs.google.com/document/d/1xSNJBRpL51DR40NzzTuGeHS3XO5IaNgpmRTNrAC7NtU/edit#
   * for motivation and more details.
   *
   * All 'color' values are three-element arrays with values [Red, Green, Blue], each color
   * component ranging from 0 to 255.
   *
   * costmapPreferencesSchema = new SimpleSchema({
   * costmap: Object,
   *   lethalThreshold: {
   *     type: Number,
   *     min: 0,
   *     max: 100
   *   },
   *   lethalColor: Array,
   *     'lethalColor.$': {
   *       type: Number,
   *       min: 0,
   *       max: 255
   *     },
   *   borderThreshold: {
   *     type: Number,
   *     min: 0,
   *     max: 100
   *   },
   *   borderColor: Array,
   *     'borderColor.$': {
   *       type: Number,
   *       min: 0,
   *       max: 255
   *     },
   *   // Gradient colors used to reprent obstacle probability values.
   *   // The color value of each pixel goes from gradientStartColor (no probability of obstacle)
   *   // to gradientEndColor (maximum probability of obstacle).
   *   // If no gradientStartColor is provided, all obstacle probabilities are represented on
   *   // the same fixed color (gradientEndColor).
   *   gradientEndColor: Array,
   *     'gradientColor.$': {
   *       type: Number,
   *       min: 0,
   *       max: 255
   *     },
   *   gradientStartColor: Array,
   *     'gradientColor.$': {
   *       type: Number,
   *       min: 0,
   *       max: 255
   *     },
   *   // The alpha (transparency) of pixels can also represent obstacle probability values.
   *   // If isAlphaGradient is true, then highest probability obstacles will be represented
   *   // with an opacity of alphaValue and the least probability as totally transparent.
   *   // If isAlphaGradient is set to false, all pixels will be shown with alphaValue opacity.
   *   alphaValue: {
   *     type: Number, // decimal from 0 to 1, transparency of colors
   *     min: 0,
   *     max: 1
   *   }
   *   isAlphaGradient: { // Default: true. Whether to make transparency a function of cell cost
   *     type: Boolean
   *   }
   * });
   *
   * Schema for laser preferences
   * It enables configuring whether points size should scale or remain at a
   * fixed value, as well as the default point size (visible when zoom = 1).
   * If scaling is on, then the point size is computed as:
   *
   * pointSize = defaultPointSize / zoomLevel  -> zoomLevel <= 1
   *
   * pointSize = defaultPointSize / zoomLevel * scaleFactor -> zoomLevel > 1
   *
   * lasers: {
   *   elementValues: {
   *     '0': {
   *       outOfRangeColor: String // hex color code for the out of range shadow
   *       pointsColor: String // hex color code for this laser's points
   *     },
   *     '1': {
   *       ...
   *     }
   *   }
   * }
   *
   * Schema for robot pose preferences implemented in web/imports/lib/uiPreferences.js
   * pose: {
   *   // If present, footprint is used to draw a polygon with the shape
   *   // of the robot instead of a fixed-sized circle
   *   footprint: [[1,1],[1,-1],[-1,-1],[-1,1]],
   *   // If present, draws the size of the robot pose circle with this radius in meters.
   *   // The arrow avatar is sized to be 2/3rds of this radius.
   *   // If footprint is provided, then the arrow will be reduced to 2/3rds of the
   *   // indicated size, but the outline will take the shape of the polygon specified
   *   // in the footprint property.
   *   radius: 0.26
   * }
   *
   * // If present, topmostLayers determines which layer is rendered on top. This applies for now
   * // to robot layers only. For example ["laser"] will draw laser points of top of all other
   * // robot layers.
   * // The default order for layers (top to bottom) is ["avatar", "path", "laser", "costmap"].
   * // Adding any layer name to topmostLayer pushes it to the top (beginning of the list).
   * topmostLayers: Array
   *
   * // If present, for maps of type LOCALIZATION_MAP_TYPE.NAVSAT, which tile source
   * // to use. This is used to display street maps, satellite images, etc.
   * // Possible values can be found in MapNavsatLayer.js, in the LOCALIZATION_TILESETS constant.
   * tileset: String
   */
  map: { type: Object, optional: true, blackbox: true },
  /**
   * `navigationDetail` element: Options for Navigation Detail screen.
   * Includes layouts & teleop options.
   *
   * {
   *   layouts: { // layouts configuration; in {elementList, elementValues } form
   *     elementList: [ arrayOfLayoutIds ] // NOTE: The first layout id is selected by default
   *     elementValues: {
   *       <layoutId>: <LayoutObject> // See design doc for LayoutObject format
   *     }
   *   },
   *   // coming soon: available actions
   *   // TODO This must be migrated to use elementList/elementValues instead of
   *   // a single Array. Otherwise, configManager can't be used to tailor the configuration
   *   mapsList: [ // array of map objects
   *    {
   *      topic: String,
   *      label: String // optional
   *    }
   *   ],
   *   teleop: {
   *     continuitySafetyThreshold: Number - The number of seconds before client stops sending
   *                                         the same teleop command.
   *   }
   *   speedometers: {
   *      linear: {
   *        maxValue: Number,
   *        minValue: Number,
   *        unit: String,
   *      }
   *      angular: {
   *        maxValue: Number,
   *        minValue: Number,
   *        unit: String,
   *      }
   *   }
   * }
   */
  navigationDetail: { type: Object, optional: true, blackbox: true },
}, { requiredByDefault: false });
if (Meteor.isDevelopment) {
  UIPreferences.attachSchema(Schemas.uiPreferences);
}
if (Meteor.isServer) {
  UIPreferences.rawCollection().createIndex({ entityId: 1, entityType: 1 }, { unique: true });
}

/**
 * Full-stack preferences.
 * Contains preferences (configuration) for:
 * - Locks: https://docs.google.com/document/d/1y0-htiDFGgDr1csOQwqk3CmRYEQZ6_hko9IGpNDYUm8
 */
const Preferences = new Mongo.Collection(COLLECTIONS.PREFERENCES);
Schemas.preferences = new SimpleSchema({
  entityId: { type: String, optional: false },
  entityType: { type: String, optional: false },
  // lock: Determines how we use robot Locks.
  // lock: {
  //   type: string // see LOCK_TYPES in lock.js
  //   expirationSeconds: number, // <=0 for no timeouts
  //   expirationRenewalSeconds: number, // defaults to expirationSeconds
  //   notifications: bool // Enable or disable notification: defaults to true
  // }
  lock: { type: Object, blackbox: true, optional: true },
  robotSimulations: { type: Object, blackbox: true, optional: true },
  // robotSimulations: {
  //   maxActiveCount: integer // Maximum number of active robot simulations
  // }
  // agentVariant: Determines if there is a prefered agent variant
  agentVariant: { type: String, optional: true },
  // dataSources: additional configuration for data sources.
  // dataSources: {
  //   autoCreateUIElements: Bool
  // }
  dataSources: { type: Object, blackbox: true, optional: true },
}, { requiredByDefault: false });

const SpatialTransformations = new Mongo.Collection(COLLECTIONS.SPATIAL_TRANSFORMATIONS);
/**
 *  entityId,
 *  entityType,
 *  transformations: {
 *    frameIdA: {    // Represents the source frame ID for the transformation
 *                   // Most common use is a robot world frame ID - commonly 'map' frame in ROS
 *      frameId: String // Represents the target frame ID for the transformation
 *                      // Most common use is a sublocation common world frame ID
 *      aTb: {
 *        m: aTb transformation matrix (3x3)
 *      }
 *    }
 *  }
 */
if (Meteor.isServer) {
  SpatialTransformations.rawCollection().createIndex(
    { entityId: 1, entityType: 1 },
    { unique: true }
  );
}

export {
  CameraImages,
  DataDisplayConfig,
  Preferences,
  KPIDefinitions,
  RobotVitals,
  Robots,
  RobotAgentFiles,
  RobotCustomData,
  RobotCustomDataKeyValues, // TODO Remove this one! IO-876\
  RobotCustomScript,
  RobotDiagnostics,
  RobotKeyValues,
  RobotLocalization,
  RobotLogs,
  RobotModuleState,
  SpatialTransformations,
  UIPreferences,
  VDA5050LayoutsDefinition,
  Sublocations
};
