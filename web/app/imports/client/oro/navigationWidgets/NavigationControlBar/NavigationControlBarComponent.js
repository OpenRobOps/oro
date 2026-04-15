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
 * Navigation Control Bar Component
 *
 * The NavigationControlBar component provides navigation and control options for managing robots
 * in Navigation scope.
 *
 * Key Features:
 * - Responsive Design: Adapts to different screen sizes, including mobile devices.
 * - Control Bar Auto-Hide: Automatically hides when not in use (e.g., during fullscreen mode).
 * - Robot selector: Allows to select robots.
 * - Map Layers Selector: Allows users to choose map layers.
 * - Hi-rez toggle: Enables high-resolution camera snapshots.
 * - Map selector: Allows changing the active map topic.
 * - Fullscreen Toggle: Enables fullscreen mode.
 * - Color Customization: Dynamically adjusts the color theme based on the active mode.
 *
 * Meteor agnostic component
 */
import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Chip,
  Collapse,
  IconButton,
  Menu,
  MenuItem,
  Switch,
  Tooltip,
  Typography
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import useMediaQuery from '@mui/material/useMediaQuery';
import classNames from 'classnames';
// MUI icons — replaces custom SVG icons from the Figma design
import {
  Bot,
  ChevronDown,
  Layers,
  Maximize2,
  Minimize2,
  RefreshCw,
  Settings,
  X,
} from 'lucide-react';
// ORO modules
import { useFullscreenContext } from '../../contexts/FullscreenContext';

// Time in ms that the control bar will close after the user
// loses focus on the control bar (only for fullscreen)
const AFTER_FOCUS_CLOSE_TIME = 5000;

const useStyles = makeStyles()(theme => ({
  container: {
    display: 'flex',
    height: '44px',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 12px',
    backgroundColor: theme.palette.background.surface,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: '10px',
  },
  backgroundFullscreen: {
    backgroundColor: theme.palette.background.titleBar,
    padding: '5px',
    boxShadow: '10px 10px 20px 2px rgba(0, 0, 0, 0.3)'
  },
  backgroundTeleop: {
    background:
      'repeating-linear-gradient(-45deg, #F5834E, #F5834E 15px, rgb(240, 85, 35) 15px, rgb(240, 85, 35) 30px)'
  },
  backgroundWaypoint: {
    background:
      'repeating-linear-gradient(-45deg, #88BF2D, #88BF2D 15px, rgb(0,107,0, 70%) 15px, rgb(0,107,0, 70%) 30px)'
  },
  collapsedContainer: {
    width: '100%'
  },
  fullscreenContainer: {
    position: 'absolute',
    top: 0,
    zIndex: 1
  },
  // transparent container that shows in the space where the toolbar would be if it was not hidden
  hiddenControlBarContainer: {
    zIndex: 1000,
    height: '50px',
    width: '100%',
    background: 'transparent',
    position: 'absolute'
  },
  leftGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  rightGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  // Robot chip — shown when a robot is selected
  robotChip: {
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: '4px',
    height: '32px',
    fontSize: '11px',
    color: theme.palette.text.primary,
    '& .MuiChip-icon': {
      fontSize: '16px',
      color: theme.palette.text.secondary,
    },
    '& .MuiChip-deleteIcon': {
      fontSize: '16px',
      color: theme.palette.text.secondary,
      '&:hover': { color: theme.palette.text.primary }
    }
  },
  // Robot search wrapper — shown when no robot is selected
  robotSearchWrapper: {
    minWidth: '200px'
  },
  // Control button: lock, layers, map selector
  controlButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: '4px',
    height: '24px',
    border: 'none',
    background: 'none',
    color: theme.palette.text.secondary,
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
      color: theme.palette.text.primary,
    }
  },
  controlButtonIcon: {
    fontSize: '18px'
  },
  controlButtonLabel: {
    fontSize: '12px',
    whiteSpace: 'nowrap',
  },
  // Hi-rez toggle
  hiRezContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  hiRezLabel: {
    fontSize: '14px',
    color: theme.palette.text.primary,
    whiteSpace: 'nowrap',
  },
  // Icon-only action buttons on the right
  iconBtn: {
    padding: '4px',
    color: theme.palette.text.secondary,
    '&:hover': {
      color: theme.palette.text.primary,
      backgroundColor: theme.palette.action.hover
    }
  },
  iconBtnSm: {
    fontSize: '22px'
  },
  // Mobile layout
  mobileContainer: {
    display: 'flex',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'space-between'
  }
}));

