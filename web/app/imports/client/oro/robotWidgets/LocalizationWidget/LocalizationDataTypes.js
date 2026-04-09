import { LOCALIZATION_MAP_TYPES } from '../../../../shared/constants';

/**
 * Data-type declarations specific for Localization widget, for all information shared
 * and processed through the RobotsDataContext.
 * These declarations are source-agnostic, meaning they only represent the data we
 * store in the state (context) and how we dispatch it to this context, but not where it
 * comes from (Meteor, DirectClient).
 */
const SET_ROBOT_LOCALIZATION_DATA = 'set_robot_localization_data';
const SET_MULTIPLE_ROBOTS_LOCALIZATION_DATA = 'set_robots_localization_data';
const SET_MAP = 'set_map';
const SET_RTT_DATA = 'set_rtt_data';
const SET_ROBOT_DETAILS = 'set_robot_details';

// The list of all data source types for localization
const LOCALIZATION_DATA_TYPE = {
  LOCALIZATION: 'localization',
  MAP: 'map',
  RTT: 'RTT',
  DETAILS: 'RobotDetails'
};

/**
 * Action to update a single robot's localization data.
 */
function singleRobotLocalizationData({ robotId, localizationData }) {
  return {
    robotId,
    localizationData,
    action: SET_ROBOT_LOCALIZATION_DATA
  };
}

/**
 * Action to update the current map
 *
 * @param args contains:
 *  - mapUrl A signed URL for the map
 *  - isLoading
 */
function mapData(args) {
  const { mapUrl, type } = args;
  if (mapUrl || type === LOCALIZATION_MAP_TYPES.NAV_SAT) {
    return {
      ...args,
      action: SET_MAP
    };
  } // otherwise returns null, and the map is not dispatched as an update
  return null;
}

/**
 * Action to update multiple robots' localization data.
 *
 * @param args contains:
 *  - localizationData: map from robotId to localizationData for each robot
 *    (robotPose, laserRanges, ...)
 *  - isLoading
 */
function multipleRobotsLocalizationData(args) {
  return {
    ...args,
    action: SET_MULTIPLE_ROBOTS_LOCALIZATION_DATA
  };
}

/*
 * Action builder to dispatch RTT data updates from a single robot
 */
function rttData(data, { robotId }) {
  return {
    ...data,
    robotId,
    action: SET_RTT_DATA
  };
}

function robotDetailsData(data, { robotIds }) {
  return {
    ...data,
    robotIds,
    action: SET_ROBOT_DETAILS
  };
}

export {
  // Types of Localization data shared through the RobotsDataContext
  LOCALIZATION_DATA_TYPE,
  // dispatch message types
  SET_MAP,
  SET_RTT_DATA,
  SET_ROBOT_LOCALIZATION_DATA,
  SET_MULTIPLE_ROBOTS_LOCALIZATION_DATA,
  SET_ROBOT_DETAILS,
  // dispatch messages
  singleRobotLocalizationData,
  multipleRobotsLocalizationData,
  mapData,
  rttData,
  robotDetailsData
};
