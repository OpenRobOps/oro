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
 * Shared look for the Navigation control bar controls (Lock, Actions, Map selector),
 * mirroring the robot selector's box (RobotSearch.searchBoxContainer) so the four
 * controls read as one family.
 */
export const TOOLBAR_CONTROL_HEIGHT = 34;

export const toolbarControl = theme => ({
  height: `${TOOLBAR_CONTROL_HEIGHT}px`,
  boxSizing: 'border-box',
  background: theme.palette.background.black,
  border: `1px solid ${theme.palette.background.borderLight}`,
  borderRadius: '4px',
  color: theme.palette.text.primary,
  fontSize: '14px',
  fontWeight: 400,
  textTransform: 'none',
  padding: '0 8px',
  '&:hover': {
    borderColor: theme.palette.background.borderMedium,
    background: theme.palette.background.black,
  },
});

/** Leading icon inside a toolbar control (lucide, 18px). */
export const toolbarControlIcon = theme => ({
  color: theme.palette.text.buttonText,
  width: '18px',
  height: '18px',
  marginRight: '6px',
  flexShrink: 0,
});
