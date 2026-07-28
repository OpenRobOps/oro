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
 * Delivers an alert payload to a webhook channel via a single HTTP POST.
 *
 * Fire-and-forget: a delivery is never retried and never throws into the caller.
 * A send counts as delivered on a success (2xx) response; it counts as failed —
 * logged and dropped — on a non-success status, a timeout, or a network error.
 *
 * fetch and the timeout are injectable so the client can be unit-tested without
 * a real network or real waiting.
 */
const DEFAULT_TIMEOUT_MS = 5000;

export default class WebhookClient {
  constructor({ fetchImpl, timeoutMs } = {}) {
    // Node 18+/Meteor exposes a global fetch; allow overriding it for tests.
    this._fetch = fetchImpl || fetch;
    this._timeoutMs = timeoutMs || DEFAULT_TIMEOUT_MS;
  }

  /**
   * POSTs `payload` (as JSON) to `channel.url`. Returns true when the endpoint
   * replies with a success status, false otherwise (logged, never thrown).
   */
  post = async (channel, payload) => {
    const headers = { 'Content-Type': 'application/json' };
    if (channel.secret) {
      headers.Authorization = `Bearer ${channel.secret}`;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this._timeoutMs);
    try {
      const response = await this._fetch(channel.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      if (!response.ok) {
        console.warn(`WebhookClient: POST ${channel.url} responded with status ${response.status}`);
        return false;
      }
      return true;
    } catch (error) {
      console.warn(`WebhookClient: POST ${channel.url} failed: ${error.message}`);
      return false;
    } finally {
      clearTimeout(timer);
    }
  };
}
