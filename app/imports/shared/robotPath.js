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
 * Robot path styling shared by server and client.
 *
 * `PathLayer` styles each `localization.paths.<pathId>` from
 * `uiPreferences.map.robotPath.elementValues[pathId]`. The `RobotPath` ConfigAPI kind writes that
 * object at system or robot scope; `resolveRobotPath` merges them per path id.
 */

/** Client-only collection fed by the `robot_ui_preferences` publication ({pose, robotPath} per robot). */
const ROBOT_UI_PREFERENCES_COLLECTION = 'robot_ui_preferences';

const PATH_STYLE_FIELDS = ['label', 'pointColor', 'lineColor', 'pointWidth', 'lineWidth', 'isDashed', 'shouldPersist'];

const pickStyle = (style) => Object.fromEntries(
  PATH_STYLE_FIELDS.filter((f) => style && style[f] !== undefined).map((f) => [f, style[f]]),
);

/** Spec `paths` map → stored `map.robotPath` (`{ elementList, elementValues }`). */
function robotPathFromSpec(paths) {
  const ids = Object.keys(paths);
  return { elementList: ids, elementValues: Object.fromEntries(ids.map((id) => [id, pickStyle(paths[id])])) };
}

/** Stored `map.robotPath` → spec (`{ paths }`). */
function robotPathToSpec(stored) {
  const values = (stored && stored.elementValues) || {};
  return { paths: Object.fromEntries(Object.keys(values).map((id) => [id, pickStyle(values[id])])) };
}

/** Robot entry for a path id wins over the system entry; entries are not merged field-wise. */
function resolveRobotPath({ robotCfg = null, systemCfg = null } = {}) {
  const elementValues = {
    ...((systemCfg && systemCfg.elementValues) || {}),
    ...((robotCfg && robotCfg.elementValues) || {}),
  };
  return Object.keys(elementValues).length ? { elementValues } : {};
}

export {
  ROBOT_UI_PREFERENCES_COLLECTION, PATH_STYLE_FIELDS, robotPathFromSpec, robotPathToSpec, resolveRobotPath,
};
