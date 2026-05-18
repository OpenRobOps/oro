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
 * Unit tests for the Meteor-agnostic implementation layer (TimeSeriesStore).
 *
 * Runs against the real MongoDB driver `Db` exposed by `MongoInternals`. We
 * use a dedicated test collection name and drop+recreate it per test so we
 * don't touch the production `timeseries` collection.
 */

import { Meteor } from 'meteor/meteor';
import { MongoInternals } from 'meteor/mongo';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
// ORO modules
import TimeSeriesStore from '../../../shared/timeseriesStore';

if (!Meteor.isTest) {
  throw new Error('This is TEST code only');
}
chai.use(chaiAsPromised);
const { expect } = chai;

const TEST_COLLECTION = '_test_ts_store';

const dropIfExists = async (db, name) => {
  try {
    await db.dropCollection(name);
  } catch (err) {
    // Mongo error 26 = NamespaceNotFound -> collection didn't exist
    if (err?.code !== 26) throw err;
  }
};

describe('TimeSeriesStore', () => {
  let db;
  let store;

  before(() => {
    db = MongoInternals.defaultRemoteCollectionDriver().mongo.db;
  });

  beforeEach(async () => {
    await dropIfExists(db, TEST_COLLECTION);
    store = new TimeSeriesStore({ db, collectionName: TEST_COLLECTION });
    await store.init();
  });

  after(async () => {
    await dropIfExists(db, TEST_COLLECTION);
  });

  describe('constructor', () => {
    it('throws when db is missing', () => {
      expect(() => new TimeSeriesStore({ collectionName: 'x' }))
        .to.throw(/db is required/);
    });

    it('throws when collectionName is missing', () => {
      expect(() => new TimeSeriesStore({ db }))
        .to.throw(/collectionName is required/);
    });
  });

  describe('init()', () => {
    it('creates a time series collection with the configured options', async () => {
      const [info] = await db
        .listCollections({ name: TEST_COLLECTION })
        .toArray();
      expect(info).to.exist;
      expect(info.type).to.equal('timeseries');
      expect(info.options.timeseries).to.deep.include({
        timeField: 'time',
        metaField: 'meta',
        granularity: 'seconds',
      });
    });

    it('is idempotent (second call is a no-op)', async () => {
      // beforeEach already called init() once.
      await expect(store.init()).to.be.fulfilled;
      const collections = await db
        .listCollections({ name: TEST_COLLECTION })
        .toArray();
      expect(collections).to.have.length(1);
    });
  });

  describe('write()', () => {
    it('stores time as a Date, meta as a sub-doc, and fields top-level', async () => {
      const ts = Date.UTC(2024, 0, 1, 0, 0, 0);
      await store.write({
        ts,
        meta: { robotId: 'r1', source: 'test' },
        fields: { temperature: 21.5, humidity: 40 },
      });
      const docs = await db.collection(TEST_COLLECTION).find({}).toArray();
      expect(docs).to.have.length(1);
      const doc = docs[0];
      expect(doc.time).to.be.instanceOf(Date);
      expect(doc.time.getTime()).to.equal(ts);
      expect(doc.meta).to.deep.equal({ robotId: 'r1', source: 'test' });
      expect(doc.temperature).to.equal(21.5);
      expect(doc.humidity).to.equal(40);
    });

    it('defaults missing meta to {}', async () => {
      await store.write({
        ts: Date.now(),
        fields: { x: 1 },
      });
      const [doc] = await db.collection(TEST_COLLECTION).find({}).toArray();
      expect(doc.meta).to.deep.equal({});
    });
  });

  describe('aggregateQuery() input validation', () => {
    it('throws when aggregations is empty', async () => {
      await expect(store.aggregateQuery({
        aggregations: [],
        granularitySecs: 60,
      })).to.be.rejectedWith(/aggregations must be a non-empty array/);
    });

    it('throws when aggregations is not an array', async () => {
      await expect(store.aggregateQuery({
        aggregations: { field: 'x', op: 'average' },
        granularitySecs: 60,
      })).to.be.rejectedWith(/aggregations must be a non-empty array/);
    });

    it('throws when granularitySecs is zero', async () => {
      await expect(store.aggregateQuery({
        aggregations: [{ field: 'x', op: 'average' }],
        granularitySecs: 0,
      })).to.be.rejectedWith(/granularitySecs must be a positive number/);
    });

    it('throws when granularitySecs is negative', async () => {
      await expect(store.aggregateQuery({
        aggregations: [{ field: 'x', op: 'average' }],
        granularitySecs: -10,
      })).to.be.rejectedWith(/granularitySecs must be a positive number/);
    });

    it('throws when granularitySecs is missing', async () => {
      await expect(store.aggregateQuery({
        aggregations: [{ field: 'x', op: 'average' }],
      })).to.be.rejectedWith(/granularitySecs must be a positive number/);
    });

    it('throws when op is unknown', async () => {
      await expect(store.aggregateQuery({
        aggregations: [{ field: 'x', op: 'median' }],
        granularitySecs: 60,
      })).to.be.rejectedWith(/Unsupported aggregation op: median/);
    });
  });

  describe('aggregateQuery() aggregation', () => {
    // Reference time chosen so all timestamps below land on clean bucket boundaries.
    const T0 = Date.UTC(2024, 0, 1, 0, 0, 0); // 2024-01-01T00:00:00Z
    const min = (n) => n * 60 * 1000;

    // Two 10-minute windows worth of data for robot r1:
    //   window A starts at T0, contains 3 points
    //   window B starts at T0 + 10 min, contains 2 points
    // r2 has its own data in window A only.
    const seedPoints = async () => {
      const points = [
        // window A, r1
        { ts: T0 + min(1), meta: { robotId: 'r1' }, fields: { temperature: 20, humidity: 40 } },
        { ts: T0 + min(3), meta: { robotId: 'r1' }, fields: { temperature: 22, humidity: 50 } },
        { ts: T0 + min(7), meta: { robotId: 'r1' }, fields: { temperature: 24, humidity: 60 } },
        // window B, r1
        { ts: T0 + min(11), meta: { robotId: 'r1' }, fields: { temperature: 30, humidity: 70 } },
        { ts: T0 + min(15), meta: { robotId: 'r1' }, fields: { temperature: 32, humidity: 80 } },
        // window A, r2
        { ts: T0 + min(2), meta: { robotId: 'r2' }, fields: { temperature: 100, humidity: 10 } },
      ];
      for (const p of points) await store.write(p);
    };

    it('returns [] when the collection is empty', async () => {
      const rows = await store.aggregateQuery({
        meta: { robotId: 'r1' },
        aggregations: [{ field: 'temperature', op: 'average' }],
        granularitySecs: 600,
      });
      expect(rows).to.deep.equal([]);
    });

    it('aggregates avg + max across two 10-minute windows', async () => {
      await seedPoints();
      const rows = await store.aggregateQuery({
        meta: { robotId: 'r1' },
        aggregations: [
          { field: 'temperature', op: 'average' },
          { field: 'humidity', op: 'maximum' },
        ],
        granularitySecs: 600,
      });
      expect(rows).to.have.length(2);
      // Sorted ascending by window start.
      expect(rows[0].ts).to.equal(T0);
      expect(rows[0].fields.temperature).to.equal((20 + 22 + 24) / 3);
      expect(rows[0].fields.humidity).to.equal(60);
      expect(rows[1].ts).to.equal(T0 + min(10));
      expect(rows[1].fields.temperature).to.equal((30 + 32) / 2);
      expect(rows[1].fields.humidity).to.equal(80);
    });

    it('supports min, sum, first, last', async () => {
      await seedPoints();
      const rows = await store.aggregateQuery({
        meta: { robotId: 'r1' },
        aggregations: [
          { field: 'temperature', op: 'minimum' },
          { field: 'humidity', op: 'sum' },
        ],
        granularitySecs: 600,
        startTs: T0,
        endTs: T0 + min(10),
      });
      expect(rows).to.have.length(1);
      expect(rows[0].fields.temperature).to.equal(20);
      expect(rows[0].fields.humidity).to.equal(40 + 50 + 60);

      const firstLast = await store.aggregateQuery({
        meta: { robotId: 'r1' },
        aggregations: [
          { field: 'temperature', op: 'first' },
          { field: 'humidity', op: 'last' },
        ],
        granularitySecs: 600,
        startTs: T0,
        endTs: T0 + min(10),
      });
      // `$first`/`$last` reflect arrival order within the bucket; we wrote
      // points in ascending ts order so they match the time order here.
      expect(firstLast[0].fields.temperature).to.equal(20);
      expect(firstLast[0].fields.humidity).to.equal(60);
    });

    it('filters by meta (only matching series are aggregated)', async () => {
      await seedPoints();
      const r2 = await store.aggregateQuery({
        meta: { robotId: 'r2' },
        aggregations: [{ field: 'temperature', op: 'average' }],
        granularitySecs: 600,
      });
      expect(r2).to.have.length(1);
      expect(r2[0].fields.temperature).to.equal(100);
    });

    it('without meta, aggregates across all series', async () => {
      await seedPoints();
      const rows = await store.aggregateQuery({
        aggregations: [{ field: 'temperature', op: 'average' }],
        granularitySecs: 600,
      });
      // window A contains r1's 3 points (20,22,24) and r2's one point (100).
      // window B contains r1's 2 points (30, 32).
      expect(rows).to.have.length(2);
      expect(rows[0].fields.temperature).to.equal((20 + 22 + 24 + 100) / 4);
      expect(rows[1].fields.temperature).to.equal((30 + 32) / 2);
    });

    it('respects startTs (inclusive) and endTs (exclusive)', async () => {
      await seedPoints();
      // Range covering only window A (B starts at T0+10min, exclusive bound).
      const rows = await store.aggregateQuery({
        meta: { robotId: 'r1' },
        aggregations: [{ field: 'temperature', op: 'average' }],
        granularitySecs: 600,
        startTs: T0,
        endTs: T0 + min(10),
      });
      expect(rows).to.have.length(1);
      expect(rows[0].ts).to.equal(T0);
    });

    it('count counts only non-null values per field', async () => {
      // Seed three points; only two have `temperature`.
      await store.write({
        ts: T0 + min(1),
        meta: { robotId: 'rc' },
        fields: { temperature: 1, humidity: 5 },
      });
      await store.write({
        ts: T0 + min(2),
        meta: { robotId: 'rc' },
        fields: { temperature: 2, humidity: 6 },
      });
      await store.write({
        ts: T0 + min(3),
        meta: { robotId: 'rc' },
        fields: { humidity: 7 }, // no temperature
      });
      const rows = await store.aggregateQuery({
        meta: { robotId: 'rc' },
        aggregations: [
          { field: 'temperature', op: 'count' },
          { field: 'humidity', op: 'count' },
        ],
        granularitySecs: 600,
      });
      expect(rows).to.have.length(1);
      expect(rows[0].fields.temperature).to.equal(2);
      expect(rows[0].fields.humidity).to.equal(3);
    });

    it('granularitySecs of 60 produces minute-sized buckets', async () => {
      // 3 points across 3 distinct minutes.
      await store.write({ ts: T0 + min(0) + 5_000, meta: { robotId: 'g' }, fields: { x: 10 } });
      await store.write({ ts: T0 + min(1) + 5_000, meta: { robotId: 'g' }, fields: { x: 20 } });
      await store.write({ ts: T0 + min(2) + 5_000, meta: { robotId: 'g' }, fields: { x: 30 } });
      const rows = await store.aggregateQuery({
        meta: { robotId: 'g' },
        aggregations: [{ field: 'x', op: 'average' }],
        granularitySecs: 60,
      });
      expect(rows.map((r) => r.fields.x)).to.deep.equal([10, 20, 30]);
      expect(rows.map((r) => r.ts - T0)).to.deep.equal([0, min(1), min(2)]);
    });

    it('same field with multiple ops: last in list wins in output', async () => {
      await seedPoints();
      const rows = await store.aggregateQuery({
        meta: { robotId: 'r1' },
        aggregations: [
          { field: 'temperature', op: 'average' }, // first — overwritten
          { field: 'temperature', op: 'maximum' }, // last — wins
        ],
        granularitySecs: 600,
        startTs: T0,
        endTs: T0 + min(10),
      });
      expect(rows).to.have.length(1);
      expect(rows[0].fields.temperature).to.equal(24); // max(20,22,24)
    });
  });
});
