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
import { useEffect, useCallback, useState } from 'react';
import { isEqual } from 'lodash';
// ORO Modules
import TimelineComponent from './TimelineComponent';
import { useMethod } from '../../util/meteorUtils';
import { getPeriodPropsCopy, prepareTimeVarsForQuery } from '../../util/timeUtils';
import { changePeriodOnRangeUpdate } from '../../util/timeUtils/TimeIntervalHook'

const TimelineContainer = (props) => {
  const { 
    config, 
    robotId, 
    startTs: propStartTs, 
    setStartTime,
    timeRangeMs, 
    setTimeRangeMs,
    onTimeFocusChange,
    nowTs
  } = props;
  const { elementList, elementValues } = config || {};
  const { data, call, error, isLoading } = useMethod('timeseries.query');
  // The query is used as state instead of a simpler useMemo so we decide when to change the actual object
  // for useEffect below to trigger.
  const [query, setQuery] = useState();
``
  /**
   * Wrapper to change different time context props.
   * Requires being passed a value and callback to change the value
   * Can set startTime, endTime, and timeRangeMs
   */
  const setTimeWrapper = useCallback(({
    dateStart, 
    timeRangeMs: newTimeRangeMs
  }) => {
    if (dateStart && setStartTime) {
      setStartTime(dateStart.valueOf());
    }
    if (newTimeRangeMs && setTimeRangeMs) {
      setTimeRangeMs(newTimeRangeMs);
    }
    // Clear time focus to prevent timeline from rendering outside
    // of the bounds of its data, which happens when timefocus is out of range
    // from [startTs, endTs]
    if (onTimeFocusChange) {
      onTimeFocusChange(undefined);
    }
  }, [setStartTime, setTimeRangeMs, onTimeFocusChange]);
  const onChangeLayout = useCallback(changePeriodOnRangeUpdate(setTimeWrapper), [setTimeWrapper]);

  useEffect(() => {
    const attributeIds = elementList;
    const aggregations = (attributeIds || []).map(attrId => elementValues?.[attrId].op || 'average');
    const { startTs, endTs } = prepareTimeVarsForQuery(propStartTs, timeRangeMs, nowTs);
    const timeframeMs = endTs - startTs;
    // Find the closest 'period' as defined in our toolbars, which is also helpful to select a reasonable granularity
    const period = getPeriodPropsCopy(timeframeMs);
    const newQuery = {
      robotId,
      attributeIds,
      aggregations,
      startTs,
      endTs,
      intervalMinutes: (period?.intervalSeconds || 300) / 60
      // timeframeHours: 24,
      // intervalMins: 1,
    }
    if (!isEqual(query, newQuery)) {
      // This useEffect changes every time nowTs change (every minute) but the unless the query is live, 
      // query arguments won't change so we compare with isEqual before changing state
      setQuery(newQuery);
    }
  }, [elementList, elementValues, robotId, propStartTs, timeRangeMs, nowTs]);

  // Trigger a data load every time the query changes
  useEffect(() => { query && call(query) }, [query]);

  return (
    // eslint-disable-next-line react/jsx-props-no-spreading
    <TimelineComponent 
      {...props} 
      dataQuery={query} 
      data={data} 
      error={error} 
      onChangeLayout={onChangeLayout}
      isLoading={isLoading}
    />
  );
};

export default TimelineContainer;
