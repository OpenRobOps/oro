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
 * Speed Gauge
 *
 * Circular arc gauge for speed/rotation display in the navigation detail panel.
 * The arc covers 70% of the circle, oriented like a speedometer (bottom-left to bottom-right).
 * Unsigned variant: arc starts at left, grows right.
 * Signed variant: arc starts at center, grows left (negative) or right (positive).
 */
import React from 'react';
import { CircularProgress } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { alpha } from '@mui/material/styles';
import PropTypes from 'prop-types';
import { isNumber } from 'lodash';
// ORO Modules
import { REAL_TIME_STALE_DATA_SECONDS } from '../../../../shared/uiPreferences';

// Portion of the circle the arc covers (70%)
const ARC_SIZE = 70;

// Rotate so the arc is centered at the bottom (like a speedometer).
// 126deg = 360 * (35/100), where 35 = ARC_SIZE/2
const ROOT_ROTATION = -126;

// Signed variant overrides: zero at the top (North), grows right for positive
// and left for negative values.
// This inline transform REPLACES MUI's internal rotate(-90deg) on determinate
// CircularProgress, so the arc starts at SVG 0deg (East, 3 o'clock). Combined
// with the ringWrapper rotation (ROOT_ROTATION), the start lands at North when
// East(+90) + ROOT_ROTATION + own = 0  =>  own = -90 - ROOT_ROTATION.
const signedStyleOverride = {
  transform: `rotate(${-90 - ROOT_ROTATION}deg)`,
  boxShadow: 'inset -5px 0px 4px rgba(0,0,0,0.3)',
};

const GAUGE_SIZE = 110; // px — diameter of the circular gauge

const useStyles = makeStyles()(theme => ({
  // Outer wrapper: centers the ring + overlays the text
  wrapper: {
    position: 'relative',
    width: `${GAUGE_SIZE}px`,
    height: `${GAUGE_SIZE}px`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Ring wrapper rotates the arcs into speedometer orientation
  ringWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    transform: `rotate(${ROOT_ROTATION}deg)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backgroundRing: {
    color: alpha(theme.palette.text.primary, 0.12),
    position: 'absolute',
  },
  foregroundRing: {
    color: theme.palette.incidents.ok,
    position: 'absolute',
    boxShadow: 'inset 3px -4px 5px rgba(0,0,0,0.3)',
    borderRadius: '50%',
  },
  foregroundRingZeroData: {
    color: alpha(theme.palette.incidents.ok, 0.45),
  },
  // Text overlay — centered, not rotated
  textOverlay: {
    position: 'absolute',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  value: {
    fontWeight: 600,
    fontSize: '1.4rem',
    lineHeight: 1.1,
    color: theme.palette.text.primary,
    letterSpacing: '-0.01em',
  },
  units: {
    fontSize: '0.6rem',
    fontWeight: 300,
    color: alpha(theme.palette.text.primary, 0.55),
    textAlign: 'center',
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
  },
  offline: {
    color: alpha(theme.palette.text.primary, 0.3),
  },
  zeroData: {
    color: alpha(theme.palette.text.primary, 0.45),
  },
}));

const SpeedGauge = ({
  value, ts, unit, offline, variant = 'unsigned', minValue = 0, maxValue = 100, isZeroData
}) => {
  const { classes } = useStyles();

  const normalize = (val) => {
    const denom = (maxValue - minValue) === 0 ? 1 : (maxValue - minValue);
    return Math.min(ARC_SIZE, Math.abs((val - minValue) * ARC_SIZE / denom));
  };

  const normalizeSigned = (val) => {
    const n = val / (maxValue || 1) * (ARC_SIZE / 2);
    return Math.min(ARC_SIZE / 2, Math.max(-ARC_SIZE / 2, n));
  };

  const normalizeFunc = variant === 'signed' ? normalizeSigned : normalize;

  const validSpeedVal = !offline
    && ts > Date.now() - REAL_TIME_STALE_DATA_SECONDS * 1000
    && isNumber(value);

  const speedVal = validSpeedVal || isZeroData ? value : 0;
  const progressVal = speedVal ? normalizeFunc(speedVal) : 0;

  const isOfflineDisplay = offline && !isZeroData;

  const ringStyle = variant === 'signed' ? signedStyleOverride : undefined;

  return (
    <div className={classes.wrapper}>
      {/* Rotated ring layer */}
      <div className={classes.ringWrapper}>
        <CircularProgress
          className={classes.backgroundRing}
          size={GAUGE_SIZE}
          variant="determinate"
          thickness={5}
          value={ARC_SIZE}
        />
        <CircularProgress
          className={`${classes.foregroundRing}${isZeroData ? ` ${classes.foregroundRingZeroData}` : ''}`}
          size={GAUGE_SIZE}
          thickness={5}
          variant="determinate"
          style={ringStyle}
          value={progressVal}
        />
      </div>

      {/* Text layer — always upright */}
      <div className={classes.textOverlay}>
        <span className={`${classes.value}${isOfflineDisplay ? ` ${classes.offline}` : ''}${isZeroData ? ` ${classes.zeroData}` : ''}`}>
          {isOfflineDisplay ? '-' : speedVal}
        </span>
        <span className={`${classes.units}${isOfflineDisplay ? ` ${classes.offline}` : ''}`}>
          {unit}
        </span>
      </div>
    </div>
  );
};

SpeedGauge.propTypes = {
  offline: PropTypes.bool,
  minValue: PropTypes.number,
  maxValue: PropTypes.number,
  value: PropTypes.number,
  ts: PropTypes.number,
  unit: PropTypes.string,
  variant: PropTypes.string,
  isZeroData: PropTypes.bool,
};

export default SpeedGauge;
