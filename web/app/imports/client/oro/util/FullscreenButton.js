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
import { CloseFullscreenIcon, OpenFullscreenIcon } from '../graphics/customNavigationIcons';

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
      <CloseFullscreenIcon
        classes={renderFullscreenIcon}
        style={style}
      />
    </IconButton>
  ) : (
    <IconButton
      aria-label="fullscreen"
      onClick={onClick}
      data-test={`${dataTest}open`}
      size="large">
      <OpenFullscreenIcon
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
