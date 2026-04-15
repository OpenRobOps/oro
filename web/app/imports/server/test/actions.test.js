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
 * Unit tests for server/actions.js
 */
import { Meteor } from 'meteor/meteor';
import { assert, expect } from 'chai';
import * as sinon from 'sinon';
// ORO modules
import { resetDatabase } from './setup';
import {
  ACTION_TYPES, ARGNAME_SCRIPT_FILENAME,
  createDummyArgName, createInternalActionId, formatScriptAction
} from '../../shared/actions';
import { Robots, RobotCustomScript, RobotLocalization } from '../../lib/collections';
import { AttrValues } from '../../lib/attributes';
import ActionsEngine from '../actions';
// import EventLog from '../eventLogger';
import LockManager from '../lock';
import { LOCK_TYPES } from '../../lib/lock';
import { createUser } from './common';
import OroRoles from '../roles';
import { ROLE_OPERATOR } from '../../shared/roles';
import MqttMock from './mocks/mqtt';
import Nav2DMock from './mocks/nav2d';
import AttributesManager from '../attributes';
import { ActionDefinitions } from '../../lib/actions';
// import AnnotationsManager from '../annotations';
// import { SPATIAL_ANNOTATION_TYPES } from '../../shared/annotations';
// import SpatialTransformationsManager from '../spatialTransformationsManager';

// Just make sure this is not getting loaded in dev/prod
if (!Meteor.isTest) {
  throw new Error('This is TEST code only');
}

// TODO(herchu) Add tests for the following
// - executing multiple actions (note: not fully supported)
// - storing and executing actions
//     let { actions, errors } = mgr.prepareAndStoreActions({
//       entityId: "BdDPjysoE3Cq9iYbf", entityType: "company",
//       actionIds: ["RestartAgent-000000", "PublishToTopic-000000"],
//       context: { robotId: "herchu-venv-002"}, args: { message: "hello" }, sourceId: "123456" });
//     mgr.runStoredAction(actions[0].actionId, actions[0].nonce);

// Some test constants, used in all tests
const ROBOT_ID = 'r0';
const ACTION_LABEL = 'a label';
const ARG_MESSAGE = 'message'; // matches the `message` field for PublishToTopic actions
const ARG_NAME = 'name12345'; // an action argument
const ARG_FILENAME = 'start_mission.sh';
const ARGNAME_MISSION = '--mission';
const ARGNAME_SPEED = '--speed';
const MY_NAME = 'OpenRobOps'; // for a proper Hello World test: "Hello, OpenRobOps!"
const ATTR1 = 'attr-id-1';
const ATTR2 = 'attr-id-2';
const DUMMY_ARG = createDummyArgName(); // internal argument key; used for empty args (hidden in UI)

// Helper function to create a PublishToTopic action
const createPublishAction = async (engine) => (
   engine.createActionDefinition({
    definition: {
      type: ACTION_TYPES.PUBLISH_TO_TOPIC,
      label: ACTION_LABEL,
      elementList: [ARG_MESSAGE], // overrides PUBLISH_TO_TOPIC template; removes 'ram'
      elementValues: {
        [ARG_MESSAGE]: { value: 'Hello, World.' }
      }
    }
  })
);

// Helper function to create a PublishToTopic action with user arguments. This is a variation
// of createPublishAction with an extra argument used in the template
const createPublishActionWithArgs = async (engine) => (
  engine.createActionDefinition({
    definition: {
      type: ACTION_TYPES.PUBLISH_TO_TOPIC,
      label: ACTION_LABEL,
      elementList: [ARG_MESSAGE, ARG_NAME],
      elementValues: {
        [ARG_MESSAGE]: { value: 'Hello, {{' + ARG_NAME + '}}!' },
        [ARG_NAME]: {
          input: {}
        }
      }
    }
  })
);

const createScriptAction = async (engine) => (
  engine.createActionDefinition({
    definition: {
      type: ACTION_TYPES.RUN_SCRIPT,
      label: ACTION_LABEL,
      elementList: [ARGNAME_SCRIPT_FILENAME],
      elementValues: {
        [ARGNAME_SCRIPT_FILENAME]: { value: ARG_FILENAME }
      }
    }
  })
);

// This action contains a dummy-named argument, which should be invisible to users (it acts
// like an "empty" argument name, only containing a value).
const createScriptActionWithDummyArgs = async (engine) => (
  engine.createActionDefinition({
    definition: {
      type: ACTION_TYPES.RUN_SCRIPT,
      label: ACTION_LABEL,
      elementList: [ARGNAME_SCRIPT_FILENAME, DUMMY_ARG],
      elementValues: {
        [ARGNAME_SCRIPT_FILENAME]: { value: ARG_FILENAME },
        [DUMMY_ARG]: { value: '--restart-node' }
      }
    }
  })
);

