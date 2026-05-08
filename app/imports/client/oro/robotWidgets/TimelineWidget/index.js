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
import { useEffect, useMemo } from 'react';
// ORO Modules
import TimelineComponent from './TimelineComponent';
import { useMethod } from '../../util/meteorUtils';
import { prepareTimeVarsForQuery } from '../../util/timeUtils';

const TimelineContainer = (props) => {
  const { config, robotId, startTs: propStartTs, timeRangeMs, nowTs, dataQuery: dataQueryProp } = props;
  const { elementList, elementValues } = config || {};
  console.log("xx Container", props)

  const { data, call, error } = useMethod('timeseries.query');

  const query = useMemo(() => {
    const attributeIds = elementList;
    const aggregations = attributeIds.map(attrId => elementValues?.[attrId].op || 'avg'); // TODO "op"?
    // const { startTs, endTs } = prepareTimeVarsForQuery(propStartTs, timeRangeMs, nowTs);
    const startTs = new Date("2026-05-06 10:00").getTime();
    const endTs = new Date("2026-05-06 18:00").getTime();
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
    console.log("useEffect", query)
    call(query)
  }, [query])
  console.log("xx widget index got data?", data, query, dataQueryProp)
  return (
    // eslint-disable-next-line react/jsx-props-no-spreading
    <TimelineComponent {...props} dataQuery={query} data={data} />
  );
};

export default TimelineContainer;
