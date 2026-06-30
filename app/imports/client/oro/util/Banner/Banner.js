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
 * NOTE: colors are passed in via the `colors` prop (resolved by the caller from
 * the theme) rather than read from the style function's theme; the legacy
 * withStyles path does not reliably receive the app theme, so the caller resolves
 * palette values through useTheme and hands them down.
 */
import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from 'tss-react/mui';
import Collapse from '@mui/material/Collapse';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';

const useStyles = makeStyles()({
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    padding: '8px 12px 8px 14px',
    margin: '8px 16px 0',
    borderRadius: '8px',
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
});

const Banner = ({
  open, message, actions, statusColor, statusContent, colors,
}) => {
  const { classes } = useStyles();
  return (
    <Collapse in={open} timeout={400}>
      <div
        className={classes.container}
        style={{
          backgroundColor: colors.background,
          border: `1px solid ${colors.border}`,
          borderLeft: statusColor ? `4px solid ${statusColor}` : `1px solid ${colors.border}`,
        }}
      >
        <div className={classes.statusAndMessage}>
          {statusColor && statusContent && (
            <span className={classes.badge} style={{ backgroundColor: statusColor }}>
              {statusContent}
            </span>
          )}
          <Typography
            data-test="notifications-message"
            className={classes.message}
            style={{ color: colors.text }}
          >
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
              data-test={`notification-action-${action.label}`}
              sx={action.subtle
                ? { textTransform: 'none', color: colors.muted }
                : {
                  textTransform: 'none',
                  color: colors.text,
                  borderColor: colors.border,
                  '&:hover': { borderColor: colors.accent, backgroundColor: 'transparent' },
                }}
            >
              {action.label}
            </Button>
          ))}
        </div>
      </div>
    </Collapse>
  );
};

Banner.propTypes = {
  open: PropTypes.bool.isRequired,
  message: PropTypes.node.isRequired,
  actions: PropTypes.array.isRequired,
  statusColor: PropTypes.string,
  statusContent: PropTypes.node,
  // Resolved palette colors: { background, border, text, muted, accent }.
  colors: PropTypes.object.isRequired,
};

export default Banner;
