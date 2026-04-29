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
