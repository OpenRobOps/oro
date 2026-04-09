/**
 * Pose Data Container
 *
 * Fetches custom UI preferences using `useUIPreferences` hook.
 */
import React from 'react';
import PropTypes from 'prop-types';
// ORO Modules
import PoseDataComponent from './PoseDataComponent';
import { useUIPreferences } from '../../util/hooks';
import { ID_TYPE_ROBOT } from '../../../../shared/constants';
import { EXTERNAL_MAP_LINK } from '../../../../lib/uiPreferences';
import LoadingBar from '../../util/LoadingBar';

const PoseData = ({ robotId, ...props }) => {
  // Fetch custom preferences for the open link button
  const {
    isLoading: isUIPreferencesLoading,
    data: uiPreferences
  } = useUIPreferences(robotId, ID_TYPE_ROBOT, EXTERNAL_MAP_LINK);
  return (
    isUIPreferencesLoading
      ? <LoadingBar height="15px" />
      : <PoseDataComponent uiPreferences={uiPreferences} {...props} />
  );
};

PoseData.propTypes = {
  robotId: PropTypes.string.isRequired,
};

export default PoseData;
