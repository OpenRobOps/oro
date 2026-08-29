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
 * Presentational Robot Lock button. All lock state and Meteor interaction live in the
 * container (index.js); this component only renders the button and a tooltip when disabled.
 *
 * Design slides:
 * https://docs.google.com/presentation/d/1x2SdRWEqcuVYEbQoyHOaW_27FBsBWSrHlOu1vecpy74
 */
import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { LockKeyhole } from 'lucide-react';
import { makeStyles, withStyles } from 'tss-react/mui';
import { alpha } from '@mui/material/styles';
import { Button, Tooltip, Box, Typography } from '@mui/material';
import { toolbarControl, toolbarControlIcon } from '../../util/toolbarControlStyles';

const useStyles = makeStyles()(theme => ({
  buttonText: {
    color: 'inherit',
    fontSize: '14px',
    fontWeight: 400,
    lineHeight: 'normal',
    whiteSpace: 'nowrap',
  },
  button: {
    ...toolbarControl(theme),
    minWidth: 0,
  },
  buttonLocked: {
    background: alpha(theme.palette.background.white, 0.2),
    '&:hover': { background: alpha(theme.palette.background.white, 0.25) },
  },
  lockIcon: toolbarControlIcon(theme),
}));

const tooltipStyles = theme => ({
  tooltip: {
    color: theme.palette.background.white,
    backgroundColor: theme.palette.text.black,
    border: `solid 1px ${theme.palette.background.white}`,
    borderRadius: 0,
    fontSize: 13
  }
});
const CustomTooltip = withStyles(Tooltip, tooltipStyles);
CustomTooltip.muiName = 'Tooltip';

// Breakpoint style constant
const LG_BREAKPOINT = { display: { lg: 'block', xs: 'none' } };

const LockComponent = (props) => {
  const {
    locked, label, lockedBy, disabled = false, onToggleLock
  } = props;
  const { classes } = useStyles();

  const lockButton = (
    <Button
      size="small"
      variant="text"
      className={classNames(classes.button, { [classes.buttonLocked]: locked })}
      onClick={onToggleLock}
      disabled={disabled}
      title={lockedBy}
    >
      <LockKeyhole className={classes.lockIcon} />
      <Box sx={LG_BREAKPOINT}>
        <Typography className={classes.buttonText}>
          {label}
        </Typography>
      </Box>
    </Button>
  );

  if (disabled) {
    return (
      <CustomTooltip title={lockedBy} placement="bottom" disableInteractive>
        <div>
          {lockButton}
        </div>
      </CustomTooltip>
    );
  }
  return lockButton;
};

LockComponent.propTypes = {
  locked: PropTypes.bool,
  label: PropTypes.string,
  lockedBy: PropTypes.string, // tooltip text describing who holds the lock
  disabled: PropTypes.bool,
  onToggleLock: PropTypes.func, // toggles lock/unlock
};

export default LockComponent;
