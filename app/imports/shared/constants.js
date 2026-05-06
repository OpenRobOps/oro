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
 * System-wide shared constants
 */
const COLLECTIONS = {
  // ORO model collections
  // - Entities
  ROBOTS: 'robots',
  USERS: 'users', // Based on Meteor package

  // - Permissions-related
  ROLES: 'roles', // note that this is the same name used by alanning/roles

  // Dashboards for each user
  DASHBOARDS: 'dashboards',

  // - Definitions
  ATTRIBUTE_DEFINITIONS: 'attr_defs',
  VITAL_DEFINITIONS: 'vital_defs',
  INCIDENT_DEFINITIONS: 'incident_definitions',
  ALERTS_CONFIG: 'alerts_config',
  ACTION_DEFINITIONS: 'action_defs',
  CUSTOM_SCRIPT: 'custom_script',
  DATA_DISPLAY_CONFIG: 'data_display_config',
  STATUS_CONFIG: 'status_config',
  UI_PREFERENCES: 'ui_preferences',
  PREFERENCES: 'preferences',

  // - Data
  ATTRIBUTE_VALUES: 'attr_values',
  ROBOT_ALERTS: 'robot_alerts',
  INCIDENTS: 'incidents',
  NOTIFICATIONS: 'notifications',
  ACTION_TOKENS: 'action_tokens',
  ROBOT_AGENT_FILES: 'robot_agent_files',
  ROBOT_DATABAGS: 'robot_databags',
  ROBOT_STATUS: 'robot_status',
  ROBOTS_WITH_STATUS: 'view_robots_with_status',
  SPATIAL_ANNOTATIONS: 'spatial_annotations',

  // Real-time reactive data collections
  ATTR_VALUES: 'attr_values',
  SYSTEM_STATUS: 'systemStatus',
  LOCALIZATION: 'localization',
  LOGS: 'logs',
  CAMERA_IMAGES: 'camera_images',
  DIAGNOSTICS: 'diagnostics',
  ROBOT_VITALS: 'robot_vitals',
  CUSTOM_DATA: 'custom_data',
  CUSTOM_DATA_KEY_VALUES: 'custom_data_key_values', // Deprecated, goes away after IO-876 contract
  ROBOT_KEY_VALUES: 'robot_key_values',
  MISSIONS: 'missions',
  MISSIONS_CONFIG: 'missions_config',

  // Agent management
  MODULE_STATES: 'module_states',

  // Application Server only collections
  AGENT_MODULE_REQUEST: 'agent_module_request',
  AUTHORIZATION_TOKENS: 'authorization_tokens',
  MQTT_CREDENTIALS: 'mqtt_credentials',
  TIMELINE_TOKENS: 'timeline_tokens',
  ROBOT_KEYS_UNBOUND: 'robot_keys_unbound',
  // Used only in the server by MqttAuthManager
  MQTT_SELECTORS: 'mqtt_selectors',
  MQTT_BROKER_DETAILS: 'mqtt_broker_details',

  INTEROP_CONFIG: 'interop_config',
  // Transformations to be applied to spatial data when ingested by the Platform (either by
  // ingest or direct client)
  SPATIAL_TRANSFORMATIONS: 'spatial_transformations',
  // Missions Dispatch & Schedule collections
  MISSION_SCHEDULES: 'mission_schedules',
  MISSION_DEFINITIONS: 'mission_definitions',

  // Traffic Management & Zones
  TRAFFIC_ZONES: 'traffic_zones',
  TRAFFIC_ZONE_TYPES_CONFIG: 'traffic_zone_types_config',
  TRAFFIC_CONFIG_CONFIG: 'traffic_control_config',

  // Notification Channels
  NOTIFICATION_CHANNELS: 'notification_channels',

  // Event Log - when implemented over mongodb
  EVENT_LOG: 'event_log',

  // Time series store for numeric data points
  TIMESERIES: 'timeseries'
};

/**
 * ConfigManager constants
 * NOTE(herchu) ConfigManager still re-exports them, there are way too many modules using them
 */
// system wide configurations ID
const ID_DEFAULT = '0';
const ID_TYPE_ROBOT = 'robot';
const ID_TYPE_ROLE = 'role';
const ID_TYPE_USER = 'user';
const ID_TYPE_SYSTEM_WIDE = 'system';

/**
 * Module States constants
 */
