import { useTracker } from 'meteor/react-meteor-data';
import { Meteor } from 'meteor/meteor';
import { RobotKeyValues } from '../../../lib/collections';

const useRobotKeyValues = (robotId) => useTracker(() => {
  if (!robotId) {
    return { isLoading: false, data: [] };
  }
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
}, [robotId]);

export default useRobotKeyValues;
