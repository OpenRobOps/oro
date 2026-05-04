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
 * Configuration as code tests for Actions
 *
 */
import { Meteor } from 'meteor/meteor';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import * as sinon from 'sinon';
import { cloneDeep } from 'lodash';
// ORO modules
import { resetDatabase } from '../setup';
import ConfigAPI from '../../configAPI/configAPI';
// import UIPreferencesManager from '../../uiPreferences';
import InOrbitMqtt from '../../mqtt';
import MqttMock from '../../test/mocks/mqtt';
import Nav2DMock from '../../test/mocks/nav2d';
import { createUser, createRobot,  } from '../configAPI';
import OroRoles from '../../roles';
import { ROLE_ADMIN, ROLE_VIEWER } from '../../../shared/roles';
import { KIND_ACTION_DEFINITION, LIST_FORMAT_FULL } from '../../../shared/configAPI';
import { ACTION_TYPES, ActionDefinitions } from '../../../lib/actions';
import ActionsEngine from '../../actions';
import { createDummyArgName } from '../../../shared/actions';

// Just make sure this is not getting loaded in dev/prod
if (!Meteor.isTest) {
  throw new Error('This is TEST code only');
}
const { expect } = chai;
chai.use(chaiAsPromised);

/**
 * Creates an action using the Action Engine createActionDefinition
 */
export const createAction = async ({
  actionId = null,
  actionDefinition,
  actionType = ACTION_TYPES.RUN_SCRIPT
}) => {
  const actionsConfig = new ActionsEngine();
  return actionsConfig.createActionDefinition({
    actionId,
    definition: { type: actionType, ...actionDefinition }
  });
};

/**
 * Removes the definition of an action
 * NOTE(franguerini): It queries and writes the mongo db because the config manager
 * does not support to remove a definition to suppress an action. This way it bypasses
 * the ConfigManager so the change is done directly on the db
 */
export const removeActionDefinition = async ({ entityId, entityType, actionId }) => (
  ActionDefinitions.updateAsync(
    { entityId, entityType },
    { $set: { [actionId]: null } }
  )
);

// since ActionsEngine cannot be initialized multiple times, keep a single MQTT instance too
const theMqttSingleton = new MqttMock();
const theNav2DModule = new Nav2DMock();

const defaultActionDefinition = () => (
  [
    {
      kind: KIND_ACTION_DEFINITION,
      id: 'RestartAgent-000000',
      label: 'Restart Agent',
      suppressed: false,
      scope: ''
    },
    {
      kind: KIND_ACTION_DEFINITION,
      id: 'Relocalize-000000',
      label: 'Relocalize',
      suppressed: false,
      scope: ''
    },
    {
      kind: KIND_ACTION_DEFINITION,
      id: 'NavigateTo-000000',
      label: 'Waypoint Teleop',
      suppressed: false,
      scope: ''
    },
    {
      kind: KIND_ACTION_DEFINITION,
      id: 'CancelNavGoal-000000',
      label: 'Cancel Navigation Goal',
      suppressed: false,
      scope: ''
    },
    {
      kind: KIND_ACTION_DEFINITION,
      id: 'CameraToggle-000000',
      label: 'Camera Toggles',
      suppressed: false,
      scope: ''
    },
    {
      kind: KIND_ACTION_DEFINITION,
      id: 'UpdateAgent-000000',
      label: 'Update Agent',
      suppressed: false,
      scope: ''
    }
  ]
);

