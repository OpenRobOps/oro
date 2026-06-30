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
 * Displays a banner across the top of the app, following ORO's dark theme.
 * Used for in-app incident notifications; renders a severity chip, a message,
 * and one button per action provided. A `subtle` action renders as a text button.
 *
 * NOTE: colors are hardcoded to the ORO dark-theme tokens rather than read from
 * the style function's theme; the withStyles/makeStyles path here does not reliably
 * receive the app theme, so we mirror the same approach the theme uses for its
 * MuiMenu/MuiAutocomplete overrides. Tokens: background.paper #170E28,
 * background.borderLight #3E3155, text.primary #FAF0F0, text.muted #AAAAAA,
 * background.brightBlue #9E6FF3.
 */
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { withStyles } from 'tss-react/mui';
import Collapse from '@mui/material/Collapse';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';

const COLOR_BACKGROUND = '#170E28';
const COLOR_BORDER = '#3E3155';
const COLOR_TEXT = '#FAF0F0';
const COLOR_MUTED = '#AAAAAA';
const COLOR_ACCENT = '#9E6FF3';

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    padding: '8px 12px 8px 14px',
    margin: '8px 16px 0',
    borderRadius: '8px',
    backgroundColor: COLOR_BACKGROUND,
    border: `1px solid ${COLOR_BORDER}`,
  },
  statusAndMessage: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    minWidth: 0,
  },
  badge: {
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '20px',
    padding: '0 8px',
    borderRadius: '5px',
    fontSize: '0.625rem',
    fontWeight: 600,
    lineHeight: 1,
    color: '#FFFFFF',
    whiteSpace: 'nowrap',
  },
  message: {
    color: COLOR_TEXT,
    fontSize: '0.8125rem',
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    flexShrink: 0,
  },
  actionButton: {
    textTransform: 'none',
    color: COLOR_TEXT,
    borderColor: COLOR_BORDER,
    '&:hover': {
      borderColor: COLOR_ACCENT,
      backgroundColor: 'transparent',
    },
  },
  subtleButton: {
    textTransform: 'none',
    color: COLOR_MUTED,
  },
};

class Banner extends PureComponent {
  render() {
    const {
      open, classes, message, actions, statusColor, statusContent,
    } = this.props;
    return (
      <Collapse in={open} timeout={400}>
        <div
          className={classes.container}
          style={statusColor ? { borderLeft: `4px solid ${statusColor}` } : undefined}
        >
          <div className={classes.statusAndMessage}>
            {statusColor && statusContent && (
              <span className={classes.badge} style={{ backgroundColor: statusColor }}>
                {statusContent}
              </span>
            )}
            <Typography data-test="notifications-message" className={classes.message}>
              {message}
            </Typography>
          </div>
          <div className={classes.actions}>
            {actions.map((action) => (
              <Button
                key={action.label}
                onClick={action.onClick}
                disabled={action.disabled}
                variant={action.subtle ? 'text' : 'outlined'}
                size="small"
                className={action.subtle ? classes.subtleButton : classes.actionButton}
                data-test={`notification-action-${action.label}`}
              >
                {action.label}
              </Button>
            ))}
          </div>
        </div>
      </Collapse>
    );
  }
}

Banner.propTypes = {
  open: PropTypes.bool.isRequired,
  message: PropTypes.node.isRequired,
  actions: PropTypes.array.isRequired,
  statusColor: PropTypes.string,
  statusContent: PropTypes.node,
  classes: PropTypes.object,
};

export default withStyles(Banner, styles);
