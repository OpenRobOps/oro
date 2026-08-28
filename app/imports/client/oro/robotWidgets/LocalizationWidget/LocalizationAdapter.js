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
import {
  useRobotMapsList, useFrameTransforms, parseMapRef, mapRefFor, findMapRef,
} from '../../hooks/useRobotMaps';
import { useRobotsUiPreferences } from '../../hooks/useRobotsUiPreferences';
import {
  transformLocalizationData, partitionByTransform, DEFAULT_FRAME_ID,
} from '../../../../shared/maps';

// Constant arrays to avoid new objects and re-renders
const EMPTY_ANNOTATIONS_LIST = [];

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
    robotIds: robotIdsToQuery, lowBandwidth, selectedRobotId: mainRobotId
  });

  // Which map to show: the ref from context (system:<id> | robot:<id> | <label>), else the
  // robot's own default map, else the first shared map (ISO robots publish no map at all).
  // The context ref can be stale after switching to a robot that doesn't have that map (e.g. it
  // named a robot-owned map of the previously selected robot); once the maps list has loaded,
  // ignore it unless it still resolves to one of this robot's maps. While loading, keep it as-is
  // to avoid flashing to the default map and back.
  const { isLoading: mapsLoading, maps, defaultMap } = useRobotMapsList(mainRobotId);
  const contextMapUsable = !!contextMapLabel
    && (mapsLoading || !!findMapRef(maps, contextMapLabel, mainRobotId));
  const mapRef = (contextMapUsable && contextMapLabel)
    || (defaultMap && mapRefFor(defaultMap))
    || robotsLocalizationData?.[mainRobotId]?.defaultMap;
  const mapQuery = parseMapRef(mapRef, mainRobotId) || {};

  useDataSource(
    state,
    dispatch,
    LOCALIZATION_DATA_TYPE.MAP,
    {
      robotId: mainRobotId,
      entityType: mapQuery.entityType,
      entityId: mapQuery.entityId,
      // null (not undefined) bypasses useMeteorMapData's `label = 'map'` default, so an
      // unresolved mapQuery doesn't fall through to reconstructing a robot/'map' query.
      label: mapQuery.label || null,
    }
  );

  // Fetch robot online/offline data
  useDataSource(state, dispatch, LOCALIZATION_DATA_TYPE.DETAILS, { robotIds: robotIdsToQuery });
  const robotDetails = useMemo(
    () => keyBy(state.robotDetails || [], '_id'),
    [state.robotDetails]
  );

  // Per-robot avatar/footprint and path-styling preferences (resolved server-side from config
  // and ISO-reported footprints); RobotPoseLayer reads `map.pose`, PathLayer reads `map.robotPath`.
  const robotsUiPreferences = useRobotsUiPreferences(robotIdsToQuery);

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

  // Place robots on the selected map: each robot's frame → map frame.
  const robotFrames = useMemo(() => Object.fromEntries(robotIdsToDisplay.map((rId) => (
    [rId, robotsLocalizationData?.[rId]?.map?.frameId || DEFAULT_FRAME_ID]
  ))), [robotIdsToDisplay, robotsLocalizationData]);
  const { isLoading: transformLoading, transforms } = useFrameTransforms({
    robotIds: robotIdsToDisplay, robotFrames, to: map.frameId,
  });
  const { drawn, skipped } = useMemo(() => partitionByTransform({
    robotIds: robotIdsToDisplay, transforms, toFrame: transformLoading ? undefined : map.frameId,
  }), [robotIdsToDisplay, transforms, transformLoading, map.frameId]);
  const selectedHasNoTransform = !!map.frameId && !transformLoading
    && robotIdsToDisplay.includes(mainRobotId) && !transforms[mainRobotId];
  const mapWithFrame = useMemo(() => ({
    ...map,
    frameTransform: transforms[mainRobotId] || null,
    robotFrameId: robotFrames[mainRobotId] || DEFAULT_FRAME_ID,
    noTransform: selectedHasNoTransform,
    skippedRobots: skipped.length,
  }), [map, transforms, robotFrames, mainRobotId, selectedHasNoTransform, skipped.length]);

  const filteredRobotLocalizationData = useMemo(() => Object.fromEntries(
    drawn.filter((rId) => robotsLocalizationData[rId])
      .map((rId) => {
        // Detail (lasers/paths) is only subscribed for the selected robot; the reducer keeps the last
        // known values when a robot loses its subscription, so drop them here for everyone else.
        const { laserRanges, paths, ...poseOnly } = robotsLocalizationData[rId];
        const data = rId === mainRobotId ? robotsLocalizationData[rId] : poseOnly;
        return [rId, transformLocalizationData(data, transforms[rId])];
      })
  ), [drawn, robotsLocalizationData, transforms, mainRobotId]);

  // Load keys for outdoor map tiles services
  const tilesetKey = Meteor.settings?.public?.maptilerKey;

  return (
    <Localization
      isLoading={isLoading}
      map={mapWithFrame}
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
