/**
 * Functions and constants for setting UI preferences; shared with client code.
 */
import SimpleSchema from 'simpl-schema';
import { pick } from 'lodash';
// ORO modules
// Re-export constants, to allow for incrementally porting code from /lib to /shared
import {
  GROUP_ID_NONE, GROUP_LABEL_NONE, SECTION_SCOPES
} from '../shared/uiPreferences';

// Some widget key names inside the uiPrefs object
const GROUND_CONTROL_WIDGET = 'groundControlWidget';
const FLEET_STATUS_WIDGET = 'fleetStatusWidget';
const APPBAR_WIDGET = 'appBar';
const NAVIGATION_DETAIL_WIDGET = 'navigationDetail';
const TIME_CAPSULE_WIDGET = 'timeCapsule';
const ACTIONS_PREFERENCES_FIELD = 'actions';
const DASHBOARDS = 'dashboards';
// Some key names found inside widgets (listed above)
const EMBEDDED_ACTION_KEY = 'embeddedActions';
const MAPS_LIST_KEY = 'mapsList';
const SPEED_GAUGE_WIDGET = 'speedometers';
// Field name under uiPreferences holding a config of a pattern of the html title
const HTML_TITLE_PATTERN = 'htmlTitlePattern';
// Field name under uiPreferences used in PoseDataComponent to customize a button
const EXTERNAL_MAP_LINK = 'externalMapLink';

const WIDGET_CONFIG = {
  SMALL_GRID: 4,
  SMALL_PLUS_GRID: 6,
  MEDIUM_GRID: 8,
  MEDIUM_PLUS_GRID: 10,
  LARGE_GRID: 12
};

// Defaults for layout objects
const NAVIGATION_DETAIL_LAYOUT_DEFAULTS = {
  widgets: {},
  controls: {
    teleop: false // if teleop controls are shown
  },
  maximize: null,
  splitLayout: true,
  splitters: ['70%', '45%'], // default panel sizes (first: vertical, second: horizontal)
  assistEnabled: false,
  allowFocusCamera: false,
};

/**
 * Constants for widget type IDs. These correspond to the _id field in WIDGET_TYPES_LIST
 *
 * These can have any string value... as long as we always use the same.
 */
const WIDGET_TYPES = {
  CHART: 'chart',
  // CUSTOM_COMMANDS: 'customCommands',
  // ROS_DIAGNOSTICS: 'diagnostics',
  VITALS: 'vitals',
  // DATA_BAGS: 'dataBags',
  // LOCALIZATION: 'localization',
  // KEY_VALUES: 'keyValues',
  // CUSTOM_DATA: 'customData',
  // LOGS: 'logsWidget',
  // ACTIONS: 'actionsWidget',
  // CAMERA: 'cameraWidget',
  // AUDIT_LOG: 'auditLog',
  // LIST_DATA: 'listData'
};

// Definitive Object listing all IDs for all of our widgets
const WIDGET_TYPES_IDS = {
  // Fleet Widgets
  FLEET_STATUS: 'fleetStatus',
  ROBOT_SEARCH: 'robotSearch',
  FLEET_CONTROL: 'fleetControl',
  INCIDENT_TIMELINE: 'incidentTimeline',
  INCIDENT_LIST: 'incidentList',
  // Start robot widgets
  NAVIGATION: 'navigation',
  CHART: 'chart',
  IMAGE: 'image',
  ROBOT_CONTROL_BAR: 'robotControlBar',
  ROS_DIAGNOSTICS: 'diagnostics',
  VITALS: 'vitals',
  DATA_BAGS: 'dataBags',
  LOCALIZATION: 'localization',
  KEY_VALUES: 'keyValues',
  LOGS: 'logsWidget',
  ACTIONS: 'actionsWidget',
  CAMERA: 'cameraWidget',
  AUDIT_LOG: 'auditLog',
  AUDIT_LOG_FLEET: 'auditLogFleet',
  LIST_DATA: 'listData',
  CUSTOM_DATA_IMAGE: 'customDataImage',
  CUSTOM_DATA_TEXT: 'customDataText',
  HISTORY: 'history',
  // Navigation widgets
  NAVIGATION_CONTROL_BAR: 'navigationControlBar',
  // Time Capsule
  TIME_CAPSULE_MAP: 'timeCapsuleMap',
  TIME_CAPSULE_CONTROL_BAR: 'timeCapsuleControlBar',
  TIME_CAPSULE_SEGMENT_LOGS: 'timeCapsuleSegmentLogs',
  TIME_CAPSULE_AUDIT_LOGS: 'timeCapsuleAuditLogs',
  TIME_CAPSULE_DATA_BAGS: 'timeCapsuleDataBags',
  TIME_CAPSULE_CAMERA_IMAGES: 'timeCapsuleCameraImages',
  TIME_CAPSULE_AI_SUMMARY: 'timeCapsuleAISummary',
  TIME_CAPSULE_ROS_DIAGNOSTICS: 'timeCapsuleRosDiagnostics',
  // Mission & Orders widgets
  MISSION_TRACKER: 'missionTracker',
  FLEET_MISSION_TRACKER: 'fleetMissionTracker',
  MISSION_CONTROL_BAR: 'missionControlBar',
};

