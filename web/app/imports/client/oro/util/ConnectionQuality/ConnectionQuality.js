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