const NavigationControlBar = (props) => {
  const [showControlBar, setShowControlBar] = useState(false);
  const [disableHideBar] = useState(false);
  const [layersMenuAnchor, setLayersMenuAnchor] = useState(null);
  const [mapMenuAnchor, setMapMenuAnchor] = useState(null);

  const { classes } = useStyles();
  const isMobile = useMediaQuery('(max-width:900px)');
  const { toggleFullscreen } = useFullscreenContext();
  const showBarTimer = useRef(null);

  const {
    robotId,
    fullscreen,
    teleopMode,
    waypointMode,
    robot,
    Lock,
    RobotSearch,
    selectRobotCallback,
    setSelectedRobotId,
    // map controls
    mapLabel,
    mapsList = [],
    onMapChange,
    // layers
    layers = [],
    // hi-rez
    hiRezOn = false,
    onHiRezToggle,
    // action callbacks
    onSettingsClick,
    onReplaceClick,
  } = props;

  const controlBarTimer = useCallback(() => {
    if (showBarTimer.current) clearTimeout(showBarTimer.current);
    showBarTimer.current = setTimeout(() => {
      if (!disableHideBar) setShowControlBar(false);
    }, AFTER_FOCUS_CLOSE_TIME);
  }, [disableHideBar]);

  const onToolbarEnter = useCallback(() => setShowControlBar(true), []);
  const onToolbarLeave = useCallback(() => controlBarTimer(), [controlBarTimer]);

  // Clear the auto-hide timer on unmount; prevents a state update on an
  // unmounted component if the user leaves while the bar is fading out
  useEffect(() => {
    return () => {
      if (showBarTimer.current) clearTimeout(showBarTimer.current);
    };
  }, []);

  const backgroundClassNames = useMemo(() => ({
    [classes.backgroundFullscreen]: fullscreen,
    [classes.backgroundTeleop]: teleopMode,
    [classes.backgroundWaypoint]: waypointMode
  }), [fullscreen, teleopMode, waypointMode, classes]);

  const controlBarActive = !fullscreen || teleopMode || waypointMode || showControlBar;

  const handleLayersOpen = useCallback((e) => setLayersMenuAnchor(e.currentTarget), []);
  const handleLayersClose = useCallback(() => setLayersMenuAnchor(null), []);
  const handleMapOpen = useCallback((e) => setMapMenuAnchor(e.currentTarget), []);
  const handleMapClose = useCallback(() => setMapMenuAnchor(null), []);
  const handleMapSelect = useCallback((mapId) => {
    onMapChange?.(mapId);
    handleMapClose();
  }, [onMapChange, handleMapClose]);

  const robotName = robot?.name || robot?.robotId || robotId;

  const desktopContent = (
    <>
      {/* ── Left group ─────────────────────────────────────── */}
      <div className={classes.leftGroup}>

        {/* Robot selector: chip when selected, search box when not */}
        {robotId ? (
          <Chip
            className={classes.robotChip}
            icon={<Bot size={16} />}
            label={robotName}
            deleteIcon={<X size={14} />}
            onDelete={setSelectedRobotId ? () => setSelectedRobotId(null) : undefined}
            data-test="navdet-controls-robotchip"
          />
        ) : (
          <div className={classes.robotSearchWrapper}>
            <RobotSearch
              selectedRobotId={robotId}
              selectRobotCallback={selectRobotCallback}
              setSelectedRobotId={setSelectedRobotId}
              data-test="navdet-controls-robotsearch"
            />
          </div>
        )}

        {/* Lock */}
        {robot && Lock && (
          <Lock
            robotId={robotId}
            lock={robot.lock}
            fullscreen={fullscreen}
          />
        )}

        {/* Layers dropdown */}
        <>
          <button
            type="button"
            className={classes.controlButton}
            onClick={handleLayersOpen}
            data-test="navdet-controls-layers"
          >
            <Layers size={16} />
            <Typography className={classes.controlButtonLabel}>Layers</Typography>
            <ChevronDown size={16} />
          </button>
          <Menu
            anchorEl={layersMenuAnchor}
            open={Boolean(layersMenuAnchor)}
            onClose={handleLayersClose}
          >
            {layers.length === 0 ? (
              <MenuItem disabled>No layers available</MenuItem>
            ) : (
              layers.map(layer => (
                <MenuItem key={layer.id} onClick={handleLayersClose}>{layer.label}</MenuItem>
              ))
            )}
          </Menu>
        </>
      </div>

      {/* ── Right group ────────────────────────────────────── */}
      <div className={classes.rightGroup}>

        {/* Hi-rez toggle */}
        <div className={classes.hiRezContainer}>
          <Switch
            size="small"
            checked={hiRezOn}
            onChange={onHiRezToggle}
            color="primary"
            disabled={!robotId}
            data-test="navdet-controls-highrez"
          />
          <Typography className={classes.hiRezLabel}>
            {`Hi-rez ${hiRezOn ? 'On' : 'Off'}`}
          </Typography>
        </div>

        {/* Map selector */}
        {(mapsList.length > 0 || mapLabel) && (
          <>
            <button
              type="button"
              className={classes.controlButton}
              onClick={handleMapOpen}
              data-test="navdet-controls-map"
            >
              <Typography className={classes.controlButtonLabel}>
                {mapLabel || 'Select map'}
              </Typography>
              <ChevronDown size={16} />
            </button>
            <Menu
              anchorEl={mapMenuAnchor}
              open={Boolean(mapMenuAnchor)}
              onClose={handleMapClose}
            >
              {mapsList.map(map => (
                <MenuItem key={map.mapId} onClick={() => handleMapSelect(map.mapId)}>
                  {map.label}
                </MenuItem>
              ))}
            </Menu>
          </>
        )}

        {/* Swap / replace view */}
        {onReplaceClick && (
          <Tooltip title="Swap view">
            <IconButton className={classes.iconBtn} onClick={onReplaceClick} size="small">
              <RefreshCw size={20} />
            </IconButton>
          </Tooltip>
        )}

        {/* Settings */}
        {onSettingsClick && (
          <Tooltip title="Settings">
            <IconButton className={classes.iconBtn} onClick={onSettingsClick} size="small">
              <Settings size={20} />
            </IconButton>
          </Tooltip>
        )}

        {/* Fullscreen */}
        <Tooltip title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
          <IconButton
            className={classes.iconBtn}
            onClick={toggleFullscreen}
            size="small"
            data-test="navdet-controls-fullscreen-"
          >
            {fullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </IconButton>
        </Tooltip>
      </div>
    </>
  );

  const mobileContent = (
    <div className={classes.mobileContainer}>
      <RobotSearch
        selectedRobotId={robotId}
        selectRobotCallback={selectRobotCallback}
        setSelectedRobotId={setSelectedRobotId}
        data-test="navdet-controls-robotsearch"
      />
      <Tooltip title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
        <IconButton
          className={classes.iconBtn}
          onClick={toggleFullscreen}
          size="small"
          data-test="navdet-controls-fullscreen-"
        >
          {fullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
        </IconButton>
      </Tooltip>
    </div>
  );

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
          {isMobile ? mobileContent : desktopContent}
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
  // map controls
  mapLabel: PropTypes.string,
  mapsList: PropTypes.arrayOf(PropTypes.shape({
    mapId: PropTypes.string,
    label: PropTypes.string
  })),
  onMapChange: PropTypes.func,
  // layers
  layers: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string,
    label: PropTypes.string
  })),
  // hi-rez
  hiRezOn: PropTypes.bool,
  onHiRezToggle: PropTypes.func,
  // icon actions
  onSettingsClick: PropTypes.func,
  onReplaceClick: PropTypes.func,
  // callbacks
  selectRobotCallback: PropTypes.func,
  setSelectedRobotId: PropTypes.func,
  // injected components
  Lock: PropTypes.elementType,
  RobotSearch: PropTypes.func
};

export default NavigationControlBar;
