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
 * Notifications container.
 *
 * Renders the newest in-app notification across the fleet, when notifications are
 * enabled by the user. Not scoped to a robot in view; the notification message
 * already names its robot.
 */
import React from 'react';
import PropTypes from 'prop-types';
// ORO modules
import useNotifications from '../hooks/useNotifications';
import NotificationsComponent from './NotificationsComponent';

const Notifications = ({ enabled }) => {
  const { notifications } = useNotifications();
  if (!enabled || !notifications.length) {
    return null;
  }
  return <NotificationsComponent key={notifications[0]._id} notification={notifications[0]} />;
};

Notifications.propTypes = {
  enabled: PropTypes.bool
};

export default Notifications;
