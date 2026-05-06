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
 * TimeSeriesStore - Meteor-agnostic implementation layer.
 *
 * Wraps a MongoDB time series collection on a raw driver `Db` instance and
 * provides write + windowed-aggregation query helpers. Pure: no Meteor
 * imports, no global singletons, throws plain `Error`.
 *
 * Bucketing and storage-shape options live as module-level constants below
 * — tweak in place as the workload evolves.
 */

// Time series collection options.
const TIME_FIELD = 'time';
const META_FIELD = 'meta';
const GRANULARITY = 'seconds'; // 'seconds' | 'minutes' | 'hours'
// Positive number enables TTL on the collection (seconds); null disables TTL.
const EXPIRE_AFTER_SECONDS = null;

// Mapping from public op names to MongoDB accumulator operators.
// `count` is a sentinel; handled specially in query() to count non-null
// values for the field rather than per-bucket document count.
const AGG_OPS = {
  avg: '$avg',
  min: '$min',
  max: '$max',
  sum: '$sum',
  first: '$first',
  last: '$last',
  count: '$count',
};

class TimeSeriesStore {
  /**
   * @param {object} args
   * @param {import('mongodb').Db} args.db   Raw MongoDB driver Db instance.
   * @param {string} args.collectionName     Name of the time series collection.
   */
  constructor({ db, collectionName }) {
    if (!db) throw new Error('TimeSeriesStore: db is required');
    if (!collectionName) throw new Error('TimeSeriesStore: collectionName is required');
    this._db = db;
    this._name = collectionName;
  }

  init = async () => {
    const existing = await this._db.listCollections({ name: this._name }).toArray();
    if (existing.length > 0) {
      return;
    }
    const options = {
      timeseries: {
        timeField: TIME_FIELD,
        metaField: META_FIELD,
        granularity: GRANULARITY,
      },
    };
    if (EXPIRE_AFTER_SECONDS != null) {
      options.expireAfterSeconds = EXPIRE_AFTER_SECONDS;
    }
    await this._db.createCollection(this._name, options);
  };

  /**
   * Write a single data point.
   * @param {object} args
   * @param {number} args.ts      Epoch milliseconds.
   * @param {object} [args.meta]  Optional metadata dict (e.g. { robotId }).
   * @param {object} args.fields  Numeric field values, top-level on the doc.
   */
  write = async ({ ts, meta, fields }) => {
    const doc = {
      [TIME_FIELD]: new Date(ts),
      [META_FIELD]: meta ?? {},
      ...fields,
    };
    await this._db.collection(this._name).insertOne(doc);
  };

  /**
   * Aggregate fields of a time series into fixed-size time windows.
   *
   * @param {object}   args
   * @param {object}   [args.meta]            Filter on the metaField; flattened
   *                                          into dotted-key matches
   *                                          (e.g. { robotId: 'r1' } -> { 'meta.robotId': 'r1' }).
   *                                          Omit / pass {} to query across all series.
   * @param {Array<{field: string, op: string}>} args.aggregations
   *                                          Per-field aggregation. `op` is one of
   *                                          'avg' | 'min' | 'max' | 'sum' | 'first' | 'last' | 'count'.
   *                                          When the same `field` appears with multiple
   *                                          ops, the last one in the list wins in the
   *                                          output `fields` object.
   * @param {number}   args.granularitySecs   Window size in seconds (e.g. 600 = 10 min).
   * @param {number}   [args.startTs]         Inclusive lower bound, epoch ms.
   * @param {number}   [args.endTs]           Exclusive upper bound, epoch ms.
   *
   * @returns {Promise<Array<{ ts: number, fields: object }>>}
   *   Sorted ascending by `ts` (window start, epoch ms).
   */
  aggregateQuery = async ({ meta, aggregations, granularitySecs, startTs, endTs }) => {
    if (!Array.isArray(aggregations) || aggregations.length === 0) {
      throw new Error('aggregations must be a non-empty array');
    }
    if (!(granularitySecs > 0)) {
      throw new Error('granularitySecs must be a positive number');
    }

    const match = {};
    for (const [k, v] of Object.entries(meta ?? {})) {
      match[`${META_FIELD}.${k}`] = v;
    }
    if (startTs != null || endTs != null) {
      match[TIME_FIELD] = {};
      if (startTs != null) match[TIME_FIELD].$gte = new Date(startTs);
      if (endTs != null) match[TIME_FIELD].$lt = new Date(endTs);
    }

    const groupStage = {
      _id: {
        $dateTrunc: {
          date: `$${TIME_FIELD}`,
          unit: 'second',
          binSize: granularitySecs,
        },
      },
    };
    const fieldsProjection = {};
    for (const { field, op } of aggregations) {
      const accumulator = AGG_OPS[op.toLowerCase()];
      if (!accumulator) {
        throw new Error(`Unsupported aggregation op: ${op}`);
      }
      // Use a tmp key so multiple ops on the same field don't collide in $group.
      const tmpKey = `_${field}_${op}`;
      // For `count`, sum 1 per doc where the field is present and non-null.
      // We must use `$type` because in aggregation MISSING is not considered
      // equal to null by `$eq`/`$ne` (unlike find queries).
      groupStage[tmpKey] = accumulator === '$count'
        ? {
          $sum: {
            $cond: [
              { $in: [{ $type: `$${field}` }, ['missing', 'null']] },
              0,
              1,
            ],
          },
        }
        : { [accumulator]: `$${field}` };
      fieldsProjection[field] = `$${tmpKey}`;
    }

    const pipeline = [
      { $match: match },
      { $group: groupStage },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, ts: '$_id', fields: fieldsProjection } },
    ];
    const docs = await this._db.collection(this._name).aggregate(pipeline).toArray();
    return docs.map((d) => ({ ts: d.ts.getTime(), fields: d.fields }));
  };
}

export default TimeSeriesStore;
export { TIME_FIELD, META_FIELD, GRANULARITY, EXPIRE_AFTER_SECONDS, AGG_OPS };