describe('configAPI:ActionDefinition', function () {
  this.timeout(5000);
  // Variables used in various tests
  let sinonSandbox;

  beforeEach(async () => {
    await resetDatabase();
    sinonSandbox = sinon.createSandbox();
    sinonSandbox.stub(new InOrbitMqtt(), 'setModuleState'); // to prevent attempts to publish
    const actionsEngine = new ActionsEngine();
    await actionsEngine.init({
      mqtt: theMqttSingleton,
      nav2d: theNav2DModule
    });
    await new OroRoles().createDefaultRoles();
    await new ConfigAPI().init();
  });

  afterEach(() => {
    sinonSandbox.restore();
  });

  it('lists actions definitions using list short format', async () => {
    const actionCreated = await createAction({
      actionDefinition: {
        type: 'RunScript',
        label: 'test action',
        elementList: ['filename'],
        elementValues: { filename: { value: 'restart.sh' } }
      }
    });
    const user = await createUser({ role: ROLE_ADMIN });
    const configApi = new ConfigAPI();
    configApi.init();
    // List actions
    const result = await configApi.list({
      user,
      kind: KIND_ACTION_DEFINITION
    });
    expect(result).to.have.deep.members([
      ...defaultActionDefinition(),
      {
        kind: KIND_ACTION_DEFINITION,
        id: actionCreated.id,
        label: 'test action',
        suppressed: false,
        scope: ''
      }]);
  });

  it('lists actions using full format (few fields, using defaults)', async () => {
    const actionCreated = await createAction({
      actionDefinition: {
        label: 'test action',
        type: 'RunScript',
        elementList: ['filename'],
        elementValues: { filename: { value: 'restart.sh' } }
      }
    });
    expect(actionCreated.success).to.be.true;
    const user = await createUser({ role: ROLE_ADMIN });
    
    // List actions
    const result = await new ConfigAPI().list({
      user,
      kind: KIND_ACTION_DEFINITION,
      format: LIST_FORMAT_FULL
    });
    console.log(result);
    expect(result).to.contain.deep.members([
      {
        apiVersion: 'v0.1',
        kind: KIND_ACTION_DEFINITION,
        metadata: {
          id: actionCreated.id,
          scope: '',
        },
        spec: {
          label: 'test action',
          type: ACTION_TYPES.RUN_SCRIPT,
          arguments: [{
            name: 'filename',
            type: 'string',
            value: 'restart.sh'
          }],
          confirmation: {
            required: false
          },
          lock: true,
          description: ''
        }
      }]);
  });

  it('lists actions using full format (all action fields)', async () => {
    const actionCreated = await createAction({
      actionDefinition: {
        label: 'test action',
        type: 'RunScript',
        confirmation: { required: true },
        elementList: ['filename', '--dock-id', '--current-route', '--speed'],
        elementValues: {
          filename: {
            value: 'dock.sh'
          },
          '--dock-id': {
            value: '0011',
            type: 'string'
          },
          '--current-route': {
            attributeId: 'attr1234',
            type: 'string'
          },
          '--speed': {
            type: 'number',
            input: {
              control: 'select',
              values: [{ name: 'fast', value: 100 }, { name: 'slow', value: 20 }]
            }
          }
        },
        conditions: [{ not: { collections: ['lab'] } }],
        widgets: ['navigation']
      }
    });
    expect(actionCreated.success).to.be.true;
    const user = await createUser({ role: ROLE_ADMIN });
    
    // List actions
    const result = await new ConfigAPI().list({
      user,
      kind: KIND_ACTION_DEFINITION,
      format: LIST_FORMAT_FULL
    });
    expect(result).to.contain.deep.members([
      {
        apiVersion: 'v0.1',
        kind: KIND_ACTION_DEFINITION,
        metadata: {
          id: actionCreated.id,
          scope: ''
        },
        spec: {
          label: 'test action',
          type: ACTION_TYPES.RUN_SCRIPT,
          arguments: [{
            name: 'filename',
            type: 'string',
            value: 'dock.sh'
          }, {
            name: '--dock-id',
            type: 'string',
            value: '0011'
          }, {
            name: '--current-route',
            type: 'string',
            dataSourceId: 'attr1234'
          }, {
            name: '--speed',
            type: 'number',
            input: {
              control: 'select',
              values: [{ name: 'fast', value: 100 }, { name: 'slow', value: 20 }]
            }
          }],
          confirmation: {
            required: true
          },
          condition: {
            rules: [{ not: { collections: ['lab'] } }]
          },
          widgets: ['navigation'],
          lock: true,
          description: ''
        }
      }
    ]);
  });

  it('validates permissions for applying definitions', async () => {
    const configObject = {
      kind: KIND_ACTION_DEFINITION,
      metadata: {
        id: 'myAction',
      },
      spec: {
        type: 'RunScript',
        label: 'My script',
        arguments: [{
          name: 'filename',
          type: 'string',
          value: 'script.sh'
        }]
      },
      apiVersion: 'v0.1'
    };
    const user = await createUser({ role: ROLE_VIEWER });
    
    await expect(
      new ConfigAPI().apply({ configObject, user })
    ).to.be.rejectedWith('Unauthorized');
  });

  it('suppresses configs by applying null specs', async () => {
    const configObject = {
      kind: KIND_ACTION_DEFINITION,
      metadata: {
        id: 'myAction',
      },
      spec: {
        type: 'RunScript',
        label: 'My script',
        arguments: [{
          name: 'filename',
          type: 'string',
          value: 'script.sh'
        }]
      },
      apiVersion: 'v0.1'
    };
    const user = await createUser({ role: ROLE_ADMIN });
    await new ConfigAPI().apply({ configObject: configObject, user });
    const action = await new ActionsEngine().getActionDefinition('myAction');
    const expected = {
      _id: 'myAction',
      description: '',
      elementList: [
        'filename'
      ],
      elementValues: {
        filename: {
          type: 'string',
          value: 'script.sh'
        }
      },
      label: 'My script',
      lock: false,
      type: 'RunScript'
    };
    expect(action).to.deep.include(expected);
    // suppress it
    configObject.spec = null;
    await new ConfigAPI().apply({ configObject: configObject, user });
    // Check that the action is suppressed for robots with the Hooli tag
    const actionSuppressed = await new ActionsEngine().getActionDefinition('myAction');
    expect(actionSuppressed).to.be.undefined;
  });

  it.skip('correctly stores and retrieves the group an action belongs to', async () => {
    const configObject = {
      kind: KIND_ACTION_DEFINITION,
      metadata: {
        id: 'myAction',
      },
      spec: {
        type: 'RunScript',
        group: 'mygroup',
        label: 'My script',
        arguments: [{
          name: 'filename',
          type: 'string',
          value: 'script.sh'
        }]
      },
      apiVersion: 'v0.1'
    };
    const user = await createUser({ role: ROLE_ADMIN });
    
    await new ConfigAPI().apply({ configObject, user });
    const [action] = await new ConfigAPI().list({
      user,
      kind: KIND_ACTION_DEFINITION,
      id: 'myAction',
      format: LIST_FORMAT_FULL
    });
    expect(action.spec.group).equals('mygroup');
  });

  it.skip('correctly stores and retrieves the embedded widgets of an action', async () => {
    const configObject = {
      kind: KIND_ACTION_DEFINITION,
      metadata: {
        id: 'myAction',
      },
      spec: {
        type: 'RunScript',
        label: 'My script',
        widgets: ['navigation'],
        arguments: [{
          name: 'filename',
          type: 'string',
          value: 'script.sh'
        }]
      },
      apiVersion: 'v0.1'
    };
    const user = await createUser({ role: ROLE_ADMIN });
    
    await new ConfigAPI().apply({ configObject, user });
    const [action] = await new ConfigAPI().list({
      user,
      kind: KIND_ACTION_DEFINITION,
      id: 'myAction',
      format: LIST_FORMAT_FULL
    });
    expect(action.spec.widgets).to.deep.equal(['navigation']);
  });

  it.skip('Uses the latest group defined for an action', async () => {
    const configObject = {
      kind: KIND_ACTION_DEFINITION,
      metadata: {
        id: 'myAction',
      },
      spec: {
        type: 'RunScript',
        label: 'My script',
        arguments: [{
          name: 'filename',
          type: 'string',
          value: 'script.sh'
        }]
      },
      apiVersion: 'v0.1'
    };
    const configObjectTag = {
      kind: KIND_ACTION_DEFINITION,
      metadata: {
        id: 'myAction',
      },
      spec: {
        type: 'RunScript',
        group: 'mygroup',
        label: 'My script',
        arguments: [{
          name: 'filename',
          type: 'string',
          value: 'script.sh'
        }]
      },
      apiVersion: 'v0.1'
    };
    const configObjectTagSuppress = {
      kind: KIND_ACTION_DEFINITION,
      metadata: {
        id: 'myAction',
      },
      spec: null,
      apiVersion: 'v0.1'
    };
    const user = await createUser({ role: ROLE_ADMIN });
    
    await new ConfigAPI().apply({ configObject: configObject, user });
    const [action] = await new ConfigAPI().list({
      user,
      kind: KIND_ACTION_DEFINITION,
      id: 'myAction',
      format: LIST_FORMAT_FULL
    });
    expect(action.spec.group).equals('mygroup');
  });

  it('validates missing arguments', async () => {
    // this action definition is correct, but tests below will alter it
    const action = {
      kind: KIND_ACTION_DEFINITION,
      metadata: {
        id: 'myAction',
      },
      spec: {
        type: 'RunScript',
        label: 'My script',
        arguments: [{
          name: 'filename',
          type: 'string',
          value: 'script.sh'
        }]
      },
      apiVersion: 'v0.1'
    };
    const user = await createUser({ role: ROLE_ADMIN });
    
    // Attempt to write an action with a type not from ACTION_TYPES known types
    const configObject = cloneDeep(action);
    configObject.spec.type = 'NotAValidActionType';
    await expect(
      new ConfigAPI().apply({ configObject, user })
    ).to.be.rejectedWith('Invalid action');
    // Try a RunScript without the mandatory 'filename' argument
    const configObject2 = cloneDeep(action);
    configObject2.spec.arguments = [{ // filename is a required argument, it will fail
      name: 'not-filename',
      type: 'string',
      value: 'foo'
    }];
    await expect(
      new ConfigAPI().apply({ configObject: configObject2, user })
    ).to.be.rejectedWith('Missing action argument: filename');
    // Try a PublishToTopic without the mandatory 'message' argument
    const configObject3 = cloneDeep(action);
    configObject3.spec.type = 'PublishToTopic';
    configObject3.spec.arguments = [];
    await expect(
      new ConfigAPI().apply({ configObject: configObject3, user })
    ).to.be.rejectedWith('Missing action argument: message');
  });

  it('validates protected action types', async () => {
    const user = await createUser({ role: ROLE_ADMIN });
    
    // this action definition is correct, but tests below will alter it
    const apiCallStub = {
      kind: KIND_ACTION_DEFINITION,
      metadata: {
        id: 'myAction',
      },
      apiVersion: 'v0.1'
    };
    // Attempt to redefine an action marked as 'final'
    await expect(
      new ConfigAPI().apply({
        user,
        configObject: {
          ...apiCallStub,
          spec: {
            type: ACTION_TYPES.CANCEL_NAV_GOAL
          }
        }
      })
    ).to.be.rejectedWith('Cannot re-define this action');
    // Attempt to redefine an action marked as 'internal'
    await expect(
      new ConfigAPI().apply({
        user,
        configObject: {
          ...apiCallStub,
          spec: {
            type: ACTION_TYPES.RELOCALIZE
          }
        }
      })
    ).to.be.rejectedWith('Cannot re-define this action');
  });

  it('Create and clear an action', async () => {
    const unnamedArgId = createDummyArgName();
    const actionId = 'myAction';
    const configObject = {
      kind: KIND_ACTION_DEFINITION,
      metadata: {
        id: actionId
      },
      spec: {
        type: 'RunScript',
        label: 'My script',
        arguments: [{
          name: 'filename',
          type: 'string',
          value: 'script.sh'
        }, {
          name: '--speed',
          value: 200, // default, overriden below
          type: 'number'
        }, {
          name: unnamedArgId,
          type: 'string',
          input: {
            control: 'text',
            label: 'mission'
          }
        }]
      },
      apiVersion: 'v0.1'
    };
    const user = await createUser({ role: ROLE_ADMIN });
    const configApi = new ConfigAPI();
    configApi.init();
    await configApi.apply({ configObject, user });
    delete configObject.spec;
    await configApi.clear({ configObject, user });

    const actionDef = await new ActionsEngine().getActionDefinition(actionId);
    expect(actionDef).to.be.undefined;
  });
});