// Creates an action (a RunScript, though it is less relevant) to test receiving
// and validating user-provided arguments
const createScriptActionWithUserArgs = async (engine) => (
  engine.createActionDefinition({
    definition: {
      type: ACTION_TYPES.RUN_SCRIPT,
      label: ACTION_LABEL,
      // ARGNAME_SCRIPT_FILENAME in elementList should be inherited from its template
      elementList: [
        ARGNAME_SCRIPT_FILENAME,
        ARGNAME_MISSION,
        ARGNAME_SPEED
      ],
      elementValues: {
        [ARGNAME_SCRIPT_FILENAME]: { value: ARG_FILENAME },
        [ARGNAME_MISSION]: {
          value: 'sweep',
          required: true,
          type: 'string',
          input: {
            control: 'text',
            values: [
              { value: 'wash', label: 'Wash' },
              { value: 'sweep', label: 'Sweep' },
              { value: 'dry', label: 'Dry' }
            ],
            label: 'Mission to run'
          }
        },
        [ARGNAME_SPEED]: {
          required: true,
          type: 'number',
          input: {
            control: 'text',
            label: 'Speed: Distance over time',
            min: 1,
            max: 10
          }
        }
      }
    }
  })
);

// Creates an action (a RunScript, though it is less relevant) to test running injecting some
// data sources as argument values
const createScriptActionWithAttributes = async (engine) => (
  engine.createActionDefinition({
    definition: {
      type: ACTION_TYPES.RUN_SCRIPT,
      label: ACTION_LABEL,
      // ARGNAME_SCRIPT_FILENAME in elementList should be inherited from its template
      elementList: [
        ARGNAME_SCRIPT_FILENAME,
        ARGNAME_MISSION,
        ARGNAME_SPEED
      ],
      elementValues: {
        [ARGNAME_SCRIPT_FILENAME]: { value: ARG_FILENAME },
        [ARGNAME_MISSION]: {
          value: 'WILL NOT BE USED', // the attribute in the robot takes precedende
          required: true,
          type: 'string',
          attributeId: ATTR1,
          input: {
            control: 'text',
          }
        },
        [ARGNAME_SPEED]: {
          required: true,
          type: 'number',
          value: -999, // will not be used
          attributeId: ATTR2,
          input: {
            control: 'text',
            label: 'Speed: Distance over time',
            min: 1,
            max: 10
          }
        }
      }
    }
  })
);

// Creates an action (a RunScript, though it is less relevant) with required argument
// to test receiving and validating user-provided arguments
const createScriptActionWithRequiredText = async (engine) => (
  engine.createActionDefinition({
    definition: {
      type: ACTION_TYPES.RUN_SCRIPT,
      label: ACTION_LABEL,
      elementList: [
        ARGNAME_SCRIPT_FILENAME,
        ARGNAME_MISSION
      ],
      elementValues: {
        [ARGNAME_SCRIPT_FILENAME]: { value: 'xyz' },
        [ARGNAME_MISSION]: {
          required: true,
          type: 'string',
          input: {
            control: 'text'
          }
        }
      }
    }
  })
);

// Helper function to create a test robot in the DB
const createRobot = async (online = true) => (
  Robots.insertAsync({
    _id: ROBOT_ID,
    name: 'Rosie',
    version: '0.1',
    status: { agentOnline: online },
    updateStamp: Date.now()
  })
);

// Helper function to insert some attributes' values in the DB
const createAttributes = async (robotId, values) => {
  await AttrValues.upsertAsync({
      _id: robotId
    }, 
    Object.keys(values).reduce((acc, key) => {
      acc[key] = {
        value: values[key],
        ts: Date.now()
      };
      return acc;
    }, {})
  );
};

const runAction = async (engine, id, args, robotId = ROBOT_ID) => (
  engine.runAction({
    actionId: id,
    context: { robotId },
    args
  })
);

// since ActionsEngine cannot be initialized multiple times, keep a single MQTT instance too
const theMqttSingleton = new MqttMock();
const theNav2DModule = new Nav2DMock();

const sinonSandbox = sinon.createSandbox();


describe('ActionsManager: system actions', async () => {
  let engine;
  let mqtt;
  let nav2d;

  beforeEach(async () => {
    await resetDatabase();
    // Create the ActionsEngine with a stub MQTT connector
    engine = new ActionsEngine();
    await new AttributesManager().init();
    // HACK! Since we reset database every time, we need to re-add defaults to the DB, and provide
    // the mocks this test suite uses. Note that init() ignores the call if this._initialized is
    // already set. This hack is necessary as configAPIActionDefinitions.test.js uses different mocks.
    engine._initialized = false;
    mqtt = theMqttSingleton;
    nav2d = theNav2DModule;
    await engine.init({ mqtt, nav2d });
    mqtt.reset(); // reset all counts
    nav2d.reset(); // reset all counts
  });

  afterEach(async () => {
    sinonSandbox.restore();
  });

  it('runs Restart Agent', async () => {
    const id = createInternalActionId(ACTION_TYPES.RESTART_AGENT);
    assert.isString(id);
    await createRobot(true);
    const result = await runAction(engine, id);
    assert.isObject(result, 'Running an action must return objects');
    assert.isTrue(result.ok, 'Action execution must return success value');
    assert.equal(result.robotId, ROBOT_ID, 'Action result robotId must match');
    // Validate the command was sent through the (mock) mqtt channel
    assert.equal(mqtt.getMessagesCount(ROBOT_ID), 1, 'Exactly 1 command must be sent');
    assert.isTrue(mqtt.hasAgentRestarted(ROBOT_ID), 'RestartAgent must have been sent');
  });

  it('runs Update Agent', async () => {
    const id = createInternalActionId(ACTION_TYPES.UPDATE_AGENT);
    assert.isString(id);
    await createRobot(true);
    const result = await runAction(engine, id);
    assert.isTrue(result.ok, 'Action execution must return success value');
    // Validate the command was sent through the (mock) mqtt channel
    assert.equal(mqtt.getMessagesCount(ROBOT_ID), 1, 'Exactly 1 command must be sent');
    assert.isTrue(mqtt.hasAgentUpdated(ROBOT_ID), 'UpdateAgent must have been sent');
  });
});

