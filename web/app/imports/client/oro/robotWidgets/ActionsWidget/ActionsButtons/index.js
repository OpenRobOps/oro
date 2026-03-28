/*
 * Display a list of Actions and handle clicking and executing them.
 *
 * It displays actions in several different ways; according to its `variant` prop.
 * See ActionsButtonsComponent.
 *
 * The actions that it displays may be templates (actions from config), when a
 * companyId and robotId are given, or a list of prepared actions if `preparedActions`
 * is provided.
 *
 * This component is simply a Meteor wrapper over two big pieces of functionality:
 *  - executing actions, giving feedback, resolving conditionals etc: WithActionsContext
 *  - presentation of the actions buttons: ActionsListComponent. This one is in the
 *    ui-gallery for easier testing.
 */
import { Meteor } from 'meteor/meteor';
import { withTracker } from 'meteor/react-meteor-data';
import PropTypes from 'prop-types';
import { keyBy } from 'lodash';
// ORO modules
import WithActionsContext from '../../../util/WithActionsContext';
import ActionsButtonsComponent from './ActionsButtonsComponent';
import { ActionDefinitions } from '../../../../../lib/actions';
import { Robots, Preferences } from '../../../../../lib/collections';

const ActionsButtonsWithHOC = baseProps => WithActionsContext(baseProps, ActionsButtonsComponent);

const ActionsButtonsContainer = withTracker(({ robotId, preparedActions, actionIds }) => {
  // We can only get robot details if we have a specific robotId provided for these actions
  if (robotId) {
    const actionsHandle = Meteor.subscribe('actions.config');
    const robotHandle = Meteor.subscribe('robot.details', { robotId });
    const preferencesHandle = Meteor.subscribe('preferences', { keys: ['lock'] });
    const isLoading = !robotHandle.ready()
      || !preferencesHandle.ready()
      || !actionsHandle.ready();
    if (isLoading) {
      return { isLoading: true };
    }
    // For the Actions widget (with sections), allow fitlering out which actions we want to show
    const actionsQuery = Array.isArray(actionIds) ? { _id: { $in: actionIds } } : {};
    const actionsFromConfig = ActionDefinitions.find(actionsQuery).fetch();
    const robot = Robots.findOne({ _id: robotId });
    const lockConfig = Preferences.findOne({ _id: 'lock' }) || {};
    return {
      robot,
      actions: actionsFromConfig,
      lockConfig,
    };
  } else {
    // If this component is not showing actions for a robot, still pass actionList to the HOC
    // so it can render them if they are already prepared actions (as used in Banner)
    return { actions: preparedActions };
  }
})(ActionsButtonsWithHOC);

ActionsButtonsContainer.propTypes = {
  // The current robot if this actions are running on a robot.
  robotId: PropTypes.string,
  // A list of already-prepared actions, if they are for example in a notification
  // banner - they are not taken from config, but instead simply displayed
  preparedActions: PropTypes.array,
  // The widget variant for presentation. See ActionsButtonsComponent
  variant: PropTypes.string,
  // Normally all actions from config are displayed. If only a subset of them
  // should appear in this component, pass an array of ids in `actionIds`
  actionIds: PropTypes.array
};

export default ActionsButtonsContainer;
