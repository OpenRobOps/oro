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
 * SecondaryButton: Outlined neutral action button. Used for Reject / Cancel
 * and other secondary actions.
 */
import React from 'react';
import PropTypes from 'prop-types';
import { Button } from '@mui/material';
import { makeStyles } from 'tss-react/mui';

const useStyles = makeStyles()(theme => ({
  button: {
    fontFamily: theme.fontFamily.ui,
    fontSize: '12px',
    fontWeight: 600,
    letterSpacing: '0.6px',
    lineHeight: '16px',
    textTransform: 'none',
    color: theme.palette.text.detailsValue,
    border: `1px solid ${theme.palette.background.rejectBorder}`,
    padding: '9px 17px',
    borderRadius: '8px',
    // The global MuiButtonBase override sets `border: 0 !important` on hover;
    // restate the border with !important so the button doesn't shift width.
    '&:hover': {
      border: `1px solid ${theme.palette.background.rejectBorder} !important`,
      backgroundColor: theme.palette.background.onHoverGray,
    },
  },
}));

const SecondaryButton = ({ className, children, ...rest }) => {
  const { classes, cx } = useStyles();
  return (
    <Button
      variant="outlined"
      className={cx(classes.button, className)}
      {...rest}
    >
      {children}
    </Button>
  );
};

SecondaryButton.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node,
};

export default SecondaryButton;