describe('ActionsManager: user created actions', () => {
  let engine;
  let mqtt;
  let nav2d;

  beforeEach(async () => {
    await resetDatabase();
    // Create the ActionsEngine with a stub MQTT connector
    engine = new ActionsEngine();
    await new AttributesManager().init();
    // HACK! Since we reset database every time, we need to re-add defaults to the DB, and provide
    // the mocks this test suite uses. Note that init() ignores the call if this._initialized is
    // already set. This hack is necessary as configAPIActionDefinitions.test.js uses different mocks.
    engine._initialized = false;
    mqtt = theMqttSingleton;
    nav2d = theNav2DModule;
    await engine.init({ mqtt, nav2d });
    mqtt.reset(); // reset all counts
    nav2d.reset(); // reset all counts
  });

  afterEach(async () => {
    sinonSandbox.restore();
  });

  // Test that an action can be created and it returns its own type and id
  it('creates actions', async () => {
    const res = await createPublishAction(engine);
    assert.equal(res.success, true);
    assert.equal(res.label, ACTION_LABEL);
    assert.isString(res.id);
  });

  // Test that an action can be "prepared" for execution
  it('prepares an action for execution', async () => {
    await createRobot(true);
    const { id } = await createPublishAction(engine);
    assert.isString(id);
    const prepared = await engine.prepareActions({
      actionIds: [id],
      context: { robotId: ROBOT_ID }
    });
    assert.isNull(prepared.errors, 'There must be no errors preparing action');
    assert.isArray(prepared.actions, 'actions field must be a list');
    assert.equal(prepared.actions.length, 1, 'actions must contain exactly 1 element');
    const action = prepared.actions[0];
    assert.equal(action.actionId, id, 'Returned action id must match');
    // Finally test the message that would be published, including our argument value
    assert.equal(action.elementValues[ARG_MESSAGE], 'Hello, World.');
  });

  // Test that multiple actions can be "prepared" for execution
  it('prepares multiple actions for execution', async () => {
    await createRobot(true);
    const { id: id1 } = await createPublishAction(engine);
    assert.isString(id1);
    const { id: id2 } = await createScriptAction(engine);
    assert.isString(id2);
    const prepared = await engine.prepareActions({
      actionIds: [id1, id2],
      context: { robotId: ROBOT_ID }
    });
    assert.isNull(prepared.errors, 'There must be no errors preparing action');
    assert.isArray(prepared.actions, 'actions field must be a list');
    assert.equal(prepared.actions.length, 2, 'actions must contain exactly 2 elements');
    const action1 = prepared.actions[0];
    const action2 = prepared.actions[1];
    assert.equal(action1.actionId, id1, 'Returned action id must match');
    assert.equal(action2.actionId, id2, 'Returned action id must match');
  });

  // Test that an action can be "prepared" for execution
  it('prepares actions with args for execution', async () => {
    await createRobot(true);
    const { id } = await createPublishActionWithArgs(engine);
    assert.isString(id);
    const prepared = await engine.prepareActions({
      actionIds: [id],
      context: { robotId: ROBOT_ID },
      args: { [ARG_NAME]: MY_NAME }
    });
    assert.isNull(prepared.errors, 'There must be no errors preparing action');
    assert.isArray(prepared.actions, 'actions field must be a list');
    assert.equal(prepared.actions.length, 1, 'actions must contain exactly 1 element');
    const action = prepared.actions[0];
    assert.equal(action.actionId, id, 'Returned action id must match');
    // Finally test the message that would be published, including our argument value
    assert.equal(action.elementValues[ARG_MESSAGE], 'Hello, OpenRobOps!');
  });

  // Tests running an action. This includes (under the hood) preparing an action,
  // which is tested in the previous it()
  it('runs a publish actions without actual arguments', async () => {
    const { id } = await createPublishAction(engine);
    await createRobot(true);
    const result = await runAction(engine, id);
    assert.isObject(result, 'Running an action must return objects');
    assert.isTrue(result.ok, 'Action execution must return success value');
    assert.equal(result.robotId, ROBOT_ID, 'Action result robotId must match');
    // Validate the command was sent through the (mock) mqtt channel
    assert.equal(
      mqtt.getMessagesCount(ROBOT_ID),
      1,
      'Exactly 1 PublishToTopic command must be sent'
    );
    assert.equal(
      mqtt.getLastPublishedCommand(ROBOT_ID),
      'Hello, World.',
      'PublishToTopic command must have been sent through MQTT'
    );
  });

  // Tests running an action. This includes (under the hood) preparing an action,
  // which is tested in the previous it()
  it('runs a script actions', async () => {
    const { id } = await createScriptAction(engine);
    await createRobot(true);
    const result = await runAction(engine, id);
    assert.isObject(result, 'Running an action must return objects');
    assert.isTrue(result.ok, 'Action execution must return success value');
    assert.equal(result.robotId, ROBOT_ID, 'Action result robotId must match');
    // Validate the command was sent through the (mock) mqtt channel
    assert.equal(
      mqtt.getMessagesCount(ROBOT_ID),
      1,
      'Exactly 1 RunScript command must be sent'
    );
    assert.equal(
      mqtt.getLastCustomScript(ROBOT_ID),
      ARG_FILENAME,
      'RunScript must have been sent through MQTT'
    );
  });

  it('formats a script actions help message (no arguments)', async () => {
    const { id } = await createScriptAction(engine);
    const action = await engine.getActionDefinition(id);
    assert.equal(
      formatScriptAction(action),
      // FIXME: This path refers to InOrbit agent, should be configurable
      'runs: ~/.inorbit/local/user_scripts/start_mission.sh'
    );
  });

  it('formats a script actions help message (user arguments)', async () => {
    const { id } = await createScriptActionWithUserArgs(engine);
    const action = await engine.getActionDefinition(id);
    assert.equal(
      formatScriptAction(action),
      // FIXME: This path refers to InOrbit agent, should be configurable
      'runs: ~/.inorbit/local/user_scripts/start_mission.sh --mission sweep --speed <value>'
    );
  });

  it('runs a script actions with empty arguments', async () => {
    const { id } = await createScriptActionWithDummyArgs(engine);
    await createRobot(true);
    const result = await runAction(engine, id);
    assert.isObject(result, 'Running an action must return objects');
    assert.isTrue(result.ok, 'Action execution must return success value');
    assert.equal(result.robotId, ROBOT_ID, 'Action result robotId must match');
    // Validate the command was sent through the (mock) mqtt channel
    assert.equal(
      mqtt.getMessagesCount(ROBOT_ID),
      1,
      'Exactly 1 RunScript command must be sent'
    );
    // This asserts that no 'arg-xyz...' (the dummy arg name) is sent, but only its value
    assert.equal(
      mqtt.getLastCustomScript(ROBOT_ID),
      ARG_FILENAME + ' --restart-node',
      'RunScript must have been sent through MQTT'
    );
  });

  it('formats a script actions help message (dummy arguments)', async () => {
    const { id } = await createScriptActionWithDummyArgs(engine);
    const action = await engine.getActionDefinition(id);
    assert.equal(
      formatScriptAction(action),
      // FIXME: This path refers to InOrbit agent
      'runs: ~/.inorbit/local/user_scripts/start_mission.sh --restart-node'
    );
  });
});

