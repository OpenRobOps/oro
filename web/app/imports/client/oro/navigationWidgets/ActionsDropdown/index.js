/**
 * Actions Dropdown Menu
 *
 * Component in charge of subscribing to the actions available to the robot.
 * It acts as a wrapper for ActionsMenu passing the necessary props.
 */
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
// ORO modules
import ActionsDropdownComponent from './ActionsDropdownComponent';
import { ID_TYPE_ROBOT } from '../../../../shared/constants';
import { NAVIGATION_DETAIL_WIDGET, ACTIONS_PREFERENCES_FIELD, EMBEDDED_ACTION_KEY } from '../../../../lib/uiPreferences';
import { keyValueListToObject } from '../../../../lib/util';
import {
  useRobotData,
  useActionsConfig,
  useUIPreferences
} from '../../util/hooks';

// Build the list of UI preference widgets to fetch
const uiPreferencesWidgets = [NAVIGATION_DETAIL_WIDGET, ACTIONS_PREFERENCES_FIELD];

const ActionsDropdown = ({ robotId, textClasses }) => {
  // Get the robot data
  const { data: robot } = useRobotData(robotId);

  // Get UI preferences for the robot
  const { data: uiPrefs, isLoading: isUIPreferencesLoading } = useUIPreferences(
    robotId,
    ID_TYPE_ROBOT,
    uiPreferencesWidgets
  );

  // Get actions config for the robot
  const { data: actionsConfig } = useActionsConfig(robotId);

  // Build embedded actions from UI preferences and actions config
  const embeddedActions = useMemo(() => {
    const embeddedActionIds = uiPrefs?.[NAVIGATION_DETAIL_WIDGET]?.[EMBEDDED_ACTION_KEY] || [];
    return keyValueListToObject({
      elementList: embeddedActionIds,
      elementValues: actionsConfig
    });
  }, [uiPrefs, actionsConfig]);

  if (!robotId || isUIPreferencesLoading) return null;

  return (
    <ActionsDropdownComponent
      textClasses={textClasses}
      embeddedActions={embeddedActions}
      robot={robot}
      uiPrefs={uiPrefs}
    />
  );
};

ActionsDropdown.propTypes = {
  robotId: PropTypes.string,
  textClasses: PropTypes.object
};

export default ActionsDropdown;
