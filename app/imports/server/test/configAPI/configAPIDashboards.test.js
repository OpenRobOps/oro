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

import { Meteor } from 'meteor/meteor';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import fs from 'fs';
// ORO modules
import { resetDatabase } from '../setup';
import ConfigAPI from '../../configAPI/configAPI';
import {
  AuthorizationError,
  KIND_DASHBOARD_DEFINITION, KIND_DATASOURCE_DEFINITION, LIST_FORMAT_FULL, LIST_FORMAT_SHORT,
  SchemaError,
  ValidationError
} from '../../../shared/configAPI';
import { createUser } from '../configAPI';
import OroRoles, { ROLE_ADMIN, ROLE_VIEWER } from '../../roles';
import DashboardsManager from '../../dashboards';
import { validateNoDuplicateDataSourceIds } from '../../configAPI/dashboards';

// Just make sure this is not getting loaded in dev/prod
if (!Meteor.isTest) {
  throw new Error('This is TEST code only');
}
const { expect } = chai;
chai.use(chaiAsPromised);

describe('configAPI:DashboardDefinition', () => {
  let configApi;

  beforeEach(async () => {
    await resetDatabase();
    configApi = await new ConfigAPI().init({});
    await new OroRoles().createDefaultRoles();
  });

  it('apply: checks for permissions', async () => {
    // Create a regular User (no CONFIG permission on dashboards)
    const user = await createUser({ role: ROLE_VIEWER });
    // Attempt to apply a dashboard on , with one of the ids created for company 2
    const configObject = {
      kind: KIND_DASHBOARD_DEFINITION,
      apiVersion: 'v0.1',
      metadata: {
        id: 'dashboard123'
      },
      spec: {
        label: 'My dasboard',
        sections: []
      }
    };
    await expect(
      configApi.apply({ user, configObject })
    ).to.be.rejectedWith(AuthorizationError);
  });

  it('apply: rejects invalid dashboard specs', async () => {
    const user = await createUser({ role: ROLE_ADMIN });
    await expect(
      configApi.apply({
        configObject: {
          kind: KIND_DASHBOARD_DEFINITION,
          metadata: {
            id: 'test',
          },
          apiVersion: 'v0.1',
          spec: {
            label: 'Test dashboard',
            sections: [],
            color: 'green'
          }
        },
        user
      })
    ).to.be.rejectedWith(SchemaError);
  });

  // Repeat applying a dashboard many times, each time with a different expected error
  [{
    widget: {
      type: 'vitals',
      label: '',
      config: {
        dataSources: 'hello' // should be an array
      }
    },
    message: 'The \'dataSources\' field must be an array'
  }, {
    widget: {
      type: 'group',
      label: '' // missing 'widgets'
    },
    message: 'The \'widgets\' field is required'
  }, {
    widget: {
      type: 'BADTYPE',
      label: ''
    },
    message: 'The \'sections[0].widgets[0].type\' field value'
  }, {
    widget: {
      type: 'vitals',
      label: '',
      config: {
        dataSources: [
          { id: 'ds1', label: 'Data Source 1', type: 'gauge' },
          { id: 'ds2', label: 'Data Source 2', type: 'gauge' },
          { id: 'ds1', label: 'Data Source 1 Duplicate', type: 'gauge' }
        ]
      }
    },
    message: 'Duplicate datasource \'ds1\' found in the same widget. Each datasource can only be used once per widget.'
  }].forEach(({ widget, message }) => {
    it(`apply: checks individual widgets configurations errors (${widget.type})`, async () => {
      const user = await createUser({ role: ROLE_ADMIN });
      // eslint-disable-next-line no-await-in-loop
      await expect(
        configApi.apply({
          configObject: {
            kind: KIND_DASHBOARD_DEFINITION,
            metadata: {
              id: 'test',
            },
            apiVersion: 'v0.1',
            spec: {
              label: 'Dashboard',
              sections: [{
                scope: 'fleet',
                label: 'Fleet',
                widgets: [widget]
              }],
            }
          },
          user
        })
      ).to.be.rejectedWith(SchemaError, message);
    });
  });

  it('apply: creates dashboards', async () => {
    const user = await createUser({ role: ROLE_ADMIN });
    const dashboards = await new DashboardsManager().listDashboards();
    expect(dashboards).to.have.length(0);
    const dashboardId = 'newdash';
    await configApi.apply({
      configObject: {
        kind: KIND_DASHBOARD_DEFINITION,
        metadata: {
          id: dashboardId,
        },
        apiVersion: 'v0.1',
        spec: {
          label: 'Test dashboard',
          sections: [{
            label: 'Empty section',
            scope: 'robot',
            widgets: []
          }]
        }
      },
      user
    });
    const dashboards2 = await new DashboardsManager().listDashboards();
    expect(dashboards2).to.have.length(1);
    const dashboardDoc = dashboards2.find(doc => doc._id == dashboardId);
    expect(dashboardDoc.label).eq('Test dashboard');
    expect(dashboardDoc.sections.length).eq(1);
    expect(dashboardDoc.sections[0].widgets.length).eq(0);
  });

  it('apply: creates dashboards with widgets nested in groups', async () => {
    const user = await createUser({ role: ROLE_ADMIN });
    const dashboardId = 'newdash';
    await configApi.apply({
      configObject: {
        kind: KIND_DASHBOARD_DEFINITION,
        metadata: {
          id: dashboardId,
        },
        apiVersion: 'v0.1',
        spec: {
          label: 'Test dashboard',
          sections: [{
            label: 'Nested section',
            scope: 'robot',
            widgets: [{
              type: 'diagnostics',
              label: 'Diagnostics'
            }, {
              type: 'group',
              label: 'Group',
              widgets: [
                {
                  type: 'vitals',
                  label: 'Vitals'
                },
                {
                  type: 'listData',
                  label: 'List Data'
                }
              ]
            }
          ]
          }]
        }
      },
      user
    });
    const dashboards = await new DashboardsManager().listDashboards();
    const dashboardDoc = dashboards.find(doc => doc._id == dashboardId);
    expect(dashboardDoc.label).eq('Test dashboard');
    expect(dashboardDoc.sections.length).eq(1);
    expect(dashboardDoc.sections[0].widgets.length).eq(2);
    const group = dashboardDoc.sections[0].widgets[1];
    expect(group.widgets.length).eq(2);
    expect(group.widgets[0].label).eq('Vitals');
    expect(group.widgets[1].label).eq('List Data');
  });

  it('apply: creates dashboards with many widget types', async () => {
    // This test is similar to previous ones; just adding more widget types and specific flags
    // that were at some point found to be missing
    const user = await createUser({ role: ROLE_ADMIN });
    const dashboardId = 'newdash';
    await configApi.apply({
      configObject: {
        kind: KIND_DASHBOARD_DEFINITION,
        metadata: {
          id: dashboardId,
        },
        apiVersion: 'v0.1',
        spec: {
          label: 'Test dashboard',
          sections: [{
            label: 'Conditional section',
            scope: 'robot',
            widgets: [{
              type: 'actionsWidget',
              label: 'Actions',
              config: {
                bigButtons: true,
                expanded: true,
                actionIds: ['action1', 'action2']
              }
            }, {
              type: 'cameraWidget',
              label: 'Camera',
              config: {
                cameraId: '10'
              },
              // set an odd layout with all non-default values
              layout: { grid: 5, height: '300px', withoutBackground: true, chroma: false }
            }, {
              type: 'fleetStatus',
              label: 'Fleet',
              config: {
                isExpanded: false
              }
            }, {
              type: 'chart',
              label: 'Chart',
              config: {
                min: 10,
                max: 20,
                chartType: 'linechart',
                dataSources: [{ id: 'cpu', label: 'CPU', op: 'last' }]
              }
            },
            {
              type: 'listData',
              label: 'List Data',
              config: {
                dataSources: [
                  { id: 'cpu', label: 'CPU', precision: 1, type: 'gauge', unit: '%' }
                ]
              }
            }]
          }]
        }
      },
      user
    });
    const dashboards = await new DashboardsManager().listDashboards();
    const dashboardDoc = dashboards.find(doc => doc._id == dashboardId);
    expect(dashboardDoc.label).eq('Test dashboard');
    expect(dashboardDoc.sections.length).eq(1);
    expect(dashboardDoc.sections[0].label).to.eq('Conditional section');
    const { widgets } = dashboardDoc.sections[0];
    // Actions widget fields
    const actionsWidget = widgets[0];
    expect(actionsWidget.label).eq('Actions');
    expect(actionsWidget.type).eq('actionsWidget');
    expect(actionsWidget.config.bigButtons).eq(true);
    expect(actionsWidget.config.expanded).eq(true);
    expect(actionsWidget.config.actionIds[0]).to.eq('action1');
    // Camera widget fields
    const cameraWidget = widgets[1];
    expect(cameraWidget.label).eq('Camera');
    expect(cameraWidget.type).eq('cameraWidget');
    expect(cameraWidget.config.cameraId).eq('10');
    expect(cameraWidget.layout.grid).eq(5);
    expect(cameraWidget.layout.height).eq('300px');
    expect(cameraWidget.layout.chroma).eq(false);
    expect(cameraWidget.layout.withoutBackground).eq(true);
    // Fleet Status widget fields
    const fleetWidget = widgets[2];
    expect(fleetWidget.label).eq('Fleet');
    expect(fleetWidget.type).eq('fleetStatus');
    expect(fleetWidget.config.isExpanded).eq(false);
    // Chart widget fields
    const chartWidget = widgets[3];
    expect(chartWidget.label).eq('Chart');
    expect(chartWidget.type).eq('chart');
    expect(chartWidget.config.min).eq(10);
    expect(chartWidget.config.max).eq(20);
    expect(chartWidget.config.chartType).eq('linechart');
    expect(chartWidget.config.elementValues.cpu.label).eq('CPU');
    expect(chartWidget.config.elementValues.cpu.op).eq('last');
    // List Data widget fields
    const listDataWidget = widgets[4];
    expect(listDataWidget.label).eq('List Data');
    expect(listDataWidget.type).eq('listData');
    expect(listDataWidget.config.elementValues.cpu.label).eq('CPU');
    expect(listDataWidget.config.elementValues.cpu.precision).eq(1);
    expect(listDataWidget.config.elementValues.cpu.type).eq('gauge');
    expect(listDataWidget.config.elementValues.cpu.unit).eq('%');
  });

  it('apply: null specs remove dashboards', async () => {
    const user = await createUser({ role: ROLE_ADMIN });
    await configApi.apply({
      configObject: {
        kind: KIND_DASHBOARD_DEFINITION,
        metadata: { id: 'dash123' },
        apiVersion: 'v0.1',
        spec: { label: 'Test Dashboard', sections: [] }
      },
      user
    });
    const dashboards = await new DashboardsManager().listDashboards();
    expect(dashboards).to.have.length(1);
    expect(dashboards[0]._id).eq('dash123');
    await configApi.apply({
      configObject: {
        kind: KIND_DASHBOARD_DEFINITION,
        metadata: {
          id: 'dash123'
        },
        apiVersion: 'v0.1',
        spec: null
      },
      user
    });
    const dashboards2 = await new DashboardsManager().listDashboards();
    expect(dashboards2).to.have.length(0);
  });

  it('clear: requires sufficient permissions', async () => {
    const configObject = {
      kind: KIND_DASHBOARD_DEFINITION,
      metadata: {
        id: 'dashboard1',
      },
      apiVersion: 'v0.1'
    };
    const user = await createUser({ role: ROLE_VIEWER });
    expect(
      configApi.clear({ configObject, user })
    ).to.be.rejectedWith('Unauthorized');
  });

  it('list: short format retrieves a list of dashboards', async () => {
    const user = await createUser({ role: ROLE_ADMIN });
    await configApi.apply({
      configObject: {
        kind: KIND_DASHBOARD_DEFINITION,
        metadata: { id: 'dash123' },
        apiVersion: 'v0.1',
        spec: { label: 'Test Dashboard', sections: [] }
      },
      user
    });
    const result = await configApi.list({
      user,
      kind: KIND_DASHBOARD_DEFINITION,
      format: LIST_FORMAT_SHORT
    });
    expect(result).to.have.length(1);
    expect(result[0].kind).eq('DashboardDefinition');
    expect(result[0].label).eq('Test Dashboard');
  });

  it('list: full format retrieves dashboards definitions', async () => {
    const user = await createUser({ role: ROLE_ADMIN });
    await configApi.apply({
      configObject: {
        kind: KIND_DASHBOARD_DEFINITION,
        metadata: { id: 'dash123' },
        apiVersion: 'v0.1',
        spec: { label: 'Test Dashboard', sections: [] }
      },
      user
    });
    const result = await configApi.list({
      user,
      kind: KIND_DASHBOARD_DEFINITION,
      format: LIST_FORMAT_FULL
    });
    expect(result).to.have.length(1);
    expect(result[0].kind).eq('DashboardDefinition');
    expect(result[0].spec.label).eq('Test Dashboard');
    expect(result[0].spec.sections).to.have.length(0);
  });

  describe('validateNoDuplicate', () => {
    it('returns true for array with no duplicates', () => {
      const errors = [];
      const dataSources = [
        { id: 'ds1', label: 'Data Source 1' },
        { id: 'ds2', label: 'Data Source 2' },
        { id: 'ds3', label: 'Data Source 3' },
      ];
      const result = validateNoDuplicateDataSourceIds(dataSources, errors);
      expect(errors.length).eq(0);
    });

    it('returns false and adds error for duplicate IDs', () => {
      const errors = [];
      const dataSources = [
        { id: 'ds1', label: 'Data Source 1' },
        { id: 'ds2', label: 'Data Source 2' },
        { id: 'ds1', label: 'Data Source 1 Duplicate' },
      ];
      const result = validateNoDuplicateDataSourceIds(dataSources, errors);
      expect(errors.length).eq(1);
      expect(errors[0].type).eq('duplicateDataSourceId');
      expect(errors[0].message).to.include('Duplicate datasource \'ds1\'');
      expect(errors[0].message).to.include('Each datasource can only be used once per widget');
    });
  });
});
