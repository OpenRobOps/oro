/**
 * Copyright 2026 InOrbit, Inc.
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

/*
 * Constants for user interactions modes in Navigation/Localization.
*/
const TELEOP_MODE = 'teleop';
const NAVIGATE_MODE = 'navigation';
const MULTI_NAVIGATE_MODE = 'multi-waypoint';
const PRECISION_MODE = 'precision';
const RELOCALIZE_MODE = 'relocalize';
const WAYPOINT_EDIT_MODE = 'waypointEdit';

const CANCEL_NAVGOAL_INTERACTION = 'cancelNavGoal';

const INTERACTION_MODES = {
  TELEOP_MODE,
  NAVIGATE_MODE,
  MULTI_NAVIGATE_MODE,
  RELOCALIZE_MODE,
  PRECISION_MODE,
  WAYPOINT_EDIT_MODE,
};

export {
  TELEOP_MODE,
  NAVIGATE_MODE,
  MULTI_NAVIGATE_MODE,
  PRECISION_MODE,
  RELOCALIZE_MODE,
  WAYPOINT_EDIT_MODE,
  INTERACTION_MODES,
  // Other interaction message constants
  CANCEL_NAVGOAL_INTERACTION
};
