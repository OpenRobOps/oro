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

/*
 * Define the dashboards collection, so a single definition
 * can use used by the server and the client.
 */
import { Mongo } from 'meteor/mongo';
import { Meteor } from 'meteor/meteor';
import SimpleSchema from 'simpl-schema';
import { cloneDeep, keyBy } from 'lodash';
// ORO modules
import { COLLECTIONS } from '../shared/constants';
import { UIPreferences } from '../lib/collections';
import { DASHBOARDS, SECTION_SCOPES, WIDGET_TYPE_GROUP } from './uiPreferences';
import { countDashboardSectionsWithScopes } from '../shared/dashboards';

/**
 * Dashboards
 * represents a dashboards label, sections, including its widgets and their format,
 * among other configs
 */
const Dashboards = new Mongo.Collection(COLLECTIONS.DASHBOARDS);
const LayoutSchema = new SimpleSchema({
  chroma: { type: Boolean, required: false },
  height: { type: SimpleSchema.oneOf(String, Number), required: false },
  grid: { type: SimpleSchema.Integer, min: 1, max: 12, required: false },
});

const WidgetSchema = new SimpleSchema({
  label: String,
  type: String,
  config: { type: Object, blackbox: true },
  layout: LayoutSchema,
});

const SectionSchema = new SimpleSchema({
  label: { type: String, required: false },
  scope: String,
  comment: { type: String, required: false },
  withControlWidget: { type: Boolean, required: false },
  widgets: Array,
  'widgets.$': WidgetSchema
});

const DashboardsSchema = new SimpleSchema({
  label: String,
  order: { type: Number, required: false },
  sections: Array,
  'sections.$': SectionSchema,
});
if (Meteor.isDevelopment) {
  // Dashboards.attachSchema(DashboardsSchema);
}

/**
 * Gets the list of all dashboards (irrespective of which roles
 * can see them).
 *
 * @return a list of dashboardId
 */
const listAllDashboardsAsync = async () => {
  const dashboards = await loadDashboardsAsync();
  return dashboards.map(dashboard => dashboard._id);
};

/**
 * Loads from mongodb *all* dashboards specs from a list of dashboard ids.
 *
 * @param {Array} dashboardIds A list of dashboard ids
 * @return {object} A map from dashboard id to dashboard spec
 */
const loadDashboardsAsync = async dashboardIds => (
  keyBy(
    await Dashboards.find({ _id: { $in: dashboardIds } }).fetchAsync(),
    '_id'
  )
);

// @deprecated Use loadDashboardsAsync instead
const loadDashboards = dashboardIds => (
  keyBy(
    Dashboards.find({ _id: { $in: dashboardIds } }).fetch(),
    '_id'
  )
);

/**
 * Given a dashboards configuration (mapping from dashboard id to dashboard specs) it finds a
 * returns a dashboard such that it contains the given scopes.
 *
 * It will attempt to find the "best" dashboard matching these scopes, as there can be many.
 * For example, the default Robot dashboard could contain several sections of scope "robot", while
 * a Navigation dashboard could contain one with scope "navigation" and one with "robot".
 * In order to find the result, it selects the with the most matching sections (and the least
 * non-matching sections as tie-breaker).
 *
 * @param {Object} dashboards Object, map from dashboard ids to specs
 * @param {Array} scopes A list of scopes to match
 * @returns
 */
const findDashboardWithScopes = (dashboards, scopes) => {
  let bestScore;
  let bestDashboard = null;
  Object.values(dashboards).forEach((dashboard) => {
    const sectionsCount = Array.isArray(dashboard.sections) ? dashboard.sections.length : 0;
    const goodScopesCount = countDashboardSectionsWithScopes(dashboard, scopes);
    const score = goodScopesCount * 10 - (sectionsCount - goodScopesCount);
    if (score > 0 && (!bestDashboard || bestScore < score)) {
      bestScore = score;
      bestDashboard = dashboard;
    }
  });
  return bestDashboard;
};

/**
 * Folds a list of widgets asynchronously.
 * @param {Array} widgets
 * @param {*} initialValue
 * @param {Function} reducer Function with signature async (acc, widget) -> newAcc
 * @returns {Promise<*>} The final accumulator value
 */
const foldWidgetsListAsync = async (widgets, initialValue, reducer) => {
  let acc = initialValue;
  if (Array.isArray(widgets)) {
    for (const widget of widgets) {
      // eslint-disable-next-line no-await-in-loop
      acc = await reducer(acc, widget);
      if (widget?.type === WIDGET_TYPE_GROUP) {
        // eslint-disable-next-line no-await-in-loop
        acc = await foldWidgetsListAsync(widget.widgets, acc, reducer);
      }
    }
  }
  return acc;
};

/**
 * Folds the widgets of a dashboard config asynchronously.
 * @param {Object} dashboardConfig
 * @param {*} initialValue
 * @param {Function} reducer Function with signature async (acc, widget) -> newAcc
 * @returns {Promise<*>} The final accumulator value
 */
const foldWidgetsAsync = async (dashboardConfig, initialValue, reducer) => {
  let acc = initialValue;
  if (Array.isArray(dashboardConfig.sections)) {
    for (const section of dashboardConfig.sections) {
      if (Array.isArray(section?.widgets)) {
        acc = await foldWidgetsListAsync(section.widgets, acc, reducer);
      }
    }
  }
  return acc;
};

export default Dashboards;
export {
  Dashboards,
  DashboardsSchema,
  listAllDashboardsAsync,
  cleanupSectionConfig,
  loadDashboards, // deprecated
  loadDashboardsAsync,
  findDashboardWithScopes,
  foldWidgetsAsync,
  foldWidgetsListAsync,
};
