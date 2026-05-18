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
 * API wrapper for Event (Audit) Log. It is an thin wrapper over our events ingest log component.
 *
 * ** THIS MODULE IS SHARED WITH INGEST, DO NOT IMPORT METEOR-ONLY CODE HERE!
 *
 * Events can be any object. Also from this module some constants are exported to annotate
 * events always the same way, including { module, eventType }
 *
 * Current implementation is API-based, so this module simply collects batches of events and
 * performs the HTTP REST API calls. In the future this can be replaced by a queue-based
 * implementation, without changing this module's interface.
 */
import axios from 'axios';
import EventStore from './eventStore';
import {
    EVENTS_API_PATH,
  } from '../../lib/events';
  
// Maximum number of events to send in a single API call batch
const MAX_EVENTS_PER_BATCH = 20;
// Period to wait until sending queued to the API, in milliseconds
const API_REQUEST_WAIT_MS = 100;


export default class HttpEventStore extends EventStore {
  constructor({ peerKey, service, url, enabled }) {
    super();
    if (!enabled) {
        this.enabled = false;
        return;
      }
    // the events queue is a simple array, with a timer to send them with a short delay
    this.eventsQueue = [];
    this.requestTimer = null;
    // Find and configure the peer api server. Give preference to `service` field
    // for k8s autodiscovery. If found, it uses the virtual IP of that service
    // from environment variables.
    // When not given, use (if available) the URL from configuration, which likely
    // includes a real domain name and goes through external network interfaces.
    if (service) {
        const hostVar = service + '_SERVICE_HOST';
        const host = process.env[hostVar];
        console.log('Configuing event log API against service: ' + service
          + ', using variable ' + hostVar + '=' + host);
        if (!host) {
          throw new Error('Env var ' + hostVar + ' not found or without value');
        }
        this.url = `http://${host}:80`;
      } else if (url) {
        console.log('Configuring event log API from url: ' + url);
        this.url = url;
      } else {
        throw new Error('Unable to configure peer API; unknown config');
      }
      if (this.url.substr(this.url.length - 1) == '/') {
        this.url = this.url.substr(0, this.url.length - 1);
      }
      this.peerKey = peerKey;
      if (!this.peerKey) {
        throw new Error('peerKey not provided to eventLog');
      }
      // Enable the service just now
      this.enabled = true;
    }

  /**
   * Just sends any pending events. It also removes the queue to force errors in case
   * more events are received after this call.
   */
  shutdown = async () => {
    this._doSendEvents(); // send any event pending in the queue
    this.eventsQueue = null;
    this.enabled = false;
  };

  /**
   * Sends a batch of events.
   * The method is not async; but it does not need to. Events are simply queued to be sent
   * later.
   */
  sendEvents = async (dataArray) => {
    if (!dataArray.length) {
      return;
    }
    if (!this.enabled) { // ignore
      for (const evt of dataArray) {
        if (!this.loggedErrors.has(evt.eventType)) {
          this.loggedErrors.add(evt.eventType);
          console.error('Event log: Not enabled! Missed recording event of type', evt.eventType);
        }
      }
      return;
    }
    const queue = this.eventsQueue;
    const now = Date.now(); // default ts for any event without it
    dataArray.forEach((evt) => {
      if (evt) {
        queue.push({ ts: now, ...evt });
      }
    });
    // If there are too many events already queued, send them now.
    // Otherwise set a timeout callback (or wait for it if already set)
    if (queue.length >= MAX_EVENTS_PER_BATCH) {
      this._doSendEvents();
    } else if (!this.requestTimer) {
      this.requestTimer = setTimeout(this._doSendEvents, API_REQUEST_WAIT_MS);
    }
  };

  /**
   * Sends all queued events. Called from a timeout or when the events queue grows too much
   */
  _doSendEvents = async () => {
    if (this.requestTimer) {
      clearTimeout(this._requestTimer);
      this.requestTimer = null;
    }
    if (!this.eventsQueue.length) {
      return false; // nothing to do. Don't do an API call
    }
    const events = this.eventsQueue;
    this.eventsQueue = [];

    try {
      const res = await axios.post(this.url + EVENTS_API_PATH, {
        events,
        peerKey: this.peerKey
      });
      return res && res.status % 100 == 2;
    } catch (error) {
      console.error(`Event log: Failed sending event (code: ${error.code}):`, error.message);
      return false;
    }
  };

}