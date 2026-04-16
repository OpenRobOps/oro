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
  MULTI_NAVIGATE_MODE, NAVIGATE_MODE, PRECISION_MODE, RELOCALIZE_MODE
} from '../../../navigationWidgets/interactions';

/**
 * Component to interact with the Map.
 *
 * It will side effect the map to pick the right layer based on the visualization type
 *
 */
const InteractionPicker = ({
  robotLocalizationData, uiPreferences = {}
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
    default:
      return null;
  }
};

InteractionPicker.propTypes = {
  robotLocalizationData: PropTypes.object,
  uiPreferences: PropTypes.object,
};

export default InteractionPicker;
