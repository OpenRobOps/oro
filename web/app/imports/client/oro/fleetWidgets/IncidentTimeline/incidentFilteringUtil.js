/**
 * Client Side Incident Filtering Util
 * Utility functions associated with Incidents context filtering.
 *
 * NOTE: REACT & METEOR FREE FILE
 */

/**
 * Provides a function that filters incidents according to the context passed.
 * Meant to be used as a parameter to Array.filter on an incidents array.
 *
 * @param {Object} context
 *   selectedComponentFilter {string} - component id to filter by
 *   selectedSeverityFilter  {Array}  - severities to filter by
 */
const filterFunctionForIncidents = (context = {}) => (incident) => {
  const { selectedComponentFilter, selectedSeverityFilter } = context;
  let ok = true;
  if (selectedComponentFilter) {
    ok = ok && incident && incident.componentsIds.includes(selectedComponentFilter);
  }
  if (selectedSeverityFilter) {
    ok = ok && incident && selectedSeverityFilter.includes(incident.highestSeverity);
  }
  return ok;
};

export { filterFunctionForIncidents };
