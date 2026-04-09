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
import {
  Check,
  Compass,
  Gamepad2,
  LocateFixed,
  Navigation,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
// ORO imports
import { useActiveInteraction } from '../contexts/ActiveInteractionContext';
import { useDarkModeContext } from '../contexts/DarkModeContext';
import { useLocalizationWidget } from '../contexts/LocalizationWidgetContext';
import { useFullscreenContext } from '../contexts/FullscreenContext';
import WrapWithTooltip from '../util/WrapWithTooltip.js';
import CancelNavToGoalButton from './CancelNavToGoalButton';
import {
  PRECISION_MODE,
  RELOCALIZE_MODE,
  TELEOP_MODE,
} from './interactions';
import { KEY_TELEOP } from './LayoutManager.js';

const ICON_SIZE = 22;

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
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: '8px',
    padding: '6px',
    marginBottom: '4px',
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
      color: theme.palette.text.primary,
    },
    '&.active': {
      backgroundColor: theme.palette.primary.main,
      color: theme.palette.common.white,
      borderColor: theme.palette.primary.main,
      '&:hover': {
        backgroundColor: theme.palette.primary.dark,
      }
    },
    '&.active-secondary': {
      backgroundColor: theme.palette.secondary.main,
      color: theme.palette.common.white,
      borderColor: theme.palette.secondary.main,
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
const NavButton = ({ tooltip, onClick, disabled, active, activeVariant = 'primary', dataTest, children }) => {
  const btn = (
    <IconButton
      onClick={onClick}
      disabled={disabled}
      className={classnames('navBtn', {
        active: active && activeVariant === 'primary',
        'active-secondary': active && activeVariant === 'secondary'
      })}
      data-test={dataTest}
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
  dataTest: PropTypes.string,
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
  const { isFullscreen } = useFullscreenContext();
  const { increaseZoom, decreaseZoom, reset } = useLocalizationWidget();
  const { isDarkMode } = useDarkModeContext();

  const isRelocalizeActive = activeInteraction === RELOCALIZE_MODE;
  const isTeleopActive = activeInteraction === TELEOP_MODE;
  const isPrecisionActive = activeInteraction === PRECISION_MODE;
  const isAnyActionActive = Boolean(activeInteraction);

  const handleResetZoom = useCallback(() => reset?.(), [reset]);
  const handleIncreaseZoom = useCallback(() => increaseZoom?.(), [increaseZoom]);
  const handleDecreaseZoom = useCallback(() => decreaseZoom?.(), [decreaseZoom]);
  const handleTeleop = useCallback(() => setActiveInteraction(isTeleopActive ? null : TELEOP_MODE), [isTeleopActive, setActiveInteraction]);
  const handleRelocalize = useCallback(() => setActiveInteraction(isRelocalizeActive ? null : RELOCALIZE_MODE), [isRelocalizeActive, setActiveInteraction]);
  const handlePrecision = useCallback(() => setActiveInteraction(isPrecisionActive ? null : PRECISION_MODE), [isPrecisionActive, setActiveInteraction]);
  const handleConfirm = useCallback(() => executeInteraction(), [executeInteraction]);

  const offlineMsg = !isZeroData && robotOffline ? 'Robot offline' : undefined;

  return (
    <Grid container className={classes.boxContainer}>

      {/* Group 1: zoom controls */}
      <Grid item xs={12} className={classes.firstIconContainer}>
        <NavButton tooltip="Reset zoom" onClick={handleResetZoom} disabled={isZeroData} dataTest="localization-zoom-reset">
          <Compass size={ICON_SIZE} />
        </NavButton>
        <NavButton tooltip="Zoom in" onClick={handleIncreaseZoom} disabled={isZeroData} dataTest="localization-zoom-in">
          <ZoomIn size={ICON_SIZE} />
        </NavButton>
        <NavButton tooltip="Zoom out" onClick={handleDecreaseZoom} disabled={isZeroData} dataTest="localization-zoom-out">
          <ZoomOut size={ICON_SIZE} />
        </NavButton>
      </Grid>

      {/* Group 2: interaction controls */}
      <Grid item xs={12} className={classes.secondIconContainer}>
        {isPanelVisibleFn(KEY_TELEOP) && (
          <NavButton tooltip={offlineMsg || 'Relocalize'} onClick={handleRelocalize} disabled={robotOffline && isZeroData} active={isRelocalizeActive} dataTest="localization-robot-relocalize">
            <Navigation size={ICON_SIZE} />
          </NavButton>
        )}
        {isPanelVisibleFn(KEY_TELEOP) && (
          <NavButton tooltip={offlineMsg || 'Precision Teleop'} onClick={handlePrecision} disabled={robotOffline && isZeroData} active={isPrecisionActive} dataTest="localization-robot-precision">
            <LocateFixed size={ICON_SIZE} />
          </NavButton>
        )}
        {isPanelVisibleFn(KEY_TELEOP) && (
          <NavButton tooltip={offlineMsg || 'Open Teleop'} onClick={handleTeleop} disabled={robotOffline && isZeroData} active={isTeleopActive} activeVariant="secondary" dataTest="localization-robot-teleop">
            <Gamepad2 size={ICON_SIZE} />
          </NavButton>
        )}
      </Grid>

      {/* Group 3: cancel + confirm */}
      {isPanelVisibleFn(KEY_TELEOP) && (
        <Grid item xs={12} className={classes.thirdIconContainer}>
          <CancelNavToGoalButton
            robotId={robotId}
            buttonVariant={isAnyActionActive ? 'contained' : 'outlined'}
          />
        </Grid>
      )}
      <Grid item xs={12} className={classes.thirdIconContainer}>
        {isAnyActionActive && data && (
          <Tooltip title={offlineMsg || ''} placement="left">
            <span>
              <IconButton
                disabled={robotOffline && isZeroData}
                onClick={handleConfirm}
                data-test="navdet-controls-confirm"
                className={classnames(classes.confirmButton, { [classes.confirmDarkMode]: isDarkMode })}
                size="large"
              >
                <Check size={ICON_SIZE} className={classnames(classes.checkmark, { [classes.checkmarkDark]: isDarkMode })} />
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
