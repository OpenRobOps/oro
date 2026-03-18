/**
 * FleetStatusWidget — Data Fetching Container
 *
 * Subscribes to the robots_with_status publication, computes aggregated robot statuses,
 * sorts robots, and passes data to FleetStatusComponent.
 */
import React, { useMemo, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import { isEmpty } from 'lodash';
import { getAggregatedRobotStatus } from '../../../../lib/status';
import useRobotsWithStatus from '../../hooks/useRobotsWithStatus';
import { useMethod } from '../../util/meteorUtils';
import FleetStatusComponent from './FleetStatusComponent';
import { UI_AGG_STATUS } from '../fleetFilteringUtil';
import { AGG_STATUSES_KEY } from '../../../../shared/constants';
import { useWidgetData } from '../../contexts/WidgetDataContext';

const FleetStatusWidgetContainer = ({
  config: widgetConfig,
  robotStatus: statusFilter,
  ...other
}) => {
  const { setWidgetTitle } = useWidgetData();
  const { call: callGetRobotDetailedStatus } = useMethod('status.getRobotDetailedStatus');

  const statusList = widgetConfig?.elementList;
  const statusValues = widgetConfig?.elementValues;

  const { robots: robotDocs, isLoading: isRobotsLoading } = useRobotsWithStatus({
    statusList,
    statusFilter,
  });

  const isLoading = isRobotsLoading;

  // TODO: Once the publication embeds a pre-computed aggregated status per robot,
  // this client-side calculation of UI_AGG_STATUS should be removed and replaced
  // by reading that field directly from the robot document.
  // Compute aggregated status field for each robot
  const robots = useMemo(() => {
    if (isEmpty(robotDocs)) return [];
    return robotDocs.map(robot => ({
      ...robot,
      [UI_AGG_STATUS]: {
        [AGG_STATUSES_KEY]: getAggregatedRobotStatus(robot, statusList, true)
      }
    }));
  }, [robotDocs, statusList]);

  // Set the widget title to "Fleet: <n>" when robots are available
  useEffect(() => {
    setWidgetTitle(state => (
      robots?.length
        ? (
          <>
            {state.spec?.title || 'Fleet'}
            :&nbsp;
            <b>
              {robots.length}
            </b>
          </>
        )
        : state.spec?.title || 'Fleet'
    ));
  }, [robots?.length, setWidgetTitle]);

  const getRobotDetailedStatus = useCallback(async ({ robotId, attributeId }) => {
    try {
      const status = await callGetRobotDetailedStatus({ robotId });
      const st = status?.[attributeId];
      if (st?.message) {
        let { message } = st;
        if (st.ts) {
          message += ` (Last reported ${moment(st.ts).fromNow()})`;
        }
        return message;
      }
      return 'No status data available';
    } catch (err) {
      console.error('Error on status.getRobotDetailedStatus', err);
      return null;
    }
  }, [callGetRobotDetailedStatus]);

  return (
    <FleetStatusComponent
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...other}
      isLoading={isLoading}
      statusList={statusList}
      statusValues={statusValues}
      robots={robots}
      getRobotDetailedStatus={getRobotDetailedStatus}
      robotStatus={statusFilter}
    />
  );
};

FleetStatusWidgetContainer.propTypes = {
  statusList: PropTypes.arrayOf(PropTypes.string),
  statusValues: PropTypes.object,
  robotStatus: PropTypes.string,
  attributeStatus: PropTypes.object,
  onRobotSelected: PropTypes.func,
  config: PropTypes.object,
  isMobile: PropTypes.bool,
  sortBy: PropTypes.string,
  robotId: PropTypes.string,
};

export default FleetStatusWidgetContainer;
