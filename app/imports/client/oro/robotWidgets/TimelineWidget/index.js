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
import { useEffect, useMemo, useCallback } from 'react';
// ORO Modules
import TimelineComponent from './TimelineComponent';
import { useMethod } from '../../util/meteorUtils';
import { prepareTimeVarsForQuery } from '../../util/timeUtils';
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
    nowTs,
  } = props;
  const { elementList, elementValues } = config || {};
  const { data, call, error } = useMethod('timeseries.query');

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

  const query = useMemo(() => {
    const attributeIds = elementList;
    const aggregations = attributeIds.map(attrId => elementValues?.[attrId].op || 'avg'); // TODO "op"?
    const { startTs, endTs } = prepareTimeVarsForQuery(propStartTs, timeRangeMs, nowTs);
    // const startTs = new Date("2026-05-06 10:00").getTime();
    // const endTs = new Date("2026-05-06 18:00").getTime();
    const intervalMinutes = 1;
    return {
      robotId,
      attributeIds,
      aggregations,
      startTs,
      endTs,
      intervalMinutes
      // timeframeHours: 24,
      // intervalMins: 1,
    }
  }, [elementList, elementValues, robotId,]);

  useEffect(() => {
    // TODO run query again every time query changes (in live mode only)
    call(query)
  }, [query])
  
  return (
    // eslint-disable-next-line react/jsx-props-no-spreading
    <TimelineComponent 
      {...props} 
      dataQuery={query} 
      data={data} 
      error={error} 
      onChangeLayout={onChangeLayout}
    />
  );
};

export default TimelineContainer;
