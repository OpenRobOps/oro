/**
 * IncidentList
 */
import WithNoDataMessage from '../../util/WithNoDataMessage';
import IncidentListWithTracker from './IncidentListWithTracker';

// We are passing the same component as ZeroDataComponent
// because it knows how to handle its zero data state
// also, we are passing the same component if there is no robot selected
// because this component should be shown regardless of the robot selection
export default WithNoDataMessage(IncidentListWithTracker, {
  ZeroDataComponent: IncidentListWithTracker,
  NoSelectionComponent: IncidentListWithTracker
});
