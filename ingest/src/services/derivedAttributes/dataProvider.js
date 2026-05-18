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

import { isNumber, isString } from 'lodash';
// import { TimeseriesFieldConfig, TIMESERIES_FIELD } from '../../shared/timeseries';
import AttributesManager from '../../server/attributes';

const ONE_DAY_IN_SECONDS = 86400;

// Aggregation functions mapping to DB aggregation functions
// This is used to map aggregation functions to the corresponding DB aggregation functions
// when they differ e.g. 'max' in ORO is 'max' in TimescaleDB, but 'mean' in ORO is 'avg'
// in said database.
const AGG_FUNC_NAME_TO_DB_AGG_FUNC = {
  mean: 'avg',
};

/**
 * Data Provider class for svc-derived-attributes.
 *
 * Implements method for getting data from different backend services.
 * NOTE: this class was initially introduced as a wrapper for accessing timeseries data
 * from TimescaleDB, using a FF. In the future, it will
 * be kept as a data abstraction layer to make derived attrs service DB agnostic.
 */
let instance;
export default class RobotDerivedAttributesDataProvider {
  /**
   * Initializes the processor
   * @param {object} timeseriesApi
   */
  constructor() {
    // Singleton pattern
    if (instance === undefined) {
      instance = this;
    }
    // eslint-disable-next-line no-constructor-return
    return instance;
  }

  init = async ({ timeseriesApi }) => {
    this._timeseriesApi = timeseriesApi;
    return this;
  };

  /**
   * Calculates the bounding box of robot positions in the provided timewindow
   *
   * @param {Object} robotId
   * @param {Object} startTs
   * @param {Object} endTs
   * @returns {Object} An object with minX, minY, maxX and maxY keys or an
   *    empty object if the bounding box could not be determined.
   */
  getVisitedAreaBoundingBox = async ({ robotId, startTs, endTs }) => {
    let result = {};
    let timescaleResult = {};
    // new version (rqeuires aggregations):
    timescaleResult = await this._timeseriesApi.getMinMaxPose({
      robotId,
      startTs,
      endTs
    });
    // older version:
    // timescaleResult = await this._timeseriesApi.getAggregatePose({
    //   robotId,
    //   startTs,
    //   endTs
    // });

    // TODO(lean): this method should return all the bounding boxes if there are multiple
    // frameIds for the given timeframe.
    // The API is backwards compatible and returns nothing if there are more than 1
    // results.
    // TODO(mike)
    // When graduating TSDB, please make this method return all the bounding boxes
    // for all the frameIds and let the function `withVisitedAreaBoundingBox` return nothing
    // if there are multiple bounding boxes.
    if (!timescaleResult.length || timescaleResult.length != 1) {
      return {};
    }
    const { minX, minY, maxX, maxY } = timescaleResult[0];
    result = { minX, minY, maxX, maxY };
    return result;
  };

  /**
   * Returns the aggregation of the values of an attribute on the given timewindow.
   *
   * @param {string} robotId
   * @param {string} attributeId
   * @param {string} aggFuncName an aggregation function e.g. min, max, mean, etc.
   * @param {function} resultFunc A function to process the points as returned from the DB and
   *  turns them into the result of this InOrbit function. If not given, it is assumed that
   *  the query returns only one point with one column, which becomes the result.
   * @param {number} limit The limit for points in the result. Not passed to the DB client if
   *  omitted; although our DB client imposes its own limits.
   * @param {number} startTs The start of the time window in milliseconds since epoch.
   * @param {number} endTs The end of the time window in milliseconds since epoch.
   * @return {object} an array of objects with the following format: [
   *  { ts: number, value: any },
   *  ...
   * ]
   */
  aggregateAttribute = async ({
    robotId,
    attributeId,
    aggFuncName,
    resultFunc = null,
    limit = null,
    startTs,
    endTs
  }) => {
    if (!robotId) {
      throw new Error('robotId is required');
    }
    if (!isString(attributeId)) {
      throw new Error('attributeId must be a string');
    }
    if (!isNumber(startTs) || !isNumber(endTs)) {
      throw new Error('startTs and endTs must be numbers');
    }
    if ((endTs - startTs) <= 0 || (endTs - startTs) / 1000 > ONE_DAY_IN_SECONDS) {
      throw new Error('startTs and endTs must be within the last 24 hours');
    }

    const attrDefs = await new AttributesManager().getRobotAttributeDefinitions(robotId);
    const attrDef = attrDefs && attrDefs[attributeId];
    const timeseriesFieldConfig = attrDef
      && new TimeseriesFieldConfig(attributeId, attrDef[TIMESERIES_FIELD]);

    if (!timeseriesFieldConfig) {
      throw new Error('attribute must have a timeline field configured');
    }

    const result = await this._timeseriesApi.getAggregateAttribute({
      robotId,
      attributeId,
      aggFuncName: aggFuncName.toLowerCase() in AGG_FUNC_NAME_TO_DB_AGG_FUNC
        ? AGG_FUNC_NAME_TO_DB_AGG_FUNC[aggFuncName.toLowerCase()]
        : aggFuncName,
      startTs,
      endTs
    });

    // If there are errors, the API gives an ok = false as a response.
    if (result === false) {
      throw new Error('Error getting aggregate attribute.');
    }

    // No results found
    if (!Array.isArray(result) || !result.length) {
      return undefined;
    }

    if (!resultFunc) {
      // By default, this meta-function expect the aggregation to return a single point; e.g.
      // "min" or "max" operators. This code implements that behevior, assuming there is only
      // one point, with exactly one field (plus the always present time field)
      const [{ value: aggVal }] = result;
      if (!isNumber(aggVal)) {
        throw new Error('Aggregation result is not a number.');
      }
      return aggVal;
    } else {
      // If an "result function" is passed, then pass it all retrieved points and let it decide
      // the result of this expressions function
      return resultFunc(result);
    }
  };
}
