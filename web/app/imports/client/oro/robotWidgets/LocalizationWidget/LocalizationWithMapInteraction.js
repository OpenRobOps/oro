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
  defaultMap: PropTypes.string
};

export default LocalizationWithMapInteraction;
