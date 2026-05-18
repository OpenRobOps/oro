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
 * Wraps the components that register callbacks and execute the navigation
 * related interactions (navigation, relocalize, etc.)
 */
import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
// ORO imports
import { useActionsConfig } from '../../util/hooks';
import { useActiveInteraction } from '../../contexts/ActiveInteractionContext';
import {
  NAVIGATE_TO_ACTION_ID,
  RELOCALIZE_ACTION_ID,
  CANCEL_NAV_GOAL_ID,
} from '../../../../lib/actions';
import { CANCEL_NAVGOAL_INTERACTION, NAVIGATE_MODE, RELOCALIZE_MODE, TELEOP_MODE } from '../interactions';

const ActiveInteractionExecutors = ({
  robotId,
  executeAction
}) => {
  const { setInteractionCallback, clearInteractionCallback } = useActiveInteraction();
  const { data: actionsConfig } = useActionsConfig(robotId);

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