describe('ActionsManager: simple error conditions for actions', async () => {
  let engine;
  let mqtt;
  let nav2d;

  beforeEach(async () => {
    await resetDatabase();
    // Create the ActionsEngine with a stub MQTT connector
    engine = new ActionsEngine();
    await new AttributesManager().init();
    // HACK! Since we reset database every time, we need to re-add defaults to the DB, and provide
    // the mocks this test suite uses. Note that init() ignores the call if this._initialized is
    // already set. This hack is necessary as configAPIActionDefinitions.test.js uses different mocks.
    engine._initialized = false;
    mqtt = theMqttSingleton;
    nav2d = theNav2DModule;
    await engine.init({ mqtt, nav2d });
    mqtt.reset(); // reset all counts
    nav2d.reset(); // reset all counts
  });

  afterEach(async () => {
    sinonSandbox.restore();
  });

  // Tests running an action. This includes (under the hood) preparing an action,
  // which is tested in the previous it()
  it('does not run actions on offline robots', async () => {
    const { id } = await createPublishAction(engine);
    assert.isString(id);
    await createRobot(false); // false: offline
    const result = await runAction(engine, id);
    assert.equal(result.error, 'Robot is offline', 'Cannot execute actions on offline robots');
  });

  it('cannot run script with missing required arguments', async () => {
    const { id } = await createScriptActionWithUserArgs(engine);
    assert.isString(id);
    await createRobot(true);
    const result = await runAction(engine, id);
    assert.isObject(result, 'Running an action must return objects');
    assert.isObject(result.errors, 'Running this action should return an error');
    assert.equal(Object.keys(result.errors).length, 1, 'Only one argument is missing'); // the other one was optional
    assert.isTrue(ARGNAME_SPEED in result.errors, 'Speed was a required argument');
    assert.equal(result.ok, undefined, 'Action execution with error must NOT return success value');
    assert.equal(mqtt.getMessagesCount(ROBOT_ID), 0, 'No msgs must be sent');
  });

  it('cannot provide arguments to an action not expecting them', async () => {
    const { id } = await createPublishAction(engine);
    assert.isString(id);
    await createRobot(true);
    const BAD_ARG_NAME = 'foo';
    const result = await runAction(engine, id, { [BAD_ARG_NAME]: 'bar' });
    assert.isObject(result, 'Running an action must return objects');
    assert.isObject(result.errors, 'Running this action should return an error');
    assert.equal(Object.keys(result.errors).length, 1, 'Only one argument is missing'); // the other one was optional
    assert.isTrue(BAD_ARG_NAME in result.errors, 'Speed was a required argument');
    assert.equal(result.ok, undefined, 'Action execution with error must NOT return success value');
    assert.equal(mqtt.getMessagesCount(ROBOT_ID), 0, 'No msgs must be sent');
  });
});

