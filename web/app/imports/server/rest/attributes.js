/**
 * Robots Attributes REST API.
 *
 * NOTE: Part of this belongs to Robots API (/robots) and the rest to
 * config API (/config)
 */
// ORO modules
import { ACCESS_LEVEL_VIEW } from '../roles';
import AttributesManager from '../attributes';
import { notFoundApiError } from '../rest_api_common';

/**
 * Handle REST API to get a robot's attribute.
 *
 * @param {Object} robot
 */
async function apiGetRobotAttribute({ robot, attributeId }) {
  const doc = await new AttributesManager()
    .getRobotAttributeValues(robot._id, [attributeId]);
  if (!(attributeId in doc)) {
    return notFoundApiError('Attribute does no exist for this robot');
  } else {
    const { value, ts } = doc[attributeId] || {}; // it could be null; ie. no value reported
    return [{ attribute: attributeId, value, ts }];
  }
}


// Map URLs to functions
const routes = [{
  path: 'robots/{robotId:id}/attributes/{attributeId:id}',
  method: 'GET',
  handler: apiGetRobotAttribute,
  trackingId: 'getRobotAttribute',
  checkUserCanRobot: ACCESS_LEVEL_VIEW,
  loadRobot: true
}];

export default routes;
