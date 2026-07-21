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
 * Unit tests for WebhookClient: the fire-and-forget HTTP POST used to deliver
 * alerts to webhook channels. fetch is injected so no real network is used.
 */
import { Meteor } from 'meteor/meteor';
import { expect } from 'chai';
import WebhookClient from '../webhookClient';

if (!Meteor.isTest) {
  throw new Error('This is TEST code only');
}

const CHANNEL = { _id: 'ops-webhook', type: 'webhook', url: 'https://hooks.example.com/h' };
const PAYLOAD = { status: 'open', alertId: 'a1' };

// A fetch stub that records its args and returns a configurable response.
const fakeFetch = ({ ok = true, status = 200, throws = null } = {}) => {
  const calls = [];
  const fn = async (url, opts) => {
    calls.push({ url, opts });
    if (throws) { throw throws; }
    return { ok, status };
  };
  fn.calls = calls;
  return fn;
};

describe('WebhookClient', () => {
  it('POSTs the payload as JSON', async () => {
    const fetchImpl = fakeFetch();
    const client = new WebhookClient({ fetchImpl });
    await client.post(CHANNEL, PAYLOAD);

    expect(fetchImpl.calls).to.have.length(1);
    const { url, opts } = fetchImpl.calls[0];
    expect(url).eq('https://hooks.example.com/h');
    expect(opts.method).eq('POST');
    expect(opts.headers['Content-Type']).eq('application/json');
    expect(JSON.parse(opts.body)).deep.eq(PAYLOAD);
  });

  it('adds an Authorization Bearer header when the channel has a secret', async () => {
    const fetchImpl = fakeFetch();
    const client = new WebhookClient({ fetchImpl });
    await client.post({ ...CHANNEL, secret: 'topsecret' }, PAYLOAD);

    expect(fetchImpl.calls[0].opts.headers.Authorization).eq('Bearer topsecret');
  });

  it('sends no Authorization header when the channel has no secret', async () => {
    const fetchImpl = fakeFetch();
    const client = new WebhookClient({ fetchImpl });
    await client.post(CHANNEL, PAYLOAD);

    expect(fetchImpl.calls[0].opts.headers.Authorization).to.be.undefined;
  });

  it('returns true on a success response', async () => {
    const client = new WebhookClient({ fetchImpl: fakeFetch({ ok: true, status: 200 }) });
    expect(await client.post(CHANNEL, PAYLOAD)).eq(true);
  });

  it('returns false (not thrown) on a non-success status', async () => {
    const client = new WebhookClient({ fetchImpl: fakeFetch({ ok: false, status: 500 }) });
    expect(await client.post(CHANNEL, PAYLOAD)).eq(false);
  });

  it('returns false (not thrown) on a network error', async () => {
    const client = new WebhookClient({ fetchImpl: fakeFetch({ throws: new Error('ECONNREFUSED') }) });
    expect(await client.post(CHANNEL, PAYLOAD)).eq(false);
  });

  it('aborts and returns false when the request exceeds the timeout', async () => {
    // fetch that never resolves until its abort signal fires.
    const hangingFetch = (url, opts) => new Promise((resolve, reject) => {
      opts.signal.addEventListener('abort', () => reject(new Error('aborted')));
    });
    const client = new WebhookClient({ fetchImpl: hangingFetch, timeoutMs: 20 });
    expect(await client.post(CHANNEL, PAYLOAD)).eq(false);
  });
});
