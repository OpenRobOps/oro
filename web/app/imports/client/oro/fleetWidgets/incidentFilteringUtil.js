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
 * Client Side Incident Filtering Util
 * Utility functions and constants associated with Incidents context filtering
 * There is no Rendering component here, instead these are all functions
 * which facilitate and unify the handling of Incidents context across widgets.
 *
 * NOTE: REACT & METEOR FREE FILE
*/

/**
 * Provides a function that filters incidents according to the context passed,
 * this function is meant to be used as a parameter on Array.filter function of incidents
 *
 * NOTE: This function has unit tests so if you add functionality please update the unit tests
 *                    (/web/ui-support/test/IncidentsFilterUtil.test.js)
 * @param {Object} context - Object containing the parsed filters applied
 *        {
 *          selectedComponentFilter: string containing the component id of the context
 *          selectedSeverityFilter: array containing the severities filters applied to the context
 *         }
*/
const filterFunctionForIncidents = (context = {}) => (incident) => {
  const { selectedComponentFilter, selectedSeverityFilter } = context;
  let ok = true;
  // if the component filter is applied and the incidents components id contains the selected component id filter
  if(selectedComponentFilter) {
    ok = ok && incident?.componentsIds?.includes(selectedComponentFilter);
  }
  // if the component filter is applied and the incident highest severity is contained in the selected severities filters
  if(selectedSeverityFilter) {
    ok = ok && incident && selectedSeverityFilter.includes(incident.highestSeverity);
  }
  return ok;
}

export { filterFunctionForIncidents };
