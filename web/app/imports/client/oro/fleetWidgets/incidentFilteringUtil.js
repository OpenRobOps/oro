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
 * NOTE(franguerini): This function has unit tests so if you add functionality please update the unit tests
 *                    (/inorbit/web/ui-support/test/IncidentsFilterUtil.test.js)
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
    ok = ok && incident && incident.componentsIds.includes(selectedComponentFilter);
  }
  // if the component filter is applied and the incident highest severity is contained in the selected severities filters
  if(selectedSeverityFilter) {
    ok = ok && incident && selectedSeverityFilter.includes(incident.highestSeverity);
  }
  return ok;
}

export { filterFunctionForIncidents };
