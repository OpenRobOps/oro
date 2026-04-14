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
 * Vitals Text Entry
 *
 * This is a specific entry for the vitals. It displays information from the robot in a text form.
 * This component is used to avoid code duplication in the Vitals component, which passes a key and
 * a value as props. For example: Network usage.
 *
 * For gauge entries, use the VitalsGaugeEntry component.
 */

import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { isString, isBoolean, isObject } from 'lodash';
import { Typography, Tooltip, Grid } from '@mui/material';
import { withStyles } from 'tss-react/mui';
import VitalsHeaderLegend from '../VitalsHeaderLegend';
import { formatWithUnit } from '../../../../../lib/util';

const styles = theme => ({
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  value: {
    fontSize: '36px',
    color: theme.palette.common.white,
    fontWeight: theme.fontWeight.medium,
    maxWidth: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  valueDisabled: {
    color: theme.palette.incidents.inactive
  },
  unit: {
    fontSize: '1rem',
    fontWeight: theme.fontWeight.bold
  },
  stringValue: {
    fontWeight: theme.fontWeight.medium,
    fontSize: '24px',
    textAlign: 'center',
    color: theme.palette.common.white,
    height: '120px',
    display: 'flex',
    alignItems: 'center'
  },
  circleContainer: {
    border: `1px solid ${theme.palette.background.borderLight}`,
    borderRadius: '50%',
    height: '115px',
    width: '115px',
    alignItems: 'center',
    marginBottom: '0.5em',
    display: 'flex',
    justifyContent: 'center'
  },
  gaugeContainer: {
    paddingBottom: '0.5em',
    alignItems: 'center',
    alignContent: 'center',
    justifyContent: 'center',
    flexDirection: 'column'
  }
});

const VitalsTextEntry = (props) => {
  // NOTE: Doing poor formatting to booleans only since they don't show up properly
  // See CustomDataWidget#mapKeyValuePairs for the full explanation about this.
  // TODO(herchu) Consolidate number formatting (Use formatWithUnit or AttributeFormatter here)
  // IO-7189. Here remove the type checks; and pass precision (receive it from props first)
  let { value, unit } = props;
  const {
    classes, offline, legend, naValue, naLabel, disabled
  } = props;
  let displayAsString = false;
  if (value === undefined || naValue === value) {
    // if there is no value _or the value should be treated as N/A_,
    // then display a "no value" label (which is configurable too)
    value = (naLabel === undefined ? '--' : naLabel);
    unit = ''; // unit should not be shown in this case
  } else if (isBoolean(value) || isObject(value)) {
    value = '' + value;
    displayAsString = true;
  } else if (isString(value)) {
    displayAsString = true;
  } else {
    if (unit == '%') {
      // Percentage values are assumed to be normalized in [0..1] range
      // TODO(herchu) IO-7189 remove this scaling when using AttributeValueFormatter
      value *= 100;
    }
    // Adjust value and units if possible and needed. Since Vitals widgets can't fit many digits,
    // force precision=1
    ({ value, unit } = formatWithUnit(value, unit, { precision: 1 }));
  }
  return (
    <Grid
      container
      className={classes.gaugeContainer}
    >
      <VitalsHeaderLegend legend={legend} disabled={disabled} dataTest="gauge-legend" />
      <Tooltip title={value} placement="bottom" disableInteractive>
        {displayAsString ? (
          <Typography className={classes.stringValue}>
            {value}
          </Typography>
        ) : (
          <div className={classes.circleContainer}>
            <Typography
              data-test="mc-vitals-widget-value"
              variant="h5"
              className={
                classNames(classes.value, { [classes.valueDisabled]: offline || disabled })
              }
            >
              <span>
                {offline || disabled ? '--' : value}
              </span>
              <span className={classes.unit}>
                {unit}
              </span>
            </Typography>
          </div>
        )}
      </Tooltip>
    </Grid>
  );
};

VitalsTextEntry.propTypes = {
  classes: PropTypes.object,
  legend: PropTypes.string,
  unit: PropTypes.string,
  naValue: PropTypes.any, // value to handle as "N/A" or "--", for example -1 in a numeric stream
  naLabel: PropTypes.string, // label to display when value is "N/A"
  value: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.bool,
    PropTypes.number
  ]),
  offline: PropTypes.bool,
  disabled: PropTypes.bool,
};

export default withStyles(VitalsTextEntry, styles, { withTheme: true });
