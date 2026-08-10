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
 * PrimaryButton: solid accent action button. Used for Approve / Save Changes
 * and other primary affirmative actions.
 *
 * Fill and ink come from background.accentSolid / text.onAccent, which are
 * guaranteed to pass WCAG AA together in every theme. Do not substitute
 * secondary.main for the fill — it is the graphic accent and is too light
 * behind text in some themes.
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
    color: theme.palette.text.onAccent,
    backgroundColor: theme.palette.background.accentSolid,
    padding: '8px 16px',
    borderRadius: '8px',
    boxShadow: '0px 1px 1px rgba(0,0,0,0.05)',
    '&:hover': {
      backgroundColor: theme.palette.background.accentPurpleHover,
    },
  },
}));

const PrimaryButton = ({ className, children, ...rest }) => {
  const { classes, cx } = useStyles();
  return (
    <Button
      variant="contained"
      disableElevation
      className={cx(classes.button, className)}
      {...rest}
    >
      {children}
    </Button>
  );
};

PrimaryButton.propTypes = {
  className: PropTypes.string,
  children: PropTypes.node,
};

export default PrimaryButton;
