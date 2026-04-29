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

/* eslint-disable max-classes-per-file */
/**
 * Dashboard Manager
 * Handles various operations regarding dashboards such as:
 * - Methods for CRUD operations on dashboards
 * - Publications to send dashboard data to clients
 */
import { Meteor } from 'meteor/meteor';
import { Random } from 'meteor/random';
import { isString, isBoolean, isEmpty } from 'lodash';
// ORO modules
// import OroRoles from './roles';
// import { UIPreferences, Companies } from '../lib/collections';
import Dashboards, {
  listAllDashboardsAsync,
  foldWidgetsAsync
} from '../lib/dashboards';
// import ConfigManager, { assertUniqueIdFields } from '../lib/configManagerAsync';
import { DASHBOARDS, WIDGET_TYPE_GROUP, WIDGET_TYPES_IDS } from '../lib/uiPreferences';
import defaultDashboards from '../lib/fixtures/default-dashboards.json';
// import { renameKeys } from '../lib/util';
// import {
//   RESOURCE_SINGLETONS, ACCESS_LEVEL_CONFIGURE,
//   glueId,
//   SCOPE_SEPARATOR,
// } from '../shared/roles';
// import AttributesManager from './attributes';
// import { TIMESERIES_FIELD_TYPES } from '../shared/timeseries';
// import { ValidationError } from '../shared/configAPI';

let instance;
class DashboardsManager {
  constructor() {
    if (instance === undefined) {
      instance = this;
      // this._uiPrefsCnfg = new ConfigManager(UIPreferences);
      // Configuration listeners to receive callbacks when dashboards change.
      this._configListenerCallbacks = [];
    }
    // eslint-disable-next-line no-constructor-return
    return instance;
  }

  init = async () => {
    // Placeholder.
  }

  /**
   * Returns all dashboard objects in the DB; regardless their visibility.
   * 
   * @returns {Array} An array of dashboard db documents (with _id)
   */
  listDashboards = async () => {
    return await Dashboards.find({}).fetchAsync();
  };

  /**
   * Creates an empty dashboard.
   *
   * @param {String} dashboardId (optional) The dashboardId. Randomized if null
   * @return {String} dashboardId
   */
  addNewDashboard = async (dashboardId = null) => {
    const newDashId = dashboardId || Random.secret(20);
    const setDashboardBool = {};
    setDashboardBool['dashboards.' + newDashId] = false;

    // await UIPreferences.upsertAsync({
    // ...
    // }, {
    //   $set: setDashboardBool,
    // });

    const result = await Dashboards.insertAsync({
      _id: newDashId,
      label: 'New Dashboard',
      sections: []
    });

    await this.propagateConfigChange({
      id: newDashId,
    });
    return result;
  };

  /**
   * Deletes an existing dashboard and removes it from the uiPreferences
   *
   * @return {String} dashboardId
   */
  deleteDashboard = async ({ dashboardId }) => {
    // Remove the dashboard
    const result = await Dashboards.removeAsync({
      _id: dashboardId,
    });

    await this.propagateConfigChange({
      id: dashboardId,
    });
    return result;
  };

  /**
   * Removes a given attribute given by its id from any dashboard of a company.
   * It traverses all dashboards, all their sections, and all their widgets (even
   * recursively through groups) and if the attribute is found, it updates the
   * dashboard document in mongo, doing a point-wise modification to remove that
   * attribute.
   */
  suppressAttributeFromDashboards = async (attributeId) => {
    const dashboardIds = await listAllDashboardsAsync();
    const dashboardDocs = await Dashboards.find({ _id: { $in: dashboardIds } }).fetchAsync();
    await Promise.all(dashboardDocs.map(async (dashboardDoc) => {
      const dashboardId = dashboardDoc._id;
      const updates = this._suppressAttributeFromDashboard(dashboardDoc, attributeId);
      if (!isEmpty(updates)) {
        // If the `updates` object is not empty, update the document in the db
        await Dashboards.updateAsync({ _id: dashboardId }, { $set: updates });
      }
    }));
  };

