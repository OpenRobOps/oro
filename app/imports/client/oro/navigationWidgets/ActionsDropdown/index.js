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
 * Actions Dropdown Menu
 *
 * Component in charge of subscribing to the actions available to the robot
 * it will act as a wrapper for ActionsMenu passing the props necessary.
 */
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
// ORO modules
import ActionsDropdownComponent from './ActionsDropdownComponent';
import { keyValueListToObject } from '../../../../lib/util';
import {
  useRobotData,
  useActionsConfig
} from '../../util/hooks';
import { findEmbeddedActions } from '../../robotWidgets/ActionsWidget/util';

const ActionsDropdown = ({ robotId, textClasses }) => {
  // Get the robot data
  const { data: robot } = useRobotData(robotId);

  // Get actions config for the robot
  const { data: actionsConfig } = useActionsConfig(robotId);

  const embeddedActions = useMemo(() => (
    findEmbeddedActions(actionsConfig, 'navigation')
  ), [actionsConfig]);

  if (!robotId) {
    return null;
  }

  return (
    <ActionsDropdownComponent
      textClasses={textClasses}
      actions={embeddedActions}
      robot={robot}
    />
  );
};

ActionsDropdown.propTypes = {
  robotId: PropTypes.string,
  textClasses: PropTypes.object
};

export default ActionsDropdown;
