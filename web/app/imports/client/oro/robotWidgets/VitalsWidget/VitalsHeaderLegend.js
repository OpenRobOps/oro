/**
 * Vitals Header Legend
 *
 * Displays a header used on vitals widget
 */

import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Typography } from '@mui/material';
import { withStyles } from 'tss-react/mui';

const styles = theme => ({
  legend: {
    display: 'block',
    fontWeight: theme.fontWeight.medium,
    fontSize: '16px',
    color: theme.palette.text.title
  },
  legendDisabled: {
    color: theme.palette.text.notesLight
  }
});

const VitalsHeaderLegend = (props) => {
  const {
    classes, legend, disabled, dataTest
  } = props;
  return (
    <Typography
      variant="subtitle1"
      className={classNames(classes.legend, { [classes.legendDisabled]: disabled })}
      data-test={dataTest}
    >
      {legend}
    </Typography>
  );
};

VitalsHeaderLegend.propTypes = {
  legend: PropTypes.string,
  dataTest: PropTypes.string,
  disabled: PropTypes.bool,
  classes: PropTypes.object
};

export default withStyles(VitalsHeaderLegend, styles, { withTheme: true });
