/**
 * useRobots — Hook to fetch robots data
 *
 * Subscribes to the robots publication and returns the robots data
 *
 * @param {string} robotId - The id of the robot to fetch
 * @returns {Object} - { isLoading, robotIds, robotsMap }
 *  isLoading: boolean - Whether the data is still loading
 *  robotIds: string[] - The ids of the robots
 *  robotsMap: { [robotId]: robotData } -
 *    {
 *      [robotId]: {
 *        _id: string - The id of the robot
 *        name: string - The name of the robot
 *        hostname: string - The hostname of the robot
 *        status: {
 *          agentOnline: boolean - Whether the agent is online
 *          value: number - The status value
 *        }
 *      }
 *    }
 */
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
