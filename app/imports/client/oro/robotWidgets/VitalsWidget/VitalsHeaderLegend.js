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
    color: theme.palette.text.title,
    marginBottom: '6px'
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
