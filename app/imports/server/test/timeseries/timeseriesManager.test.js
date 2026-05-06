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
 * Unit tests for the Meteor-aware front (TimeSeriesManager).
 *
 * The manager is a thin singleton over `TimeSeriesStore`. Tests verify the
 * singleton lifecycle and that `init`, `write`, and `query` correctly
 * delegate to the underlying store. The store itself is exercised in
 * `./timeseriesStore.test.js`; here we stub it.
 */

import { Meteor } from 'meteor/meteor';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import * as sinon from 'sinon';
// ORO modules
import TimeSeriesManager, { TimeSeries, TimeSeriesStore } from '../../timeseries';

if (!Meteor.isTest) {
  throw new Error('This is TEST code only');
}
chai.use(chaiAsPromised);
const { expect } = chai;

describe('TimeSeriesManager', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('singleton', () => {
    it('returns the same instance on repeated construction', () => {
      const a = new TimeSeriesManager();
      const b = new TimeSeriesManager();
      expect(a).to.equal(b);
    });
  });

  describe('exports', () => {
    it('exports TimeSeries as a Meteor Mongo.Collection backed by COLLECTIONS.TIMESERIES', () => {
      expect(TimeSeries).to.exist;
      expect(TimeSeries.rawCollection().collectionName).to.equal('timeseries');
    });

    it('re-exports TimeSeriesStore for direct use', () => {
      expect(TimeSeriesStore).to.be.a('function');
    });
  });

  describe('init()', () => {
    // Inject a fake Db via TimeSeries.rawDatabase() so the manager builds a
    // real TimeSeriesStore but never touches Mongo. Stubbing
    // TimeSeriesStore.prototype.init wouldn't work — store methods are arrow
    // class fields (per-instance own properties), not prototype methods.
    const buildFakeDb = ({ existing = [], createImpl } = {}) => ({
      listCollections: sandbox.stub().returns({
        toArray: sandbox.stub().resolves(existing),
      }),
      createCollection: createImpl ?? sandbox.stub().resolves(),
    });

    it('builds a TimeSeriesStore wired to TimeSeries.rawDatabase() and calls its init()', async () => {
      const fakeDb = buildFakeDb();
      sandbox.stub(TimeSeries, 'rawDatabase').returns(fakeDb);

      const manager = new TimeSeriesManager();
      manager._store = null; // ensure init() builds a fresh store
      await manager.init();

      expect(manager._store).to.be.instanceOf(TimeSeriesStore);
      expect(manager._store._db).to.equal(fakeDb);
      expect(manager._store._name).to.equal('timeseries');
      sinon.assert.calledOnce(fakeDb.listCollections);
      sinon.assert.calledOnce(fakeDb.createCollection);
      // Confirm the manager passes through the configured time series options.
      const [name, options] = fakeDb.createCollection.firstCall.args;
      expect(name).to.equal('timeseries');
      expect(options.timeseries).to.deep.include({
        timeField: 'ts',
        metaField: 'meta',
        granularity: 'seconds',
      });
    });

    it('propagates store init errors', async () => {
      const fakeDb = buildFakeDb({
        createImpl: sandbox.stub().rejects(new Error('boom')),
      });
      sandbox.stub(TimeSeries, 'rawDatabase').returns(fakeDb);

      const manager = new TimeSeriesManager();
      manager._store = null;
      await expect(manager.init()).to.be.rejectedWith('boom');
    });
  });

  describe('write() / query()', () => {
    let manager;
    let stubStore;

    beforeEach(() => {
      manager = new TimeSeriesManager();
      stubStore = {
        write: sandbox.stub().resolves(),
        query: sandbox.stub().resolves([{ ts: 123, fields: { x: 1 } }]),
      };
      manager._store = stubStore;
    });

    it('write() forwards args to the store unchanged', async () => {
      const args = {
        ts: 1700000000000,
        meta: { robotId: 'r1' },
        fields: { temperature: 21.5 },
      };
      await manager.write(args);
      sinon.assert.calledOnceWithExactly(stubStore.write, args);
    });

    it('query() forwards args to the store and returns its result', async () => {
      const args = {
        meta: { robotId: 'r1' },
        aggregations: [{ field: 'temperature', op: 'avg' }],
        granularitySecs: 600,
        startTs: 1700000000000,
        endTs: 1700000600000,
      };
      const result = await manager.query(args);
      sinon.assert.calledOnceWithExactly(stubStore.query, args);
      expect(result).to.deep.equal([{ ts: 123, fields: { x: 1 } }]);
    });

    it('write() rejects when the store rejects', async () => {
      stubStore.write.rejects(new Error('store down'));
      await expect(manager.write({ ts: 0, fields: {} }))
        .to.be.rejectedWith('store down');
    });

    it('query() rejects when the store rejects', async () => {
      stubStore.query.rejects(new Error('bad pipeline'));
      await expect(manager.query({
        aggregations: [{ field: 'x', op: 'avg' }],
        granularitySecs: 60,
      })).to.be.rejectedWith('bad pipeline');
    });
  });
});
