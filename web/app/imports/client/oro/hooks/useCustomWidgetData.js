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
