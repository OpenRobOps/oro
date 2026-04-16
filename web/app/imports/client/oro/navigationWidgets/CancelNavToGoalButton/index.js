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
 * Cancel nav to goal button
 *
 * Button that has the purpose of stopping a moving robot by executing 'cancelNavGoal'.
 * This button will only show when the robot is moving.
 *
 * IMPORTANT: This is not a "generic cancel button", it has many specific actions
 *            for the execution of cancelNavGoal action.
 *            Reuse this component with care.
 */
import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import { IconButton } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
// ORO modules
import { useActiveInteraction } from '../../contexts/ActiveInteractionContext';
import { useIsRobotMoving } from '../../util/hooks';
import CancelNavIcon from '../../graphics/op/CancelIcon';
import { CANCEL_NAVGOAL_INTERACTION } from '../interactions.js';
import WrapWithTooltip from '../../util/WrapWithTooltip.js';
import { TOOLTIP_POSITION_LEFT } from '../../../lib/constants.js';

const useStyles = makeStyles()(theme => ({
  actionButton: {
    fontSize: '1rem',
    flexDirection: 'row',
    background: theme.palette.teleop.actionButton,
    margin: '10px 8px',
    opacity: '100%',
    boxShadow:
      '0px 3px 5px -1px rgba(0,0,0,0.2), 0px 6px 10px 0px rgba(0,0,0,0.14), 0px 1px 18px 0px rgba(0,0,0,0.12)',
    width: '36px',
    height: '36px',
    '&:hover, &.Mui-focusVisible': {
      background: theme.palette.teleop.hoverActionButton,
    }
  },
  disabled: {
    '&.Mui-disabled': {
      opacity: '65%'
    },
  }
}));

const CancelNavToGoalButton = ({ robotId }) => {
  const { executeInteraction } = useActiveInteraction();
  const { classes } = useStyles();
  const robotIsMoving = useIsRobotMoving(robotId);
  const cancelNavGoal = useCallback(() => executeInteraction(CANCEL_NAVGOAL_INTERACTION), [executeInteraction]);

  return robotIsMoving ? (
    WrapWithTooltip(
      'Exit', (
        <IconButton
          onClick={cancelNavGoal}
          size="large"
          classes={{
            root: classes.actionButton
          }}
        >
          <CancelNavIcon />
        </IconButton>
      ), { placement: TOOLTIP_POSITION_LEFT }
    )
  ) : (
    null
  );
};

CancelNavToGoalButton.propTypes = {
  robotId: PropTypes.string // Robot id to subscribe to useIsRobotMoving
};

export default CancelNavToGoalButton;
