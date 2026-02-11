/**
 * VitalsWidget
 *
 * This component displays some of the robot information inside Ground Control. It is a container
 * for VitalsTextEntry and VitalsGaugeEntry components.
 */
import { Meteor } from 'meteor/meteor';
import { withTracker } from 'meteor/react-meteor-data';
// ORO modules
import VitalsWidgetComponent from './VitalsWidgetComponent';
import { Robots } from '../../../../lib/collections';
import { fetchRobotAttributeValues } from '../../../../lib/attributes';
import WithNoDataMessage from '../../util/WithNoDataMessage';

/**
 * Get values from server
 */
const VitalsWidgetContainer = withTracker(({ robotId, config }) => {
  if (robotId) {
    const attributes = (config && config.elementList) || [];
    // Query only the attributes we are displaying, based on the configuration
    const vitalsHandle = Meteor.subscribe('attributes.values', { robotId, attributes });
    const robotHandle = Meteor.subscribe('robot.details', { robotId });
    const isLoading = !vitalsHandle.ready() || !robotHandle.ready();
    if (isLoading) {
      return { isLoading };
    }
    const attributeValues = fetchRobotAttributeValues({ robotId, attributes }) || {};
    const robot = Robots.findOne({ _id: robotId });
    return {
      isLoading,
      attributeValues,
      robot
    };
  }
  return {};
})(VitalsWidgetComponent);

// We are passing the same component as ZeroDataComponent
// because it knows how to handle its zero data state
export default WithNoDataMessage(VitalsWidgetContainer, {
  ZeroDataComponent: VitalsWidgetContainer
});
