/**
 * Layer Picker Component for the map.
 *
 * TODO: The "picker" name is misleading, this is not an element to pick the interaction:
 * rename to InteractionLayer or ActiveControlsLayer.
 */
import React from 'react';
import PropTypes from 'prop-types';
// ORO Modules
import WaypointNav from './WaypointNav';
import Relocalize from './Relocalize';
import PrecisionWaypoint from './PrecisionWaypoint';
import { useActiveInteraction } from '../../../contexts/ActiveInteractionContext';
import {
  MULTI_NAVIGATE_MODE, NAVIGATE_MODE, PRECISION_MODE, RELOCALIZE_MODE, WAYPOINT_EDIT_MODE,
  ZONE_EDIT_MODE
} from '../../../navigationWidgets/interactions';
import WaypointEdit from './WaypointEdit';
import ZoneEdit from './ZoneEdit';

/**
 * Component to interact with the Map.
 *
 * It will side effect the map to pick the right layer based on the visualization type
 *
 */
const InteractionPicker = ({
  robotLocalizationData, uiPreferences = {}, namedWaypoints, frameId, zones, zoneTypes
}) => {
  const { activeInteraction } = useActiveInteraction();

  switch (activeInteraction) {
    case NAVIGATE_MODE:
      return (
        <WaypointNav
          robotLocalizationData={robotLocalizationData}
          uiPreferences={uiPreferences}
        />
      );
    case MULTI_NAVIGATE_MODE:
      return (
        <WaypointNav
          robotLocalizationData={robotLocalizationData}
          uiPreferences={uiPreferences}
          isMultiWaypoint
        />
      );
    case RELOCALIZE_MODE:
      return (
        <Relocalize
          robotLocalizationData={robotLocalizationData}
          uiPreferences={uiPreferences}
        />
      );
    case PRECISION_MODE:
      return (
        <PrecisionWaypoint
          robotLocalizationData={robotLocalizationData}
          uiPreferences={uiPreferences}
        />
      );
    case WAYPOINT_EDIT_MODE:
      return (
        <WaypointEdit
          namedWaypoints={namedWaypoints}
          uiPreferences={uiPreferences}
          frameId={frameId}
        />
      );
    case ZONE_EDIT_MODE:
      return (
        <ZoneEdit
          zones={zones}
          zoneTypes={zoneTypes}
          frameId={frameId}
        />
      );
    default:
      return null;
  }
};

InteractionPicker.propTypes = {
  robotLocalizationData: PropTypes.object,
  uiPreferences: PropTypes.object,
  namedWaypoints: PropTypes.array,
  zones: PropTypes.array, // list of TrafficZones
  zoneTypes: PropTypes.object, // config for TrafficZoneTypes: map from id to ZoneType
  frameId: PropTypes.string // passed to WaypointEdit to know which sublocation to add waypoints to
};

export default InteractionPicker;
