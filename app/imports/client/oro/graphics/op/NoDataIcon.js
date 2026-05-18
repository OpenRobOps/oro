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
 * No Data icon:
 * This icon is used when the user is looking at a widget and it has no data to show
 */
import React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { Database } from 'lucide-react';
import { withStyles } from 'tss-react/mui';
import { Grid, Typography } from '@mui/material';

const styles = theme => ({
  noDataIcon: {
    display: 'flex',
    alignSelf: 'center',
    padding: '10px',
    color: theme.palette.text.title,
    flexShrink: 0,
  },
  noDataTypography: {
    fontSize: '0.875rem',
    fontWeight: theme.fontWeight.lightPlus,
    textAlign: 'center',
    color: theme.palette.text.title
  },
  noDatatBoldTypography: {
    fontSize: '0.875rem',
    fontWeight: theme.fontWeight.medium
  },
  noRobotDataContainer: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    minHeight: '245px',
  }
});

const NoDataIcon = ({ classes, mainText, secondaryText }) => (
  <Grid container className={classes.noRobotDataContainer}>
    <Database
      className={classes.noDataIcon}
      size={64}
      strokeWidth={1.5}
      aria-hidden
    />
    <Typography
      className={classnames(
        classes.noDataTypography,
        classes.noDatatBoldTypography
      )}
    >
      {mainText || 'No Data to show yet.'}
    </Typography>
    <Typography className={classes.noDataTypography}>
      {secondaryText || 'Data will be displayed when the robot starts publishing it.'}
    </Typography>
  </Grid>
);

NoDataIcon.propTypes = {
  classes: PropTypes.object,
  mainText: PropTypes.string,
  secondaryText: PropTypes.string
};

export default withStyles(NoDataIcon, styles, { withTheme: true });
