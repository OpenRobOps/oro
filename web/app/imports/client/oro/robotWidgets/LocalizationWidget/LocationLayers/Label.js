/**
 * Displays a label on the map
 */
import React from 'react';
import { Grid, Typography } from '@mui/material';
import PropTypes from 'prop-types';
import { makeStyles } from 'tss-react/mui';
// ORO Modules
import OverlayContainer from '../Map/OverlayContainer';

const useStyles = makeStyles()(theme => ({
  label: {
    fontSize: '0.875rem',
    fontWeight: theme.fontWeight.bold,
    color: theme.palette.background.white
  },
}));

const Label = ({ label }) => {
  const { classes } = useStyles();

  return (
    <OverlayContainer>
      <Grid>
        <Typography className={classes.label}>
          {label}
        </Typography>
      </Grid>
    </OverlayContainer>
  );
};

Label.propTypes = {
  label: PropTypes.string,
};

export default Label;
