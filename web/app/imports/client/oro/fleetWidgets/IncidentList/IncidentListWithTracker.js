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

/*
 * Incident List Meteor Wrapper
 * Wraps around Incident List Component and sets Meteor dependant component and props
 */
import { Meteor } from 'meteor/meteor';
import { keyBy } from 'lodash';
import { useTracker } from 'meteor/react-meteor-data';
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
// ORO modules
import { Incidents } from '../../../../lib/alerts';
import IncidentListComponent from './IncidentListComponent';
import { Robots } from '../../../../lib/collections';
import { filterFunctionForRobotId } from '../fleetFilteringUtil';
import { filterFunctionForIncidents } from '../incidentFilteringUtil';
import { useTimeVarsForLiveQuery } from '../../util/timeUtils';

const NO_FILTER_FN = () => true;

const IncidentListContainer = ({
  robotId,
  selectedComponentFilter,
  selectedSeverityFilter,
  startTs: contextStartTs,
  timeRangeMs,
  nowTs,
  ...otherProps
  // startTs,
  // endTs
}) => {
  const incidentsFilterFunction = useMemo(() => filterFunctionForIncidents({
    selectedComponentFilter,
    selectedSeverityFilter,
  }), [
    selectedComponentFilter,
    selectedSeverityFilter,
  ]);

  const { startTs, endTs } = useTimeVarsForLiveQuery(contextStartTs, timeRangeMs, nowTs);

  const [isLoading, queriedIncidents, robotsMap] = useTracker(() => {
    // Get all robots (to display their names)
    const robotsHandle = Meteor.subscribe('robots', {});
    const robots = robotsHandle.ready() ? Robots.find({}).fetch() : [];

    let incidentQuery = robotId ?{
      robotId: { $in: [robotId] }
    } : {};
    const incidentsHandle = Meteor.subscribe('incidents.list', {
      robotIds: robotId ? [robotId] : undefined,
      startTs,
      endTs,
      componentId: selectedComponentFilter,
      severities: selectedSeverityFilter
    });
    const incidentsList = incidentsHandle.ready() && Incidents.find(incidentQuery).fetch();
    return [
      !robotsHandle.ready() || !incidentsHandle.ready(),
      incidentsList,
      keyBy(robots, '_id')
    ];
  }, [robotId, startTs, endTs, selectedComponentFilter, selectedSeverityFilter]);

  const incidents = useMemo(() => (
    (queriedIncidents || []).filter(incidentsFilterFunction)
  ), [incidentsFilterFunction, queriedIncidents]);

  return (
    <IncidentListComponent
      {...otherProps}
      isLoading={isLoading}
      incidents={incidents}
      robotsMap={robotsMap}
    />
  );
};

IncidentListContainer.propTypes = {
  robotId: PropTypes.string,
  // startTs can be a string when live, otherwise is a number
  startTs: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  timeRangeMs: PropTypes.number,
  nowTs: PropTypes.number,
  selectedComponentFilter: PropTypes.string,
  selectedSeverityFilter: PropTypes.string
};

export default IncidentListContainer;
