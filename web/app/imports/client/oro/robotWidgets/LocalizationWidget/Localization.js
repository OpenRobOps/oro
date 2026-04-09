/**
 * Robot Map component that handles showing all layers,
 * such as the Map, Pose, Lasers, costmap.
 *
 * It is mainly a presentational component, displaying the data it receives
 * through props. It also contains interactive elements, which depend
 * on ActiveInteraction context and dispatch changes to its interactions.
 *
 * It should remain Meteor independent.
 */
import React, { useMemo, useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from 'tss-react/mui';
import { get } from 'lodash';
import Layers from './Map/Layers';
import MapImageLayer from './Map/MapImageLayer';
import MapNavsatLayer from './Map/MapNavsatLayer';
import RobotLayer from './RobotLayers/RobotLayer';
import { useLocalizationWidget } from '../../contexts/LocalizationWidgetContext/LocalizationWidgetContext';
import { LOCALIZATION_MAP_TYPES } from '../../../../shared/constants';
import {
  NAVIGATION_MAP_LAYER_COSTMAP,
  NAVIGATION_MAP_LAYER_LIDARS,
  NAVIGATION_MAP_LAYER_POSE_OUTLINE,
  NAVIGATION_MAP_LAYER_PATHS,
  NAVIGATION_MAP_LAYER_ROBOT_NAMES,
} from '../../contexts/LocalizationWidgetContext/mapLayers';

// Variants the Localization widget allows
const LOCALIZATION_VARIANTS = {
  NAVIGATION_DETAIL: 'NavigationDetail',
  MAP_WIDGET: 'MapWidget'
};

const useStyles = makeStyles()(theme => ({
  offlineMessage: {
    height: '100%',
    width: '100%',
    position: 'absolute',
    zIndex: '1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.palette.background?.gray,
    opacity: '0.5',
    top: 0
  },
  mapContainer: {
    contain: 'content',
    height: 'inherit',
  },
  mapImageNavigation: {
    width: '100%'
  },
  mapImageWidget: {
    height: '100%',
    width: 'auto'
  },
}));

/**
 * Component that displays the map and poses.
 *
 * Receives all data as props from LocalizationAdapter.
 * The Map component is injected via the MapComponent prop.
 */
function Localization({
  map = {},
  selectedRobotId,
  // eslint-disable-next-line no-unused-vars
  selectRobotCallback,
  robotsLocalizationData = {},
  robotsUiPreferences = {},
  robotOffline,
  variant,
  updatePoseTs,
  dimmed,
  centerOnRobot,
  onMapPanning,
  onMapPanEnd,
  isZeroData,
  robotIds,
  robotsDetails,
  tilesetKey,
  Map: MapComponent
}) {
  const { classes } = useStyles();
  const { mapUrl, type: mapType = LOCALIZATION_MAP_TYPES.IMAGE } = map;
  const [mapToRender, setMapToRender] = useState(map);

  const {
    zoomLevel,
    setZoom,
    customCenter,
    isLayerVisible,
    setInitialZoom,
    reset
  } = useLocalizationWidget(mapType);


  /**
   * Store the value of the map in mapToRender.
   * Only update if the mapUrl changes to avoid map "flickering" when switching
   * between maps in the same location.
   */
  useEffect(() => {
    setMapToRender(map);
    setInitialZoom(mapType);
    reset();
  }, [mapUrl, mapType, reset]);

  const selectedRobotLocalizationData = robotsLocalizationData[selectedRobotId] || {};
  const selectedRobotPose = selectedRobotLocalizationData.robotPose || { x: 0, y: 0 };

  // Save the current pose timestamp
  if (updatePoseTs) {
    updatePoseTs(selectedRobotLocalizationData.ts);
  }

  // map center [x, y] coords
  let center;
  if (centerOnRobot && selectedRobotPose) {
    center = [selectedRobotPose.x, selectedRobotPose.y];
  } else if (customCenter) {
    center = customCenter;
  }

  // Handles clicking a robot, which selects it (if not already selected)
  const handleRobotClick = useCallback((clickedRobotId) => {
    if (clickedRobotId != selectedRobotId && selectRobotCallback) {
      selectRobotCallback(clickedRobotId);
    }
  }, [selectedRobotId, selectRobotCallback]);

  const [handleZoomChanged, handlePanStart, handlePanEnd] = useMemo(() => (
    [
      (params = {}) => {
        const { zoom } = params;
        zoom && setZoom(zoom);
      },
      () => {
        onMapPanning && onMapPanning();
      },
      (params = {}) => {
        const { newCenter } = params;
        onMapPanEnd && onMapPanEnd(newCenter);
      }
    ]
  ), []);


  // For navsat maps, choose the selected or else the first robot in the
  // list to determine map preferences, such as which tiles to use.
  const navsatUiPreferences = robotsUiPreferences[selectedRobotId || robotIds?.[0]];

  if (robotOffline && !isZeroData) {
    return (
      <div className={classes.offlineMessage}>
        <span>Robot is offline</span>
      </div>
    );
  }

  if (!MapComponent) {
    return <div className={classes.mapContainer} />;
  }

  return (
    <MapComponent
      type={mapType}
      viewParams={mapToRender}
      center={center}
      zoom={zoomLevel}
      onZoomChange={handleZoomChanged}
      onRobotClick={handleRobotClick}
      onPanStart={handlePanStart}
      onPanEnd={handlePanEnd}
      selectedRobotPose={selectedRobotPose}
      selectedRobotId={selectedRobotId}
      variant={variant}
    >
      <Layers>
        {mapType == LOCALIZATION_MAP_TYPES.IMAGE
          ? <MapImageLayer url={mapToRender && mapToRender.mapUrl} mapMetadata={mapToRender} />
          : (
            <MapNavsatLayer
              mapMetadata={mapToRender}
              uiPreferences={navsatUiPreferences}
              tilesetKey={tilesetKey}
            />
          )}
        {Object.keys(robotsLocalizationData).map(rId => (
          <RobotLayer
            key={rId}
            map={mapToRender}
            robotId={rId}
            localizationData={robotsLocalizationData[rId]}
            uiPreferences={robotsUiPreferences[rId]}
            dimmed={dimmed}
            robotDetails={robotsDetails && robotsDetails[rId]}
            showCostmap={selectedRobotId === rId
              && isLayerVisible(NAVIGATION_MAP_LAYER_COSTMAP)}
            showPoseOutline={selectedRobotId === rId
              && isLayerVisible(NAVIGATION_MAP_LAYER_POSE_OUTLINE)}
            showLaserRanges={selectedRobotId === rId
              && isLayerVisible(NAVIGATION_MAP_LAYER_LIDARS)}
            showPaths={selectedRobotId === rId
              && isLayerVisible(NAVIGATION_MAP_LAYER_PATHS)}
            showLaserPoints={selectedRobotId === rId
              && isLayerVisible(NAVIGATION_MAP_LAYER_LIDARS)}
            showRobotNames={isLayerVisible(NAVIGATION_MAP_LAYER_ROBOT_NAMES)}
            selected={selectedRobotId == rId}
          />
        ))}

      </Layers>
    </MapComponent>
  );
}

Localization.propTypes = {
  // Data Props
  robotsLocalizationData: PropTypes.object,
  robotsDetails: PropTypes.object,
  map: PropTypes.object,
  robotOffline: PropTypes.bool,
  isZeroData: PropTypes.bool,
  // User Interface props
  robotIds: PropTypes.array,
  selectedRobotId: PropTypes.string,
  selectRobotCallback: PropTypes.func,
  variant: PropTypes.string,
  centerOnRobot: PropTypes.bool,
  onMapPanning: PropTypes.func,
  onMapPanEnd: PropTypes.func,
  dimmed: PropTypes.bool,
  robotsUiPreferences: PropTypes.object,
  updatePoseTs: PropTypes.func,
  tilesetKey: PropTypes.string,
  Map: PropTypes.elementType
};

export { LOCALIZATION_VARIANTS };
export default Localization;
