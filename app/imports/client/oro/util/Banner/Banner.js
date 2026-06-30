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
 * Displays a banner across the top of the app, following ORO's design.
 * Used for in-app incident notifications; renders a message, a severity color
 * indicator, and one button per action provided.
 */
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { withStyles } from 'tss-react/mui';
import Collapse from '@mui/material/Collapse';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';

const styles = (theme) => ({
  container: {
    paddingLeft: '30px',
    paddingRight: '35px',
    borderRadius: '10px',
    overflow: 'hidden',
    boxShadow: `5px 5px 10px ${theme.palette.boxShadow.light}, -3px -3px 5px 1px ${theme.palette.boxShadow.white}`,
    backgroundColor: theme.palette.background.white,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    [theme.breakpoints.down('1240')]: {
      flexDirection: 'column'
    }
  },
  statusAndMessage: {
    display: 'flex',
    alignItems: 'center'
  },
  status: {
    textAlign: 'center',
    padding: '4px',
    minWidth: '35px',
    height: '32px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  message: {
    padding: theme.spacing(1),
    fontWeight: 700,
    fontSize: '14px'
  },
  actions: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center'
  },
  actionButton: {
    textTransform: 'none'
  }
});

class Banner extends PureComponent {
  render() {
    const {
      open, classes, message, actions, statusColor, statusContent
    } = this.props;
    return (
      <Collapse in={open} timeout={500}>
        <Grid
          container
          className={classes.container}
          style={{ borderBottom: statusColor ? `2px solid ${statusColor}` : undefined }}
        >
          <Grid item className={classes.statusAndMessage}>
            {statusColor && (
              <Grid item className={classes.status} style={{ backgroundColor: statusColor }}>
                {statusContent}
              </Grid>
            )}
            <Typography data-test="notifications-message" className={classes.message}>
              {message}
            </Typography>
          </Grid>
          <Grid item className={classes.actions}>
            {actions.map((action) => (
              <Button
                key={action.label}
                onClick={action.onClick}
                disabled={action.disabled}
                variant="outlined"
                size="small"
                className={classes.actionButton}
                data-test={`notification-action-${action.label}`}
              >
                {action.label}
              </Button>
            ))}
          </Grid>
        </Grid>
      </Collapse>
    );
  }
}

Banner.propTypes = {
  open: PropTypes.bool.isRequired,
  message: PropTypes.node.isRequired,
  actions: PropTypes.array.isRequired,
  statusColor: PropTypes.string,
  statusContent: PropTypes.element,
  classes: PropTypes.object
};

export default withStyles(Banner, styles, { withTheme: true });
