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
 * ActiveInteractionControl
 *
 * Vertical toolbar with buttons for robot interaction in NavigationDetail:
 * zoom in/out/reset, relocalize, precision teleop, open teleop, cancel nav goal, confirm.
 * Zones and waypoint editing are not included.
 */
import React, { useCallback } from 'react';
import { Grid, IconButton, Tooltip } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { makeStyles } from 'tss-react/mui';
import PropTypes from 'prop-types';
import classnames from 'classnames';
// Custom navigation icons
import CompassIcon from '../graphics/op/CompassIcon/CompassIcon';
import ZoomInIcon from '../graphics/op/ZoomInIcon/ZoomInIcon';
import ZoomOutIcon from '../graphics/op/ZoomOutIcon/ZoomOutIcon';
import LocalizeIcon from '../graphics/op/LocalizeIcon/LocalizeIcon';
import RetroPadIcon from '../graphics/op/RetroPadIcon/RetroPadIcon';
import LocPinIcon from '../graphics/op/LocPinIcon/LocPinIcon';
import ConfirmIcon from '../graphics/op/ConfirmIcon';
// ORO imports
import { useActiveInteraction } from '../contexts/ActiveInteractionContext';
import { useLocalizationWidget } from '../contexts/LocalizationWidgetContext';
import CancelNavToGoalButton from './CancelNavToGoalButton';
import {
  NAVIGATE_MODE,
  RELOCALIZE_MODE,
  TELEOP_MODE,
} from './interactions';
import { KEY_TELEOP } from './LayoutManager.js';


const useStyles = makeStyles()(theme => ({
  boxContainer: {
    borderRadius: '0 10px 10px 0',
    padding: '10px',
    height: '100%',
    width: '100%',
    boxSizing: 'border-box',
  },
  boxContainerMint: {
    backgroundColor: theme.palette.background.mintAccentDim,
  },
  boxContainerOrange: {
    backgroundColor: theme.palette.background.orangeAccentDim,
  },
  firstIconContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px'
  },
  secondIconContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: '50px',
    gap: '8px'
  },
  thirdIconContainer: {
    height: '45px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: '30px'
  },
  navBtn: {
    color: theme.palette.text.primary,
    backgroundColor: theme.palette.background.surface,
    borderRadius: '50%',
    padding: '6px',
    marginBottom: '4px',
    // text-derived hairline + shadow keep the circle visible over both
    // light maps (surface is near-white) and dark maps (shadow is invisible)
    border: `1px solid ${alpha(theme.palette.text.primary, 0.3)}`,
    boxShadow: '0 1px 4px rgba(0, 0, 0, 0.35)',
    '& .MuiSvgIcon-root': { fontSize: '24px' },
    '&:hover': {
      backgroundColor: theme.palette.background.navDark,
      color: theme.palette.text.primary,
    },
    '&.active-mint': {
      backgroundColor: theme.palette.background.surface,
      color: theme.palette.background.mintAccent,
      boxShadow: `0 0 0 1.5px ${theme.palette.background.mintAccent}`,
      '&:hover': { backgroundColor: theme.palette.background.navDark },
    },
    '&.active-orange': {
      backgroundColor: theme.palette.background.surface,
      color: theme.palette.background.orangeAccent,
      boxShadow: `0 0 0 1.5px ${theme.palette.background.orangeAccent}`,
      '&:hover': { backgroundColor: theme.palette.background.navDark },
    }
  },
  confirmButton: {
    flexDirection: 'row',
    margin: '10px 8px',
    width: '36px',
    height: '36px',
    backgroundColor: theme.palette.background.surface,
    boxShadow: `0 0 0 1.5px ${theme.palette.background.mintAccent}`,
    '&:hover, &.Mui-focusVisible': {
      backgroundColor: theme.palette.background.navDark
    },
  },
  confirmButtonOrange: {
    boxShadow: `0 0 0 1.5px ${theme.palette.background.orangeAccent}`,
  },
  checkmark: {
    color: theme.palette.background.mintAccent
  },
  checkmarkOrange: {
    color: theme.palette.background.orangeAccent
  }
}));

/**
 * Small icon button for the nav sidebar. Highlights when `active`.
 */
const NavButton = ({ tooltip, onClick, disabled, active, activeVariant = 'mint', children }) => {
  const { classes } = useStyles();
  const btn = (
    <IconButton
      onClick={onClick}
      disabled={disabled}
      className={classnames(classes.navBtn, {
        // using colors because waypoint nav AND relocalize are mint and teleop is orange
        'active-mint': active && activeVariant === 'mint',
        'active-orange': active && activeVariant === 'orange'
      })}
      size="medium"
    >
      {children}
    </IconButton>
  );
  if (!tooltip) return btn;
  return (
    <Tooltip title={tooltip} placement="left">
      <span>{btn}</span>
    </Tooltip>
  );
};

