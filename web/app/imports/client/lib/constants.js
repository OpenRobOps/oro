/**
 * Client-only constants
 *
 * For system-wide constants, see web/lib/constants.js
 */

/**
 * Constants for the different modes of NavigationDetail Screen
 * These are the navigation detail actions to intervene on the robot
 * there are 4 of them at the moment:
 *    - Relocalize (localize, correcting robot position)
 *    - Teleop (open loop intervention)
 *    - Waypoint navigation (single, multiple waypoint)
 *    - Precise waypoint navigation (stepwise navigation/waypoint)
 */
const NAV_DETAIL__MODE_TELEOP = 'teleop';
const NAV_DETAIL__MODE_LOCALIZATION = 'relocalize';
const NAV_DETAIL__MODE_NAV_GOAL = 'nav2goal';
const NAV_DETAIL__MODE_STEPWISE_NAV = 'stepwise';
const NAV_DETAIL__MODE_NO_INTERVENTION = 'none';
const NAV_DETAIL__MODES = [
  NAV_DETAIL__MODE_TELEOP,
  NAV_DETAIL__MODE_LOCALIZATION,
  NAV_DETAIL__MODE_NAV_GOAL,
  NAV_DETAIL__MODE_STEPWISE_NAV,
  NAV_DETAIL__MODE_NO_INTERVENTION
];

// Define the position of the tooltip
const TOOLTIP_POSITION_LEFT = 'left';

// Constants use to assist with the dimensions of the parent component
const CONTAINER_LARGE = 'large';
const CONTAINER_MEDIUM = 'medium';
const CONTAINER_SMALL = 'small';
// Breakpoints to indicate when the parent component is large, medium or small
const LARGE_CONTAINER_BREAKPOINT = 300;
const MEDIUM_CONTAINER_BREAKPOINT = 150;

export {
  NAV_DETAIL__MODE_TELEOP,
  NAV_DETAIL__MODE_NAV_GOAL,
  NAV_DETAIL__MODE_LOCALIZATION,
  NAV_DETAIL__MODE_STEPWISE_NAV,
  NAV_DETAIL__MODE_NO_INTERVENTION,
  NAV_DETAIL__MODES,
  TOOLTIP_POSITION_LEFT,
  CONTAINER_LARGE,
  CONTAINER_MEDIUM,
  CONTAINER_SMALL,
  LARGE_CONTAINER_BREAKPOINT,
  MEDIUM_CONTAINER_BREAKPOINT
};