describe('configAPI:ActionDefinition execution', () => {
  // Variables used in various tests
  let mqtt;

  beforeEach(async () => {
    await resetDatabase();
    await new OroRoles().createDefaultRoles();
    mqtt = new MqttMock();
    const engine = new ActionsEngine();
    // HACK! Since we reset database every time, we need to re-add defaults to the DB, and provide
    // the mocks this test suite uses. Note that init() ignores the call if this._initialized is
    // already set. This hack is necessary as actions.test.js uses different mocks.
    engine._initialized = false;
    await engine.init({ mqtt });
    new ConfigAPI().init();
  });

  it('Create and execute an action', async () => {
    const unnamedArgId = createDummyArgName();
    const configObject = {
      kind: KIND_ACTION_DEFINITION,
      metadata: {
        id: 'myAction'
      },
      spec: {
        type: 'RunScript',
        label: 'My script',
        arguments: [{
          name: 'filename',
          type: 'string',
          value: 'script.sh'
        }, {
          name: '--speed',
          value: 200, // default, overriden below
          type: 'number'
        }, {
          name: unnamedArgId,
          type: 'string',
          input: {
            control: 'text',
            label: 'mission'
          }
        }]
      },
      apiVersion: 'v0.1'
    };
    const user = await createUser({ role: ROLE_ADMIN });
    await new ConfigAPI().apply({ configObject, user });
    const robotId = await createRobot();
    const result = await new ActionsEngine().runAction({
      actionId: 'myAction',
      context: { robotId },
      args: { [unnamedArgId]: 'dock56' }
    });
    console.log(result);
    expect(result.ok).is.true;
    expect(mqtt.getLastCustomScript(robotId)).eq('script.sh --speed 200 dock56');
  });
});
