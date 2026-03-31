/**
 * Navigation Control Bar Component
 *
 * The NavigationControlBar component provides navigation and control options for managing robots
 * in Navigation scope.
 *
 * Key Features:
 * - Responsive Design: Adapts to different screen sizes, including mobile devices.
 * - Control Bar Auto-Hide: Automatically hides when not in use (e.g., during fullscreen mode).
 * - Robot and Map and Actions selector: Allows to select robots, maps, and actions.
 * - Fullscreen Toggle: Enables fullscreen mode.
 * - Color Customization: Dynamically adjusts the color theme based on the active mode.
 * - Map Layers Selector: Allows users to choose map layers (if map_layers is active).

 *
 * Meteor agnostic component
 */
import React, { useState, useRef, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Collapse, Grid } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import useMediaQuery from '@mui/material/useMediaQuery';
import classNames from 'classnames';
// InOrbit modules
// import ActionsDropdownComponent from '../ActionsDropdown';
import { useFullscreenContext } from '../../contexts/FullscreenContext';
import FullscreenButton from '../../util/FullscreenButton';
import { useActiveInteraction } from '../../contexts/ActiveInteractionContext';
import { ZONE_EDIT_MODE } from '../interactions';

// Time in ms that the control bar will close after the user
// loses focus on the control bar (only for fullscreen)
const AFTER_FOCUS_CLOSE_TIME = 5000;

const useStyles = makeStyles()(theme => ({
  container: {
    display: 'flex',
    height: '40px',
    alignItems: 'center',
    margin: '0px',
    padding: '0px 3px'
  },
  searchBoxContainer: {
    minWidth: '200px'
  },
  fullscreenSearchBoxContainer: {
    marginLeft: '8px'
  },
  mapSettingsContainer: {
    display: 'flex',
    alignItems: 'center',
    marginLeft: 'auto'
  },
  baseButtonRoot: {
    color: theme.palette.text.title
  },
  backgroundFullscreen: {
    backgroundColor: theme.palette.background.titleBar,
    padding: '5px',
    boxShadow: '10px 10px 20px 2px rgba(0, 0, 0, 0.3)'
  },
  colorFullscreen: {
    color: theme.palette.text.icon
  },
  backgroundTeleop: {
    background:
      'repeating-linear-gradient(-45deg, #F5834E, #F5834E 15px, rgb(240, 85, 35) 15px, rgb(240, 85, 35) 30px)'
  },
  backgroundWaypoint: {
    background:
      'repeating-linear-gradient(-45deg, #88BF2D, #88BF2D 15px, rgb(0,107,0, 70%) 15px, rgb(0,107,0, 70%) 30px)'
  },
  colorTeleop: {
    color: theme.palette.text.content
  },
  colorWaypoint: {
    color: theme.palette.text.content
  },
  collapsedContainer: {
    width: '100%'
  },
  fullscreenContainer: {
    position: 'absolute',
    top: 0,
    zIndex: 1
  },
  actionButtonsContainer: {
    display: 'flex',
    padding: '0 10px'
  },
  // transparent container that shows in the space where the toolbar would be if it was not hidden
  hiddenControlBarContainer: {
    zIndex: 1000,
    height: '50px',
    width: '100%',
    background: 'transparent',
    position: 'absolute'
  },
  mobileContainer: {
    display: 'flex',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'space-between'
  }
}));

