/**
 * useRobots — Hook to fetch all robots
 *
 * Subscribes to the robots publication and returns robots keyed by id.
 *
 * @returns {Object} - { isLoading, robotsById }
 *  isLoading: boolean - Whether the subscription is still loading
 *  robotsById: { [robotId]: robotData } - All robots indexed by _id
 */
import { useTracker } from 'meteor/react-meteor-data';
import { Meteor } from 'meteor/meteor';
import { Robots } from '../../../lib/collections';

const useRobots = () => useTracker(() => {
  const handle = Meteor.subscribe('robots', {});
  const robots = Robots.find({}).fetch();
  const robotsById = robots.reduce((acc, r) => { acc[r._id] = r; return acc; }, {});
  return { isLoading: !handle.ready(), robotsById };
}, []);

export default useRobots;
