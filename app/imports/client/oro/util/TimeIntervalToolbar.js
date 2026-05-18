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
