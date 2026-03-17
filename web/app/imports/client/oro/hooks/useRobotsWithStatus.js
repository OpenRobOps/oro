import { useTracker } from 'meteor/react-meteor-data';
import { Meteor } from 'meteor/meteor';
import { RobotsWithStatus } from '../../../lib/status';
import { matchesStatusFilter } from '../../../shared/status';

/**
 * Subscribes to the robots_with_status publication and returns robot documents
 * merged with their status data.
 *
 * The publication already filters server-side, but if there are other widgets
 * subscribing to the same collection with different filters, extra documents
 * can exist in Minimongo. So, client-side filtering is still required.
 *
 * @param {object} params
 * @param {Array}   params.statusList   - List of status attribute IDs to display.
 * @param {string}  params.statusFilter - Optional status filter string (e.g. 'ewo').
 * @returns {{ robots: object[], isLoading: boolean }}
 */
const useRobotsWithStatus = ({ statusList, statusFilter }) => useTracker(() => {
  const handle = Meteor.subscribe('robots_with_status', { statusList, statusFilter });

  const allRobots = RobotsWithStatus.find().fetch();

  // Client-side filtering: compute aggregated status and check against the filter
  const robots = allRobots.filter((robot) => {
    const aggStatusValue = (Array.isArray(statusList) ? statusList : []).reduce(
      (agg, attrId) => Math.max(agg, (robot.statuses?.[attrId]?.value) || 0),
      0
    );
    return matchesStatusFilter(statusFilter, aggStatusValue);
  });

  return { robots, isLoading: !handle.ready() };
}, [statusList, statusFilter]);

export default useRobotsWithStatus;
