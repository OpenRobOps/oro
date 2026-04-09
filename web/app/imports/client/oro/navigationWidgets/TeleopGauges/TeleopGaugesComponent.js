/**
 * Renders the teleoperation gauges:
 * linear speed, connection quality, and angular velocity.
 */
import React from 'react';
import { toNumber } from 'lodash';
import PropTypes from 'prop-types';
import { Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
// ORO Modules
import SpeedGauge from './SpeedGauge';
import ConnectionQuality from '../../util/ConnectionQuality/index.js';

// Zero data placeholder values for speed gauges
const speedLinearZeroData = 0.28;
const speedAngularZeroData = -0.28;

const useStyles = makeStyles()(() => ({
  controlsContainer: {
    height: '100%',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '4px',
  },
  speedGaugesRow: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    width: '100%',
  },
  speedGaugeContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
  },
  label: {
    fontSize: '0.65rem',
    fontWeight: 400,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  },
  networkRow: {
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
  },
}));

const TeleopGauges = (props) => {
  const {
    maxLinearVel, speedLinearObj = {}, offline,
    robotId, networkStatus, maxAngularVel, speedAngularObj = {},
    handleNetworkStatus,
    angularGaugePrefs, linearGaugePrefs, isZeroData
  } = props;

  const { classes } = useStyles();

  // Default to 'signed' variant for angular gauge
  const angularGaugeVariant = 'signed';

  return (
    <div className={classes.controlsContainer}>
      <div className={classes.speedGaugesRow}>
        <div className={classes.speedGaugeContainer}>
          <Typography className={classes.label}>Speed</Typography>
          <SpeedGauge
            minValue={linearGaugePrefs?.minValue || 0}
            maxValue={linearGaugePrefs?.maxValue || maxLinearVel}
            value={isZeroData ? speedLinearZeroData : toNumber(speedLinearObj.value)}
            ts={speedLinearObj.ts}
            unit={linearGaugePrefs?.unit || 'm/sec'}
            offline={offline && !isZeroData}
            isZeroData={isZeroData}
          />
        </div>
        <div className={classes.speedGaugeContainer}>
          <Typography className={classes.label}>Rotation</Typography>
          <SpeedGauge
            maxValue={angularGaugePrefs?.maxValue || maxAngularVel}
            value={isZeroData ? speedAngularZeroData : toNumber(speedAngularObj.value)}
            ts={speedLinearObj.ts}
            unit={angularGaugePrefs?.unit || 'rad/sec'}
            offline={offline && !isZeroData}
            variant={isZeroData ? 'signed' : angularGaugeVariant}
            isZeroData={isZeroData}
          />
        </div>
      </div>
      <div className={classes.networkRow}>
        <ConnectionQuality
          robotId={robotId}
          offline={offline}
          onNetworkStatus={handleNetworkStatus}
          networkStatus={networkStatus}
          isZeroData={isZeroData}
        />
      </div>
    </div>
  );
};

TeleopGauges.propTypes = {
  robotId: PropTypes.string,
  offline: PropTypes.bool,
  maxLinearVel: PropTypes.number,
  maxAngularVel: PropTypes.number,
  speedLinearObj: PropTypes.object,
  speedAngularObj: PropTypes.object,
  networkStatus: PropTypes.number,
  handleNetworkStatus: PropTypes.func,
  angularGaugePrefs: PropTypes.object,
  linearGaugePrefs: PropTypes.object,
  isZeroData: PropTypes.bool,
};

export default TeleopGauges;