// A group is not a widget by itself, but it allows grouping several widgets in a box
const WIDGET_TYPE_GROUP = '__group__';

const WIDGET_TYPES_LIST = [
  {
    _id: WIDGET_TYPES_IDS.INCIDENT_LIST,
    contextType: 'incident',
    label: 'Incident List',
    configurable: true,
    unique: true,
    defaultLayout: {
      grid: WIDGET_CONFIG.MEDIUM_GRID,
      chroma: true,
      height: 1
    },
    defaultConfig: {},
    scope: SECTION_SCOPES.FLEET,
    imgLocation: '/images/thumbnails/thumb_incident list.svg'
  },
  {
    _id: WIDGET_TYPES_IDS.INCIDENT_TIMELINE,
    contextType: 'incident',
    label: 'Incident Timeline',
    configurable: true,
    unique: true,
    defaultLayout: {
      grid: WIDGET_CONFIG.LARGE_GRID,
      chroma: true,
      height: 1
    },
    defaultConfig: {},
    scope: SECTION_SCOPES.FLEET,
    imgLocation: '/images/thumbnails/thumb_incident timeline.svg'
  },
  {
    _id: WIDGET_TYPES_IDS.FLEET_STATUS,
    contextType: 'fleet',
    label: 'Fleet Status',
    configurable: true,
    unique: true,
    defaultLayout: {
      grid: WIDGET_CONFIG.LARGE_GRID,
      chroma: true
    },
    defaultConfig: {},
    scope: SECTION_SCOPES.FLEET,
    imgLocation: '/images/thumbnails/thumb_fleet.svg'
  },
  {
    _id: WIDGET_TYPES_IDS.FLEET_CONTROL,
    scope: SECTION_SCOPES.FLEET,
    contextType: 'fleet',
    label: 'Fleet Control',
    configurable: false,
    unique: true,
    defaultLayout: {
      grid: WIDGET_CONFIG.LARGE_GRID
    },
    defaultConfig: {},
    imgLocation: '/images/thumbnails/thumb_fleet ctrl widget.svg'
  },
  // START ROBOT WIDGETS
  {
    _id: WIDGET_TYPES_IDS.ROBOT_CONTROL_BAR,
    contextType: 'robot',
    label: 'Robot Control',
    configurable: false,
    unique: true,
    defaultLayout: {
      grid: WIDGET_CONFIG.LARGE_GRID
    },
    defaultConfig: {},
    scope: SECTION_SCOPES.ROBOT,
    imgLocation: '/images/thumbnails/thumb_robot ctrl.svg'
  },
  {
    _id: WIDGET_TYPES.CHART,
    label: 'Timeline',
    configurable: true,
    defaultLayout: {
      grid: WIDGET_CONFIG.MEDIUM_GRID,
      chroma: true,
      height: 1
    },
    scope: SECTION_SCOPES.ROBOT,
    defaultConfig: {
      min: 0,
      max: 100,
      chartType: 'linechart'
    },
    imgLocation: '/images/thumbnails/thumb_timeline.svg'
  },
  {
    _id: WIDGET_TYPES.VITALS,
    label: 'Vitals',
    default: true,
    configurable: true,
    defaultLayout: {
      grid: WIDGET_CONFIG.SMALL_GRID,
      chroma: true,
      height: 1
    },
    defaultConfig: {},
    scope: SECTION_SCOPES.ROBOT,
    imgLocation: '/images/thumbnails/thumb_vitals.svg'
  },
  {
    _id: WIDGET_TYPES_IDS.NAVIGATION,
    label: 'Navigation',
    default: true,
    unique: true,
    defaultLayout: {
      grid: WIDGET_CONFIG.LARGE_GRID,
      height: 2
    },
    defaultConfig: {},
    scope: SECTION_SCOPES.NAVIGATION,
    imgLocation: '/images/thumbnails/thumb_navigation detail.svg'
  },
  {
    _id: WIDGET_TYPES.LOCALIZATION,
    label: 'Map',
    default: true,
    unique: true,
    configurable: true,
    defaultLayout: {
      grid: WIDGET_CONFIG.SMALL_GRID,
      chroma: true,
      height: 1
    },
    defaultConfig: {},
    scope: SECTION_SCOPES.ROBOT,
    imgLocation: '/images/thumbnails/thumb_map.svg'
  },
  {
    _id: WIDGET_TYPES.ROS_DIAGNOSTICS,
    label: 'ROS Diagnostics',
    default: true,
    unique: true,
    defaultLayout: {
      grid: WIDGET_CONFIG.SMALL_GRID,
      chroma: true,
      height: 1
    },
    defaultConfig: {},
    scope: SECTION_SCOPES.ROBOT,
    imgLocation: '/images/thumbnails/thumb_ros diagnostic.svg'
  },
  {
    _id: WIDGET_TYPES.DATA_BAGS,
    label: 'Data Bags',
    default: true,
    unique: true,
    defaultLayout: {
      grid: WIDGET_CONFIG.SMALL_GRID,
      chroma: true,
      height: 1
    },
    defaultConfig: {},
    scope: SECTION_SCOPES.ROBOT,
    imgLocation: '/images/thumbnails/thumb_data bags.svg'
  },
  {
    _id: WIDGET_TYPES.KEY_VALUES,
    label: 'Key-value Sources',
    unique: true,
    default: true,
    defaultLayout: {
      grid: WIDGET_CONFIG.SMALL_GRID,
      chroma: true,
      height: 1
    },
    defaultConfig: {},
    scope: SECTION_SCOPES.ROBOT,
    imgLocation: '/images/thumbnails/thumb_key value sources.svg'
  },
  {
    _id: WIDGET_TYPES_IDS.CUSTOM_DATA_TEXT,
    label: 'Log files',
    defaultLayout: {
      grid: WIDGET_CONFIG.SMALL_GRID,
      chroma: true,
      height: 1
    },
    defaultConfig: {},
    scope: SECTION_SCOPES.ROBOT,
    imgLocation: '/images/thumbnails/thumb_text file.svg'
  },
  {
    _id: WIDGET_TYPES_IDS.CUSTOM_DATA_IMAGE,
    label: 'Custom Image',
    defaultLayout: {
      grid: WIDGET_CONFIG.SMALL_GRID,
      chroma: true,
      height: 1
    },
    defaultConfig: {},
    scope: SECTION_SCOPES.ROBOT,
    imgLocation: '/images/thumbnails/thumb_custom image.svg'
  },
  {
    _id: WIDGET_TYPES.LOGS,
    label: 'ROS out',
    unique: true,
    defaultLayout: {
      grid: WIDGET_CONFIG.SMALL_GRID,
      chroma: true,
      height: 1
    },
    defaultConfig: {},
    scope: SECTION_SCOPES.ROBOT,
    imgLocation: '/images/thumbnails/thumb_ros out.svg'
  },
  {
    _id: WIDGET_TYPES.ACTIONS,
    label: 'Robot Actions',
    unique: true,
    defaultLayout: {
      grid: WIDGET_CONFIG.SMALL_GRID,
      chroma: true,
      height: 1
    },
    defaultConfig: {},
    scope: SECTION_SCOPES.ROBOT,
    imgLocation: '/images/thumbnails/thumb_robot actions.svg'
  },
  {
    _id: WIDGET_TYPES.CAMERA,
    label: 'Camera',
    configurable: true,
    defaultLayout: {
      grid: WIDGET_CONFIG.SMALL_GRID,
      chroma: true,
      height: 1
    },
    defaultConfig: {
      cameraId: '0'
    },
    scope: SECTION_SCOPES.ROBOT,
    imgLocation: '/images/thumbnails/thumb_camera.svg'
  },
  {
    _id: WIDGET_TYPES_IDS.AUDIT_LOG,
    label: 'Audit Log',
    configurable: false,
    unique: true,
    defaultLayout: {
      grid: WIDGET_CONFIG.SMALL_GRID,
      chroma: true,
      height: 1
    },
    defaultConfig: {},
    scope: SECTION_SCOPES.ROBOT,
    imgLocation: '/images/thumbnails/thumb_audit log.svg'
  },
  {
    _id: WIDGET_TYPES_IDS.AUDIT_LOG_FLEET,
    label: 'Fleet Log',
    configurable: false,
    unique: true,
    defaultLayout: {
      grid: WIDGET_CONFIG.SMALL_GRID,
      chroma: true,
      height: 1
    },
    defaultConfig: {},
    scope: SECTION_SCOPES.FLEET,
    imgLocation: '/images/thumbnails/thumb_audit log.svg'
  },
  {
    _id: WIDGET_TYPES.LIST_DATA,
    label: 'List Data',
    configurable: true,
    defaultLayout: {
      grid: WIDGET_CONFIG.SMALL_GRID,
      chroma: true,
      height: 1
    },
    defaultConfig: {},
    scope: SECTION_SCOPES.ROBOT,
    imgLocation: '/images/thumbnails/thumb_list data.svg'
  },
  {
    _id: WIDGET_TYPES_IDS.MISSION_TRACKER,
    label: 'Missions',
    configurable: false,
    defaultLayout: {
      grid: WIDGET_CONFIG.SMALL_GRID,
      chroma: true,
      height: 1
    },
    defaultConfig: {},
    scope: SECTION_SCOPES.ROBOT,
    imgLocation: '/images/thumbnails/thumb_missions.svg'
  },
  {
    _id: WIDGET_TYPES_IDS.FLEET_MISSION_TRACKER,
    label: 'Missions',
    configurable: false,
    defaultLayout: {
      grid: WIDGET_CONFIG.SMALL_GRID,
      chroma: true,
      height: 1
    },
    defaultConfig: {},
    scope: SECTION_SCOPES.FLEET,
    imgLocation: '/images/thumbnails/thumb_missions.svg'
  },
  // NOTE(herchu) When adding a new widget type, also add its config conversion to and from
  // Config API specs, in server/configAPI/dashboards.js#WidgetConfigConvertersByType
  // (Please leave this note at the end of this list)
];

