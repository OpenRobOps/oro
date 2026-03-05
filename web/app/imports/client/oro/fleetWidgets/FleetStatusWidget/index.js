/**
 * FleetStatusWidget — Data Fetching Container
 *
 * Subscribes to the robots_with_status publication, computes aggregated robot statuses,
 * sorts robots, and passes data to FleetStatusComponent.
 */
import React, { useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
import { isEmpty, isArray } from 'lodash';
import moment from 'moment';
import { getAggregatedRobotStatus } from '../../../../lib/status';
import { RobotsWithStatus, UIPreferences } from '../../../../lib/collections';
import { FLEET_STATUS_WIDGET } from '../../../../lib/uiPreferences';
import FleetStatusComponent from './FleetStatusComponent';
import { UI_AGG_STATUS } from '../fleetFilteringUtil';
import { AGG_STATUSES_KEY } from '../../../../shared/constants';
import { useWidgetData } from '../../contexts/WidgetDataContext';

/**
 * Fetch detailed status for a single robot attribute, shown in a tooltip.
 * @param {object} params - { robotId, attributeId, cb }
 */
const getRobotDetailedStatus = ({ robotId, attributeId, cb }) => {
  Meteor.call('status.getDetailedStatus', { robotId }, (err, status) => {
    if (err) {
      console.error('Error on status.getDetailedStatus', err);
      cb(null);
      return;
    }
    const st = status && status[attributeId];
    if (st && st.message) {
      let { message } = st;
      if (st.ts) {
        message += ` (Last reported ${moment(st.ts).fromNow()})`;
      }
      cb(message);
    } else {
      cb('No status data available');
    }
  });
};

const FleetStatusWidgetContainer = ({
  config: widgetConfig,
  robotStatus: statusFilter,
  ...other
}) => {
  const { setWidgetTitle } = useWidgetData();

  // Fetch fleet status config from UIPreferences
  const uiPrefs = useTracker(() => {
    const handle = Meteor.subscribe('ui.preferences', {
      widget: [FLEET_STATUS_WIDGET],
    });
    if (!handle.ready()) return null;
    return UIPreferences.findOne();
  }, []);

  // Resolve statusList and statusValues: UIPreferences first, widget config as override
  const { elementList: uiElementList, elementValues: uiElementValues } =
    (uiPrefs?.[FLEET_STATUS_WIDGET]) || {};

  let statusList = uiElementList;
  let statusValues = uiElementValues;
  // If the widget has its own config, use it as override
  if (isArray(widgetConfig?.elementList) && widgetConfig.elementList.length) {
    statusList = widgetConfig.elementList;
    statusValues = widgetConfig.elementValues;
  }

  // Subscribe to robots_with_status publication
  const { robotDocs, isLoading: isRobotsLoading } = useTracker(() => {
    if (!statusList) return { robotDocs: [], isLoading: true };
    const handle = Meteor.subscribe('robots_with_status', {
      statusList,
      statusFilter,
    });
    return {
      robotDocs: RobotsWithStatus.find({}).fetch(),
      isLoading: !handle.ready(),
    };
  }, [JSON.stringify(statusList), statusFilter]);

  const isLoading = !uiPrefs || isRobotsLoading;

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

