/**
 * Configuration as code tests for status definitions
 */
import { Meteor } from 'meteor/meteor';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
// ORO modules
import { resetDatabase } from '../setup';
import ConfigAPI from '../../configAPI/configAPI';
import OroRoles from '../../roles';
import {
  KIND_DATASOURCE_DEFINITION, KIND_STATUS_DEFINITION, LIST_FORMAT_FULL
} from '../../../shared/configAPI';
import { createRobot, createUser } from '../configAPI';
import { ROLE_ADMIN, ROLE_VIEWER } from '../../../lib/roles';
import RobotStatusManager from '../../status';
import { ID_TYPE_ROBOT } from '../../../shared/constants';
import { STATUS } from '../../../shared/status';
import {
  configObjectRuleToStatusConfigRule,
  statusConfigRuleToConfigObjectRule
} from '../../configAPI/statusDefinitions';
import AttributesManager from '../../attributes';

// Just make sure this is not getting loaded in dev/prod
if (!Meteor.isTest) {
  throw new Error('This is TEST code only');
}
const { expect } = chai;
chai.use(chaiAsPromised);

describe('configAPI:StatusDefinition conversion between representations ', () => {
  it('conversion: external to internal representation of status rules', () => {
    const external = [{
      status: 'ERROR',
      function: 'ABOVE',
      params: [5]
    }, {
      status: 'WARNING',
      function: 'BELOW',
      params: [10]
    }, {
      status: 'WARNING',
      function: 'EQUALS',
      params: ['hello']
    }, {
      status: 'WARNING',
      function: 'NOT_EQUALS',
      params: ['hello']
    }, {
      status: 'WARNING',
      function: 'CONTAINS',
      params: ['hello']
    }, {
      status: 'ERROR',
      function: 'EQUALS',
      params: ['hello'],
      sustainedForSeconds: 180
    }];
    const expected = [{
      status: STATUS.ERROR.value,
      functionName: 'higherThan',
      params: {
        max: 5
      }
    }, {
      status: STATUS.WARN.value,
      functionName: 'lessThan',
      params: {
        min: 10
      }
    }, {
      status: STATUS.WARN.value,
      functionName: 'equals',
      params: {
        value: 'hello'
      }
    }, {
      status: STATUS.WARN.value,
      functionName: 'notEquals',
      params: {
        value: 'hello'
      }
    }, {
      status: STATUS.WARN.value,
      functionName: 'contains',
      params: {
        value: 'hello'
      }
    }, {
      status: STATUS.ERROR.value,
      functionName: 'sustainedEquals',
      params: {
        value: 'hello',
        minSeconds: 180
      }
    }];
    expect(external.map(configObjectRuleToStatusConfigRule)).deep.eq(expected);
  });

  it('conversion: internal to external representation of status rules', () => {
    const internal = [{
      status: STATUS.ERROR.value,
      functionName: 'higherThan',
      params: {
        max: 5
      }
    }, {
      status: STATUS.WARN.value,
      functionName: 'lessThan',
      params: {
        min: 10
      }
    }, {
      status: STATUS.WARN.value,
      functionName: 'equals',
      params: {
        value: 'hello'
      }
    }, {
      status: STATUS.WARN.value,
      functionName: 'notEquals',
      params: {
        value: 'hello'
      }
    }, {
      status: STATUS.WARN.value,
      functionName: 'contains',
      params: {
        value: 'hello'
      }
    }, {
      status: STATUS.ERROR.value,
      functionName: 'sustainedEquals',
      params: {
        value: 'hello',
        minSeconds: 180
      }
    }];
    const expected = [{
      status: 'ERROR',
      function: 'ABOVE',
      params: [5]
    }, {
      status: 'WARNING',
      function: 'BELOW',
      params: [10]
    }, {
      status: 'WARNING',
      function: 'EQUALS',
      params: ['hello']
    }, {
      status: 'WARNING',
      function: 'NOT_EQUALS',
      params: ['hello']
    }, {
      status: 'WARNING',
      function: 'CONTAINS',
      params: ['hello']
    }, {
      status: 'ERROR',
      function: 'EQUALS',
      params: ['hello'],
      sustainedForSeconds: 180
    }];
    expect(internal.map(statusConfigRuleToConfigObjectRule)).deep.eq(expected);
  });
});

