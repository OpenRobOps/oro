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
 * Fullscreen button component
 * This button is going to open or close the fullscreen navigation if it is enabled
 *
 * Only renders the fullscreen button if navigation-layout FF is not "simple"
 */
import React, { Fragment, useMemo } from 'react';
import PropTypes from 'prop-types';
import { IconButton } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { MoveDiagonal } from 'lucide-react';
import { CloseFullscreenIcon } from '../graphics/customNavigationIcons';

const useStyles = makeStyles()(theme => ({
  button: {
    color: theme.palette.text.title
  }
}));

const FullscreenButton = ({ fullscreen, onClick, dataTest, style }) => {
  const { classes } = useStyles();
  const renderFullscreenIcon = useMemo(() => (
    { root: classes.button }
  ), [classes]);

  return !fullscreen ? (
    <IconButton
      aria-label="exit-fullscreen"
      onClick={onClick}
      data-test={`${dataTest}close`}
      size="large">
      <MoveDiagonal
        width={20}
        height={20}
        className={classes.button}
        style={style}
      />
    </IconButton>
  ) : (
    <IconButton
      aria-label="fullscreen"
      onClick={onClick}
      data-test={`${dataTest}open`}
      size="large">
      <CloseFullscreenIcon
        classes={renderFullscreenIcon}
        style={style}
      />
    </IconButton>
  );
};

FullscreenButton.propTypes = {
  fullscreen: PropTypes.bool,
  onClick: PropTypes.func,
  dataTest: PropTypes.string,
  style: PropTypes.object
};

export default FullscreenButton;
