/**
 * Loading
 * Placeholder for a loading component when it is lazily imported
 *  or it is loading.
 * AVOID importing libraries here... Ideally no imports except react used.
 * TODO: make it pretty!
 */
import React from 'react';
// Note: Consider replacing with own implementation to make it lighter
import CircularProgress from '@mui/material/CircularProgress';
import { withStyles } from 'tss-react/mui';

const styles = () => ({
  divContainer: {
    display: 'flex',
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '5px',
    padding: '5px',
  },
  progressBar: {
    animationDuration: '600ms'
  }
});

const Loading = ({ classes = {} }) => (
  <div className={classes.divContainer}>
    <CircularProgress
      className={classes.progressBar}
      disableShrink
    />
  </div>
);

export default withStyles(Loading, styles);
