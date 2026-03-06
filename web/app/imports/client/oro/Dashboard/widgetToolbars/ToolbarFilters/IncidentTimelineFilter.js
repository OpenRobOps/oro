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
import { withStyles } from 'tss-react/mui';
import SeverityFilter from '../../../util/SeverityFolder';
import IncidentComponentFilter from '../../../util/IncidentComponentFilter';
import TimeIntervalToolbar from '../../../util/TimeIntervalToolbar';
import LiveButton from '../../../util/LiveButton';
import { StartTsPropType } from '../../../util/timeUtils';

const styles = () => ({
  itemContainer: {
    display: 'flex',
    alignItems: 'center',
    maxHeight: '32px'
  }
});

const IncidentTimelineFilter = (props) => {
  const { classes, startTs, setStartTime, timeRangeMs } = props;

  return (
    <Grid container spacing={1}>
      <LiveButton
        startTs={startTs}
        timeRangeMs={timeRangeMs}
        setStartTime={setStartTime}
      />
      <Grid item className={classes.itemContainer}>
        {/* eslint-disable-next-line react/jsx-props-no-spreading */}
        <SeverityFilter {...props} />
      </Grid>
      <Grid item className={classes.itemContainer}>
        {/* eslint-disable-next-line react/jsx-props-no-spreading */}
        <IncidentComponentFilter {...props} />
      </Grid>
      <Grid item className={classes.itemContainer}>
        {/* eslint-disable-next-line react/jsx-props-no-spreading */}
        <TimeIntervalToolbar {...props} />
      </Grid>
    </Grid>
  );
};

IncidentTimelineFilter.propTypes = {
  classes: PropTypes.object,
  startTs: StartTsPropType,
  timeRangeMs: PropTypes.number,
  setStartTime: PropTypes.func
};

export default withStyles(IncidentTimelineFilter, styles);
