/**
 * Common (and Meteor-indepentent) functions for Dashboards
 */

/**
 * Given a dashboard spec, it counts the number of sections whose scopes are any of those given
 * in the list `scopes`.
 *
 * @param {object} dashboard A dashboard spec
 * @param {Array} scopes A list of scopes to look for (valid values in SECTION_SCOPES constant)
 * @param {Number} scopes The number of sections matching any of the given scopes
 */
 const countDashboardSectionsWithScopes = (dashboard, scopes) => {
  if (!Array.isArray(scopes)) {
    throw new Error('scopes must be an array');
  }
  const sections = dashboard && dashboard.sections;
  return Array.isArray(sections)
    && sections.filter(section => scopes.some(scope => section && section.scope == scope)).length;
};

export {
  countDashboardSectionsWithScopes,
};
