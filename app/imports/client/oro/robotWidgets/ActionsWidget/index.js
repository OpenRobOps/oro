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
 * Actions widget
 * Displays a list of actions that can be executed on robot.
 */
import React from 'react';
import { withTracker } from 'meteor/react-meteor-data';
// ORO modules
import ActionsButtons from './ActionsButtons';
import ActionsWidgetComponent from './ActionsWidgetComponent';
import WithNoDataMessage from '../../util/WithNoDataMessage';

const ActionsWidget = props => (
  <ActionsWidgetComponent {...props} ActionsButtons={ActionsButtons} />
);

const ActionsWidgetContainer = withTracker(({ config = {} }) => {
  // Optional array of actionIds to display, if not showing all actions available
  const { actionIds } = config;
  const expanded = Boolean(config.expanded);
  const bigButtons = Boolean(config.bigButtons);

  return {
    expanded,
    bigButtons,
    actionIds
  };
})(ActionsWidget);

// We are passing the same component as ZeroDataComponent
// because it knows how to handle its zero data state
export default WithNoDataMessage(ActionsWidgetContainer, {
  ZeroDataComponent: ActionsWidgetContainer
});
