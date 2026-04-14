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
 * TimeIntervalHook
 *
 * Renders time period selection buttons (1h, 1d, 1w, etc.) and page navigation
 * buttons (prev, next, last), passing time context props to a render function.
 */
import React, { useCallback, useMemo } from 'react';
import moment from 'moment';
import useMediaQuery from '@mui/material/useMediaQuery';
import PropTypes from 'prop-types';
import { makeStyles } from 'tss-react/mui';
import { Button, ButtonGroup } from '@mui/material';
import classnames from 'classnames';
import LastPageIcon from '@mui/icons-material/LastPage';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import {
  isLive, getPeriod, getIntervalInMs, getAbsoluteEndTs, getDefaultTimeRangeMs, StartTsPropType,
  LIVE_TIME,
  PAGE_LAST, PAGE_NEXT, PAGE_PREV,
  MILLIS_IN_SECOND, MILLIS_IN_MINUTE, MILLIS_IN_HOUR, MILLIS_IN_DAY, MILLIS_IN_WEEK,
  PERIOD_SECOND, PERIOD_MINUTE, PERIOD_HOUR, PERIOD_DAY, PERIOD_WEEK, PERIOD_MONTH, PERIOD_CUSTOM,
  LABELS_SECOND, LABELS_MINUTE, LABELS_HOUR, LABELS_DAY, LABELS_WEEK, LABELS_MONTH, LABELS_CUSTOM,
  PERIODS
} from '.';
import { isObject } from 'lodash';

const useStyles = makeStyles()(theme => ({
  mobileButtonContainer: {
    '.MuiButtonGroup-grouped': {
      minWidth: '15px',
    }
  },
  smallerButtonContainer: {
    '.MuiButtonGroup-grouped': {
      minWidth: '25px',
    }
  },
  mobileButton: {
    padding: '0px !important'
  },
  buttonContainer: {
    borderRadius: '5px',
    height: '21px',
    margin: '0 2px'
  },
  button: {
    padding: '2px 8px',
    color: theme.palette.text.buttonText,
    fontSize: '0.8125rem',
    fontFamily: 'Inter, Helvetica, Arial, sans-serif',
    fontWeight: 500,
    textTransform: 'capitalize',
    border: `1px solid ${theme.palette.background.borderLight}`,
    backgroundColor: theme.palette.background.default,
    '&:hover': {
      backgroundColor: theme.palette.background.spaceIntelligence,
      border: `1px solid ${theme.palette.background.borderLight} !important`,
      opacity: 0.7,
    },
    '&.Mui-disabled': {
      color: theme.palette.text.buttonText,
      opacity: 0.4,
      border: `1px solid ${theme.palette.background.borderLight}`,
      backgroundColor: theme.palette.background.default,
    },
  },
  selected: {
    color: `${theme.palette.text.primary} !important`,
    opacity: '1 !important',
    backgroundColor: `${theme.palette.background.selected} !important`,
    border: `1px solid ${theme.palette.background.borderLight} !important`,
    '&.Mui-disabled': {
      color: `${theme.palette.text.primary} !important`,
      opacity: '1 !important',
      backgroundColor: `${theme.palette.background.selected} !important`,
    },
  },
  disabled: {
    color: theme.palette.text.buttonText
  }
}));

// Minimum selectable time period in milliseconds.
const MIN_SELECTABLE_PERIOD_MS = PERIODS[PERIOD_SECOND].timeframeSeconds;

const renderPeriodOption = (buttonId, {
  setTimeWrapper, timeRangeMs, classes, staticTimeOnly, isMobile, startTs, nowTs
}, buttonLabel) => {
  const [period] = getPeriod(timeRangeMs);
  const isSelectedPeriod = period === buttonId;
  const isCustom = buttonId === PERIOD_CUSTOM;
  const newTimeRangeMs = getIntervalInMs(buttonId);

  const onClick = staticTimeOnly
    ? () => setTimeWrapper({ dateStart: nowTs - newTimeRangeMs, timeRangeMs: newTimeRangeMs })
    : () => setTimeWrapper({ dateStart: startTs, timeRangeMs: newTimeRangeMs });

  return (
    <Button
      key={buttonId}
      className={classnames(classes.button, {
        [classes.selected]: isSelectedPeriod,
        [classes.disabled]: isSelectedPeriod,
        [classes.mobileButton]: isMobile
      })}
      data-test={`timeline-mixin-${buttonId}-button`}
      onClick={onClick}
      disabled={isCustom || isSelectedPeriod}
    >
      {buttonLabel || buttonId}
    </Button>
  );
};