NavButton.propTypes = {
  tooltip: PropTypes.string,
  onClick: PropTypes.func,
  disabled: PropTypes.bool,
  active: PropTypes.bool,
  activeVariant: PropTypes.oneOf(['mint', 'orange']),
  children: PropTypes.node,
};

const ActiveInteractionControl = ({
  robotOffline, robotId, isZeroData, isPanelVisibleFn
}) => {
  const { classes } = useStyles();
  const {
    activeInteraction,
    data,
    setActiveInteraction,
    executeInteraction,
  } = useActiveInteraction();
  const { increaseZoom, decreaseZoom, reset } = useLocalizationWidget();

  const isRelocalizeActive = activeInteraction === RELOCALIZE_MODE;
  const isTeleopActive = activeInteraction === TELEOP_MODE;
  const isNavigationActive = activeInteraction === NAVIGATE_MODE;
  const isAnyActionActive = Boolean(activeInteraction);

  const handleResetZoom = useCallback(() => reset?.(), [reset]);
  const handleIncreaseZoom = useCallback(() => increaseZoom?.(), [increaseZoom]);
  const handleDecreaseZoom = useCallback(() => decreaseZoom?.(), [decreaseZoom]);
  const handleTeleop = useCallback(() => setActiveInteraction(isTeleopActive ? null : TELEOP_MODE), [isTeleopActive, setActiveInteraction]);
  const handleRelocalize = useCallback(() => setActiveInteraction(isRelocalizeActive ? null : RELOCALIZE_MODE), [isRelocalizeActive, setActiveInteraction]);
  const handleNavigation = useCallback(() => setActiveInteraction(isNavigationActive ? null : NAVIGATE_MODE), [isNavigationActive, setActiveInteraction]);
  const handleConfirm = useCallback(() => executeInteraction(), [executeInteraction]);

  const offlineMsg = !isZeroData && robotOffline ? 'Robot offline' : undefined;

  return (
    <Grid container className={classnames(classes.boxContainer, {
      [classes.boxContainerMint]: isRelocalizeActive || isNavigationActive,
      [classes.boxContainerOrange]: isTeleopActive,
    })}>

      {/* Group 1: zoom controls */}
      <Grid size={{ xs: 12 }} className={classes.firstIconContainer}>
        <NavButton tooltip="Reset zoom" onClick={handleResetZoom} disabled={isZeroData}>
          <CompassIcon />
        </NavButton>
        <NavButton tooltip="Zoom in" onClick={handleIncreaseZoom} disabled={isZeroData}>
          <ZoomInIcon />
        </NavButton>
        <NavButton tooltip="Zoom out" onClick={handleDecreaseZoom} disabled={isZeroData}>
          <ZoomOutIcon />
        </NavButton>
      </Grid>

      {/* Group 2: interaction controls */}
      <Grid size={{ xs: 12 }} className={classes.secondIconContainer}>
        {isPanelVisibleFn(KEY_TELEOP) && (
          <NavButton tooltip={offlineMsg || 'Relocalize'} onClick={handleRelocalize} disabled={robotOffline && isZeroData} active={isRelocalizeActive}>
            <LocalizeIcon />
          </NavButton>
        )}
        {isPanelVisibleFn(KEY_TELEOP) && (
          <NavButton tooltip={offlineMsg || 'Waypoint Teleop'} onClick={handleNavigation} disabled={robotOffline && isZeroData} active={isNavigationActive}>
            <LocPinIcon />
          </NavButton>
        )}
        {isPanelVisibleFn(KEY_TELEOP) && (
          <NavButton tooltip={offlineMsg || 'Open Teleop'} onClick={handleTeleop} disabled={robotOffline && isZeroData} active={isTeleopActive} activeVariant="orange">
            <RetroPadIcon />
          </NavButton>
        )}
      </Grid>

      {/* Group 3: cancel + confirm */}
      {isPanelVisibleFn(KEY_TELEOP) && (
        <Grid size={{ xs: 12 }} className={classes.thirdIconContainer}>
          <CancelNavToGoalButton
            robotId={robotId}
            buttonVariant={isAnyActionActive ? 'contained' : 'outlined'}
          />
        </Grid>
      )}
      <Grid size={{ xs: 12 }} className={classes.thirdIconContainer}>
        {isAnyActionActive && data && (
          <Tooltip title={offlineMsg || ''} placement="left">
            <span>
              <IconButton
                disabled={robotOffline && isZeroData}
                onClick={handleConfirm}
                className={classnames(classes.confirmButton, { [classes.confirmButtonOrange]: isTeleopActive })}
                size="large"
              >
                <ConfirmIcon classes={{ checkmark: classnames(classes.checkmark, { [classes.checkmarkOrange]: isTeleopActive }) }} />
              </IconButton>
            </span>
          </Tooltip>
        )}
      </Grid>
    </Grid>
  );
};

ActiveInteractionControl.propTypes = {
  robotOffline: PropTypes.bool,
  robotId: PropTypes.string,
  isZeroData: PropTypes.bool,
  isPanelVisibleFn: PropTypes.func,
};

export default ActiveInteractionControl;
