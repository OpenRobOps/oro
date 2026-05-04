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
import { isArray } from 'lodash';
// ORO modules
import { GROUP_LABEL_NONE } from '../../../../shared/uiPreferences';

/**
 * Creates some "group" objects for actions from a configuration.
 * Each action has a 'group' string property. This creates and returns a dictionary
 * whose keys are group ids (just a group name, lowercased), and values { label, actions }
 * with the group in the original casing (or one of them, there could be multiple) and the
 * list of action objects in that group.
 */
const createActionGroups = (actions) => {
  if (!isArray(actions)) {
    return [];
  }
  return actions.reduce((acc, action) => {
    const groupName = action.group || GROUP_LABEL_NONE;
    const groupKey = groupName.toLowerCase();
    if (!acc[groupKey]) {
        // Note that the label is the group name of the first action found in this group.
        // If different casing is found in group names, the first one found will be used 
        // (but at least actions remain in the same group)
        acc[groupKey] = { actions: [], label: groupName };
    }
    acc[groupKey].actions.push(action);
    return acc;
  }, {});  
}


/**
 * Finds actions that should be embedded in a specific widget. We used this for actions
 * embedded in NavigationDetail ('navigation' widget). In the future this would be used for 
 * other widgets.
 * 
 * @param {Object} actionsConfig - The actions config object (map from actionId to action definition)
 * @param {string} widgetName - The name of the widget to find actions for
 * @returns {Array} - The list of action objects that should be embedded in the widget
 */
const findEmbeddedActions = (actionsConfig = {}, widgetName) => (
  Object.values(actionsConfig).filter(action => isArray(action?.widgets) && action.widgets.includes(widgetName))
)

export {
  createActionGroups,
  findEmbeddedActions
}