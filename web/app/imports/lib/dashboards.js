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
// import { UIPreferences } from '../lib/collections';
import { DASHBOARDS, SECTION_SCOPES, WIDGET_TYPE_GROUP } from './uiPreferences';
import DashboardSectionFixtures from './dashboardSectionFixtures';
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
 * Process or cleanup a specific section of the dasboards config,
 * given the Section object definition: This includes adding default widgets,
 * when necessary.
 *
 * @param section A section object for this configuration to be validated
 *   and sanitized.
 * @param oldSection Optional, the old configuration of the corresponding
 *   section in the old dahsboard concfig. It is used for comparison against
 *   the new one; to check for example if section types or layout presets have changed.
 */
const cleanupSectionConfig = (section, oldSection) => {
  const { scope, widgets } = section;
  const timeCapsuleLayouts = DashboardSectionFixtures[SECTION_SCOPES.TIME_CAPSULE];
  let { layoutId: newLayoutId } = section || {};
  const { layoutId: oldLayoutId } = oldSection || {};
  if (scope == SECTION_SCOPES.TIME_CAPSULE
    && (!Array.isArray(widgets) || !widgets.length || (newLayoutId && oldLayoutId != newLayoutId))
  ) {
    // Time Capsule sections are not directly editable in the UI; instead,
    // only a 'layoutId' is selected. (This applies only to editing the section
    // from config UI; as manual DB configuration is still possible)
    // See https://docs.google.com/presentation/d/1S31pKkFRqIIm3YbTEJIpHEq0uRux3sdVM7-woTdItOE/edit#slide=id.gcbe140f026_0_287
    newLayoutId = newLayoutId || timeCapsuleLayouts[0].id;
    const layout = timeCapsuleLayouts.find(layoutObject => layoutObject.id == newLayoutId)
      || timeCapsuleLayouts[0];
    Object.keys(layout.config).forEach((key) => {
      section[key] = cloneDeep(layout.config[key]);
    });
    // Save a `config.layoutId` object in the section to know which layout
    // was selected
    section.layoutId = newLayoutId;
    section.withControlWidget = true; // Time Capsule always uses its Control Bar
  }
};

/**
 * Process or cleanup dasboard config, given the Dashboard object definition:
 * This includes adding default widgets, when necessary.
 *
 * @param dashboard A dashboard object for this configuration to be validated
 *   and sanitized.
 * @param oldDashboard Optional, the old configuration of the same dashboard
 *   object. It is used for comparison against the new one; to check for
 *   example if section types or layout presets have changed.
 */
const cleanupDashboardConfig = (dashboard, oldDashboard = null) => {
  dashboard.sections && dashboard.sections.forEach((section, ix) => {
    cleanupSectionConfig(
      section,
      oldDashboard && oldDashboard.sections && oldDashboard.sections[ix]
    );
  });
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
  cleanupDashboardConfig,
  loadDashboards, // deprecated
  loadDashboardsAsync,
  findDashboardWithScopes,
  foldWidgetsAsync,
  foldWidgetsListAsync,
};
