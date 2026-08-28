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

/** Robot name label anchored above the avatar; the selected robot's label is highlighted. */
import React from 'react';
import PropTypes from 'prop-types';
import { makeStyles } from 'tss-react/mui';
import { Paper, Typography } from '@mui/material';
import AnchoredOverlayLayer from '../Map/AnchoredOverlay';
import { PALETTE } from '../utils/utils';

const useStyles = makeStyles()((theme) => ({
  container: {
    backgroundColor: theme.palette.background.paper, color: theme.palette.text.primary,
    boxShadow: '0px 2px 6px rgba(0,0,0,0.3)', padding: '2px 6px', borderRadius: 4, opacity: 0.85,
  },
  selected: {
    '&&': { backgroundColor: PALETTE.robotPoseSelectedPrimary, color: '#fff', opacity: 0.95 },
  },
  name: { fontWeight: 500, fontSize: 12, whiteSpace: 'nowrap', color: 'inherit' },
}));

const RobotName = ({ robotPose = {}, robotDetails = {}, robotId, selected }) => {
  const { classes, cx } = useStyles();
  if (!Number.isFinite(robotPose.x) || !Number.isFinite(robotPose.y)) return null;
  return (
    <AnchoredOverlayLayer x={robotPose.x} y={robotPose.y} sizeY={0.7}>
      <Paper elevation={0} className={cx(classes.container, { [classes.selected]: selected })}>
        <Typography className={classes.name}>{robotDetails.name || robotId}</Typography>
      </Paper>
    </AnchoredOverlayLayer>
  );
};
RobotName.propTypes = { robotPose: PropTypes.object, robotDetails: PropTypes.object, robotId: PropTypes.string, selected: PropTypes.bool };
export default RobotName;
