/*
 * Incident List Meteor Wrapper
 * Wraps around Incident List Component and sets Meteor dependant component and props
 */
import { Meteor } from 'meteor/meteor';
import { groupBy } from 'lodash';
import { useTracker } from 'meteor/react-meteor-data';
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
// InOrbit modules
import { Incidents } from '../../../../lib/alerts';
import IncidentListComponent from './IncidentListComponent';
import { Robots } from '../../../../lib/collections';
import { filterFunctionForRobotId } from '../fleetFilteringUtil';
import { filterFunctionForIncidents } from '../incidentFilteringUtil';
import { ID_TYPE_ROBOT } from '../../../../shared/constants';
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
  const filterFunction = useMemo(() => (
    robotId
      ? filterFunctionForRobotId(robotId)
      : NO_FILTER_FN
  ), [robotId]);

  const incidentsFilterFunction = useMemo(() => filterFunctionForIncidents({
    selectedComponentFilter,
    selectedSeverityFilter,
  }), [
    selectedComponentFilter,
    selectedSeverityFilter,
  ]);

  const { startTs, endTs } = useTimeVarsForLiveQuery(contextStartTs, timeRangeMs, nowTs);

  const [isLoading, robotsMap, robotIds, queriedIncidents] = useTracker(() => {
    const robotsHandle = Meteor.subscribe('collections.robots', {});
    const robots = robotsHandle.ready() ? Robots.find({}).fetch() : [];
    const filteredRobotIds = robots.filter(filterFunction).map(r => r._id);
    // Map from robot ID to robot object
    const robotsById = groupBy(robots, '_id');

    const incidentsHandle = robotsHandle.ready() && Meteor.subscribe('incidents.list', {
      robotIds: filteredRobotIds,
      startTs,
      endTs,
      componentId: selectedComponentFilter,
      severities: selectedSeverityFilter
    });
    const incidentsList = (incidentsHandle && incidentsHandle.ready() && Incidents.find({
      robotId: { $in: filteredRobotIds }
    }).fetch());
    return [
      !robotsHandle.ready() || !incidentsHandle || !incidentsHandle.ready(),
      robotsById,
      filteredRobotIds,
      incidentsList
    ];
  }, [filterFunction, startTs, endTs]);

  const incidents = useMemo(() => (
    (queriedIncidents || []).filter(incidentsFilterFunction)
  ), [incidentsFilterFunction, queriedIncidents]);

  return (
    <IncidentListComponent
      {...otherProps}
      isLoading={isLoading}
      incidents={incidents}
      robotsMap={robotsMap}
      robotIds={robotIds}
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
