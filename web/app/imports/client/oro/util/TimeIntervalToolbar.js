/**
 * TimeIntervalToolbar
 * Renders period selection and page navigation buttons for timeline widgets.
 * Wraps TimeIntervalHook and exposes its views inside a flex container.
 */
import React from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from 'tss-react/mui';
import { Grid } from '@mui/material';
import TimeIntervalHook from './timeUtils/TimeIntervalHook';

const useStyles = makeStyles()(() => ({
  buttonGroupContainer: {
    display: 'flex'
  }
}));

const TimeIntervalToolbar = ({ timeIntervalProps }) => {
  const { classes } = useStyles();
  return (
    <Grid className={classes.buttonGroupContainer}>
      {timeIntervalProps && timeIntervalProps.views}
    </Grid>
  );
};

TimeIntervalToolbar.propTypes = {
  timeIntervalProps: PropTypes.object
};

const TimeIntervalToolbarWithHook = (props) => (
  <TimeIntervalHook
    render={renderProps => <TimeIntervalToolbar {...renderProps} />}
    {...props}
  />
);

export default TimeIntervalToolbarWithHook;