const renderPageOption = (buttonId, {
  setTimeWrapper, startTs, timeRangeMs, classes, staticTimeOnly, nowTs, isMobile
}, buttonLabel) => {
  const live = isLive(startTs);
  const dateNow = moment(nowTs);
  const dateStart = live
    ? dateNow.clone().subtract(timeRangeMs / 1000, 'seconds')
    : moment(Number(startTs));
  const isSelected = (buttonId === PAGE_LAST || buttonId === PAGE_NEXT) && live;
  const enabled = !isSelected;

  let dateStartAux = dateStart;
  switch (buttonId) {
    case PAGE_LAST:
      dateStartAux = !staticTimeOnly ? LIVE_TIME : nowTs - timeRangeMs;
      break;
    case PAGE_PREV:
      dateStartAux = dateStartAux.subtract(timeRangeMs / 1000, 'seconds');
      break;
    case PAGE_NEXT:
      dateStartAux = dateStartAux.clone().add(timeRangeMs / 1000, 'seconds');
      break;
    default:
      break;
  }

  if (!isLive(dateStartAux)
    && dateStartAux.valueOf() + timeRangeMs + MIN_SELECTABLE_PERIOD_MS > nowTs) {
    dateStartAux = !staticTimeOnly ? LIVE_TIME : nowTs - timeRangeMs;
  }

  return (
    <Button
      key={buttonId}
      className={classnames(
        classes.button,
        { [classes.selected]: isSelected },
        { [classes.mobileButton]: isMobile }
      )}
      disabled={!enabled}
      onClick={() => setTimeWrapper({ dateStart: dateStartAux })}
    >
      {buttonLabel || buttonId}
    </Button>
  );
};

const renderPeriodOptions = (args) => {
  const { classes, width, isMobile } = args;

  if (isMobile) {
    return [
      <ButtonGroup key="page-options" className={classnames(classes.buttonContainer, classes.mobileButtonContainer)} aria-label="">
        {renderPageOption(PAGE_PREV, args, <ChevronLeftIcon fontSize="8px" />)}
        {renderPageOption(PAGE_NEXT, args, <NavigateNextIcon fontSize="8px" />)}
        {renderPageOption(PAGE_LAST, args, <LastPageIcon fontSize="8px" />)}
      </ButtonGroup>,
      <ButtonGroup key="period-options" className={classnames(classes.buttonContainer, classes.mobileButtonContainer)} aria-label="">
        {renderPeriodOption(PERIOD_SECOND, args, LABELS_SECOND[2])}
        {renderPeriodOption(PERIOD_MINUTE, args, LABELS_MINUTE[2])}
        {renderPeriodOption(PERIOD_HOUR, args, LABELS_HOUR[2])}
        {renderPeriodOption(PERIOD_DAY, args, LABELS_DAY[2])}
        {renderPeriodOption(PERIOD_WEEK, args, LABELS_WEEK[2])}
        {renderPeriodOption(PERIOD_MONTH, args, LABELS_MONTH[2])}
        {renderPeriodOption(PERIOD_CUSTOM, args, LABELS_CUSTOM[2])}
      </ButtonGroup>
    ];
  } else if (width <= 800) {
    return [
      <ButtonGroup key="page-options" className={classnames(classes.buttonContainer, classes.smallerButtonContainer)} aria-label="">
        {renderPageOption(PAGE_PREV, args, <ChevronLeftIcon fontSize="0.8125rem" />)}
        {renderPageOption(PAGE_NEXT, args, <NavigateNextIcon fontSize="0.8125rem" />)}
        {renderPageOption(PAGE_LAST, args, <LastPageIcon fontSize="0.8125rem" />)}
      </ButtonGroup>,
      <ButtonGroup key="period-options" className={classnames(classes.buttonContainer, classes.smallerButtonContainer)} aria-label="">
        {renderPeriodOption(PERIOD_SECOND, args, LABELS_SECOND[1])}
        {renderPeriodOption(PERIOD_MINUTE, args, LABELS_MINUTE[1])}
        {renderPeriodOption(PERIOD_HOUR, args, LABELS_HOUR[1])}
        {renderPeriodOption(PERIOD_DAY, args, LABELS_DAY[1])}
        {renderPeriodOption(PERIOD_WEEK, args, LABELS_WEEK[1])}
        {renderPeriodOption(PERIOD_MONTH, args, LABELS_MONTH[1])}
        {renderPeriodOption(PERIOD_CUSTOM, args, LABELS_CUSTOM[1])}
      </ButtonGroup>
    ];
  }
  return [
    <ButtonGroup key="page-options" className={classes.buttonContainer} aria-label="">
      {renderPageOption(PAGE_PREV, args)}
      {renderPageOption(PAGE_NEXT, args)}
      {renderPageOption(PAGE_LAST, args)}
    </ButtonGroup>,
    <ButtonGroup key="period-options" className={classes.buttonContainer} aria-label="">
      {renderPeriodOption(PERIOD_SECOND, args, LABELS_SECOND[0])}
      {renderPeriodOption(PERIOD_MINUTE, args, LABELS_MINUTE[0])}
      {renderPeriodOption(PERIOD_HOUR, args, LABELS_HOUR[0])}
      {renderPeriodOption(PERIOD_DAY, args, LABELS_DAY[0])}
      {renderPeriodOption(PERIOD_WEEK, args, LABELS_WEEK[0])}
      {renderPeriodOption(PERIOD_MONTH, args, LABELS_MONTH[0])}
      {renderPeriodOption(PERIOD_CUSTOM, args, LABELS_CUSTOM[0])}
    </ButtonGroup>
  ];
};