const UI_PREFS_FIELDS = {
  // Top level elements
  MAP: 'map',
  CAMERAS: 'cameras',
  // Elements within MAP
  MAP__COSTMAP: 'costmap'
};

const VITAL_ELEMENT_GAUGE = 'gauge';
const VITAL_ELEMENT_TEXT = 'text';
const VITAL_ELEMENT_HIDDEN = 'hidden';
const VITALS_ELEMENT_TYPES = [
  { _id: VITAL_ELEMENT_TEXT, name: 'Text' },
  { _id: VITAL_ELEMENT_GAUGE, name: 'Gauge' }
];

const TIMELINE_CHART_OPS_LIST = [
  { _id: 'average', name: 'Average' },
  { _id: 'count', name: 'Count' },
  { _id: 'maximum', name: 'Maximum' },
  { _id: 'minimum', name: 'Minimum' },
  { _id: 'sum', name: 'Sum' },
  { _id: 'last', name: 'Last' },
];

// Possible widget element types
const CHART_TYPES = [
  { _id: 'areachart', name: 'Area' },
  { _id: 'linechart', name: 'Lines' }
];

const DEFAULT_TIMELINE_OP = 'average';

/**
 * Returns the visual element type to use for a given attribute definition by default.
 * Percentages get Gauges, anything else gets Text.
 */
