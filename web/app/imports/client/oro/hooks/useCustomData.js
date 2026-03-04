import { useTracker } from 'meteor/react-meteor-data';
import { Meteor } from 'meteor/meteor';
import { RobotCustomData } from '../../../lib/collections';

const useCustomData = (robotId, customField) => useTracker(() => {
  if (!robotId) {
    return { isLoading: false, data: {} };
  }
  const handle = Meteor.subscribe('custom_data', { robotId });
  const data = RobotCustomData.findOne({ robotId, customField }) || {};
  return { isLoading: !handle.ready(), data };
}, [robotId, customField]);

export default useCustomData;
