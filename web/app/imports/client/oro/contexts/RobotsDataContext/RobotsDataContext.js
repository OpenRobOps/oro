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
 * This context handles data from robots, providing it to any users
 * through useRobotsDataContext. It is mainly used for Localization and this is its
 * first implementation, although it is not specific to LocalizationData.
 *
 * Data updates are handled via 'actions' through the context dispatch function.
 * These can take the form of updating data coming from a source (DDP, fetch, mqtt)
 * or changing the 'requests' for data to be displayed and requested.
 *
 * This module is Meteor-independent; it must not be confused with what currently
 * lives in LocalizationDataProvider.js which handles data fetching.
 */
import React from 'react';
import { get as lodashGet } from 'lodash';
import {
  SET_MAP,
  SET_RTT_DATA,
  SET_ROBOT_LOCALIZATION_DATA,
  SET_MULTIPLE_ROBOTS_LOCALIZATION_DATA,
  SET_ROBOT_DETAILS,
} from '../../robotWidgets/LocalizationWidget/LocalizationDataTypes';

// Main context. It is not exported, but accessed via its Provider and hook
const RobotsDataContext = React.createContext(null);
RobotsDataContext.displayName = 'robotsDataContext';

/**
 * Builds an initial context state. It is normally an empty state, although
 * it may also receive static initial data from a fixture.
 *
 * The only allowed props for the initial state are:
 *  - dataSources: Hooks that define data fetching strategies
 *  - robotsLocalizationData, used for fixtures
 */
function init(props = {}) {
  const { robotsLocalizationData = {}, dataSources = {} } = props;
  return {
    robotsLocalizationData,
    dataSources
  };
}

/**
 * Combine the known localization state of a robot with a new received state. These two objects
 * contain { costmap, laserRanges, paths, robotPose... }, and are receiving part of this data
 * through DDP and part through MQTT. This function takes special care of not "moving back in time"
 * the robot pose, which is coming though both channels.
 */
function mergeSingleRobotLocalizationData(
  previousLocalization,
  newLocalization
) {
  if (!newLocalization) {
    // Since this functions is part of a reducer, which receives data from various
    // sources, allow to gracefully handle 'no updates' - simply stay in the same state.
    return previousLocalization;
  }
  if (!previousLocalization) {
    // First data received for a robot
    return newLocalization;
  }
  // Combine both localization pieces into one
  const nextLocalization = { ...previousLocalization, ...newLocalization };

  // Only update robotPose if the timestamp is newer than the existing one we have
  const previousRobotPoseTs = lodashGet(previousLocalization, 'robotPose.ts', 0);
  const newRobotPoseTs = lodashGet(newLocalization, 'robotPose.ts', 0);
  // Keeps previous localization lasers if new localization doesn't have any
  if (previousLocalization?.laserRanges && !newLocalization?.laserRanges) {
    nextLocalization.laserRanges = previousLocalization.laserRanges;
    // Checks if there are any previous lasers that weren't included in newLocalization
    // and make sure to copy them
  } else if (previousLocalization.laserRanges && newLocalization.laserRanges) {
    Object.keys(previousLocalization.laserRanges).forEach((k) => {
      if (!(k in newLocalization.laserRanges)) {
        nextLocalization.laserRanges[k] = previousLocalization.laserRanges[k];
      }
    });
  }
  if (previousRobotPoseTs >= newRobotPoseTs) {
    nextLocalization.robotPose = previousLocalization.robotPose;
    // NOTE: Laser and pose are updated at the same time in both Mongo and MQTT methods
    // so for this reason, if we prevent updating pose, we also prevent updating lasers
    nextLocalization.laserRanges = previousLocalization.laserRanges;
  }

  // Be careful with path updates, which may be partial (updating only one path) or outdated
  if (newLocalization.paths && previousLocalization.paths) {
    // For any new path that we received an update for, if we had a previous one with a newer
    // timestamp, keep the previous one
    Object.keys(newLocalization.paths).forEach((k) => {
      if (previousLocalization.paths[k]
        && previousLocalization.paths[k].ts > nextLocalization.paths[k].ts) {
        nextLocalization.paths[k] = previousLocalization.paths[k];
      }
    });
    // Also check if there are any previous paths that weren't included in newLocalization
    // and make sure to copy them
    Object.keys(previousLocalization.paths).forEach((k) => {
      if (!(k in newLocalization.paths)) {
        nextLocalization.paths[k] = previousLocalization.paths[k];
      }
    });
  }
  return nextLocalization;
}

