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
import { makeStyles } from 'tss-react/mui';
import PropTypes from 'prop-types';
import classnames from 'classnames';
// Custom navigation icons
import CompassIcon from '../graphics/op/CompassIcon/CompassIcon';
import ZoomInIcon from '../graphics/op/ZoomInIcon/ZoomInIcon';
import ZoomOutIcon from '../graphics/op/ZoomOutIcon/ZoomOutIcon';
import LocalizeIcon from '../graphics/op/LocalizeIcon/LocalizeIcon';
import RetroPadIcon from '../graphics/op/RetroPadIcon/RetroPadIcon';
import ConfirmIcon from '../graphics/op/ConfirmIcon';
// ORO imports
import { useActiveInteraction } from '../contexts/ActiveInteractionContext';
import { useDarkModeContext } from '../contexts/DarkModeContext';
import { useLocalizationWidget } from '../contexts/LocalizationWidgetContext';
import CancelNavToGoalButton from './CancelNavToGoalButton';
import {
  RELOCALIZE_MODE,
  TELEOP_MODE,
} from './interactions';
import { KEY_TELEOP } from './LayoutManager.js';


const useStyles = makeStyles()(theme => ({
  boxContainer: {
    borderRadius: '10px',
    padding: '10px',
    height: '100%',
  },
  firstIconContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  secondIconContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: '50px'
  },
  thirdIconContainer: {
    height: '45px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginTop: '30px'
  },
  navBtn: {
    color: theme.palette.text.secondary,
    backgroundColor: theme.palette.action.selected,
    borderRadius: '50%',
    padding: '6px',
    marginBottom: '4px',
    '& .MuiSvgIcon-root': { fontSize: '24px' },
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
      color: theme.palette.text.primary,
    },
    '&.active': {
      backgroundColor: theme.palette.primary.main,
      color: theme.palette.common.white,
      '&:hover': {
        backgroundColor: theme.palette.primary.dark,
      }
    },
    '&.active-secondary': {
      backgroundColor: theme.palette.secondary.main,
      color: theme.palette.common.white,
    }
  },
  confirmButton: {
    flexDirection: 'row',
    margin: '10px 8px',
    boxShadow:
      '0px 3px 5px -1px rgba(0,0,0,0.2), 0px 6px 10px 0px rgba(0,0,0,0.14), 0px 1px 18px 0px rgba(0,0,0,0.12)',
    width: '36px',
    height: '36px',
    backgroundColor: theme.palette.background.white,
    '&:hover, &.Mui-focusVisible': {
      backgroundColor: theme.palette.text.notesLight
    },
  },
  confirmDarkMode: {
    backgroundColor: theme.palette.teleop?.completedPath,
    '&:hover, &.Mui-focusVisible': {
      backgroundColor: theme.palette.background.titleBar
    },
  },
  checkmark: {
    color: '#3F3F3F'
  },
  checkmarkDark: {
    color: theme.palette.teleopArrows?.lightBackground
  }
}));

/**
 * Small icon button for the nav sidebar. Highlights when `active`.
 */
const NavButton = ({ tooltip, onClick, disabled, active, activeVariant = 'primary', children }) => {
  const { classes } = useStyles();
  const btn = (
    <IconButton
      onClick={onClick}
      disabled={disabled}
      className={classnames(classes.navBtn, {
        active: active && activeVariant === 'primary',
        'active-secondary': active && activeVariant === 'secondary'
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
  activeVariant: PropTypes.oneOf(['primary', 'secondary']),
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
  const { isDarkMode } = useDarkModeContext();

  const isRelocalizeActive = activeInteraction === RELOCALIZE_MODE;
  const isTeleopActive = activeInteraction === TELEOP_MODE;
  const isAnyActionActive = Boolean(activeInteraction);

  const handleResetZoom = useCallback(() => reset?.(), [reset]);
  const handleIncreaseZoom = useCallback(() => increaseZoom?.(), [increaseZoom]);
  const handleDecreaseZoom = useCallback(() => decreaseZoom?.(), [decreaseZoom]);
  const handleTeleop = useCallback(() => setActiveInteraction(isTeleopActive ? null : TELEOP_MODE), [isTeleopActive, setActiveInteraction]);
  const handleRelocalize = useCallback(() => setActiveInteraction(isRelocalizeActive ? null : RELOCALIZE_MODE), [isRelocalizeActive, setActiveInteraction]);
  const handleConfirm = useCallback(() => executeInteraction(), [executeInteraction]);

  const offlineMsg = !isZeroData && robotOffline ? 'Robot offline' : undefined;

  return (
    <Grid container className={classes.boxContainer}>

      {/* Group 1: zoom controls */}
      <Grid item size={{ xs: 12 }} className={classes.firstIconContainer}>
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
      <Grid item size={{ xs: 12 }} className={classes.secondIconContainer}>
        {isPanelVisibleFn(KEY_TELEOP) && (
          <NavButton tooltip={offlineMsg || 'Relocalize'} onClick={handleRelocalize} disabled={robotOffline && isZeroData} active={isRelocalizeActive}>
            <LocalizeIcon />
          </NavButton>
        )}
        {isPanelVisibleFn(KEY_TELEOP) && (
          <NavButton tooltip={offlineMsg || 'Open Teleop'} onClick={handleTeleop} disabled={robotOffline && isZeroData} active={isTeleopActive} activeVariant="secondary">
            <RetroPadIcon />
          </NavButton>
        )}
      </Grid>

      {/* Group 3: cancel + confirm */}
      {isPanelVisibleFn(KEY_TELEOP) && (
        <Grid item size={{ xs: 12 }} className={classes.thirdIconContainer}>
          <CancelNavToGoalButton
            robotId={robotId}
            buttonVariant={isAnyActionActive ? 'contained' : 'outlined'}
          />
        </Grid>
      )}
      <Grid item size={{ xs: 12 }} className={classes.thirdIconContainer}>
        {isAnyActionActive && data && (
          <Tooltip title={offlineMsg || ''} placement="left">
            <span>
              <IconButton
                disabled={robotOffline && isZeroData}
                onClick={handleConfirm}
                className={classnames(classes.confirmButton, { [classes.confirmDarkMode]: isDarkMode })}
                size="large"
              >
                <ConfirmIcon classes={{ checkmark: classnames(classes.checkmark, { [classes.checkmarkDark]: isDarkMode }) }} />
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
