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
    const incidents = Incidents.find({ robotId: { $in: robotIds } }).fetch().filter(incidentsFilterFn);
    return { isLoading: !handle.ready(), incidents };
}, [robotIds, startTs, endTs, selectedComponentFilter, selectedSeverityFilter]);

export default useIncidents;
