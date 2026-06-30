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
 * Component rendering a tab selector for all the dashboards for the
 * current user. Such dashboards are computed by querying the user's
 * UIPreferences, which will yield a list of dashboards Ids that are
 * used to retrieve all the user's dashboard configurations.
 *
 * The actual rendering of the retrieved dashboards is done by
 * the DashboardSelector component.
 */
import React from 'react';
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
import sortBy from 'lodash/sortBy';
import PropTypes from 'prop-types';
// ORO modules
// import ConfigManager, { ID_TYPE_USER } from '../../../lib/configManager';
import { UIPreferences } from '../../../lib/collections';
import { Dashboards } from '../../../lib/dashboards';
import DashboardSelector from './DashboardSelector';
import Dashboard from '../Dashboard';
import NotificationsClient from '../Notifications';
import { UrlContextProvider } from '../contexts/UrlContextContext';
import RobotOfflineBar from '../util/RobotOfflineBar';

const DashboardContainer = props => (
  <UrlContextProvider>
    <DashboardSelector
      {...props}
      Dashboard={Dashboard}
      NotificationsClient={NotificationsClient}
      RobotOfflineBar={RobotOfflineBar}
    />
  </UrlContextProvider>
);

/**
 * Dashboard selector container, fetching dashboards for the current user
 * (if any), and passing down them to a DashboardSelector widget.
 */
const DashboardSelectorContainer = (props) => {
  const { urlDashboardId } = props;
  const trackerData = useTracker(() => {
    const userId = Meteor.userId();

    if (!userId) { // TODO(herchu) re-enable when log in is implemented
      return { isLoading: true };
    }

    const dashboardCfg = {};
    // Compute list of dashboard Ids for the current user by grabbing
    // all available dashboards in the Company -> Role -> User hierarchy,
    // and filtering out those not visible for the user's role.
    const dashboardIds = Object.entries(dashboardCfg.dashboards || {})
      .reduce((acc, [id, visible]) => (visible ? [...acc, id] : acc), []);

    const dashboardsHandle = Meteor.subscribe('user.dashboards', { dashboardIds });
    if (!dashboardsHandle.ready()) {
      return { isLoading: true };
    }

    const userDashboardSpecs = Dashboards.find({}).fetch();

    // Dashboard sorting:
    // Attempt to use an integer "order" property for sorting. If
    // property isn't present, fallback to the "label" property.
    const dashboardSpecs = sortBy(userDashboardSpecs, ['order', 'label']);

    // Get the initially selected dashboard configuration if it is present
    const { initialDashboardId } = dashboardCfg.dashboards || {};

    return { isLoading: false, dashboardSpecs, initialDashboardId };
  }, []);
  // The selected dashboard is derived from the URL, not the subscription. Keeping
  // it out of the tracker deps stops a tab switch from tearing down and re-running
  // the subscription, which flashed a loading state on every tab change.
  const dashboardId = urlDashboardId || null;
  return <DashboardContainer {...props} {...trackerData} dashboardId={dashboardId} />;
};

DashboardSelectorContainer.propTypes = {
  urlDashboardId: PropTypes.string, // dashboardId obtained from the URL (initial dashboard)
};

export default DashboardSelectorContainer;
