/**
 * LiveButton
 *
 * Button that shows Live on or live off status of a specific widget
 *  - Live on status, there are 3 reasons that make the button have a live status
 *     1 - alwaysLive prop is true
 *     2 - startTs is undefined
 *     3 - startTs has the value of LIVE_TIME
 *  - Live off status, non of the items mentioned above should happen
 */
import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import useMediaQuery from '@mui/material/useMediaQuery';
import classnames from 'classnames';
import { Button, Grid } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import LiveIcon from '../graphics/op/LiveIcon';
import LiveIconOff from '../graphics/op/LiveIconOff';
import { LIVE_TIME, StartTsPropType } from './timeUtils';
import { useNowTimeContext } from './timeUtils/NowTimeContext';

const useStyles = makeStyles()(theme => ({
  liveButtonContainer: {
    marginRight: 'auto',
    display: 'flex'
  },
  toolbarContainer: {
    display: 'flex'
  },
  liveButton: {
    background: theme.palette.background.brightBlue,
    borderRadius: '3px',
    margin: '0 auto 0 10px',
    display: 'flex',
    height: '20px',
    minWidth: 'auto'
  },
  mobileLiveButton: {
    margin: '0',
    fontSize: '10px',
    minWidth: '30px'
  },
  liveButtonOff: {
    background: theme.palette.text.notesLight
  },
  liveButtonStartIcon: {
    margin: 0
  },
  liveButtonStartIconMobile: {
    margin: 0
  },
  mobileLiveButtonContainer: {
    paddingLeft: '10px !important'
  }
}));

const LiveButton = ({ startTs, setStartTime, alwaysLive, timeRangeMs, isLive }) => {
  const { classes } = useStyles();
  const nowTs = useNowTimeContext();
  const isMobile = useMediaQuery('(max-width:900px)');

  const onSetLiveTime = useCallback(() => setStartTime(LIVE_TIME), []);

  const onLiveButtonClick = useCallback(() => (
    setStartTime(nowTs - timeRangeMs)
  ), [nowTs, timeRangeMs]);

  const showLive = (alwaysLive || !startTs || startTs === LIVE_TIME || isLive);
  const startIconClass = useMemo(() => (isMobile
    ? classes.liveButtonStartIconMobile
    : classes.liveButtonStartIcon), [isMobile]);

  return (
    <Grid
      item
      className={
        classnames(
          classes.liveButtonContainer,
          { [classes.mobileLiveButtonContainer]: isMobile }
        )
      }
    >
      {showLive ? (
        <Button
          className={
            classnames(
              classes.liveButton,
              { [classes.mobileLiveButton]: isMobile }
            )
          }
          classes={{ startIcon: startIconClass }}
          startIcon={<LiveIcon />}
          onClick={onLiveButtonClick}
          disabled={alwaysLive}
          data-test="live-button-on"
        />
      ) : (
        <Button
          className={
            classnames(
              classes.liveButton,
              classes.liveButtonOff,
              { [classes.mobileLiveButton]: isMobile }
            )
          }
          classes={
            { startIcon: isMobile
              ? classes.liveButtonStartIconMobile
              : classes.liveButtonStartIcon
            }
          }
          startIcon={<LiveIconOff />}
          onClick={onSetLiveTime}
          data-test="live-button-off"
        />
      )}
    </Grid>
  );
};

LiveButton.propTypes = {
  // Timestamp with the start time of value of the time context
  startTs: StartTsPropType,
  // Time duration to be substracted from now, when live off
  timeRangeMs: PropTypes.number,
  // Function that should update the start time of the time context
  setStartTime: PropTypes.func,
  // Boolean that if true it forces the button to be with a "Live" status
  alwaysLive: PropTypes.bool,
  isLive: PropTypes.bool
};

export default LiveButton;