/**
 * Combines an existing previousLocalizationState containing the robotsLocalizationData
 * for a set of robots with a new data set.
 *
 * Both arguments are objects indexed by robotId, containing their localization data; the return
 * value has the same format: the next state with all these robots localization data updated.
 */
function mergeRobotsLocalizationData(
  previousLocalizationState = {},
  newLocalizationState
) {
  const nextLocalizationState = { ...previousLocalizationState };
  Object.keys(newLocalizationState).forEach((robotId) => {
    nextLocalizationState[robotId] = mergeSingleRobotLocalizationData(
      previousLocalizationState[robotId],
      newLocalizationState[robotId]
    );
  });
  return nextLocalizationState;
}

/**
 * Main reducer for RobotsData context: It builds new states based on 'actions'.
 * NOTE: Even if the function is complex, never _change_ the state;
 * consider it immutable and work always with copies of it.
 */
function robotsDataReducer(state, { action, ...args }) {
  switch (action) {
    // Update for a single robot localization data
    case SET_ROBOT_LOCALIZATION_DATA: {
      const { robotId, localizationData } = args;
      if (!localizationData) {
        return state; // nothing to do
      }
      const { robotsLocalizationData = {} } = state;
      return {
        ...state,
        robotsLocalizationData: {
          ...robotsLocalizationData,
          [robotId]: mergeSingleRobotLocalizationData(
            robotsLocalizationData[robotId],
            localizationData
          )
        }
      };
    }
    // Updates localization data for multiple robots at the same time
    case SET_MULTIPLE_ROBOTS_LOCALIZATION_DATA: {
      const { localizationData: newLocalizationData } = args;
      const { robotsLocalizationData = {} } = state;
      return {
        ...state,
        robotsLocalizationData: mergeRobotsLocalizationData(
          robotsLocalizationData,
          newLocalizationData
        )
      };
    }
    // Updates the map for current state
    case SET_MAP: {
      return {
        ...state,
        map: args
      };
    }
    case SET_RTT_DATA: {
      const { robotId, ...rttData } = args;
      return {
        ...state,
        rtt: {
          ...state.rtt,
          [robotId]: rttData
        }
      };
    }
    case SET_ROBOT_DETAILS: {
      const { robots } = args;
      return {
        ...state,
        robotDetails: robots
      };
    }
    default:
      return state;
  }
}

/**
 * Hook to access RobotsDataContext; it provides the context state
 * and dispatch function to users. Any user of useRobotsDataContext needs
 * to be in a context wrapped by RobotsDataProvider.
 */
function useRobotsDataContext() {
  const context = React.useContext(RobotsDataContext);
  if (!context) {
    throw new Error('useRobotsDataContext must be used within a RobotsDataProvider');
  }
  const [state, dispatch] = context;
  return {
    state,
    dispatch
  };
}

/**
 * Context provider. It keeps an internal state, which is the value of the
 * context, and provides a dispatch function responsible for mutating this
 * context given 'actions' (see below).
 */
function RobotsDataProvider(props) {
  const [state, dispatch] = React.useReducer(robotsDataReducer, props, init);
  const value = React.useMemo(() => [state, dispatch], [state]);
  return <RobotsDataContext.Provider value={value} {...props} />;
}

// TODO: validate that dataSource exists in SOURCES
function useDataSource(state, dispatch, dataSource, args) {
  const { dataSources } = state;
  if (dataSources && Array.isArray(dataSources[dataSource])) {
    const hooks = dataSources[dataSource];
    hooks.forEach(hook => hook(dispatch, args));
  }
  return state;
}

/**
 * Wrapper function to turn the data retrieving functions (written as hooks) into
 * our DataSources that dispatch the data into the RobotsDataContext.
 *
 * @param useHook The hook to wrap
 * @param actionBuilder A function that creates an "action" (in Context terms) to be
 *        sent to the context dispatch() function.
 */
const wrapHookAsDataSource = (useHook, actionBuilder) => (function (dispatch, args) {
  useHook(args, (data) => {
    const action = actionBuilder(data, args);
    // if the actionBuilder decides the data is invalid and returns null, do not dispatch it
    action && dispatch(action);
  });
});

export {
  RobotsDataProvider,
  useRobotsDataContext,
  // data source connectors
  useDataSource,
  wrapHookAsDataSource
};
