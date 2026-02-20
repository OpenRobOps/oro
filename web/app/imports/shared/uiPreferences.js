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
 * TODO(franguerini): update / remove this constant when camera config
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
