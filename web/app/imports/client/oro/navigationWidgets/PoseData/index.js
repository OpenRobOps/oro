/**
 * Pose Data Container
 *
 * Fetches custom UI preferences using `useUIPreferences` hook.
 */
import React from 'react';
// ORO Modules
import PoseDataComponent from './PoseDataComponent';
import { useUIPreferences } from '../../util/hooks';
import { EXTERNAL_MAP_LINK } from '../../../../lib/uiPreferences';
import LoadingBar from '../../util/LoadingBar';

const PoseData = ({ ...props }) => {
  // Fetch custom preferences for the open link button
  const {
    isLoading: isUIPreferencesLoading,
    data: uiPreferences
  } = useUIPreferences(EXTERNAL_MAP_LINK);
  return (
    isUIPreferencesLoading
      ? <LoadingBar height="15px" />
      : <PoseDataComponent uiPreferences={uiPreferences} {...props} />
  );
};

export default PoseData;
