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

/**
 * Functions and constants for setting UI preferences; shared with client code.
 * (NON Meteor code)
 *
 * TODO(herchu) Move MORE constants from lib/uiPreferences
 */

const GROUP_ID_NONE = 'None';
const GROUP_LABEL_NONE = 'Other';

/**
 * Specifies the duration in seconds that the high resolution snapshot will last
 * TODO: update / remove this constant when camera config
 *                    allows the user to set the high resolution duration
 */
const HIGH_RES_DURATION = 60;

/**
 * Specifies the time after which real-time navigation data is considered too
 * stale and the user should be notified.
 *
 * Currently used by:
 * - CameraViewComponent, to decide how long to wait for a camera image before
 *   showing 'no image available' feedback
 * - SpeedGauge, to decide whether to show speed data or not (because it's too old)
 * - TimerComponent, to decide whether to display a timer on stale camera images or not
 */
const REAL_TIME_STALE_DATA_SECONDS = 15;

// Possible section scopes. Note that experimental section scopes may have a feature flag
// associated, see SECTION_SCOPE_FEATURE_FLAGS below.
const SECTION_SCOPES = {
  FLEET: 'fleet',
  ROBOT: 'robot',
  NAVIGATION: 'navigation',
  MISSION: 'mission',
  DEMO: 'demo',
  LOCATION: 'location',
  ORDER: 'order',
};

export {
  GROUP_ID_NONE,
  GROUP_LABEL_NONE,
  HIGH_RES_DURATION,
  REAL_TIME_STALE_DATA_SECONDS,
  SECTION_SCOPES
};
