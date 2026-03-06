import { useTracker } from 'meteor/react-meteor-data';
import { Meteor } from 'meteor/meteor';
import { Robots } from '../../../lib/collections';

const useRobots = (robotId) => useTracker(() => {
    const handle = Meteor.subscribe('robots', {});
    const allRobots = Robots.find({}).fetch();
    const robots = robotId ? allRobots.filter(r => r._id === robotId) : allRobots;
    const ids = robots.map(r => r._id);
    const byId = robots.reduce((acc, r) => { acc[r._id] = r; return acc; }, {});
    const isLoading = !handle.ready();
    return { isLoading, robotIds: isLoading ? null : ids, robotsMap: byId };
  }, [robotId]);

export default useRobots;