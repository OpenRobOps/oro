import { useTracker } from 'meteor/react-meteor-data';
import { Meteor } from 'meteor/meteor';
import { RobotsWithStatus } from '../../../lib/collections';

/**
 * Subscribes to the robots_with_status publication and returns robot documents
 * merged with their status data.
 *
 * @param {object} params
 * @param {Array}   params.statusList   - Status list config used by the publication.
 * @param {string}  params.statusFilter - Optional status filter string.
 * @param {boolean} params.skip         - When true, skips the subscription (e.g. while deps are loading).
 * @returns {{ robots: object[], isLoading: boolean }}
 */
const useRobotsWithStatus = ({ statusList, statusFilter, skip = false }) => useTracker(() => {
  if (skip) return { robots: [], isLoading: true };
  const handle = Meteor.subscribe('robots_with_status', { statusList, statusFilter });
  return {
    robots: RobotsWithStatus.find({}).fetch(),
    isLoading: !handle.ready(),
  };
}, [JSON.stringify(statusList), statusFilter, skip]);

export default useRobotsWithStatus;
