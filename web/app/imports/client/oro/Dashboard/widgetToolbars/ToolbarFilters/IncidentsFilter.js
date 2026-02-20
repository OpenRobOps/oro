/**
 * Incident widget filter
 * Provides a container for filters applied to incidents widget
 *  - Filters:
 *      - Severity
 *      - Data sources status (component)
 */
import React from 'react';
import PropTypes from 'prop-types';
import { Grid } from '@mui/material';
import { withStyles } from 'tss-react/mui';
import SeverityFilter from '../../../util/SeverityFolder';
import IncidentComponentFilter from '../../../util/IncidentComponentFilter';
import LiveButton from '../../../util/LiveButton';
import { StartTsPropType } from '../../../util/timeUtils';

const styles = () => ({
  itemContainer: {
    display: 'flex',
    alignItems: 'center',
    maxHeight: '32px'
  }
});


const IncidentsFilter = (props) => {
  const { classes, startTs, setStartTime, timeRangeMs } = props;

  return (
    <Grid container spacing={1}>
      <LiveButton
        startTs={startTs}
        timeRangeMs={timeRangeMs}
        setStartTime={setStartTime}
      />
      <Grid item className={classes.itemContainer}>
        <SeverityFilter {...props} />
      </Grid>
      <Grid item className={classes.itemContainer}>
        <IncidentComponentFilter {...props} />
      </Grid>
    </Grid>
  );
};

IncidentsFilter.propTypes = {
  classes: PropTypes.object,
  startTs: StartTsPropType,
  timeRangeMs: PropTypes.number,
  setStartTime: PropTypes.func,
};

export default withStyles(IncidentsFilter, styles);
