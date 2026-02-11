/**
 * Live Button Toolbar
 *
 * - Toolbar that wraps LiveButton
 *
 * IMPORTANT: Use this toolbar ONLY when the widget requires to have only
 *            the LiveButton in the toolbar if you have a more complex toolbar
 *            use another toolbar (either create a new one or use an existing one),
 *            DO NOT ADD NEW TOOLBAR ELEMENTS TO THIS WIDGET,
 *            unless you are certain of what you are doing.
 */
import React from 'react';
import PropTypes from 'prop-types';
import { Grid } from '@mui/material';
import LiveButton from '../../util/LiveButton';
import { StartTsPropType } from '../../util/timeUtils';

const LiveButtonToolbar = ({ alwaysLive, startTs, timeRangeMs, setStartTime }) => (
  // DO NOT ADD NEW TOOLBAR ELEMENTS TO THIS WIDGET (Read top IMPORTANT comment)
  <Grid container spacing={1}>
    <LiveButton
      alwaysLive={alwaysLive}
      startTs={startTs}
      timeRangeMs={timeRangeMs}
      setStartTime={setStartTime}
    />
  </Grid>
);

LiveButtonToolbar.propTypes = {
  alwaysLive: PropTypes.bool,
  startTs: StartTsPropType,
  timeRangeMs: PropTypes.number,
  setStartTime: PropTypes.func
};

export default LiveButtonToolbar;
