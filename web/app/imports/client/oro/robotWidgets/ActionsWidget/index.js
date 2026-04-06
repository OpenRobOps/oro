/**
 * Actions widget
 * Displays a list of actions that can be executed on robot.
 */
import React from 'react';
import { withTracker } from 'meteor/react-meteor-data';
// InOrbit modules
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
