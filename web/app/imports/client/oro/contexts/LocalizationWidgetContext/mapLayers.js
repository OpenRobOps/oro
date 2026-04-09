/**
 * Layer constants
 * for more information check design doc:
 * https://docs.google.com/document/d/1l1LRlNc4M-QS6n66O3Crdga9wZychVFve2LdI41EUHk/edit#heading=h.y21jxakbjmvv)
 */
const NAVIGATION_MAP_LAYER_COSTMAP = 'costmap';
const NAVIGATION_MAP_LAYER_POSE_OUTLINE = 'poseOutline';
const NAVIGATION_MAP_LAYER_LIDARS = 'lidars';
const NAVIGATION_MAP_LAYER_PATHS = 'paths';
const NAVIGATION_MAP_LAYER_ROBOT_NAMES = 'robotNames';
const NAVIGATION_MAP_LAYER_NAMED_WAYPOINTS = 'namedWaypoints';
const NAVIGATION_MAP_LAYER_NAMED_ZONES = 'namedZones';
const NAVIGATION_MAP_LAYER_EDGES = 'edges';
const NAVIGATION_MAP_FILTER_LAYER_ZONE_NAMES = 'zoneNamesFilter';
const NAVIGATION_MAP_FILTER_LAYER_ZONE_TYPES = 'zoneTypesFilter';

/**
 * List with all the necessary information to display the layers on the map
 *  - id: The id that identifies the layer
 *  - label: The name of the layer that's going to be displayed in the selector
 *           in Navigation Control Bar
 *  - defaultState: <optional> the default state of the layer
 */
const MAP_LAYERS = [
  {
    id: NAVIGATION_MAP_LAYER_COSTMAP,
    label: 'Costmap',
    defaultState: {
      isVisible: true
    }
  },
  {
    id: NAVIGATION_MAP_LAYER_LIDARS,
    label: 'Lidar',
    defaultState: {
      isVisible: true
    }
  },
  {
    id: NAVIGATION_MAP_LAYER_POSE_OUTLINE,
    label: 'Outline',
    defaultState: {
      isVisible: true
    }
  },
  {
    id: NAVIGATION_MAP_LAYER_PATHS,
    label: 'Path',
    defaultState: {
      isVisible: true
    }
  },
  {
    id: NAVIGATION_MAP_LAYER_ROBOT_NAMES,
    label: 'Name',
    defaultState: {
      isVisible: false
    }
  },
  {
    id: NAVIGATION_MAP_LAYER_NAMED_WAYPOINTS,
    label: 'Waypoint',
    defaultState: {
      isVisible: false,
      isEditable: true
    }
  },
  {
    id: NAVIGATION_MAP_LAYER_NAMED_ZONES,
    label: 'Zone',
    defaultState: {
      isVisible: false,
      isEditable: true
    },
    subMenu: [
      {
        id: NAVIGATION_MAP_FILTER_LAYER_ZONE_TYPES
      }
    ]
  },
  {
    id: NAVIGATION_MAP_LAYER_EDGES,
    label: 'Edge',
    defaultState: {
      isVisible: false
    }
  }
];

export {
  MAP_LAYERS,
  NAVIGATION_MAP_LAYER_COSTMAP,
  NAVIGATION_MAP_LAYER_LIDARS,
  NAVIGATION_MAP_LAYER_POSE_OUTLINE,
  NAVIGATION_MAP_LAYER_PATHS,
  NAVIGATION_MAP_LAYER_ROBOT_NAMES,
  NAVIGATION_MAP_LAYER_NAMED_WAYPOINTS,
  NAVIGATION_MAP_LAYER_NAMED_ZONES,
  NAVIGATION_MAP_LAYER_EDGES,
  NAVIGATION_MAP_FILTER_LAYER_ZONE_NAMES,
  NAVIGATION_MAP_FILTER_LAYER_ZONE_TYPES
};
