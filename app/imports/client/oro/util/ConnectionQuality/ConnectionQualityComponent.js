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
 * Connection Quality
 * Dynamically displays the connection quality using a "wifi" custom icon.
 *
 * Presentation component only. Refer to ConnectionQuality.js for data fetching.
 */
import React, { useRef } from 'react';
import { makeStyles } from 'tss-react/mui';
import PropTypes from 'prop-types';
import { Typography } from '@mui/material';
import classnames from 'classnames';
import ConnectionQualityIcon from '../../graphics/ConnectionQualityIcon';
// Refresh rate of the connection quality rtt display.
const RTT_UPDATE_FREQ = 500;
const LOW_LATENCY_THRESHOLD = 100;
const MEDIUM_LOW_LATENCY_THRESHOLD = 300;
const MEDIUM_LATENCY_THRESHOLD = 500;
const HIGH_LATENCY_THRESHOLD = 800;

const useStyles = makeStyles()(theme => ({
  container: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    display: 'flex',
    fontSize: '0.875rem',
    color: theme.palette.incidents.ok,
    fontWeight: theme.fontWeight?.bold,
    alignItems: 'center',
    marginLeft: '5px'
  },
  unit: {
    display: 'flex',
    fontSize: '0.875rem',
    color: theme.palette.incidents.ok,
    fontWeight: theme.fontWeight?.light,
    alignItems: 'center',
    marginLeft: '5px'
  },
  typography: {
    display: 'flex',
    fontSize: '0.65rem',
    fontWeight: 400,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    alignItems: 'center',
    marginRight: '6px',
  },
  secondContainer: {
    display: 'flex',
    alignItems: 'center',
    marginLeft: '4px'
  },
  secondContainerZeroData: {
    opacity: 0.5
  }
}));

const UNIT = 'ms';

// Zero-data placeholder values (inlined from lib/zeroData)
const RTT_ZERO_DATA = '--';

function determineLatency({ rtt, offline, isZeroData }) {
  const LOW_LATENCY_STATUS = 4;
  const MEDIUM_LOW_LATENCY_STATUS = 3;
  const MEDIUM_LATENCY_STATUS = 2;
  const MEDIUM_HIGH_LATENCY_STATUS = 1;
  const HIGH_LATENCY_STATUS = 0;

  if (isZeroData) {
    return { barNumber: LOW_LATENCY_STATUS, rttDisplay: RTT_ZERO_DATA };
  }
  if (offline || !rtt?.ts || Date.now() - rtt.ts > 10000) {
    return { barNumber: 0, rttDisplay: '0' };
  }
  let barNumber;
  if (rtt.value < LOW_LATENCY_THRESHOLD) {
    barNumber = LOW_LATENCY_STATUS;
  } else if (rtt.value < MEDIUM_LOW_LATENCY_THRESHOLD) {
    barNumber = MEDIUM_LOW_LATENCY_STATUS;
  } else if (rtt.value < MEDIUM_LATENCY_THRESHOLD) {
    barNumber = MEDIUM_LATENCY_STATUS;
  } else if (rtt.value < HIGH_LATENCY_THRESHOLD) {
    barNumber = MEDIUM_HIGH_LATENCY_STATUS;
  } else {
    barNumber = HIGH_LATENCY_STATUS;
  }
  const rttDisplay = (Math.ceil(rtt.value * 10) / 10 || 0.0).toString();
  return { barNumber, rttDisplay };
}

const ConnectionQualityComponent = ({ rtt = {}, offline, isZeroData, onNetworkStatus, networkStatus }) => {
  const { classes } = useStyles();
  const lastUpdateRef = useRef(Date.now());
  const lastStateRef = useRef({ barNumber: 0, rttDisplay: '0' });

  // Re-compute if rtt.ts is recent enough, or if offline/zeroData forces update
  if ((rtt?.ts && rtt.ts > lastUpdateRef.current + RTT_UPDATE_FREQ) || offline || isZeroData) {
    lastStateRef.current = determineLatency({ rtt, offline, isZeroData });
    lastUpdateRef.current = Date.now();
    if (onNetworkStatus && networkStatus !== lastStateRef.current.barNumber) {
      onNetworkStatus(lastStateRef.current.barNumber);
    }
  }

  const { barNumber, rttDisplay } = lastStateRef.current;

  return (
    <div className={classes.container}>
      <Typography className={classes.typography}>
        Network
      </Typography>
      {offline && !isZeroData ? (
        <Typography className={classes.typography}>
          Offline
        </Typography>
      ) : (
        <>
          <Typography
            data-test="connection-quality-rtt"
            className={classes.value}
          >
            {rttDisplay}
          </Typography>
          <Typography
            data-test="connection-quality-unit"
            className={classes.unit}
          >
            {UNIT}
          </Typography>
        </>
      )}
      <div
        className={classnames(
          classes.secondContainer,
          { [classes.secondContainerZeroData]: isZeroData }
        )}
      >
        <ConnectionQualityIcon
          variant="determinate"
          barNumber={barNumber}
        />
      </div>
    </div>
  );
};

ConnectionQualityComponent.propTypes = {
  rtt: PropTypes.object,
  onNetworkStatus: PropTypes.func,
  networkStatus: PropTypes.number,
  offline: PropTypes.bool,
  isZeroData: PropTypes.bool
};

export default ConnectionQualityComponent;
