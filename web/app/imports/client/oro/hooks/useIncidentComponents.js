/**
 * Hook to subscribe and return incident components defined for a company
 */
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
// ORO modules
import { IncidentConfiguration } from '../../../lib/alerts.js';

/**
 * Returns the incident components defined for a company
 */
const useIncidentComponents = () => (
  useTracker(() => {
    const handle = Meteor.subscribe('incidents.components');
    const components = IncidentConfiguration.find({}).fetch()[0] || {};
    return {
      isLoading: !handle.ready(),
      components
    };
  })
);

export default useIncidentComponents;
