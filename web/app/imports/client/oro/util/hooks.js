import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
// ORO modules
import { Robots } from '../../../lib/collections';

/**
 * Receives a robotId and returns the robot
 * it uses useTracker to load the data
 * @param {string} robotId
 */
const useRobotData = (robotId) => useTracker(() => {
    const handle = Meteor.subscribe('robot.details', { robotId });
    const robotData = Robots.findOne({ _id: robotId });
    return { data: robotData, isLoading: !handle.ready() };
  }, [robotId]);

export {
  useRobotData,
};
