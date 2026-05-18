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

import { useTracker } from 'meteor/react-meteor-data';
import { Meteor } from 'meteor/meteor';
import { RobotKeyValues, RobotCustomData } from '../../../lib/collections';

const DATA_TYPE_KV = 'key_value';

const useCustomWidgetData = (robotId, dataType, customField) => useTracker(() => {
  if (!robotId) {
    return { isLoading: false, data: dataType === DATA_TYPE_KV ? [] : {} };
  }

  if (dataType === DATA_TYPE_KV) {
    const handle = Meteor.subscribe('robot.key_values', { robotId });
    const keyValues = RobotKeyValues.findOne({ _id: robotId }) || {};
    const data = Object.keys(keyValues)
      .sort((a, b) => a.localeCompare(b))
      .filter(key => key != '_id')
      .map(key => ({
        key,
        ...keyValues[key]
      }));
    return { isLoading: !handle.ready(), data };
  }

  const handle = Meteor.subscribe('custom_data', { robotId });
  const data = RobotCustomData.findOne({ robotId, customField }) || {};
  return { isLoading: !handle.ready(), data };
}, [robotId, dataType, customField]);

export default useCustomWidgetData;