const decideVitalsWidgetElementType = attrDef => (
  attrDef && attrDef.unit == '%' ? VITAL_ELEMENT_GAUGE : VITAL_ELEMENT_TEXT
);

/**
 * Returns the list of robot attribute's fields that need to be propagated
 * to UI preferences objects: label, precision, unit, etc.
 *
 * See also projectAttributeUIFields
 */
const listAttributeUIFields = () => [
  'label', 'precision', 'unit', 'naValue', 'naLabel', 'modeId', 'enabledModes'
];

/**
 * Selects all fields from an attribute definition that need to be
 * propagated to UI objects (see listAttributeUIFields). It returns a 'sub
 * object' of attrDef, with only the fields listed by listAttributeUIFields.
 */
const projectAttributeUIFields = attrDef => (
  pick(attrDef, listAttributeUIFields())
);

// Constants for widget names in props
const NAVIGATION_DETAIL_WIDGET_TYPES = {
  MAP: 'map', // the robot's map with localization info
  CAMERA: 'camera', // all cameras, except one marked as 'distinguished'
  CONTROLS: 'controls', // teleop controls
  RTL: 'rtl', // swaps the vertical split right-to-left, to use teleop controls with left hand
  DISTINGUISHED_CAMERA: 'distinguishedCamera' // a 'distinguished camera' (aka. costmap in some impl.)
};

// Field name under navigationDetail holding the layouts configuration
const NAVIGATION_DETAIL_LAYOUTS_ELEMENT = 'layouts';