const NavigationControlBar = (props) => {
  // TODO: Fix NavigationControlBar behavior, it hides after the user
  // loses focus on the control bar or clicks on it, only on fullscreen.
  const [showControlBar, setShowControlBar] = useState(false);
  const [disableHideBar, setDisableHideBar] = useState(false);

  const { classes, theme } = useStyles();
  const isMobile = useMediaQuery('(max-width:900px)');
  const { activeInteraction } = useActiveInteraction();
  const isEditZonesActive = activeInteraction == ZONE_EDIT_MODE;

  const { toggleFullscreen } = useFullscreenContext();
  const showBarTimer = useRef(null);

  const controlBarTimer = () => {
    if (showBarTimer && showBarTimer.current) {
      clearTimeout(showBarTimer.current);
    }
    showBarTimer.current = setTimeout(() => {
      if (!disableHideBar) {
        setShowControlBar(false);
      }
    }, AFTER_FOCUS_CLOSE_TIME);
  };

  const {
    robotId,
    fullscreen,
    teleopMode,
    waypointMode,
    robot,
    Lock,
    selectRobotCallback,
    RobotSearch,
    selectedCollectionId,
    setCollectionId,
    setSelectedRobotId
  } = props;

  const onToolbarEnter = () => setShowControlBar(true);

  const onToolbarLeave = () => controlBarTimer();

  // Adds the property color according to what prop is set to true
  // Fullscreen can be overridden by teleopMode or waypointMode
  const colorClassNames = useMemo(() => ({
    [classes.colorFullscreen]: fullscreen,
    [classes.colorTeleop]: teleopMode,
    [classes.colorWaypoint]: waypointMode
  }), [fullscreen, teleopMode, waypointMode]);

  // Adds the property background according to what prop is set to true
  // Fullscreen can be overridden by teleopMode or waypointMode
  const backgroundClassNames = useMemo(() => ({
    [classes.backgroundFullscreen]: fullscreen,
    [classes.backgroundTeleop]: teleopMode,
    [classes.backgroundWaypoint]: waypointMode
  }), [fullscreen, teleopMode, waypointMode]);

  /**
   * For custom icons the color needs to be passed in the styles and classnames does not work
   * Therefore the color of the icon needs to be passed with this function
   */
  const customIconsColor = useMemo(() => {
    if (teleopMode || waypointMode) {
      return { color: theme.palette.text.content };
    }
    if (fullscreen) {
      return { color: theme.palette.text.icon };
    }
    return { color: theme.palette.text.title };
  }, [teleopMode, waypointMode, fullscreen]);

  // Variable to decide where to show or hide the control bar
  // The control bar will be displayed in normal mode (not fullscreen) and when there is some action
  // (teleopMode, waypointMode) running
  // or the user hovers over the toolbar space (showControlBar)
  const controlBarActive = true || !fullscreen || teleopMode || waypointMode || showControlBar;

  return (
    <>
      {!controlBarActive && (
        <div className={classes.hiddenControlBarContainer} onMouseEnter={onToolbarEnter} />
      )}
      <Collapse
        in={controlBarActive}
        classes={{
          root: classNames(classes.collapsedContainer, {
            [classes.fullscreenContainer]: fullscreen
          })
        }}
      >
        <div
          className={classNames(classes.container, backgroundClassNames)}
          onMouseLeave={onToolbarLeave}
        >
          <div
            className={classNames(classes.searchBoxContainer, {
              [classes.fullscreenSearchBoxContainer]: fullscreen
            })}
          >
            <RobotSearch
              selectedRobotId={robotId}
              setCollectionId={setCollectionId}
              selectRobotCallback={selectRobotCallback}
              setSelectedRobotId={setSelectedRobotId}
              data-test="navdet-controls-robotsearch"
              selectedCollectionId={selectedCollectionId}
            />
          </div>
          {isMobile ? (
            <Grid className={isMobile && classes.mobileContainer}>
              {robot && (
                <Lock
                  robotId={robotId}
                  lock={robot.lock}
                  colorClassNames={colorClassNames}
                  fullscreen={fullscreen}
                />
              )}
              <FullscreenButton
                fullscreen={fullscreen}
                onClick={toggleFullscreen}
                dataTest="navdet-controls-fullscreen-"
                style={customIconsColor}
              />
            </Grid>
          ) : (
            <>
              <div className={classNames(classes.actionButtonsContainer, colorClassNames)}>
                {robot && (
                  <Lock
                    robotId={robotId}
                    lock={robot.lock}
                    colorClassNames={colorClassNames}
                    fullscreen={fullscreen}
                  />
                )}
                {/* TODO - re-add when implementd <ActionsDropdownComponent
                  robotId={robotId}
                  textClasses={{ root: classNames(classes.baseButtonRoot, colorClassNames) }}
                /> */}
              </div>
              <div className={classes.mapSettingsContainer}>
                <FullscreenButton
                  fullscreen={fullscreen}
                  onClick={toggleFullscreen}
                  dataTest="navdet-controls-fullscreen-"
                  style={customIconsColor}
                />
              </div>
            </>
          )}
        </div>
      </Collapse>
    </>
  );
};

NavigationControlBar.propTypes = {
  robotId: PropTypes.string,
  robot: PropTypes.object,
  fullscreen: PropTypes.bool,
  teleopMode: PropTypes.bool,
  waypointMode: PropTypes.bool,
  camerasEnabled: PropTypes.bool,
  // callbacks
  selectRobotCallback: PropTypes.func,
  setCollectionId: PropTypes.func,
  setSelectedRobotId: PropTypes.func,
  // components
  Lock: PropTypes.object,
  RobotSearch: PropTypes.func
};

export default NavigationControlBar;
