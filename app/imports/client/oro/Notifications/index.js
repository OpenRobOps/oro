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
 * Scopes to the robot currently in view (from the URL context) and renders the
 * newest in-app notification, when notifications are enabled by the user.
 */
import React from 'react';
import PropTypes from 'prop-types';
// ORO modules
import { readRobotProp, CTX_PROPS } from '../../../lib/context';
import useNotifications from '../hooks/useNotifications';
import NotificationsComponent from './NotificationsComponent';

const Notifications = ({ context, enabled }) => {
  const robotId = readRobotProp({ ctx: context, prop: CTX_PROPS.ROBOT_ID });
  const { notifications } = useNotifications(robotId);
  if (!enabled || !notifications.length) {
    return null;
  }
  return <NotificationsComponent notification={notifications[0]} />;
};

Notifications.propTypes = {
  context: PropTypes.object,
  enabled: PropTypes.bool
};

export default Notifications;