// The following schema validates the map.costmap element in ui_preferences.
// TODO(herchu) Collection UIPreferences MUST be brought to this file, from ./collections.js!
//              (It's a big change as it is imported from everywhere and it requires testing)
// Design doc:
// https://docs.google.com/document/d/1xSNJBRpL51DR40NzzTuGeHS3XO5IaNgpmRTNrAC7NtU/edit#heading=h.xwlpyfoccfb7
// TODO(herchu) move UIPreferences collection from lib/collections to this file.
const Schemas = {};
const RGBArrayValidator = arr => (
  arr !== undefined && (!Array.isArray(arr) || arr.length != 3)
    ? 'RGB array must contain exacly 3 elements'
    : null
);
const RGBElementValidator = n => (
  (n < 0 || n > 255)
    ? 'RGB values must be between 0 and 255, inclusive'
    : null
);
Schemas.CostmapPreference = new SimpleSchema({
  alphaValue: { type: Number, optional: true },
  // gradientColor is an RGB array with values 0-255
  gradientStartColor: { type: Array, optional: true, custom: RGBArrayValidator },
  'gradientStartColor.$': { type: Number, custom: RGBElementValidator },
  gradientEndColor: { type: Array, optional: true, custom: RGBArrayValidator },
  'gradientEndColor.$': { type: Number, custom: RGBElementValidator },
  lethalColor: { type: Array, optional: true, custom: RGBArrayValidator },
  'lethalColor.$': { type: Number, custom: RGBElementValidator },
  lethalThreshold: { type: Number, optional: true },
  isAlphaGradient: { type: Boolean, optional: true }
});
// The following schema validates the map.pose element in ui_preferences.
// Description of the fields can be found in web/imports/lib/collections.js
Schemas.PosePreferenece = new SimpleSchema({
  // Footprint: array of [x, y] pairs
  footprint: {
    type: Array,
    minCount: 3,
    optional: true,
  },
  'footprint.$': {
    type: Array,
    minCount: 2,
    maxCount: 2,
  },
  'footprint.$.$': {
    type: Number,
  },
  // Buffer footprint: array of [x, y] pairs
  bufferFootprint: {
    type: Array,
    minCount: 3,
    optional: true,
  },
  'bufferFootprint.$': {
    type: Array,
    minCount: 2,
    maxCount: 2,
  },
  'bufferFootprint.$.$': {
    type: Number,
  },
  radius: { type: Number, optional: true },
  // border color (except when selected, same color for all)
  primaryColor: { type: String, optional: true },
  // fill color. Defaults to light gray
  secondaryColor: { type: String, optional: true },
  // optional opacity; defaults to 1. When selected, opacity is always 1
  opacity: { type: Number, optional: true },
});

export {
  CHART_TYPES,
  NAVIGATION_DETAIL_WIDGET_TYPES,

  WIDGET_TYPES,
  WIDGET_TYPES_IDS,
  WIDGET_TYPES_LIST,
  WIDGET_TYPE_FEATURE_FLAGS,
  WIDGET_TYPE_GROUP,

  VITALS_ELEMENT_TYPES,
  VITAL_ELEMENT_GAUGE,
  VITAL_ELEMENT_TEXT,
  VITAL_ELEMENT_HIDDEN,

  // Widget ids for UI Preferences
  TIME_CAPSULE_WIDGET,
  GROUND_CONTROL_WIDGET,
  FLEET_STATUS_WIDGET,
  APPBAR_WIDGET,
  NAVIGATION_DETAIL_WIDGET,
  ACTIONS_PREFERENCES_FIELD,
  DASHBOARDS,
  WIDGET_CONFIG,
  SECTION_SCOPES,
  SECTION_SCOPE_FEATURE_FLAGS,

  // Key ids for some UI preferences
  SPEED_GAUGE_WIDGET,
  UI_PREFS_FIELDS,
  EMBEDDED_ACTION_KEY,
  MAPS_LIST_KEY,
  GROUP_ID_NONE,
  GROUP_LABEL_NONE,
  HTML_TITLE_PATTERN,
  EXTERNAL_MAP_LINK,
  // Other keys
  NAVIGATION_DETAIL_LAYOUTS_ELEMENT, // element to hold layouts config in navigation detail
  NAVIGATION_DETAIL_LAYOUT_DEFAULTS, // default values for the navigation detail layout

  TIMELINE_CHART_OPS_LIST,
  DEFAULT_TIMELINE_OP,

  // Collections and schemas
  Schemas,

  // Functions
  decideVitalsWidgetElementType,
  listAttributeUIFields,
  projectAttributeUIFields,
};
