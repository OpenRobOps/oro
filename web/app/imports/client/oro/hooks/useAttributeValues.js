import { useTracker } from 'meteor/react-meteor-data';
import { Meteor } from 'meteor/meteor';
import { fetchRobotAttributeValues } from '../../../lib/attributes';

const useAttributeValues = (robotId, attributes = []) => useTracker(() => {
  if (!robotId) {
    return { isLoading: false, data: {} };
  }
  const handle = Meteor.subscribe('attributes.values', { robotId, attributes });
  const data = fetchRobotAttributeValues({ robotId, attributes }) || {};
  return { isLoading: !handle.ready(), data };
}, [robotId, attributes]);

export default useAttributeValues;
