/**
 * Vitals Gauge Entry
 *
 * This is a specific entry for the vitals. It displays information from the robot with a Gauge.
 * Note that values are percentages.
 *
 * For text only entries, use the VitalsTextEntry component.
 *
 * TODO Gauges should be replaced by the ones from a chart library. When it happens,
 * perhaps this component is deprecated or repurposed.
 */
import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { Typography, CircularProgress } from '@mui/material';
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
    position: 'absolute',
    display: 'block',
    fontWeight: theme.fontWeight.medium,
    color: '#FFFFFF',
    fontSize: '35px'
  },
  valueDisabled: {
    color: theme.palette.incidents.inactive
  },
  gaugeContainer: {
    position: 'relative',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: '0.5em'
  },
  backgroundRing: {
    color: '#251A38',
  },
  backgroundRingDisabled: {
    color: '#251A38'
  },
  foregroundRing: {
    color: '#FFFFFF',
    position: 'absolute',
    borderRadius: '50%'
  },
  unitLabel: {
    fontWeight: theme.fontWeight.light,
    fontSize: '24px'
  }
});

const VitalsGaugeEntry = (props) => {
  const {
    classes, legend, offline, primaryValue, disabled, naValue, naLabel
  } = props;
  let { unit } = props;
  let value;
  // Format primary value to display on the center of the gauge.
  const isInvalid = Number.isNaN(primaryValue)
    || primaryValue === undefined
    || primaryValue === naValue;
  if (!isInvalid) {
    // TODO(herchu) Consolidate number formatting (Use formatWithUnit or AttributeFormatter here)
    // IO-7189. Receive precision as props, and pass it to those functions
    ({ value, unit } = formatWithUnit(primaryValue, unit, { precision: 1 }));
  }
  return (
    <div className={classes.container}>
      <VitalsHeaderLegend legend={legend} disabled={disabled} dataTest="gauge-legend" />
      <div className={classes.gaugeContainer}>
        <Typography
          variant="subtitle1"
          className={
            classNames(
              classes.value,
              { [classes.valueDisabled]: offline || disabled || isInvalid }
            )
          }
          noWrap
        >
          {(offline || disabled || isInvalid) ? (
            <span>
              {(naLabel === undefined ? '--' : naLabel)}
            </span>
          ) : (
            <>
              <span>
                {Math.ceil(value)}
              </span>
              {unit && !disabled && (
                <span className={classes.unitLabel}>
                  {unit}
                </span>
              )}
            </>
          )}
        </Typography>
        <CircularProgress
          className={
            classNames(
              classes.backgroundRing,
              { [classes.backgroundRingDisabled]: offline || disabled || isInvalid }
            )
          }
          size={120}
          thickness={6}
          variant="determinate"
          value={100}
        />
        {!(offline || disabled || isInvalid) && (
          <CircularProgress
            className={classes.foregroundRing}
            size={120}
            thickness={6}
            variant="determinate"
            value={isInvalid ? 0 : primaryValue}
          />
        )}
      </div>
    </div>
  );
};

VitalsGaugeEntry.propTypes = {
  classes: PropTypes.object,
  legend: PropTypes.string,
  unit: PropTypes.string,
  naValue: PropTypes.any, // value to handle as "N/A" or "--", for example -1 in a numeric stream
  naLabel: PropTypes.string, // label to display when value is "N/A"
  primaryValue: PropTypes.oneOfType([
    PropTypes.string,
    PropTypes.number
  ]),
  offline: PropTypes.bool,
  disabled: PropTypes.bool
};

export default withStyles(VitalsGaugeEntry, styles, { withTheme: true });
