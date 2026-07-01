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
 * to buttons. Presentational and Meteor-free: the run and dismiss methods are
 * injected as props by the container (see index.js).
 */
import React, { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useTheme } from '@mui/material/styles';
import Banner from '../util/Banner';

const NotificationsComponent = ({ notification, runManualAction, dismiss }) => {
  const theme = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const runAction = useCallback((actionId) => {
    setBusy(true);
    setError(null);
    runManualAction({ notificationId: notification._id, actionId })
      .then(() => setBusy(false))
      .catch((err) => {
        setBusy(false);
        setError(err.reason || err.message);
      });
  }, [notification._id, runManualAction]);

  const onDismiss = useCallback(() => {
    dismiss({ notificationId: notification._id });
  }, [notification._id, dismiss]);

  const actions = useMemo(() => {
    const list = (notification.actions || []).map((action) => ({
      label: action.label,
      onClick: () => runAction(action.actionId),
      disabled: busy
    }));
    list.push({ 
      label: 'Dismiss',
      onClick: onDismiss,
      disabled: false,
      subtle: true
    });
    return list;
  }, [notification.actions, busy, runAction, onDismiss]);

  const statusColor = useMemo(
    () => theme.palette.severityColor?.[notification.severity],
    [notification.severity]
  );

  const message = useMemo(
    () => (error
      ? `${notification.message} (action failed: ${error})`
      : notification.message),
    [error, notification.message]
  );

  return (
    <Banner
      open
      message={message}
      actions={actions}
      statusColor={statusColor}
      statusContent={notification.severity}
    />
  );
};

NotificationsComponent.propTypes = {
  notification: PropTypes.object.isRequired,
  runManualAction: PropTypes.func.isRequired,
  dismiss: PropTypes.func.isRequired
};

export default NotificationsComponent;
