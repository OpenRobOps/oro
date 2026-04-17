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
 * Navigation Detail screen.
 *
 * Full-screen experience focused on a specific robot, enabling monitoring
 * and control of Autonomous Mobile Robots.
 */
import React, { useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from 'tss-react/mui';
// ORO imports
import { RobotsDataProvider } from '../../contexts/RobotsDataContext';
import { TimeStampHintProvider } from '../../contexts/navigationDetail/TimeStampContext';
import { DEFAULT_DATA_SOURCES } from '../../robotWidgets/LocalizationWidget/LocalizationDataSources';
import { useActiveInteraction } from '../../contexts/ActiveInteractionContext';
import NavigationControlBar from '../NavigationControlBar';
import useSize from '../useSize';
import { INTERACTION_MODES } from '../interactions';
import { useFullscreenContext } from '../../contexts/FullscreenContext';
import { useDarkModeContext } from '../../contexts/DarkModeContext';
import WithActionsContext from '../../util/WithActionsContext';
import LoadingCircle from '../../util/LoadingCircle';
import ActiveInteractionExecutors from './ActiveInteractionExecutors';
import { useRobotData } from '../../util/hooks';
import NavigationDetailComponent from './NavigationDetailComponent';
import useConfirmationSnackbar from '../../util/useConfirmationSnackbar';

const useStyles = makeStyles()(() => ({
  navigationDetailContainer: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  loadingContainer: {
    position: 'absolute',
    top: 'calc(50% - 35px)',
    left: 'calc(50% - 35px)',
  }
}));

const NavigationControlBarInteraction = (props) => {
  const { activeInteraction } = useActiveInteraction();
  const teleopMode = activeInteraction === INTERACTION_MODES.TELEOP_MODE;
  const waypointMode = (
    activeInteraction === INTERACTION_MODES.NAVIGATE_MODE
    || activeInteraction === INTERACTION_MODES.RELOCALIZE_MODE
  );
  return (
    <NavigationControlBar
      {...props}
      teleopMode={teleopMode}
      waypointMode={waypointMode}
    />
  );
};

const EMPTY_ROBOT_DATA = {};

function NavigationDetail({
  robotId,
  executeAction,
  actionExecuting,
  selectRobotCallback,
  mapLabel,
  setMapLabel,
  isZeroData,
  options
}) {
  const { classes } = useStyles();
  const { setContainerRef: setFullscreenContainerRef, isFullscreen } = useFullscreenContext();
  const containerRef = useRef(null);
  const { data: robot } = useRobotData(robotId) || EMPTY_ROBOT_DATA;
  const robotOffline = !(robot?.status?.agentOnline);
  const { setIsDarkMode } = useDarkModeContext();
  const { openDialog, ConfirmationDialog } = useConfirmationSnackbar();
  const containerSize = useSize(containerRef);

  setFullscreenContainerRef(containerRef);

  useEffect(() => {
    setIsDarkMode(isFullscreen);
  }, [isFullscreen, setIsDarkMode]);

  return (
    <div
      id="navigationDetail"
      ref={containerRef}
      className={classes.navigationDetailContainer}
    >
      {ConfirmationDialog}
      <RobotsDataProvider dataSources={DEFAULT_DATA_SOURCES}>
        <TimeStampHintProvider>
          {!containerSize ? (
            <div>isLoading...</div>
          ) : (
            <>
              <ActiveInteractionExecutors
                robotId={robotId}
                executeAction={executeAction}
              />
              {isFullscreen && document.fullscreenElement && (
                <NavigationControlBarInteraction
                  robotId={robotId}
                  selectRobotCallback={selectRobotCallback}
                  fullscreen
                  robotOffline={robotOffline}
                  mapLabel={mapLabel}
                  setMapLabel={setMapLabel}
                />
              )}
              <NavigationDetailComponent
                robotId={robotId}
                executeAction={executeAction}
                actionExecuting={actionExecuting}
                selectRobotCallback={selectRobotCallback}
                mapLabel={mapLabel}
                isZeroData={isZeroData}
                options={options}
                robotOffline={robotOffline}
                isFullscreen={isFullscreen}
                containerSize={containerSize}
                onFeedback={openDialog}
              />
            </>
          )}
        </TimeStampHintProvider>
      </RobotsDataProvider>
      {actionExecuting && (
        <div className={classes.loadingContainer}>
          <LoadingCircle />
        </div>
      )}
    </div>
  );
}

NavigationDetail.propTypes = {
  robotId: PropTypes.string,
  executeAction: PropTypes.func,
  actionExecuting: PropTypes.bool,
  selectRobotCallback: PropTypes.func,
  mapLabel: PropTypes.string,
  setMapLabel: PropTypes.func,
  isZeroData: PropTypes.bool,
  options: PropTypes.object
};

const WithActionsContextNavigationDetail = baseProps => WithActionsContext(
  baseProps,
  NavigationDetail
);

export default WithActionsContextNavigationDetail;