describe('ActionsManager: evaluates user arguments for actions', async () => {
  let engine;
  let mqtt;
  let nav2d;

  beforeEach(async () => {
    await resetDatabase();
    // Create the ActionsEngine with a stub MQTT connector
    engine = new ActionsEngine();
    await new AttributesManager().init();
    // HACK! Since we reset database every time, we need to re-add defaults to the DB, and provide
    // the mocks this test suite uses. Note that init() ignores the call if this._initialized is
    // already set. This hack is necessary as configAPIActionDefinitions.test.js uses different mocks.
    engine._initialized = false;
    mqtt = theMqttSingleton;
    nav2d = theNav2DModule;
    await engine.init({ mqtt, nav2d });
    mqtt.reset(); // reset all counts
    nav2d.reset(); // reset all counts
  });

  afterEach(async () => {
    sinonSandbox.restore();
  });

  // Tests running an action. This includes (under the hood) preparing an action,
  // which is tested in the previous it()
  it('runs script with user arguments', async () => {
    const { id } = await createScriptActionWithUserArgs(engine);
    assert.isString(id);
    await createRobot(true);
    const result = await runAction(engine, id, {
      // [ARGNAME_MISSION]: not provided, should use the default
      [ARGNAME_SPEED]: 5
    });
    assert.isObject(result, 'Running an action must return objects');
    assert.isTrue(result.ok, 'Action execution must return success value');
    assert.equal(result.robotId, ROBOT_ID, 'Action result robotId must match');
    // Validate the command was sent through the (mock) mqtt channel
    assert.equal(
      mqtt.getMessagesCount(ROBOT_ID),
      1,
      'Exactly 1 RunScript command must be sent'
    );
    assert.equal(
      mqtt.getLastCustomScript(ROBOT_ID),
      'start_mission.sh --mission sweep --speed 5',
      'RunScript must have been sent through MQTT, with matching arguments'
    );
  });

  // Tests running an action with values coming from arguments
  it('runs script with user attribute-sourced arguments', async () => {
    const { id } = await createScriptActionWithAttributes(engine);
    assert.isString(id);
    await createRobot(true);
    await createAttributes(ROBOT_ID, {
      [ATTR1]: 'default-from-attribute',
      [ATTR2]: -666 // overriden by a user arg
    });
    const result = await runAction(engine, id, {
      // [ARGNAME_MISSION]: not provided: it should use ATTR1 from the robot
      [ARGNAME_SPEED]: 10 // will override the _default_ ATTR2
    });
    assert.isObject(result, 'Running an action must return objects');
    assert.isTrue(result.ok, 'Action execution must return success value');
    assert.equal(result.robotId, ROBOT_ID, 'Action result robotId must match');
    // Validate the command was sent through the (mock) mqtt channel
    assert.equal(
      mqtt.getMessagesCount(ROBOT_ID),
      1,
      'Exactly 1 RunScript command must be sent'
    );
    assert.equal(
      mqtt.getLastCustomScript(ROBOT_ID),
      'start_mission.sh --mission default-from-attribute --speed 10',
      'RunScript must have been sent through MQTT, with matching arguments'
    );
  });

  it.skip('runs waypoint navigation with unsafe arguments', async () => {
    const id = createInternalActionId(ACTION_TYPES.NAVIGATE_PATH);
    assert.isString(id);
    await createRobot(true);
    const args = {
      frame: 'world',
      tsHint: 1324,
      waypoints: [{
        theta: 1,
      }, {
        x: 2,
        y: 3,
        theta: 4
      }]
    };
    const result = await runAction(engine, id, args);
    assert.isObject(result, 'Running an action must return objects');
    assert.isTrue(result.ok, 'Result must be successful');
    assert.equal(result.error, undefined, 'There must be no errors');
    const { robotId, frame, tsHint, waypoints } = this.nav2d.getLastMessageSent();
    // Check that the message was actually sent through the mock mqtt, with correct args
    assert.equal(this.nav2d.getMessagesCount(), 1, 'Only 1 message gets sent');
    assert.equal(robotId, ROBOT_ID);
    assert.equal(tsHint, args.tsHint);
    assert.equal(frame, args.frame);
    assert.deepEqual(waypoints, args.waypoints);
  });

  // Tests running an action. This includes (under the hood) preparing an action,
  // which is tested in the previous it()
  it('validates correct argument type', async () => {
    const { id } = await createScriptActionWithUserArgs(engine);
    assert.isString(id);
    await createRobot(true);
    const result = await runAction(engine, id, { [ARGNAME_SPEED]: 'five' });
    assert.isObject(result.errors, 'Running this action should return an error');
    assert.equal(Object.keys(result.errors).length, 1, 'Only one argument is missing'); // the other one was optional
    assert.isTrue(ARGNAME_SPEED in result.errors, 'Speed had a type mismatch');
  });

  it('validates correct min range', async () => {
    const { id } = await createScriptActionWithUserArgs(engine);
    assert.isString(id);
    await createRobot(true);
    const result = await runAction(engine, id, { [ARGNAME_SPEED]: 100000 });
    assert.isObject(result.errors, 'Running this action should return an error');
    assert.equal(Object.keys(result.errors).length, 1, 'Only one argument is wrong');
    assert.isTrue(ARGNAME_SPEED in result.errors, 'Speed had a type mismatch');
  });

  it('validates correct max range', async () => {
    const { id } = await createScriptActionWithUserArgs(engine);
    assert.isString(id);
    await createRobot(true);
    const result = await runAction(engine, id, { [ARGNAME_SPEED]: 0 });
    assert.isObject(result.errors, 'Running this action should return an error');
    assert.equal(Object.keys(result.errors).length, 1, 'Only one argument is wrong');
    assert.isTrue(ARGNAME_SPEED in result.errors, 'Speed had a type mismatch');
  });

  it('validates correct enum values', async () => {
    const { id } = await createScriptActionWithUserArgs(engine);
    assert.isString(id);
    await createRobot(true);
    const result = await runAction(engine, id, {
      [ARGNAME_MISSION]: 'wash', // not default, but accepted
      [ARGNAME_SPEED]: 5 // correct
    });
    assert.isTrue(result.ok, 'Action execution must return success value');
  });

  it('validates incorrect enum values', async () => {
    const { id } = await createScriptActionWithUserArgs(engine);
    assert.isString(id);
    await createRobot(true);
    const result = await runAction(engine, id, {
      [ARGNAME_MISSION]: 'launch space ship', // not accepted
      [ARGNAME_SPEED]: 42 // in correct too - to check multiple errors are returned
    });
    assert.isObject(result.errors, 'Running this action should return an error');
    assert.equal(Object.keys(result.errors).length, 2, 'Both args are wrong');
    assert.isTrue(ARGNAME_MISSION in result.errors, 'Mission was not an accepted value');
    assert.isTrue(ARGNAME_SPEED in result.errors, 'Speed had a range error');
  });

  it('validates required argument exist executes correctly', async () => {
    const { id } = await createScriptActionWithRequiredText(engine);
    assert.isString(id);
    await createRobot(true);
    const result = await runAction(engine, id, {
      [ARGNAME_MISSION]: 'mission'
    });
    assert.isTrue(result.ok, 'Result must be successful');
  });

  it('validates required field can not be empty', async () => {
    const { id } = await createScriptActionWithRequiredText(engine);
    assert.isString(id);
    await createRobot(true);
    const result = await runAction(engine, id, {
      [ARGNAME_MISSION]: '' // not accepted
    });
    assert.isObject(result.errors, 'Running this action should return an error');
    assert.isTrue(ARGNAME_MISSION in result.errors, 'Mission was not an accepted value.');
  });

  it('validates required field must exist', async () => {
    const { id } = await createScriptActionWithRequiredText(engine);
    assert.isString(id);
    await createRobot(true);
    const result = await runAction(engine, id, {
      // Mission not send as argument
    });

    assert.isObject(result.errors, 'Running this action should return an error');
    assert.isTrue(ARGNAME_MISSION in result.errors, 'Mission was not an accepted value.');
  });
});

