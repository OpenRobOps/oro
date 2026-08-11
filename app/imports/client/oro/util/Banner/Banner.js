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
 * Displays a banner across the top of the app.
 * Used for in-app incident notifications; renders a severity chip, a message,
 * and one button per action provided. A `subtle` action renders as a text button.
 */
import React from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from 'tss-react/mui';
import { alpha, useTheme } from '@mui/material/styles';
import Collapse from '@mui/material/Collapse';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';

const useStyles = makeStyles()((theme) => ({
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    padding: '8px 12px 8px 14px',
    margin: '8px 16px 0',
    borderRadius: '8px',
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.background.borderLight}`,
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
    whiteSpace: 'nowrap',
  },
  message: {
    color: theme.palette.text.primary,
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
    color: theme.palette.text.primary,
    // borderLight is tuned for the paper background; on the tinted banner
    // it disappears, so derive the border from the text color instead
    borderColor: alpha(theme.palette.text.primary, 0.5),
    '&:hover': {
      borderColor: theme.palette.background.brightBlue,
      backgroundColor: 'transparent',
    },
  },
  // Outlined like the action buttons (so hover can show the same border
  // without layout shift) but with no resting border and dimmer text
  subtleButton: {
    textTransform: 'none',
    color: alpha(theme.palette.text.primary, 0.75),
    borderColor: 'transparent',
    '&:hover': {
      borderColor: theme.palette.background.brightBlue,
      backgroundColor: 'transparent',
    },
  },
}));

const Banner = ({
  open, message, actions, statusColor, accentColor, statusContent,
}) => {
  const { classes } = useStyles();
  const theme = useTheme();
  const borderColor = accentColor || statusColor;
  return (
    <Collapse in={open} timeout={400}>
      <div
        className={classes.container}
        style={borderColor ? {
          borderLeft: `4px solid ${borderColor}`,
          // Tint the banner with the accent color so it stands out from
          // the paper background the dashboard widgets use; dark themes
          // need a stronger tint to be noticeable
          backgroundColor: alpha(borderColor, theme.palette.mode === 'light' ? 0.12 : 0.24),
        } : undefined}
      >
        <div className={classes.statusAndMessage}>
          {statusColor && statusContent && (
            <span
              className={classes.badge}
              style={{
                backgroundColor: statusColor,
                // Black or white, whichever contrasts the chip color in the active theme
                color: theme.palette.getContrastText(statusColor),
              }}
            >
              {statusContent}
            </span>
          )}
          <Typography className={classes.message}>
            {message}
          </Typography>
        </div>
        <div className={classes.actions}>
          {actions.map((action) => (
            <Button
              key={action.label}
              onClick={action.onClick}
              disabled={action.disabled}
              variant="outlined"
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
};

Banner.propTypes = {
  open: PropTypes.bool.isRequired,
  message: PropTypes.node.isRequired,
  actions: PropTypes.array.isRequired,
  statusColor: PropTypes.string,
  accentColor: PropTypes.string,
  statusContent: PropTypes.node,
};

export default Banner;