const changePeriodOnRangeUpdate = setTimeWrapper => ({
  newXStart, newXEnd
}) => {
  const newDateStart = moment(newXStart);
  const newDateEnd = moment(newXEnd);
  if (newDateStart.isValid() && newDateEnd.isValid() && newDateStart < newDateEnd) {
    const newTimeRangeMs = newDateEnd - newDateStart;
    const [period] = getPeriod(newTimeRangeMs);
    let newPeriod;
    if (newTimeRangeMs <= MILLIS_IN_SECOND * 1.5) {
      newPeriod = PERIOD_SECOND;
    } else if (newTimeRangeMs <= MILLIS_IN_MINUTE * 1.5) {
      newPeriod = PERIOD_MINUTE;
    } else if (newTimeRangeMs <= MILLIS_IN_HOUR * 1.25) {
      newPeriod = PERIOD_HOUR;
    } else if (newTimeRangeMs <= MILLIS_IN_DAY) {
      newPeriod = PERIOD_DAY;
    } else if (newTimeRangeMs <= MILLIS_IN_WEEK) {
      newPeriod = PERIOD_WEEK;
    } else {
      newPeriod = PERIOD_WEEK;
    }
    if (newPeriod !== period) {
      setTimeWrapper({ dateStart: newDateStart, timeRangeMs: newTimeRangeMs });
    }
  }
};

const TimeIntervalHook = (props) => {
  const {
    startTs, nowTs, timeRangeMs: propsTimeRangeMs,
    setStartTime, setTimeRangeMs, config, onTimeFocusChange, width
  } = props;
  const { classes } = useStyles();
  const timeRangeMs = propsTimeRangeMs || getDefaultTimeRangeMs();
  const isMobile = useMediaQuery('(max-width:900px)');
  const staticTimeOnly = Boolean(config?.staticTimeOnly);

  const endTs = useMemo(() => (
    getAbsoluteEndTs(startTs, timeRangeMs, nowTs)
  ), [nowTs, startTs, timeRangeMs]);

  const setTimeWrapper = useCallback(({ dateStart, timeRangeMs: newTimeRangeMs }) => {
    if (dateStart !== undefined && setStartTime) {
      setStartTime(isObject(dateStart) ? dateStart.valueOf() : dateStart);
    }
    if (newTimeRangeMs && setTimeRangeMs) {
      setTimeRangeMs(newTimeRangeMs);
    }
    if (onTimeFocusChange) {
      onTimeFocusChange(undefined);
    }
  }, [setStartTime, setTimeRangeMs, onTimeFocusChange]);

  const [, args] = getPeriod(timeRangeMs);

  const timeIntervalProps = useMemo(() => ({
    args: { ...args },
    views: renderPeriodOptions({
      setTimeWrapper, startTs, endTs, timeRangeMs, classes, staticTimeOnly, width, isMobile, nowTs
    })
  }), [startTs, endTs, timeRangeMs, staticTimeOnly, width, isMobile, nowTs, setTimeWrapper]);

  const onChangeLayout = useMemo(() => (
    changePeriodOnRangeUpdate(setTimeWrapper)
  ), [setTimeWrapper]);

  return props.render({
    timeIntervalProps,
    onChangeLayout,
    startTs,
    endTs,
    ...props
  });
};

TimeIntervalHook.displayName = 'TimeIntervalHook';

TimeIntervalHook.propTypes = {
  startTs: StartTsPropType,
  endTs: PropTypes.number,
  nowTs: PropTypes.number,
  timeRangeMs: PropTypes.number,
  setStartTime: PropTypes.func,
  setTimeRangeMs: PropTypes.func,
  config: PropTypes.object,
  width: PropTypes.number,
  render: PropTypes.func.isRequired
};

export default TimeIntervalHook;
