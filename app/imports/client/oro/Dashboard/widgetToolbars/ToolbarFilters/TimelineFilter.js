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
 * TimelineFilter
 * Provides a container for filters applied to timeline and sets
 * the time start/end currently visible in the calendar
 */
import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { Grid } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
// ORO modules
import TimeIntervalToolbarWithHook from '../../../util/TimeIntervalToolbar';
import LiveButton from '../../../util/LiveButton';
import { StartTsPropType } from '../../../util/timeUtils';

const useStyles = makeStyles()(() => ({
  container: {
    alignItems: 'self-end'
  }
}));

const TimeIntervalFilter = (props) => {
  const { startTs, setStartTime, timeRangeMs, config } = props;
  const { classes } = useStyles();
  // Creating a more reusable way to write widget size-dependent code
  // TODO: next time we should not copy this code, instead we have to generalize it and create our own hook.
  const [width, setWidth] = useState(null);
  const elementRef = useRef(null);

  useEffect(() => {
    setWidth(elementRef.current.offsetWidth);
  }, [elementRef]);

  // Timelines accept a staticTimeOnly config property, used in Time Capsule, that disables Live
  // mode. In that setting, we simply skip the LiveButton
  const staticTimeOnly = Boolean(config && config.staticTimeOnly);
  return (
    <Grid container ref={elementRef} spacing={1} className={classes.container}>
      { !staticTimeOnly ? (
        <LiveButton
          startTs={startTs}
          timeRangeMs={timeRangeMs}
          setStartTime={setStartTime}
        />
      ) : (/* When LiveButton is skipped, fill its space */
        <Grid item style={{ flex: 1 }} />
      )}
      <TimeIntervalToolbarWithHook width={width} {...props} />
    </Grid>
  );
};

TimeIntervalFilter.propTypes = {
  classes: PropTypes.object,
  startTs: StartTsPropType,
  setStartTime: PropTypes.func,
  timeRangeMs: PropTypes.number,
  config: PropTypes.object
};

export default TimeIntervalFilter;
