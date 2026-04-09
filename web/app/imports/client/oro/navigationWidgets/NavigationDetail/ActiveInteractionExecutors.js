/**
 * Wraps the components that register callbacks and execute the navigation
 * related interactions (navigation, relocalize, etc.)
 */
import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
// ORO imports
import { useActionsConfig } from '../../util/hooks';
import { useActiveInteraction } from '../../contexts/ActiveInteractionContext';
import { useTimeStampHintContext } from '../../contexts/navigationDetail/TimeStampContext';
import {
  NAVIGATE_TO_ACTION_ID,
  RELOCALIZE_ACTION_ID,
  CANCEL_NAV_GOAL_ID,
  NAVIGATE_PATH_ID
} from '../../../../lib/actions';
import { CANCEL_NAVGOAL_INTERACTION, NAVIGATE_MODE, PRECISION_MODE, RELOCALIZE_MODE, TELEOP_MODE } from '../interactions';

const ActiveInteractionExecutors = ({
  robotId,
  executeAction
}) => {
  const { setInteractionCallback, clearInteractionCallback } = useActiveInteraction();
  const { data: actionsConfig } = useActionsConfig(robotId);
  const { getTsHint } = useTimeStampHintContext();

  // Precision Teleop
  useEffect(() => {
    setInteractionCallback(PRECISION_MODE, ({ angle, distance }) => {
      // Primitive version of precision teleop currently sends a path navigation
      // with two waypoints in robot reference: first an angle only, then a position + angle
      // In the future, this should be configurable and flexible.
      const x = distance * Math.cos(angle);
      const y = distance * Math.sin(angle);
      const theta = angle;

      // Get agent-time timestamp of latest rendered sensor information
      // TODO: Provide user feedback in case we can already tell tsHint will be too old
      const tsHint = getTsHint();
      if (tsHint === 0) console.warn('During NavigatePath command, missing tsHint information');

      executeAction({
        action: {
          ...actionsConfig[NAVIGATE_PATH_ID],
          actionId: NAVIGATE_PATH_ID,
          args: {
            frame: 2, // Robot frame
            tsHint,
            waypoints: [{
              theta,
            }, {
              x, y, theta
            }]
          }
        }
      });

      return true;
    });

    return () => clearInteractionCallback(PRECISION_MODE);
  }, [executeAction, actionsConfig, getTsHint, setInteractionCallback, clearInteractionCallback]);

  useEffect(() => {
    // Waypoint Teleop
    setInteractionCallback(NAVIGATE_MODE, ({ pose }) => {
      executeAction({
        action: {
          ...actionsConfig[NAVIGATE_TO_ACTION_ID],
          actionId: NAVIGATE_TO_ACTION_ID,
          args: { pose }
        }
      });
      return true;
    });

    // Relocalize
    setInteractionCallback(RELOCALIZE_MODE, ({ pose }) => {
      executeAction({
        action: {
          ...actionsConfig[RELOCALIZE_ACTION_ID],
          actionId: RELOCALIZE_ACTION_ID,
          args: {
            deltaPose: pose
          }
        }
      });
      return true;
    });

    // Cancel Nav Goal
    setInteractionCallback(CANCEL_NAVGOAL_INTERACTION, () => {
      executeAction({
        action: {
          ...actionsConfig[CANCEL_NAV_GOAL_ID],
          actionId: CANCEL_NAV_GOAL_ID
        }
      });
      return true;
    });

    return () => {
      clearInteractionCallback(NAVIGATE_MODE);
      clearInteractionCallback(RELOCALIZE_MODE);
      clearInteractionCallback(CANCEL_NAVGOAL_INTERACTION);
    };
  }, [executeAction, actionsConfig, setInteractionCallback, clearInteractionCallback]);

  // Teleop doesn't need to execute anything after it's finished
  useEffect(() => {
    setInteractionCallback(TELEOP_MODE, () => true);
    return () => clearInteractionCallback(TELEOP_MODE);
  }, [setInteractionCallback, clearInteractionCallback]);

  return null;
};

ActiveInteractionExecutors.propTypes = {
  // Robot ID that these actions should be executed for
  robotId: PropTypes.string,
  // callback to execute actions passed from WithActionsContext
  executeAction: PropTypes.func,
};

export default React.memo(ActiveInteractionExecutors);