describe.skip('ActionsManager: navigation commands', () => {
  let engine;
  let mqtt;
  let nav2d;

  beforeEach(async () => {
    await resetDatabase();
    // Create the ActionsEngine with a stub MQTT connector
    engine = new ActionsEngine();
    await new AttributesManager().init();
    // HACK! Since we reset database every time, we need to re-add defaults to the DB, and provide
    // the mocks this test suite uses. Note that init() ignores the call if this._initialized is
    // already set. This hack is necessary as configAPIActionDefinitions.test.js uses different mocks.
    engine._initialized = false;
    mqtt = theMqttSingleton;
    nav2d = theNav2DModule;
    await engine.init({ mqtt, nav2d });
    mqtt.reset(); // reset all counts
    nav2d.reset(); // reset all counts
  });

  afterEach(async () => {
    sinonSandbox.restore();
  });

  it('executes waypoint teleop command when localization data has no frameId (agent<=4.12)', async () => {
    await createRobot(true); // true: online
    await RobotLocalization.insertAsync({
      _id: ROBOT_ID,
      robotPose: {
        x: -0.008361645974218845,
        y: 0.10003799945116043,
        theta: 0.14994296431541443
      }
    });
    const args = { pose: { x: 1, y: 2, theta: 3 } };
    const result = await runAction(engine, 'NavigateTo-000000', args);
    assert.isObject(result, 'Running an action must return objects');
    assert.isTrue(result.ok, 'Result must be successful');
    assert.equal(this.nav2d.getMessagesCount(), 1, 'One navGoal message must be sent');
    // Check that the message was actually sent through the nav2d mock, with correct args
    const { robotId, pose } = this.nav2d.getLastMessageSent();
    assert.equal(robotId, ROBOT_ID);
    assert.deepEqual(pose, args.pose);
  });

  it('executes a waypoint teleop command', async () => {
    await createRobot(true); // true: online
    await RobotLocalization.insertAsync({
      _id: ROBOT_ID,
      robotPose: {
        x: -0.008361645974218845,
        y: 0.10003799945116043,
        theta: 0.14994296431541443,
        frameId: 'map'
      }
    });
    const args = { pose: { x: 1, y: 2, theta: 3 } };
    const result = await runAction(engine, 'NavigateTo-000000', args);
    assert.isObject(result, 'Running an action must return objects');
    assert.isTrue(result.ok, 'Result must be successful');
    assert.equal(this.nav2d.getMessagesCount(), 1, 'One navGoal message must be sent');
    // Check that the message was actually sent through the nav2d mock, with correct args
    const { robotId, pose } = this.nav2d.getLastMessageSent();
    assert.equal(robotId, ROBOT_ID);
    assert.deepEqual(pose, args.pose);
  });

  it('transforms coordinates when executing a waypoint teleop command', async () => {
    await createRobot(true); // true: online
    await new SpatialTransformationsManager().setTransformation({
      entityId: ROBOT_ID,
      entityType: ID_TYPE_ROBOT,
      sourceFrameId: 'map',
      destFrameId: 'floor1',
      m: [
        [1, 0, 10],
        [0, 1, 15],
        [0, 0, 1]
      ]
    });
    await RobotLocalization.insertAsync({
      _id: ROBOT_ID,
      robotPose: {
        x: 1,
        y: 0,
        theta: 0,
        frameId: 'map'
      }
    });
    const args = { pose: { x: 0, y: 0, theta: 0, frameId: 'floor1' } };
    const result = await runAction(engine, 'NavigateTo-000000', args);
    assert.isObject(result, 'Running an action must return objects');
    assert.isTrue(result.ok, 'Result must be successful');
    assert.equal(this.nav2d.getMessagesCount(), 1, 'One navGoal message must be sent');
    // Check that the message was actually sent through the nav2d mock, with correct args
    const { robotId, pose } = this.nav2d.getLastMessageSent();
    assert.equal(robotId, ROBOT_ID);
    assert.deepEqual(pose, {
      x: -10,
      y: -15,
      theta: 0
    });
  });

  it.skip('executes a waypoint teleop command using a named waypoint', async () => {
    await createRobot(true); // true: online
    const namedWaypointPose = {
      x: 1,
      y: 0,
      theta: -3.140,
      frameId: 'map'
    };
    await new AnnotationsManager().setAnnotation({
      frameId: namedWaypointPose.frameId,
      annotationId: 'nw1',
      annotation: {
        type: SPATIAL_ANNOTATION_TYPES.WAYPOINT,
        x: namedWaypointPose.x,
        y: namedWaypointPose.y,
        theta: namedWaypointPose.theta,
        label: 'my named waypoint'
      }
    });
    await RobotLocalization.insertAsync({
      _id: ROBOT_ID,
      robotPose: {
        x: -0.008361645974218845,
        y: 0.10003799945116043,
        theta: 0.14994296431541443,
        frameId: 'map'
      }
    });
    const args = { namedWaypointId: 'nw1' };
    const result = await runAction(engine, 'NavigateTo-000000', args);
    assert.isObject(result, 'Running an action must return objects');
    assert.isTrue(result.ok, 'Result must be successful');
    assert.equal(this.nav2d.getMessagesCount(), 1, 'One navGoal message must be sent');
    // Check that the message was actually sent through the nav2d mock, with correct args
    const { robotId, pose } = this.nav2d.getLastMessageSent();
    assert.equal(robotId, ROBOT_ID);
    assert.deepEqual(pose, namedWaypointPose);
  });
});

