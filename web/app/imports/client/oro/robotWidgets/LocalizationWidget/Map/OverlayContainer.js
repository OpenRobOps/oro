/**
 * Displays its children as an overlay in the map
 */
import React from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from 'tss-react/mui';

const useStyles = makeStyles()(theme => ({
  container: {
    backgroundColor: theme.palette.primary.main,
    boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.5)',
    display: 'flex',
    flexDirection: 'column',
    padding: '8px 8px',
    gap: '10px',
    border: `3px solid ${theme.palette.primary.main}`,
    borderRadius: '8px',
    minWidth: '80px',
    alignItems: 'center',
    opacity: 0.8,
  }
}));

const OverlayContainer = ({ children }) => {
  const { classes } = useStyles();

  return (
    <div className={classes.container}>
      {children}
    </div>
  );
};

OverlayContainer.propTypes = {
  children: PropTypes.object,
};

export default OverlayContainer;
