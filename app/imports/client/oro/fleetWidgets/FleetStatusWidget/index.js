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

/**
 * FleetStatusWidget — Data Fetching Container
 *
 * Subscribes to the robots_with_status publication and passes data to FleetStatusComponent.
 *
 */
import React, { useMemo, useEffect, useCallback } from 'react';
import PropTypes from 'prop-types';
import moment from 'moment';
import { isEmpty } from 'lodash';
import { AGG_STATUS_FIELD } from '../../../../lib/status';
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

  // Read the aggregated status value added by the publication(AGG_STATUS_FIELD)
  // and reshape it into the UI_AGG_STATUS format consumed by fleetFilteringUtil.
  const robots = useMemo(() => {
    if (isEmpty(robotDocs)) return [];
    return robotDocs.map(robot => ({
      ...robot,
      [UI_AGG_STATUS]: {
        [AGG_STATUSES_KEY]: {
          // -1 means "unknown/no data" (robot never reported status);
          // distinct from 0 which means "OK" — rendered differently in the UI
          value: robot[AGG_STATUS_FIELD] ?? -1,
          label: '\u00A0', // non-breaking space keeps the table cell from collapsing when empty
          agentOnline: robot.status?.agentOnline,
        }
      }
    }));
  }, [robotDocs]);

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