describe('ActionsEngine.compileAction()', () => {
  let engine;
  let mqtt;
  let nav2d;

  beforeEach(async () => {
    await resetDatabase();
    // Create the ActionsEngine with a stub MQTT connector
    engine = new ActionsEngine();
    await new AttributesManager().init();
    // HACK! Since we reset database every time, we need to re-add defaults to the DB, and provide
    // the mocks this test suite uses. Note that init() ignores the call if this._initialized is
    // already set. This hack is necessary as configAPIActionDefinitions.test.js uses different mocks.
    engine._initialized = false;
    mqtt = theMqttSingleton;
    nav2d = theNav2DModule;
    await engine.init({ mqtt, nav2d });
    mqtt.reset(); // reset all counts
    nav2d.reset(); // reset all counts
  });

  afterEach(async () => {
    sinonSandbox.restore();
  });

  it('compiles PublishToTopic actions and the result contains the message', async () => {
    const { id: actionId } = await createPublishActionWithArgs(engine);
    await createRobot(false);
    const robotId = ROBOT_ID;
    const { ok, compiled } = await engine.compileAction({
      robotId,
      actionId,
      args: { [ARG_NAME]: MY_NAME }
    });
    expect(ok).to.be.true;
    expect(compiled).is.not.undefined;
    expect(compiled.type).eq(ACTION_TYPES.PUBLISH_TO_TOPIC);
    expect(compiled.message).eq(`Hello, ${MY_NAME}!`);
  });

  it('compiles RunScript actions and the result contains file name and arguments', async () => {
    const { id: actionId } = await createScriptActionWithAttributes(engine);
    await createRobot(false);
    const robotId = ROBOT_ID;
    await createAttributes(robotId, {
      [ATTR1]: 'default-from-attribute',
      [ATTR2]: -666 // overriden by a user arg
    });
    const { ok, compiled } = await engine.compileAction({
      robotId,
      actionId,
      args: { [ARGNAME_SPEED]: 10 }
    });
    expect(ok).to.be.true;
    expect(compiled).is.not.undefined;
    expect(compiled.type).eq(ACTION_TYPES.RUN_SCRIPT);
    expect(compiled.fileName).eq('start_mission.sh');
    expect(compiled.args).deep.eq(['--mission', 'default-from-attribute', '--speed', '10']);
  });

  it.skip('compiles NavigateTo actions and the result contains the waypoint coordinates', async () => {
    await createRobot(false);
    const robotId = ROBOT_ID;
    await RobotLocalization.insertAsync({
      _id: robotId,
      robotPose: {
        x: -0.008361645974218845,
        y: 0.10003799945116043,
        theta: 0.14994296431541443,
        frameId: 'map'
      }
    });
    const { ok, compiled } = await engine.compileAction({
      robotId,
      actionId: 'NavigateTo-000000',
      args: { pose: { x: 1, y: 2, theta: 3, frameId: 'other_floor' } }
    });
    expect(ok).to.be.true;
    expect(compiled).is.not.undefined;
    expect(compiled.type).eq(ACTION_TYPES.NAVIGATE_TO);
    expect(compiled.waypoint).deep.eq({
      x: 1,
      y: 2,
      theta: 3,
      frameId: 'other_floor'
    });
  });

  it.skip('compiles NavigateTo actions using named waypoint arguments', async () => {
    await createRobot(true); // true: online
    const namedWaypointPose = {
      x: 1,
      y: 0,
      theta: -3.140,
      frameId: 'map'
    };
    await new AnnotationsManager().setAnnotation({
      frameId: namedWaypointPose.frameId,
      annotationId: 'nw1',
      annotation: {
        type: SPATIAL_ANNOTATION_TYPES.WAYPOINT,
        x: namedWaypointPose.x,
        y: namedWaypointPose.y,
        theta: namedWaypointPose.theta,
        label: 'my named waypoint'
      }
    });
    await RobotLocalization.insertAsync({
      _id: ROBOT_ID,
      robotPose: {
        x: -0.008361645974218845,
        y: 0.10003799945116043,
        theta: 0.14994296431541443,
        frameId: 'map'
      }
    });
    const { ok, compiled } = await engine.compileAction({
      robotId: ROBOT_ID,
      actionId: 'NavigateTo-000000',
      args: { namedWaypointId: 'nw1' }
    });
    expect(ok).to.be.true;
    expect(compiled).is.not.undefined;
    expect(compiled.type).eq(ACTION_TYPES.NAVIGATE_TO);
    expect(compiled.waypoint).deep.eq(namedWaypointPose);
  });

  it('fails if required args are not provided', async () => {
    const { id: actionId } = await createScriptActionWithRequiredText(engine);
    await createRobot(false);
    const robotId = ROBOT_ID;
    const { ok, error } = await engine.compileAction({
      robotId,
      actionId,
      args: { }
    });
    expect(ok).to.be.false;
    expect(error).eq('Error during action compilation while preparing action. '
      + `robotId = ${robotId} errors = {"--mission":"The '--mission' field is required."}`);
  });

  it('fails if action does not exist', async () => {
    await createRobot(false);
    const robotId = ROBOT_ID;
    const { ok, error } = await engine.compileAction({
      robotId,
      actionId: 'some-action',
      args: { }
    });
    expect(ok).to.be.false;
    expect(error).eq('Error during action compilation while preparing action. '
      + `robotId = ${robotId} errors = "Action not found"`);
  });

  it('fails for unsupported action types', async () => {
    const actionId = createInternalActionId(ACTION_TYPES.UPDATE_AGENT);
    await createRobot(false);
    const robotId = ROBOT_ID;
    const { ok, error } = await engine.compileAction({
      robotId,
      actionId,
      args: { }
    });
    expect(ok).to.be.false;
    expect(error).eq(`Unsupported action type ${ACTION_TYPES.UPDATE_AGENT}`);
  });
});