  /**
   * Calculates the changes to suppress the given attributeId from all widgets
   * found in a dashboard object. It does not perform any modification; it only
   * returns the changes as if they were to be applied using a Mongo $set.
   *
   * For code simplicity, the result can be `{}`, the caller should check for isEmpty
   *
   * @param {object} dashboardConfig is _one_ dashboard object as retrieved from DB
   * @param {string} attributeId the attribute to remove
   * @return {object} a mongo-like update object with the paths that need to be
   *    updated. See example below.
   *
   * Example return value:
   * ```
   * {
   *   'sections.0.widgets.1.config.elementList': [ 'H13UspDmhmejsrRy', 'lG9_vpKP0gu9i9fj' ],
   *   'sections.0.widgets.1.config.elementValues._6yw-MnGEBAXSpTX': null,
   *   'sections.0.widgets.3.config.elementList': [ 'lG9_vpKP0gu9i9fj' ],
   *   'sections.0.widgets.3.config.elementValues._6yw-MnGEBAXSpTX': null
   * }
   * ```
   */
  _suppressAttributeFromDashboard = (dashboardConfig, attributeId) => {
    const sections = dashboardConfig.sections || [];
    // NOTE: Assuming we always have
    let updates = {};
    sections.forEach((sectionObj, sectionIx) => {
      const sectionUpdates = this._suppressAttributeFromSection(sectionObj, attributeId);
      updates = Object.assign(
        updates,
        renameKeys(path => (`sections.${sectionIx}.${path}`), sectionUpdates)
      );
    });
    return updates;
  };

  /**
   * Calculates the changes to suppress the given attributeId from all widgets
   * found in a _section_ object of a dashboard. It does not perform any modification;
   * it only returns the changes as if they were to be applied using a Mongo $set.
   *
   * For code simplicity, the result can be `{}`, the caller should check for isEmpty
   *
   * @param {object} sectionObject is a Section definition within a dashboard.
   *   (sections[ix] from a Dashboard object).
   * @param {string} attributeId the attribute to remove
   * @return {object} a mongo-like update object with the paths that need to be
   *    updated. See example below.
   *
   * Example return value:
   * ```
   * {
   *   'widgets.1.config.elementList': [ 'H13UspDmhmejsrRy', 'lG9_vpKP0gu9i9fj' ],
   *   'widgets.1.config.elementValues._6yw-MnGEBAXSpTX': null,
   *   'widgets.3.config.elementList': [ 'lG9_vpKP0gu9i9fj' ],
   *   'widgets.3.config.elementValues._6yw-MnGEBAXSpTX': null
   *   'widgets.4.widgets.2.config.elementList': [ 'lG9_vpKP0gu9i9fj' ],
   *   'widgets.4.widgets.2.config.elementValues._6yw-MnGEBAXSpTX': null
   * }
   * ```
   *
   * Note: In the example above, the last two keys correspond to a widget group.
   */
  _suppressAttributeFromSection = (sectionObject, attributeId) => {
    let updates = {};
    const widgets = (sectionObject && sectionObject.widgets) || [];
    widgets.forEach((widget, widgetIx) => {
      const { type, config } = widget || {};
      if (type == WIDGET_TYPE_GROUP) {
        // Dive into this group and keep searching for attributeId
        const groupUpdates = this._suppressAttributeFromSection(widget, attributeId);
        if (groupUpdates) {
          // collect all updates found for that group, add nesting (widgets[ix])
          updates = Object.assign(
            updates,
            renameKeys(path => (`widgets.${widgetIx}.${path}`), groupUpdates)
          );
        }
      } else if ([WIDGET_TYPES_IDS.CHART, WIDGET_TYPES_IDS.VITALS].includes(type)) {
        const { elementList } = config || {};

        if (Array.isArray(elementList) && elementList.includes(attributeId)) {
          updates[`widgets.${widgetIx}.config.elementList`] = elementList.filter(id => id != attributeId);
          updates[`widgets.${widgetIx}.config.elementValues.${attributeId}`] = null;
        }
      }
    });
    return updates;
  };