describe('configAPI:StatusDefinition', () => {
  beforeEach(async () => {
    // HACK(herchu): Tests expect en empty db. Some managers add defaults ("root") during init().
    // When running a complete tests suite, the managers will already been initialized when reaching
    // these tests; but not if running only a subset. Instantiating before resetDatabase()
    // guarantees this never happens.
    // eslint-disable-next-line no-new
    await resetDatabase();
    await new AttributesManager().init();
    await new OroRoles().createDefaultRoles();
  });

  it('apply: requires sufficient permissions', async () => {
    const configObject = {
      kind: KIND_STATUS_DEFINITION,
      metadata: {
        id: 'cpuLoadPercentage',
      },
      spec: {
        rules: [
          {
            function: 'ABOVE',
            params: [20],
            status: 'ERROR'
          }
        ]
      },
      apiVersion: 'v0.1'
    };
    const user = await createUser({ role: ROLE_VIEWER });
    new ConfigAPI().init();
    expect(
      new ConfigAPI().apply({ configObject, user })
    ).to.be.rejectedWith('Unauthorized');
  });

  it('apply: status configs get applied', async () => {
    const configObject = {
      kind: KIND_STATUS_DEFINITION,
      metadata: {
        id: 'cpuLoadPercentage',
      },
      spec: {
        rules: [
          {
            function: 'ABOVE',
            params: [10],
            status: 'ERROR',
            sustainedForSeconds: 120
          },
          {
            function: 'ABOVE',
            params: [5],
            status: 'WARNING',
            sustainedForSeconds: 200
          },
        ]
      },
      apiVersion: 'v0.1'
    };
    const user = await createUser({ role: ROLE_ADMIN });
    new ConfigAPI().init();
    await new ConfigAPI().apply({ configObject, user });
    const statusConfig = (await new RobotStatusManager().getStatusConfigs())['cpuLoadPercentage'];
    expect(statusConfig).not.be.undefined;
    const { rules } = statusConfig;
    expect(rules).to.deep.eq([{
      functionName: 'sustainedHigherThan',
      status: STATUS.ERROR.value,
      params: {
        maxValue: 10,
        minSeconds: 120
      },
    }, {
      functionName: 'sustainedHigherThan',
      status: STATUS.WARN.value,
      params: {
        maxValue: 5,
        minSeconds: 200
      },
    }]);
  });

  it('list: using multiple scopes includes suppressed objects', async () => {
    const configObjectDataSource = {
      kind: KIND_DATASOURCE_DEFINITION,
      metadata: {
        id: 'cpuLoadPercentage',
      },
      spec: {
        label: 'CPU DS',
      },
      apiVersion: 'v0.1'
    };
    const configObjectStatus = {
      kind: KIND_STATUS_DEFINITION,
      metadata: {
        id: 'cpuLoadPercentage'
      },
      spec: {
        rules: [
          {
            function: 'ABOVE',
            params: [10],
            status: 'ERROR',
            sustainedForSeconds: 120
          },
          {
            function: 'ABOVE',
            params: [5],
            status: 'WARNING',
            sustainedForSeconds: 120
          },
        ]
      },
      apiVersion: 'v0.1'
    };
    const configObjectStatus2 = {
      kind: KIND_STATUS_DEFINITION,
      metadata: {
        id: 'anotherAttribute'
      },
      spec: {
        rules: [] // no rules, but spec is not null so it is not suppressed
      },
      apiVersion: 'v0.1'
    };
    const user = await createUser({ role: ROLE_ADMIN });
    new ConfigAPI().init();
    await new ConfigAPI().apply({ configObject: configObjectDataSource, user });
    await new ConfigAPI().apply({ configObject: configObjectStatus, user });
    await new ConfigAPI().apply({ configObject: configObjectStatus2, user });
    const result = await new ConfigAPI().list({
      user,
      kind: KIND_STATUS_DEFINITION
    });
    const ds1 = result.find(r => r.id === 'cpuLoadPercentage');
    const ds2 = result.find(r => r.id === 'anotherAttribute');
    expect(ds1).deep.equal({
      id: 'cpuLoadPercentage',
      kind: KIND_STATUS_DEFINITION,
      label: 'CPU DS',
      suppressed: false,
      scope: ''
    });
    expect(ds2).deep.equal({
      id: 'anotherAttribute',
      kind: KIND_STATUS_DEFINITION,
      label: '',
      suppressed: false,
      scope: ''
    });
  });

  it('clear: requires sufficient permissions', async () => {
    const configObject = {
      kind: KIND_STATUS_DEFINITION,
      metadata: {
        id: 'cpuLoadPercentage',
      },
      apiVersion: 'v0.1'
    };
    const user = await createUser({ role: ROLE_VIEWER });
    new ConfigAPI().init();
    expect(
      new ConfigAPI().clear({ configObject, user })
    ).to.be.rejectedWith('Unauthorized');
  });

  it('clear: clears a definition', async () => {
    const configObject = {
      kind: KIND_STATUS_DEFINITION,
      metadata: {
        id: 'cpuLoadPercentage',
      },
      spec: {
        rules: [
          {
            function: 'ABOVE',
            params: [10],
            status: 'ERROR',
            sustainedForSeconds: 120
          },
          {
            function: 'ABOVE',
            params: [5],
            status: 'WARNING',
            sustainedForSeconds: 120
          },
        ]
      },
      apiVersion: 'v0.1'
    };
    const user = await createUser({ role: ROLE_ADMIN });
    new ConfigAPI().init();
    // apply once
    await new ConfigAPI().apply({ configObject, user });
    const statusConfig1 = await new RobotStatusManager().getStatusConfigs();
    expect(statusConfig1['cpuLoadPercentage']).not.be.undefined;
    // now clear
    delete configObject.spec;
    await new ConfigAPI().clear({ configObject, user });
    const statusConfig2 = await new RobotStatusManager().getStatusConfigs();
    expect(statusConfig2['cpuLoadPercentage']).be.undefined;
  });

  it.skip('apply: config with calculated expressions creates derived attributes', async () => {
    const NEW_ATTR = 'new_id';
    const configObject = {
      kind: KIND_STATUS_DEFINITION,
      apiVersion: 'v0.1',
      metadata: {
        id: NEW_ATTR,
      },
      spec: {
        calculated: {
          expression: 'log10(getValue("cpuLoadPercentage"))',
          filter: 'getValue("cpuLoadPercentage") > 0.6'
        },
        rules: [
          {
            function: 'ABOVE',
            params: [10],
            status: 'ERROR',
            sustainedForSeconds: 120
          }
        ]
      }
    };
    const user = await createUser({ role: ROLE_ADMIN });
    new ConfigAPI().init();
    await new ConfigAPI().apply({ configObject, user });
    // Get the applied config, it should represent exactly the same spec
    const obtainedStatusConfig = await new ConfigAPI().list({
      id: NEW_ATTR,
      kind: KIND_STATUS_DEFINITION,
      user,
      format: LIST_FORMAT_FULL
    });
    expect(obtainedStatusConfig).to.have.length(1);
    expect(obtainedStatusConfig[0]).deep.eq(configObject);
    // Assert also that the status and the attribute were created correctly
    const robotId = await createRobot();
    const statusConfig = await new RobotStatusManager().findStatusConfig(
      robotId,
      ID_TYPE_ROBOT,
      NEW_ATTR
    );
    expect(statusConfig).to.deep.eq([{
      functionName: 'sustainedHigherThan',
      status: STATUS.ERROR.value,
      params: {
        maxValue: 10,
        minSeconds: 120
      },
    }]);
    // Check that *internally* there exists a new derived Attribute, created from this Status
    const mgr = new AttributesManager();
    const attrDef = await mgr.getCompleteAttributeDefinition(NEW_ATTR);
    expect(attrDef.definition.label).eq('Calculated Status for [new_id]');
    expect(attrDef.mapping.source).eq('derived');
    expect(attrDef.mapping.transform).eq('log10(getValue("cpuLoadPercentage"))');
    expect(attrDef.mapping.filter).eq('getValue("cpuLoadPercentage") > 0.6');
    // However, this new attribute must be hidden from the DataSourceDefinition list() API
    const obtainedDataSourcesConfig = await new ConfigAPI().list({
      kind: KIND_DATASOURCE_DEFINITION,
      user
    });
    expect(obtainedDataSourcesConfig).to.have.length(0);
  });

  it.skip('apply: config with calculated expressions with label configured by the user, creates a derived attribute containing it', async () => {
    const NEW_ATTR = 'new_id';
    const configObject = {
      kind: KIND_STATUS_DEFINITION,
      apiVersion: 'v0.1',
      metadata: {
        id: NEW_ATTR,
      },
      spec: {
        calculated: {
          label: 'label',
          expression: 'log10(args[0])',
          filter: 'args[0] > 0'
        },
        rules: [
          {
            function: 'ABOVE',
            params: [10],
            status: 'ERROR',
            sustainedForSeconds: 120
          }
        ]
      }
    };
    const user = await createUser({ role: ROLE_ADMIN });
    new ConfigAPI().init();
    await new ConfigAPI().apply({ configObject, user });
    const robotId = await createRobot();
    const statusConfig = await new RobotStatusManager().findStatusConfig(
      robotId,
      ID_TYPE_ROBOT,
      NEW_ATTR
    );
    expect(statusConfig).to.deep.eq([{
      functionName: 'sustainedHigherThan',
      status: STATUS.ERROR.value,
      params: {
        maxValue: 10,
        minSeconds: 120
      },
    }]);

    const mgr = new AttributesManager();
    const attrDef = await mgr.getCompleteAttributeDefinition(ID_TYPE_COMPANY, NEW_ATTR);
    expect(attrDef.definition.label).eq('label');
    expect(attrDef.mapping.source).eq('derived');
    expect(attrDef.mapping.transform).eq('log10(args[0])');
  });

  // NOTE(herchu) Since expressions are not being validated, we cannot yet implement this test.
  // I am leaving it as a stub and as a reminder that we should have this unit test for rejected
  // expressions with bad syntax
  it.skip('apply: configs with bad calculated expressions are rejected', async () => {
    const NEW_ATTR = 'new_id';
    const configObject = {
      kind: KIND_STATUS_DEFINITION,
      apiVersion: 'v0.1',
      metadata: {
        id: NEW_ATTR,
      },
      spec: {
        calculated: {
          expression: '1 + ('
        },
        rules: []
      }
    };
    const user = await createUser({ role: ROLE_ADMIN });
    new ConfigAPI().init();
    // TODO(herchu) check that apply() returns some failure return value
    new ConfigAPI().apply({ configObject, user });
    const robotId = await createRobot();
    const statusConfig = await new RobotStatusManager().findStatusConfig(
      robotId,
      ID_TYPE_ROBOT,
      NEW_ATTR
    );
    expect(statusConfig).to.be.undefined; // the status should NOT be persisted
  });
});
