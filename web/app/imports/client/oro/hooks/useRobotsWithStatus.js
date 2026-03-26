import { useTracker } from 'meteor/react-meteor-data';
import { Meteor } from 'meteor/meteor';
import { RobotsWithStatus, AGG_STATUS_FIELD } from '../../../lib/status';
import { statusFilterToValues } from '../../../shared/status';

/**
 * Subscribes to the robots_with_status publication and returns robot documents
 * merged with their status data.
 *
 * The publication filters server-side and embeds AGG_STATUS_FIELD in each
 * document. We use find() here to guard against extra documents arriving from
 * other widget subscriptions to the same collection.
 *
 * @param {object} params
 * @param {Array}   params.statusList   - List of status attribute IDs to display.
 * @param {string}  params.statusFilter - Optional status filter string (e.g. 'ewo').
 * @returns {{ robots: object[], isLoading: boolean }}
 */
const useRobotsWithStatus = ({ statusList, statusFilter }) => useTracker(() => {
  const handle = Meteor.subscribe('robots_with_status', { statusList, statusFilter });

  const allowedValues = statusFilterToValues(statusFilter);
  const robots = RobotsWithStatus.find(
    { [AGG_STATUS_FIELD]: { $in: allowedValues } }
  ).fetch();

  return { robots, isLoading: !handle.ready() };
}, [statusList, statusFilter]);

export default useRobotsWithStatus;
