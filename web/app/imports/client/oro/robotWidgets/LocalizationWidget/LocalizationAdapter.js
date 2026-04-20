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
 * Localization data provider
 *
 * The responsibility of this component is to integrate Meteor and MQTT
 * data sources and pass them down appropriately to the Localization
 * visual component.
 *
 * NOT METEOR AGNOSTIC
 *
 * TODO: Support for multiple robots
 * TODO: Support different bandwidth modes (e.g.: overview vs. focus) aka lowBandwidth
 */
import { Meteor } from 'meteor/meteor';
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { isEmpty, keyBy } from 'lodash';
import Localization from './Localization';
import { LOCALIZATION_DATA_TYPE } from './LocalizationDataTypes';
import {
  useDataSource, useRobotsDataContext
} from '../../contexts/RobotsDataContext/RobotsDataContext';
import WithNoDataMessage from '../../util/WithNoDataMessage';
import Map from './Map';

// Constant arrays to avoid new objects and re-renders
const EMPTY_ANNOTATIONS_LIST = [];

// Inline subObject helper: returns a new object containing only the given keys
function pickKeys(object, keys) {
  if (!object || !keys) return {};
  return Object.fromEntries(
    keys.filter(k => Object.prototype.hasOwnProperty.call(object, k)).map(k => [k, object[k]])
  );
}

function LocalizationAdapter({
  selectedRobotId, // id to show all data for, prioritize its map
  selectRobotCallback,
  lowBandwidth = false,
  robotOffline,
  variant, // informs if Localization is of type 'NavigationDetail' or 'MapWidget'
  mapLabel: contextMapLabel,
  centerOnRobot = true,
  onMapPanning,
  onMapPanEnd,
  dimmed,
  isZeroData,
  robotIds,
  robotsLoading,
  missionWaypointSteps,
}) {
  // If no robot IDs are passed, choose the default one
  const robotIdsToQuery = useMemo(() => {
    if (robotsLoading) {
      return [];
    }
    return isEmpty(robotIds) ? [selectedRobotId] : robotIds;
  }, [robotIds, selectedRobotId, robotsLoading]);

  // If selectedRobotId is not part of the location then use the first robot
  // of robotIds to get the map of the location
  const mainRobotId = useMemo(() => {
    if (robotIdsToQuery) {
      if (robotIdsToQuery.includes(selectedRobotId)) {
        return selectedRobotId;
      } else {
        return robotIdsToQuery[0];
      }
    } else {
      return '';
    }
  }, [robotIdsToQuery, selectedRobotId]);

  const { state, dispatch } = useRobotsDataContext();
  const { robotsLocalizationData, map = {} } = state;

  // TODO: Implement MongoDB data fetch for robot annotations (waypoints, edges)
  // useAnnotationsList is not available in ORO. Pass empty list for now.
  const annotationsList = EMPTY_ANNOTATIONS_LIST;

  // TODO: Implement MongoDB data fetch for zone types config
  // useTrafficZoneTypesConfig is not available in ORO.
  const zoneTypesConfig = null;

  // TODO: Implement MongoDB data fetch for traffic zones
  // useTrafficZones is not available in ORO.
  const zonesData = null;

  // Get localization data for all the robots
  useDataSource(state, dispatch, LOCALIZATION_DATA_TYPE.LOCALIZATION, {
    robotIds: robotIdsToQuery, lowBandwidth
  });

  // Get the map metadata and URL, render-ready.
  // Use the mapLabel passed from the context as prop if exists;
  // if not, use the selected robot's default map.
  const mapLabel = contextMapLabel || robotsLocalizationData?.[mainRobotId]?.defaultMap;

  useDataSource(
    state,
    dispatch,
    LOCALIZATION_DATA_TYPE.MAP,
    { entityId: mainRobotId, label: mapLabel }
  );

  // Fetch robot online/offline data
  useDataSource(state, dispatch, LOCALIZATION_DATA_TYPE.DETAILS, { robotIds: robotIdsToQuery });
  const robotDetails = useMemo(
    () => keyBy(state.robotDetails || [], '_id'),
    [state.robotDetails]
  );

  // TODO: Implement useRobotsUiPreferences for ORO (not available yet)
  // UI preferences control robot avatar and map visualization per robot.
  const robotsUiPreferences = {};

  const robotIdsToDisplay = useMemo(() => {
    let filteredRobotIds = robotIdsToQuery;
    if (robotDetails) {
      // filter out offline robots
      filteredRobotIds = robotIdsToQuery.filter(rId => (
        robotDetails[rId]
        && robotDetails[rId].status
        && robotDetails[rId].status.agentOnline
      ));
    }
    return filteredRobotIds;
  }, [robotIdsToQuery, robotDetails]);

  // If no robots are left, force robot offline flag to true
  const effectiveRobotOffline = robotOffline || !robotIdsToDisplay.length;

  const isLoading = robotsLoading;

  // Filter localization data for only information for selected robotIds
  const filteredRobotLocalizationData = pickKeys(robotsLocalizationData, robotIdsToDisplay);

  // Load keys for outdoor map tiles services
  const tilesetKey = Meteor.settings?.public?.maptilerKey;

  return (
    <Localization
      isLoading={isLoading}
      map={map}
      selectedRobotId={selectedRobotId}
      robotsLocalizationData={filteredRobotLocalizationData}
      robotsUiPreferences={robotsUiPreferences}
      robotOffline={effectiveRobotOffline}
      selectRobotCallback={selectRobotCallback}
      variant={variant}
      centerOnRobot={centerOnRobot}
      onMapPanning={onMapPanning}
      onMapPanEnd={onMapPanEnd}
      dimmed={dimmed}
      isZeroData={isZeroData}
      robotIds={robotIds}
      robotsDetails={robotDetails}
      annotationsList={annotationsList}
      zonesData={zonesData}
      zoneTypes={zoneTypesConfig?.zoneTypes}
      tilesetKey={tilesetKey}
      missionWaypointSteps={missionWaypointSteps}
      Map={Map}
    />
  );
}

LocalizationAdapter.propTypes = {
  robotIds: PropTypes.array,
  robotsLoading: PropTypes.bool,
  selectedRobotId: PropTypes.string, // id to show all data for, prioritize its map
  selectRobotCallback: PropTypes.func,
  robotOffline: PropTypes.bool,
  variant: PropTypes.string, // whether NavigationDetail or MapWidget
  mapLabel: PropTypes.string, // map label taken from navigation context
  centerOnRobot: PropTypes.bool, // indicates if the robot is centered
  onMapPanning: PropTypes.func, // callback when the map is being panned
  onMapPanEnd: PropTypes.func, // callback when the map stops being panned
  dimmed: PropTypes.bool, // indicates if the robot layer should be dimmed
  isZeroData: PropTypes.bool, // indicates if the widget should show the zero data placeholder
  missionWaypointSteps: PropTypes.array, // list of mission steps of type waypoint
  lowBandwidth: PropTypes.bool, // whether in high data freq or low
};

// We are passing the same component as ZeroDataComponent
// because it knows how to handle its zero data state
export default WithNoDataMessage(LocalizationAdapter, { ZeroDataComponent: LocalizationAdapter });
