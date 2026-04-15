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
 * No Robot selected icon:
 * This icon is used when the user is looking at a robot Widget without a robot selected
 */
import React from 'react';
import classnames from 'classnames';
import { Bot } from 'lucide-react';
import { withStyles } from 'tss-react/mui';
import { Grid, Typography } from '@mui/material';

const styles = (theme) => ({
  noRobotSelectedIcon: {
    display: 'flex',
    alignSelf: 'center',
    padding: '10px',
    color: theme.palette.text.title,
    flexShrink: 0,
  },
  currentNoRobotTypography: {
    fontSize: '0.875rem',
    fontWeight: theme.fontWeight.lightPlus,
    textAlign: 'center',
    color: theme.palette.text.title
  },
  currentNoRobotBoldTypography: {
    fontSize: '0.875rem',
    fontWeight: theme.fontWeight.medium
  },
  noRobotSelectedContainer: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    minHeight: '245px',
  }
});

const NoRobotSelectedIcon = ({ classes }) => (
  <Grid container className={classes.noRobotSelectedContainer}>
    <Bot
      className={classes.noRobotSelectedIcon}
      size={64}
      strokeWidth={1.5}
      aria-hidden
    />
    <Typography
      className={classnames(
        classes.currentNoRobotTypography,
        classes.currentNoRobotBoldTypography
      )}
    >
      No robot selected.
    </Typography>
    <Typography className={classes.currentNoRobotTypography}>
      Select a robot to see content here.
    </Typography>
  </Grid>
);

export default withStyles(NoRobotSelectedIcon, styles, { withTheme: true });
