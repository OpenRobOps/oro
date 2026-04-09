/**
 * LocalizationWithMapInteraction
 * Wraps LocalizationAdapter with logic to handle map interactions.
 * Requires the parent component to have access to active interactions.
 */
import React, {
  useCallback, useState, useEffect
} from 'react';
import PropTypes from 'prop-types';
import { useLocalizationWidget } from '../../contexts/LocalizationWidgetContext/LocalizationWidgetContext';
import LocalizationAdapter from './LocalizationAdapter';
import { useActiveInteraction } from '../../contexts/ActiveInteractionContext';
import { INTERACTION_MODES } from '../../navigationWidgets/interactions';

const LocalizationWithMapInteraction = (props) => {
  const {
    robotIds: locationRobotIds = [],
    options,
    selectedRobotId,
    locationId,
    defaultMap
  } = props;

  const [robotIds, setRobotIds] = useState([]);
  const { activeInteraction } = useActiveInteraction();
  const isAnyActionActive = Boolean(activeInteraction);
  const { setIsFollowingRobot, isFollowingRobot, setCustomCenter } = useLocalizationWidget();
  const centerOnRobot = !isAnyActionActive && isFollowingRobot;

  // As soon as the map starts panning, stop following the robot
  const onMapPanning = useCallback(() => {
    setIsFollowingRobot(false);
  }, []);

  // When panning stops, save the new center as a state
  const onMapPanEnd = useCallback((newCenter) => {
    setCustomCenter(newCenter);
  }, []);

  const dimmed = activeInteraction === INTERACTION_MODES.RELOCALIZE_MODE;

  useEffect(() => {
    if (JSON.stringify(robotIds) != JSON.stringify(locationRobotIds)) {
      setRobotIds(locationRobotIds);
    }
  }, [locationRobotIds]);

  return (
    <LocalizationAdapter
      centerOnRobot={centerOnRobot}
      onMapPanning={onMapPanning}
      onMapPanEnd={onMapPanEnd}
      dimmed={dimmed}
      robotIds={robotIds}
      locationId={locationId}
      mapLabel={defaultMap}
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...props}
    />
  );
};

LocalizationWithMapInteraction.propTypes = {
  // robotIds is provided directly (replaces inorbit's companyId-based useRobotsInLocation)
  // TODO: Review entity mapping for oro context
  robotIds: PropTypes.array,
  options: PropTypes.object,
  selectedRobotId: PropTypes.string,
  locationId: PropTypes.string,
  defaultMap: PropTypes.string
};

export default LocalizationWithMapInteraction;
