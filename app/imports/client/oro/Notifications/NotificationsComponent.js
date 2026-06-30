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
 * Renders a single incident notification as a banner, mapping its manual actions
 * to buttons that run via the notifications methods. Meteor-aware only through
 * Meteor.call for running and dismissing.
 */
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Meteor } from 'meteor/meteor';
import { useTheme } from '@mui/material/styles';
import Banner from '../util/Banner';

const NotificationsComponent = ({ notification }) => {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const runAction = (actionId) => {
    setBusy(true);
    setError(null);
    Meteor.call(
      'notifications.runManualAction',
      { notificationId: notification._id, actionId },
      (err) => {
        setBusy(false);
        if (err) {
          setError(err.reason || err.message);
        }
      }
    );
  };

  const dismiss = () => {
    Meteor.call('notifications.dismiss', { notificationId: notification._id });
  };

  const actions = (notification.actions || []).map((action) => ({
    label: action.label,
    onClick: () => runAction(action.actionId),
    disabled: busy
  }));
  actions.push({ label: 'Dismiss', onClick: dismiss, disabled: false });

  const statusColor = theme.palette.severityColor
    && theme.palette.severityColor[notification.severity];
  const message = error
    ? `${notification.message} (action failed: ${error})`
    : notification.message;

  return (
    <Banner
      open
      message={message}
      actions={actions}
      statusColor={statusColor}
    />
  );
};

NotificationsComponent.propTypes = {
  notification: PropTypes.object.isRequired
};

export default NotificationsComponent;
