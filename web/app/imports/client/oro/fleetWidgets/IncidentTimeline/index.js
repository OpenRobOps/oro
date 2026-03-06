/**
 * IncidentTimeline — Data Container
 *
 * Subscribes to robots and incidents publications, builds robotsMap and filtered
 * incidents list, and passes them to IncidentTimelineComponent.
 *
 * Follows the hooks pattern (useTracker) instead of withTracker.
 * Wrapped with WithNoDataMessage to handle loading and zero-data states.
 */
import React from 'react';
import PropTypes from 'prop-types';
import { prepareTimeVarsForQuery, StartTsPropType } from '../../util/timeUtils';
import WithNoDataMessage from '../../util/WithNoDataMessage';
import IncidentTimelineComponent from './IncidentTimelineComponent';
import 'react-calendar-timeline/lib/Timeline.css';
import '../../../lib/IncidentTimeline.css';
import useRobots from '../../hooks/useRobots';
import useIncidents from '../../hooks/useIncidents';

const IncidentTimeline = ({
  robotId,
  selectedComponentFilter,
  selectedSeverityFilter,
  startTs: propStartTs,
  timeRangeMs,
  nowTs,
  ...other
}) => {
  const { startTs, endTs } = prepareTimeVarsForQuery(propStartTs, timeRangeMs, nowTs);
  const { isLoading: isRobotsLoading, robotIds, robotsMap } = useRobots(robotId);
  const { isLoading: isIncidentsLoading, incidents } = useIncidents({
    robotIds,
    startTs,
    endTs,
    selectedComponentFilter,
    selectedSeverityFilter
  });

  return (
    <IncidentTimelineComponent
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...other}
      isLoading={isRobotsLoading || isIncidentsLoading}
      incidents={incidents}
      robotsMap={robotsMap}
      robotIds={robotIds}
      startTs={propStartTs}
      timeRangeMs={timeRangeMs}
      nowTs={nowTs}
    />
  );
};

IncidentTimeline.propTypes = {
  robotId: PropTypes.string,
  selectedComponentFilter: PropTypes.string,
  selectedSeverityFilter: PropTypes.array,
  startTs: StartTsPropType,
  timeRangeMs: PropTypes.number,
  nowTs: PropTypes.number,
  selectedIncident: PropTypes.string,
  onSelectedIncidentChange: PropTypes.func,
  setStartTime: PropTypes.func
};

export default WithNoDataMessage(IncidentTimeline, {
  ZeroDataComponent: IncidentTimeline,
  NoSelectionComponent: IncidentTimeline
});