  /**
   * Updates (or creates) a dashboard configuration.
   * Does NOT modify visibility permissions, just what the dashboard is composed of
   *
   * @param {Object} newDashboardConfig
   * @throws {Exception} if the config does not pass schema or semantic validation
   */
  updateDashboard = async ({ dashboardId, newDashboardConfig }) => {
    const newDashConfig = {};
    newDashConfig['dashboards.' + dashboardId] = '';
    await this.validateDashboardConfig(newDashboardConfig);
    const result = await Dashboards.upsertAsync({
      _id: dashboardId,
    }, {
      $set: newDashboardConfig
    });
    await this.propagateConfigChange({
      id: dashboardId,
    });
    return result;
  };

  /**
   * Validates the dashboard config. The provided config must be already validated by the schema validator
   * (See web/imports/server/configAPI/dashboards.js).
   * @param {Object} newDashboardConfig
   * @throws {Exception} if the config does not pass semantic validation
   */
  validateDashboardConfig = async (newDashboardConfig) => {
    // NOTE: No additional semantic validation implemented for now. This is a placeholder.
  }

  /**
   * Returns the dashboards visible for a user. These are calculated from
   * their visibility (combined with the role(s) the user has in this account).
   *
   * @param {String} userId
   * @returns {Array} A list with all visible dashboards for this user
   */
  calculateVisibleDashboards = async (userId) => {
    // Get user dashboard Ids
    // TODO calculate user preferences
    // return Object.entries(config.dashboards || {})
    //   .reduce((acc, [id, visible]) => (visible ? [...acc, id] : acc), []);
    return null; // wildcard for "all"
  };

  /**
   * Subscribes a listener for configuration changes.
   */
  addConfigListener = (callback) => {
    this._configListenerCallbacks.push(callback);
  };

  /**
   * Propagates a configuration change, through the configuration listeners.
   * @param {object} object
   */
  propagateConfigChange = (object) => {
    for (const callback of this._configListenerCallbacks) {
      callback(object);
    }
  };

  /**
   * Toggles visibility of a dashboard to a given role.
   *
   * @param {String} dashboardId The dashboard to toggle visibility
   * @param {String} roleId A role: "manager", "viewer", etc. (NOT qualified as "role/...")
   *    Note that this argument is different from the one in the Meteor method updateVisibility
   * @param {Boolean} visible
   */
  updateVisibility = async ({ dashboardId, roleId, visible }) => {
    if (!roleId || !isString(roleId)) {
      throw new Meteor.Error('roleId must be a non-empty string');
    }
    if (!dashboardId || !isString(dashboardId)) {
      throw new Meteor.Error('dashboardId must be a non empty string');
    }
    if (!isBoolean(visible)) {
      throw new Meteor.Error('visible must be a boolean');
    }
    // Update visibility of the given dashboard for the proper role
    // const entity = assertUniqueIdFields({
    //   entityId: glueId(ID_TYPE_ROLE, roleId),
    //   entityType: ID_TYPE_ROLE,
    // });
    // return this._uiPrefsCnfg.setEntityConfig({
    //   ...entity,
    //   newConfig: { [`dashboards.${dashboardId}`]: visible }
    // });
  };
}

export default DashboardsManager;

/**
 * Publication for dashboard specs.
 *
 * @param {array} dashboardIds list of Ids identifying the dashboards to publish
 */
Meteor.publish('user.dashboards', async function () {
  // TODO/login
  // if (!this.userId) {
  //   return this.ready();
  // }
  // Determine which dashboards are visible for this user
  const visibleDashboardIds = await new DashboardsManager().calculateVisibleDashboards(this.userId);
  const query = visibleDashboardIds ? { _id: { $in: visibleDashboardIds } } : {};
  return Dashboards.find(query);
});
