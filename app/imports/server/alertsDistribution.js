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
 * Distributes alerts to their configured notification channels.
 *
 * Registered as an AlertsManager listener (see incidentsManagementSubsystem). It
 * fires on open, on escalation (level change), and on resolve, and deliberately
 * skips same-level value ticks (an update whose level did not change is noise).
 *
 * Channels are resolved from the incident definition per level; on resolve the
 * union of all level channels is used (so an endpoint that heard the open also
 * hears the resolve). A referenced-but-missing channel is skipped and logged, so
 * definitions and channels can be applied in any order.
 *
 * Delivery is one-directional and best-effort: a failing endpoint is logged by
 * the webhook client and never breaks alert processing.
 */
import { RobotAlerts, IncidentConfiguration, NotificationChannels } from '../lib/alerts';
import { ALERT_STATUS_RESOLVED, SEV_OK, SEV0, SEV1 } from '../shared/alerts';
import Robot from './model/robot';
import WebhookClient from './webhookClient';
import { CHANNEL_TYPE_WEBHOOK } from './configAPI/notificationChannels';

export default class AlertsDistribution {
  constructor(webhookClient) {
    this._webhookClient = webhookClient || new WebhookClient();
  }

  handleAlertEvent = async (alertMsg, options = {}) => {
    // Skip same-level value ticks: only opens, escalations (level change) and
    // resolves are distributed. Resolve arrives without options (no isUpdate).
    if (options.isUpdate && !options.levelChanged) {
      return;
    }
    const alert = await RobotAlerts.findOneAsync({ _id: alertMsg?._id });
    if (!alert) {
      console.warn(`AlertsDistribution could not find RobotAlert ${alertMsg?._id}`);
      return;
    }
    const definition = await IncidentConfiguration.findOneAsync({ _id: alert.componentId });
    if (!definition) {
      return;
    }
    const resolved = alert.status === ALERT_STATUS_RESOLVED;
    const channelIds = resolved
      ? this._resolveChannelIds(definition)
      : (definition[alert.event?.level]?.notificationChannels || []);
    if (!channelIds.length) {
      return;
    }
    const payload = await this._buildPayload(alert, resolved);
    for (const channelId of channelIds) {
      const channel = await NotificationChannels.findOneAsync({ _id: channelId });
      if (!channel) {
        console.warn(
          `AlertsDistribution: channel "${channelId}" not found; skipping (alert ${alert._id})`);
        continue;
      }
      if (channel.type === CHANNEL_TYPE_WEBHOOK) {
        await this._webhookClient.post(channel, payload);
      } else {
        console.warn(
          `AlertsDistribution: unsupported channel type "${channel.type}" for "${channelId}"`);
      }
    }
  };

  // On resolve there is no single level, so notify every channel referenced by any
  // level (deduplicated) — an endpoint that heard the open should hear the resolve.
  _resolveChannelIds = (definition) => [...new Set([
    ...(definition[SEV0]?.notificationChannels || []),
    ...(definition[SEV1]?.notificationChannels || []),
    ...(definition[SEV_OK]?.notificationChannels || [])
  ])];

  _buildPayload = async (alert, resolved) => {
    let robotName;
    try {
      robotName = await new Robot(alert.robotId).getNameAsync();
    } catch (e) {
      // Best effort — the payload is still useful without the display name.
    }
    return {
      status: resolved ? 'resolved' : 'open',
      severity: alert.severity,
      robotId: alert.robotId,
      robotName,
      componentId: alert.componentId,
      label: alert.label,
      message: alert.message,
      value: alert.event?.attributeValue,
      formattedValue: alert.event?.formattedValue,
      alertId: alert._id,
      ts: alert.ts
    };
  };
}
