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
import { useRobotData, useRobotLocation } from '../../util/hooks';
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
    || activeInteraction === INTERACTION_MODES.PRECISION_MODE
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
  const { locationId } = useRobotLocation({ robot });
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
                locationId={locationId}
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
