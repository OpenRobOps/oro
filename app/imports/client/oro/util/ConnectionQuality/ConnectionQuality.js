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
 * Connection Quality
 * Dynamically displays the connection quality using a "wifi" custom icon.
 *
 * This component wraps the base, presentation-only ConnectionQualityComponent with the use
 * of RobotsDataContext, requiring RTT as data source hook, obtaining RTT data from the context
 * and providing it as props to the visual component.
 */
import React from 'react';
import PropTypes from 'prop-types';
import ConnectionQualityComponent from './ConnectionQualityComponent';
import { LOCALIZATION_DATA_TYPE } from '../../robotWidgets/LocalizationWidget/LocalizationDataTypes';
import {
  useDataSource, useRobotsDataContext,
} from '../../contexts/RobotsDataContext/RobotsDataContext';

const ConnectionQualityContainer = ({ robotId, offline, isZeroData }) => {
  // Obtain context and require the RTT data source
  const { state, dispatch } = useRobotsDataContext();
  useDataSource(state, dispatch, LOCALIZATION_DATA_TYPE.RTT, { robotId });
  // Get the selected robot RTT data if available
  const { isLoading, rtt = {} } = (state.rtt && state.rtt[robotId]) || {};

  return (
    <ConnectionQualityComponent
      isLoading={isLoading}
      rtt={rtt}
      offline={offline}
      isZeroData={isZeroData}
    />
  );
};

ConnectionQualityContainer.propTypes = {
  robotId: PropTypes.string,
  offline: PropTypes.bool,
  isZeroData: PropTypes.bool
};

export default ConnectionQualityContainer;
