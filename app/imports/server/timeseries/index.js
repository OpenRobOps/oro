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
 * TimeSeries Manager - Application Server side
 *
 * Meteor-aware front for the time series store. Owns the singleton lifecycle
 * and the `Mongo.Collection` wrapper (so the collection participates in
 * Meteor's lifecycle), and delegates writes/queries to the Meteor-agnostic
 * `TimeSeriesStore` implementation in ./store.js.
 */

import { Mongo } from 'meteor/mongo';
import { isArray, isNumber, zipWith } from 'lodash';
// ORO modules
import { COLLECTIONS } from '../../shared/constants';
import TimeSeriesStore from '../../shared/timeseriesStore';

const TimeSeries = new Mongo.Collection(COLLECTIONS.TIMESERIES);

let instance;

class TimeSeriesManager {
  _store = null;

  constructor() {
    if (instance === undefined) {
      instance = this;
    }
    // eslint-disable-next-line no-constructor-return
    return instance;
  }

  init = async () => {
    Meteor.methods({
      'timeseries.query': this._meteorQueryTimeseries
    });
    this._store = new TimeSeriesStore({
      db: TimeSeries.rawDatabase(),
      collectionName: COLLECTIONS.TIMESERIES,
    });
    await this._store.init();
  };

  /**
   * Writes a batch of points
   */
  write = async (data) => this._store.write(data);

  /**
   * Performs a query. This is simply delegated to the store
   * (Note that we should abstract the implementation here)
   */
  aggregateQuery = async (args) => this._store.aggregateQuery(args);

  async _meteorQueryTimeseries({ attributeIds, aggregations, robotId, startTs, endTs, intervalMinutes }) {
    console.log("Timeseries query args: ", { attributeIds, aggregations, robotId, startTs, endTs, intervalMinutes })
    if (!robotId) {
      throw new Meteor.Error('robotId is required');
    }
    if (!isArray(attributeIds) || attributeIds.length == 0) {
      throw new Meteor.Error('attributeIds is required');
    }
    if (!isArray(aggregations) || aggregations.length == 0) {
      throw new Meteor.Error('aggregations is required');
    }
    if (attributeIds.length != aggregations.length) {
      throw new Meteor.Error('attributeIds and aggregations must have the same length');
    }
    if (!isNumber(startTs)) {
      throw new Meteor.Error('startTs is required');
    }
    if (!isNumber(endTs)) {
      throw new Meteor.Error('endTs is required');
    }
    if (!isNumber(intervalMinutes)) {
      throw new Meteor.Error('intervalMinutes is required');
    }
    let points = null;
    try {
      points = await new TimeSeriesManager().aggregateQuery({
        startTs,
        endTs,
        granularitySecs: intervalMinutes * 60,
        meta: { robotId },
        aggregations: zipWith(attributeIds, aggregations, (attributeId, aggregation) => ({
          field: attributeId,
          op: aggregation
        }))
      });
    } catch (e) {
      // aggregateQuery() performs validations (e.g. on the aggregation operators). If it
      // throws, pop up the error.
      // FIXME: We should not re-throw EVERY error; this can surface internal details: only certain 'bad argument' errors
      throw new Meteor.Error(e.message);
    }
    // For efficient data transfer and processing in the browser we turn the result into 
    // { columns: [...attributeIds], values: [[...], [...]] }
    // where each value always contains the 'time' property first. That's the format expected
    // by timeline components (and compatible with other timeseries APIs in original implementation)
    const columns = ['time', ...attributeIds];
    const rows = [];
    const expectedGapMs = intervalMinutes * 60000;
    let lastTs = null;
    points.forEach(({ ts, fields }) => {
      const values = new Array(attributeIds.length + 1);
      values[0] = ts;
      if (lastTs && ts - lastTs > expectedGapMs) {
        // There is a larger gap between last and this point than intervalMinutes.
        // As a hack, we insert an empty row so that timelines know how to render disconnected portions
        // of the time series.
        // Note that some stores (notably TigerData and InfluxDB) used to return points with null values;
        // and we mimic that behavior here (with just 1 empty point, which is enough)
        rows.push([ lastTs + expectedGapMs, ...new Array(attributeIds.length)]);
      }
      attributeIds.forEach((attributeId, ix) => {
        values[ix + 1] = fields[attributeId];
      })
      rows.push(values);
      lastTs = ts;
    });
    return { columns, values: rows };
  }
}

export default TimeSeriesManager;
export { TimeSeries };
