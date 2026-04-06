/*
 * Constants for user interactions modes in Navigation/Localization.
*/
const TELEOP_MODE = 'teleop';
const NAVIGATE_MODE = 'navigation';
const MULTI_NAVIGATE_MODE = 'multi-waypoint';
const PRECISION_MODE = 'precision';
const RELOCALIZE_MODE = 'relocalize';
const WAYPOINT_EDIT_MODE = 'waypointEdit';
const ZONE_EDIT_MODE = 'zoneEdit';

const CANCEL_NAVGOAL_INTERACTION = 'cancelNavGoal';

const INTERACTION_MODES = {
  TELEOP_MODE,
  NAVIGATE_MODE,
  MULTI_NAVIGATE_MODE,
  RELOCALIZE_MODE,
  PRECISION_MODE,
  WAYPOINT_EDIT_MODE,
  ZONE_EDIT_MODE
};

export {
  TELEOP_MODE,
  NAVIGATE_MODE,
  MULTI_NAVIGATE_MODE,
  PRECISION_MODE,
  RELOCALIZE_MODE,
  WAYPOINT_EDIT_MODE,
  ZONE_EDIT_MODE,
  INTERACTION_MODES,
  // Other interaction message constants
  CANCEL_NAVGOAL_INTERACTION
};