const ID_TYPE_AGENT = 'agent';
const ID_TYPE_CLIENT = 'client'; // reserved for client-side options. NOT part of TYPE_HIERARCHY!
const MODULE_NAMES = {
  CUSTOM_COMMANDS_AGENTLET: 'CustomCommandsAgentlet',
  CUSTOM_DATA_AGENTLET: 'CustomDataAgentlet',
  ROS_DIAGNOSTICS_AGENTLET: 'RosDiagnosticsAgentlet',
  ROS_IMAGE_AGENTLET: 'RosImageAgentlet',
  ROS_LOCALIZATION_AGENTLET: 'RosLocalizationAgentlet',
  ROS_MAP_AGENTLET: 'RosMapAgentlet',
  ROS_MONITORING_AGENTLET: 'RosMonitoringAgentlet',
  ROS_ODOMETRY_AGENTLET: 'RosOdometryAgentlet',
  ROS_TELEOP_AGENTLET: 'RosTeleopAgentlet',
  SYSTEM_AGENTLET: 'SystemAgentlet',
  ROSBAG_AGENTLET: 'RosbagAgentlet'
};

const MODULE_AVAILABLE_KEYS = {
  CUSTOM_SCRIPTS: 'available_custom_scripts',
  DIAGNOSTICS_KEYS: 'available_diagnostics_keys',
  DIAGNOSTICS_TOPICS: 'available_diagnostics_topics',
  CAMERA_TOPICS: 'available_camera_topics',
  COSTMAP_TOPICS: 'available_costmap_topics',
  LASER_TOPICS: 'available_laser_topics',
  MAP_TOPICS: 'available_map_topics',
  SET_POSE_TOPICS: 'available_set_pose_topics',
  NAV_GOAL_TOPICS: 'available_nav_goal_topics',
  PATH_TOPICS: 'available_path_topics',
  ROS_NODES: 'available_ros_nodes',
  ROS_PARAMS: 'available_ros_params',
  ROS_TOPICS: 'available_ros_topics',
  CMD_VEL_TOPICS: 'available_cmd_vel_topics',
  HDD_PARTITIONS: 'available_hdd_partitions',
  NETWORK_INTERFACES: 'available_network_interfaces'
};

// Constant to use the HTML title by default
const DEFAULT_HTML_TITLE = 'OpenRobOps';

// Define all valid characters for input IDs.
// We can add almost anything, but never '/' or ':'
const VALID_ID_CAPTURE_PATTERN = '[-0-9a-zA-Z_]+';
const VALID_ID_REGEXP = new RegExp('^' + VALID_ID_CAPTURE_PATTERN + '$');

// Defines different types of reference frames for robot poses
// 'image' refers to the initially-supported type of reference, based on a
// local reference frame, nominally called 'map', with comes normally associated
// to an pixel image that represents an obstacle grid or a prettyfied 2D planogram.
// 'navsat' refers to an outdoors environment on the surface of the earth, using
// a 2D cartesian projection, most normally UTM.
const LOCALIZATION_MAP_TYPES = {
  IMAGE: 'image',
  NAV_SAT: 'navsat'
};

// Useful empty function to use as default parameter for callbacks, to avoid
// creating new ones on re-renders (React-side)
const EMPTY_FUNCTION = () => {};

// Useful empty object to use as default parameter to prevent unnecessary re-renders (React-side)
const EMPTY_OBJECT = {};

// Useful empty array to use as default parameter to avoid re-renders (React-side)
const EMPTY_ARRAY = [];

// Magic update timestamp value to identify ghost robots (testing / demos)
// Used in timestamp values (agentOnline, status, data source ts, etc.)
const HACK_GHOST_UPDATE_STAMP_VALUE = 12;

// Key to group the aggregated status for a robot or entity
const AGG_STATUSES_KEY = 'aggregated status';

const SPATIAL_ANNOTATION_TYPES = {
  MAP: 'map',
}

export {
  COLLECTIONS,
  // Configs
  ID_DEFAULT,
  ID_TYPE_SYSTEM_WIDE,
  ID_TYPE_ROBOT,
  ID_TYPE_ROLE,
  ID_TYPE_USER,
  // Module States
  ID_TYPE_AGENT,
  ID_TYPE_CLIENT,
  MODULE_NAMES,
  MODULE_AVAILABLE_KEYS,
  // Misc constants
  DEFAULT_HTML_TITLE,
  VALID_ID_CAPTURE_PATTERN,
  VALID_ID_REGEXP,
  LOCALIZATION_MAP_TYPES,
  HACK_GHOST_UPDATE_STAMP_VALUE,
  EMPTY_FUNCTION,
  EMPTY_OBJECT,
  EMPTY_ARRAY,
  AGG_STATUSES_KEY,
  SPATIAL_ANNOTATION_TYPES,
};
