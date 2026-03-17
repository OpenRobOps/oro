import { useTracker } from 'meteor/react-meteor-data';
import { Meteor } from 'meteor/meteor';
import { Incidents } from '../../../lib/alerts';
import { filterFunctionForIncidents } from '../fleetWidgets/incidentFilteringUtil';

const useIncidents = ({ robotIds, startTs, endTs, selectedComponentFilter, selectedSeverityFilter }) => useTracker(() => {
    if (robotIds === null) {
      return { isLoading: true, incidents: [] };
    }
    const handle = Meteor.subscribe('incidents.list', {
      robotIds,
      startTs,
      endTs,
      componentId: selectedComponentFilter,
      severities: selectedSeverityFilter
    });
    const incidentsFilterFn = filterFunctionForIncidents({ selectedComponentFilter, selectedSeverityFilter });
    const incidents = Incidents.find({ entityId: { $in: robotIds }, entityType: 'robot' }).fetch().filter(incidentsFilterFn);
    return { isLoading: !handle.ready(), incidents };
}, [robotIds, startTs, endTs, selectedComponentFilter, selectedSeverityFilter]);

export default useIncidents;
