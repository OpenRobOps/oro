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
 * IncidentTimelineFilter
 * Toolbar filters for the Incident Timeline widget:
 *  - Live button
 *  - Severity filter
 *  - Component (data source) filter
 *  - Time interval selector (period + page navigation)
 */
import React from 'react';
import PropTypes from 'prop-types';
import { Grid } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import SeverityFilter from '../../../util/SeverityFolder';
import IncidentComponentFilter from '../../../util/IncidentComponentFilter';
import TimeIntervalToolbar from '../../../util/TimeIntervalToolbar';
import LiveButton from '../../../util/LiveButton';
import { StartTsPropType } from '../../../util/timeUtils';

const useStyles = makeStyles()(() => ({
  itemContainer: {
    display: 'flex',
    alignItems: 'center',
    maxHeight: '32px'
  }
}));

const IncidentTimelineFilter = (props) => {
  const { startTs, setStartTime, timeRangeMs } = props;
  const { classes } = useStyles();

  return (
    <Grid container spacing={1}>
      <LiveButton
        startTs={startTs}
        timeRangeMs={timeRangeMs}
        setStartTime={setStartTime}
      />
      <Grid className={classes.itemContainer}>
        {/* eslint-disable-next-line react/jsx-props-no-spreading */}
        <SeverityFilter {...props} />
      </Grid>
      <Grid className={classes.itemContainer}>
        {/* eslint-disable-next-line react/jsx-props-no-spreading */}
        <IncidentComponentFilter {...props} />
      </Grid>
      <Grid className={classes.itemContainer}>
        {/* eslint-disable-next-line react/jsx-props-no-spreading */}
        <TimeIntervalToolbar {...props} />
      </Grid>
    </Grid>
  );
};

IncidentTimelineFilter.propTypes = {
  startTs: StartTsPropType,
  timeRangeMs: PropTypes.number,
  setStartTime: PropTypes.func
};

export default IncidentTimelineFilter;
