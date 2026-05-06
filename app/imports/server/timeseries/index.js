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
// ORO modules
import { COLLECTIONS } from '../../shared/constants';
import TimeSeriesStore from './store';

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
    this._store = new TimeSeriesStore({
      db: TimeSeries.rawDatabase(),
      collectionName: COLLECTIONS.TIMESERIES,
    });
    await this._store.init();
  };

  write = async (args) => this._store.write(args);

  query = async (args) => this._store.query(args);
}

export default TimeSeriesManager;
export { TimeSeries, TimeSeriesStore };
