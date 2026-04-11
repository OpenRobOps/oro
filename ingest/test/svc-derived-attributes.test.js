/**
 * Unit and integration tests for svc-derived-attributes class.
 */
import { assert } from 'chai';
import mongoUnit from 'mongo-unit';
import * as sinon from 'sinon';
// InOrbit modules
import MongoManager from '../src/mongo';
import * as robotsTestData from './testData/robots.json';
import {
  COLLECTIONS,
  ID_TYPE_ROBOT,
  ID_INORBIT,
  ID_TYPE_SYSTEM_WIDE
} from '../src/shared/constants';
import { ParsedExpression } from '../src/services/derivedAttributes/expressions';
import RobotDerivedAttributesProcessor from '../src/services/derivedAttributes/processor';
import { FUNCTIONS_DICT, TYPE_NUMBER, Function } from '../src/services/derivedAttributes/functions';
import { VITAL_POSE } from '../src/shared/attributes';
import AttributesManager from '../src/server/attributes';
import RobotDerivedAttributesDataProvider from '../src/services/derivedAttributes/dataProvider';
import { createDummyRobotInDB } from './common';

describe('svc-derived-attributes', () => {
  let sinonSandbox;
  let mongoMgr;
  let attrDefsColl;
  let attributesMgr;
  let attributeValuesColl;

  beforeEach(async () => {
    sinonSandbox = sinon.createSandbox();
    mongoMgr = new MongoManager();
    attributesMgr = new AttributesManager();
    attrDefsColl = mongoMgr.getCollection(COLLECTIONS.ATTRIBUTE_DEFINITIONS);
    attributeValuesColl = mongoMgr.getCollection(COLLECTIONS.ATTRIBUTE_VALUES);
  });

  afterEach(async () => {
    sinonSandbox.restore();
  });

  /**
   * This tests nearly the entire path of a derived attribute since receiving a message from
   * the attribute updates queue.
   */
  it('calculates a derived attribute from a message update', async () => {
    // constants
    const sourceAttrId = 'sourceAttr0';
    const derivedAttrId = 'derivedAttr1';
    const robotId = await createDummyRobotInDB();
    const processor = new RobotDerivedAttributesProcessor({ robotId });
    // create attributes configuration
    await attrDefsColl.insertOne({
      attributeId: sourceAttrId,
      definition: {
        label: 'source attribute'
      }
    });
    await attrDefsColl.insertOne({
      attributeId: derivedAttrId,
      definition: {
        label: 'derived attribute'
      },
      mapping: {
        source: 'derived',
        // no 'language' given, it uses default evaluation (eval() for now)
        attributeIds: [sourceAttrId],
        transform: 'args[0] * 2'
      }
    });
    // send an attribute values update; mocking AMQP msgs using our "variants"
    const ts = Date.now();
    await processor.processUpdate({
      [sourceAttrId]: { ts, value: { doubleValue: 5 } }
    });

    const values = await attributesMgr.getRobotAttributeValues(robotId, [derivedAttrId]);
    // Note: We cannot still assert this, since the timestamp is not properly set in the service
    // (it's always "now", not depending on the attribute updates' timestamp)
    // assert.equal(values[derivedAttrId].ts, ts);
    // Finally, make sure 2 * 5 = 10 was saved to DB
    assert.equal(values[derivedAttrId].value, 10);
  });

  /**
   * This tests the entire path of a derived attribute using also a filter expression
   */
  it('calculates a derived attribute conditionally depending on the filter', async () => {
    // constants
    const sourceAttrId = 'sourceAttr0';
    const derivedAttrId = 'derivedAttr1';
    const robotId = await createDummyRobotInDB();
    const processor = new RobotDerivedAttributesProcessor({ robotId });
    // create attributes configuration
    await attrDefsColl.insertOne({
      attributeId: sourceAttrId,
      definition: {
        label: 'source attribute'
      }
    });
    await attrDefsColl.insertOne({
      attributeId: derivedAttrId,
      definition: {
        label: 'derived attribute'
      },
      mapping: {
        source: 'derived',
        // no 'language' given, it uses default evaluation (eval() for now)
        attributeIds: [sourceAttrId],
        transform: 'args[0] * 2',
        filter: 'args[0] > 2'
      }
    });
    // send an attribute values update; mocking AMQP msgs using our "variants"
    let ts = Date.now();
    await processor.processUpdate({
      [sourceAttrId]: { ts, value: { doubleValue: 5 } }
    });

    let values = await attributesMgr.getRobotAttributeValues(robotId, [derivedAttrId]);
    assert.equal(values[derivedAttrId].value, 10);

    ts = Date.now();
    await processor.processUpdate({
      [sourceAttrId]: { ts, value: { doubleValue: 1 } }
    });

    // Value not updated because it doesn't satisfy the filter
    values = await attributesMgr.getRobotAttributeValues(robotId, [derivedAttrId]);
    assert.equal(values[derivedAttrId].value, 10);
  });

  /**
   * This tests nearly the entire path of a derived attribute since receiving a message from
   * the attribute updates queue.
   * It also forces the evaluation to happen using the new, safer evaluation method (parsed
   * expressions).
   */
  it('calculates a derived attribute from a message update, using safe expressions', async () => {
    // constants
    const sourceAttrId = 'sourceAttr0';
    const derivedAttrId = 'derivedAttr1';
    const robotId = await createDummyRobotInDB();
    const processor = new RobotDerivedAttributesProcessor({ robotId });
    // create attributes configuration
    await attrDefsColl.insertOne({
      attributeId: sourceAttrId,
      definition: {
        label: 'source attribute'
      }
    });
    await attrDefsColl.insertOne({
      attributeId: derivedAttrId,
      definition: {
        label: 'derived attribute'
      }, 
      mapping: {
        source: 'derived',
        attributeIds: [sourceAttrId],
        transform: 'sin(args[0])' // sin() is not a JS function, it is only available in expr-eval
      }
    });
    // send an attribute values update; mocking AMQP msgs using our "variants"
    const ts = Date.now();
    await processor.processUpdate({
      [sourceAttrId]: { ts, value: { doubleValue: 0 } }
    });

    const values = await attributesMgr.getRobotAttributeValues(robotId, [derivedAttrId]);
    // Note: We cannot still assert this, since the timestamp is not properly set in the service
    // (it's always "now", not depending on the attribute updates' timestamp)
    // assert.equal(values[derivedAttrId].ts, ts);
    // Finally, sin(0) = 0 should be saved to the DB
    assert.equal(values[derivedAttrId].value, 0);
  });

  /**
   * This tests nearly the entire path of a derived attribute since receiving a message from
   * the attribute updates queue.
   * It also forces the evaluation to happen using the new, safer evaluation method (parsed
   * expressions) and tests that the attribute is computed only if the filter expression is
   * satisfied.
   */
  it('calculates a derived attribute using safe expressions and filter', async () => {
    // constants
    const sourceAttrId = 'sourceAttr0';
    const derivedAttrId = 'derivedAttr1';
    const robotId = await createDummyRobotInDB();
    const processor = new RobotDerivedAttributesProcessor({ robotId });
    // create attributes configuration
    await attrDefsColl.insertOne({
      attributeId: sourceAttrId,
      definition: {
        label: 'source attribute'
      }
    });
    await attrDefsColl.insertOne({
      attributeId: derivedAttrId,
      definition: {
        label: 'derived attribute'
      }, 
      mapping: {
        source: 'derived',
        attributeIds: [sourceAttrId],
        transform: 'sin(args[0])', // sin() is not a JS function, it is only available in expr-eval
        filter: 'args[0] > 0'
      }
    });
    // send an attribute values update; mocking AMQP msgs using our "variants"
    let ts = Date.now();
    await processor.processUpdate({
      [sourceAttrId]: { ts, value: { doubleValue: Math.PI / 2 } }
    });

    let values = await attributesMgr.getRobotAttributeValues(robotId, [derivedAttrId])
    assert.equal(values[derivedAttrId].value, 1);

    ts = Date.now();
    await processor.processUpdate({
      [sourceAttrId]: { ts, value: { doubleValue: 0 } }
    });

    values = await attributesMgr.getRobotAttributeValues(robotId, [derivedAttrId])
    assert.equal(values[derivedAttrId].value, 1);
  });

  /**
   * This tests nearly the entire path of a derived attribute since receiving a message from
   * the attribute updates queue -- configuring a derived attribute to calculate from TWO
   * different attributes
   */
  it('calculates derived attribute (from multiple attributes) from a message update', async () => {
    // constants
    const sourceAttrId1 = 'sourceAttr1';
    const sourceAttrId2 = 'sourceAttr2';
    const derivedAttrId = 'derivedAttr';
    const robotId = await createDummyRobotInDB();
    const processor = new RobotDerivedAttributesProcessor({ robotId });
    // create attributes configuration
    await attrDefsColl.insertOne({
      attributeId: sourceAttrId1,
      definition: {
        label: 'first source attribute'
      }
    })
    await attrDefsColl.insertOne({
      attributeId: sourceAttrId2,
      definition: {
        label: 'second source attribute'
      }
    })
    await attrDefsColl.insertOne({
      attributeId: derivedAttrId,
      definition: {
        label: 'derived attribute 2'
      },
      mapping: {
        source: 'derived',
        // not getValue('${sourceAttrId1}')
        transform: `not getValue('${sourceAttrId2}') ? "DIVISION by ZERO" : 10 * (getValue('${sourceAttrId1}') / getValue('${sourceAttrId2}'))`,
      }
    })
    // send a first update, where the second source attribute has not been yet published
    const ts = Date.now();
    await processor.processUpdate({
      [sourceAttrId1]: { ts, value: { doubleValue: 5 } }
    });
    let values = await attributesMgr.getRobotAttributeValues(robotId, [derivedAttrId]);
    assert.equal(values[derivedAttrId].value, 'DIVISION by ZERO');
    // also simulate the first one has a value on the DB, for later
    await attributeValuesColl.updateOne(
      { _id: robotId },
      { $set: { [sourceAttrId1]: { value: 5, ts } } },
      { upsert: true }
    );
    // send a second update, only the second attribute (which should divide the first one)
    await processor.processUpdate({
      [sourceAttrId2]: { ts, value: { doubleValue: 2 } }
    });
    values = await attributesMgr.getRobotAttributeValues(robotId, [derivedAttrId]);
    assert.equal(values[derivedAttrId].value, 25);
    // finally, do an update with both attributes
    await processor.processUpdate({
      [sourceAttrId1]: { ts, value: { doubleValue: 12 } },
      [sourceAttrId2]: { ts, value: { doubleValue: 4 } }
    });
    values = await attributesMgr.getRobotAttributeValues(robotId, [derivedAttrId]);
    assert.equal(values[derivedAttrId].value, 30);
  });

  it('Calculates a derived attribute that depends on itself', async () => {
    // constants
    const sourceAttrId0 = 'sourceAttr0';
    const derivedAttrId0 = 'derivedAttr0';
    const robotId = await createDummyRobotInDB();
    const processor = new RobotDerivedAttributesProcessor({ robotId });
    // create attributes configuration
    await attrDefsColl.insertOne({
      attributeId: sourceAttrId0,
      definition: {
        label: 'source attribute'
      },
    });
    await attrDefsColl.insertOne({
      attributeId: derivedAttrId0,
      definition: {
        label: 'derived attribute'
      },
      // Creates an expression that gets the value of the derived attribute
      // and adds that value with sourceAttrId0
      mapping: {
        source: 'derived',
        transform: `getValue("${derivedAttrId0}") + getValue("${sourceAttrId0}")`
      }
    });
    // Adds a initial value for the derived attribute
    await attributeValuesColl.updateOne(
      { _id: robotId },
      { $set: { [derivedAttrId0]: { value: 5, ts: Date.now() } } },
      { upsert: true }
    );
    const ts = Date.now();
    // Arrives a 3 in the source attr and this should trigger a calculation
    // involving both values (the derived attribute last value + the new value)
    await processor.processUpdate({
      [sourceAttrId0]: { ts, value: { doubleValue: 3 } }
    });
    const values = await attributesMgr.getRobotAttributeValues(robotId, [derivedAttrId0]);
    // The value gets updated to 5 + 3 = 8
    assert.equal(values[derivedAttrId0].value, 8);
    // Both attributes come as an update and the calculation
    // should work in this case too, avoiding the service to fall in a inifintie loop
    await processor.processUpdate({
      [sourceAttrId0]: { ts, value: { doubleValue: 10 } },
      [derivedAttrId0]: { ts, value: { doubleValue: 5 } }
    });
    const finalValues = await attributesMgr.getRobotAttributeValues(robotId, [derivedAttrId0]);
    // The value gets updated to 5 + 10 = 15
    assert.equal(finalValues[derivedAttrId0].value, 15);
  });
});

describe('svc-derived-attributes built-in functions', () => {
  let sinonSandbox;
  let mongoMgr;
  let robotsColl;
  let attrDefsColl;
  let attributesMgr;

  beforeEach(async () => {
    sinonSandbox = sinon.createSandbox();
    mongoMgr = new MongoManager();
    robotsColl = mongoMgr.getCollection(COLLECTIONS.ROBOTS);
    attrDefsColl = mongoMgr.getCollection(COLLECTIONS.ATTRIBUTE_DEFINITIONS);
    attributesMgr = new AttributesManager();
  });

  afterEach(async () => {
    sinonSandbox.restore();
  });

  /**
   * This tests the getValue() function,
   * it checks that the usage of this function returns the expected value when used
   * in transform derived attribute. It also checks that dependencies are inferred without
   * being explicitly listed.
   */
  it('supports evaluating get attribute value', async () => {
    // constants
    const sourceAttrId0 = 'sourceAttr0';
    const sourceAttrId1 = 'sourceAttr1';
    const derivedAttrId = 'derivedAttr1';
    const robotId = await createDummyRobotInDB();
    const processor = new RobotDerivedAttributesProcessor({ robotId });
    // create attributes configuration
    await attrDefsColl.insertOne({
      attributeId: sourceAttrId0,
      definition: {
        label: 'source attribute'
      },
    });
    await attrDefsColl.insertOne({
      attributeId: sourceAttrId1,
      definition: {
        label: 'source attribute'
      },
    });
    await attrDefsColl.insertOne({
      attributeId: derivedAttrId,
      definition: {
        label: 'derived attribute'
      },
      mapping: {
        source: 'derived',
        filter: `getValue("${sourceAttrId0}") > 5`,
        transform: `getValue("${sourceAttrId0}") * getValue("${sourceAttrId1}")`
      }
    });
    // send an attribute values update; mocking AMQP msgs using our "variants"
    const ts = Date.now();
    // Set 8 and 10 values so that the transform function makes it 80
    await processor.processUpdate({
      [sourceAttrId0]: { ts, value: { doubleValue: 8 } },
      [sourceAttrId1]: { ts, value: { doubleValue: 10 } }
    });
    const values = await attributesMgr.getRobotAttributeValues(robotId, [derivedAttrId]);
    // The value gets updated to 80 because 8 * 10 = 80
    assert.equal(values[derivedAttrId].value, 80);
  });

  /**
   * Test getValue returns null when called with a attributeId that does not exist
   */
  it('getValue returns null when value not found', async () => {
    // constants
    const sourceAttrId = 'sourceAttr0';
    const derivedAttrId = 'derivedAttr1';
    const robotId = await createDummyRobotInDB();
    const processor = new RobotDerivedAttributesProcessor({ robotId });
    // create attributes configuration
    await attrDefsColl.insertOne({
      attributeId: sourceAttrId,
      definition: {
        label: 'source attribute'
      },
    });
    await attrDefsColl.insertOne({
      attributeId: derivedAttrId,
      definition: {
        label: 'derived attribute'
      },
      mapping: {
        source: 'derived',
        transform: `getValue("${sourceAttrId}") ? getValue('someKeyThatDoesNotExist') : false`
      }
    });
    let values = await attributesMgr.getRobotAttributeValues(robotId, [derivedAttrId]);
    // send an attribute values update; mocking AMQP msgs using our "variants"
    const ts = Date.now();
    await processor.processUpdate({
      [sourceAttrId]: { ts, value: { doubleValue: 8 } }
    });
    values = await attributesMgr.getRobotAttributeValues(robotId, [derivedAttrId]);
    assert.isNull(values[derivedAttrId].value);
  });
});

describe('svc-derived-attributes expressions language', () => {
  beforeEach(async () => {
    await mongoUnit.drop();
  });

  it('evaluates simple math', async () => {
    const expr = new ParsedExpression({ expressionStr: '(1+2) * 3', functions: {} });
    await expr.evaluate({
      robotId: 'test',
      args: [],
      functions: {}
    });
    assert.isTrue(expr.isSuccess());
    assert.equal(expr.getResult(), 9);
  });

  it('evaluates trigonometric functions', async () => {
    // note: this is not supported in the eval-based expressions
    const expr = new ParsedExpression({ expressionStr: 'sin(0)', functions: {} });
    await expr.evaluate({
      robotId: 'test',
      args: [],
      functions: {}
    });
    assert.isTrue(expr.isSuccess());
    assert.equal(expr.getResult(), 0);
  });

  it('supports passing positional arguments', async () => {
    const expr = new ParsedExpression({ expressionStr: 'args[0] / args[1]', functions: {} });
    const args = [1, 2];
    await expr.evaluate({ robotId: 'test', args, functions: {} });
    assert.isTrue(expr.isSuccess());
    assert.equal(expr.getResult(), 0.5);
  });

  it('catches evaluation errors', async () => {
    // eval-based expressions can only catch errors when evaluating; not in the constructor
    const expr = new ParsedExpression({ expressionStr: '1 + speed', functions: {} });
    await expr.evaluate({
      robotId: 'test',
      args: [],
      functions: {}
    });
    assert.isFalse(expr.isSuccess());
    assert.isTrue(expr.getResult().startsWith('Error:'));
  });

  it('supports using functions', async () => {
    const functions = {
      square_root: new Function({
        name: 'square_root',
        fn: () => (x) => Math.sqrt(x),
        arity: 1
      })
    };
    const expr = new ParsedExpression({ expressionStr: 'square_root(64)', functions });
    await expr.evaluate({ robotId: 'test', args: [], functions });
    assert.isTrue(expr.isSuccess());
    assert.equal(expr.getResult(), 8);
  });

  it('evaluates async functions (example 1: simple async)', async () => {
    const functions = {
      async_inc: new Function({
        name: 'async_inc',
        fn: () => async (x) => x + 1,
        arity: 1
      })
    };
    const expr = new ParsedExpression({
      expressionStr: 'async_inc(2) + 1',
      functions
    });
    await expr.evaluate({ robotId: 'test', args: [], functions });
    assert.isTrue(expr.isSuccess());
    assert.equal(expr.getResult(), 4);
  });

  it('evaluates async functions (example 2: sleep)', async () => {
    const functions = {
      slow_inc: new Function({
        name: 'slow_inc',
        // increment a number `x` by 1, taking `ms` milliseconds to return
        fn: () => (ms, x) => new Promise((r) => setTimeout(() => r(x + 1), ms)),
        arity: 2
      })
    };
    const expr = new ParsedExpression({
      expressionStr: 'slow_inc(25, 9) + 4',
      functions
    });
    await expr.evaluate({ robotId: 'test', args: [], functions });
    assert.isTrue(expr.isSuccess());
    assert.equal(expr.getResult(), 14);
  });

  it('evaluates async functions (example 3: db)', async () => {
    const robotId = 'robot123';
    const robotsColl = await new MongoManager().getCollection(COLLECTIONS.ROBOTS);
    const doc = {
      _id: robotId,
      attribute1: 10,
      attribute2: 20
    };
    await robotsColl.insertOne(doc);
    const functions = {
      getRobotAttribute: new Function({
        name: 'getRobotAttribute',
        fn: ({ robotId: _id }) => async (attrId) => {
          const robotDoc = await robotsColl.findOne({ _id });
          return robotDoc && (attrId in robotDoc) ? robotDoc[attrId] : null;
        },
        arity: 1,
        dependenciesFn: (args, { attributeIds }) => {
          args.length && attributeIds.add(args[0]);
        }
      })
    };
    const expr = new ParsedExpression({
      expressionStr: 'getRobotAttribute("attribute1") * getRobotAttribute("attribute2")',
      functions
    });
    await expr.evaluate({ robotId, args: [], functions });
    assert.isTrue(expr.isSuccess());
    assert.equal(expr.getResult(), 200);
  });

  it('functions precomputing works also in sub-expressions', async () => {
    const robotId = 'robot123';
    const robotsColl = await new MongoManager().getCollection(COLLECTIONS.ROBOTS);
    const doc = {
      _id: robotId,
      attribute1: 5,
    };
    await robotsColl.insertOne(doc);
    const functions = {
      getRobotAttribute: new Function({
        name: 'getRobotAttribute',
        fn: ({ robotId: _id }) => async (attrId) => {
          const robotDoc = await robotsColl.findOne({ _id });
          return robotDoc && (attrId in robotDoc) ? robotDoc[attrId] : null;
        },
        arity: 1,
        dependenciesFn: (args, { attributeIds }) => {
          args.length && attributeIds.add(args[0]);
        }
      })
    };
    // In the following expression getRobotAttribute("attribute1") is a sub-expression
    const expr = new ParsedExpression({
      expressionStr: '3 > 2 ? getRobotAttribute("attribute1") : "n"',
      functions
    });
    await expr.evaluate({ robotId, args: [], functions });
    assert.isTrue(expr.isSuccess());
    assert.equal(expr.getResult(), 5);
  });

  it('catches syntax errors', async () => {
    // eval-based expressions can only catch errors when evaluating; not in the constructor
    assert.throws(() => new ParsedExpression({ expressionStr: '1 + (1 + (1 +', functions: {} }));
  });

  it('catches strict typing of InOrbit functions', async () => {
    // eval-based expressions can only catch errors when evaluating; not in the constructor
    const functions = {
      inc: new Function({
        name: 'inc',
        fn: () => (x) => x + 1,
        args: {
          min: 1,
          max: 1,
          types: [TYPE_NUMBER]
        },
        dependenciesFn: (args, { attributeIds }) => {
          args.length && attributeIds.add(args[0]);
        }
      })
    };
    // First test that inc() function, simply to discard other errors
    let expr = new ParsedExpression({ expressionStr: '(4+inc(4))/inc(2)', functions });
    await expr.evaluate({ robotId: 'foo', args: [], functions });
    assert.equal(expr.getResult(), 3);
    // Note that since expressions are simplified, basic operations as arguments to our functions
    // are allowed as long as the expression is still a constant
    expr = new ParsedExpression({ expressionStr: 'inc(3+4)', functions });
    await expr.evaluate({ robotId: 'foo', args: [], functions });
    assert.equal(expr.getResult(), 8);
    // Now try different variations of bad arguments
    assert.throws(
      () => new ParsedExpression({ expressionStr: 'inc()', functions }),
      /expects 1 argument; received 0/
    );
    assert.throws(
      () => new ParsedExpression({ expressionStr: 'inc(1, 2)', functions }),
      /expects 1 argument; received 2/
    );
    // Even if the call below receive just one argument, they are not constants
    assert.throws(
      () => new ParsedExpression({ expressionStr: 'inc(inc(1))', functions }),
      /inc can only receive constant arguments/
    );
    // Also check that constants of the wrong type are rejected
    assert.throws(
      () => new ParsedExpression({ expressionStr: 'inc("foo")', functions }),
      /Argument #1 for function inc must be a constant number/
    );
  });
});

// Low level evaluation of functions from our language, outside any expression
describe('svc-derived-attributes expressions language functions', () => {
  let sinonSandbox;
  let mongoMgr;
  let attrDefsColl;
  let attrManager;

  beforeEach(async () => {
    await mongoUnit.drop();
    sinonSandbox = sinon.createSandbox();
    mongoMgr = new MongoManager();
    attrDefsColl = mongoMgr.getCollection(COLLECTIONS.ATTRIBUTE_DEFINITIONS);
    attrManager = new AttributesManager();
  });

  afterEach(() => {
    // We clean up the sinon sandbox
    sinonSandbox.restore();
  });

  // used for multiple tests below
  const AGGREGATIONS = ['min', 'max', 'mean'];

  it('evaluates getValue()', async () => {
    const robotId = await createDummyRobotInDB();
    const { getValue } = FUNCTIONS_DICT;
    const ts = Date.now();
    const attributeValues = {
      attr1: { value: 0, ts },
      attr2: { value: 'two', ts },
      attr3: { value: [1, 2, 3], ts },
      attr4: { value: null, ts },
      attr5: { value: undefined, ts },
      attr6: undefined,
      attr7: null
    };
    // getValueRobot is now "specialized" for this robot
    const getValueRobot = getValue.injectContext({
      robotId,
      attributeValues
    });
    assert.strictEqual(await getValueRobot('attr1'), 0);
    assert.strictEqual(await getValueRobot('attr2'), 'two');
    assert.deepEqual(await getValueRobot('attr3'), [1, 2, 3]);
    assert.strictEqual(await getValueRobot('attr4'), null);
    assert.strictEqual(await getValueRobot('attr5'), undefined); // defined to be undefined :)
    assert.strictEqual(await getValueRobot('attr6'), null); // no attr update for attr6 but it is included in attributeValues
    assert.strictEqual(await getValueRobot('attr7'), null); // no attr update for attr7 but it is included in attributeValues
    assert.strictEqual(await getValueRobot('attr8'), null); // not defined in the dictionary
  });

  it('evaluates getValueAgeMs()', async () => {
    const robotId = await createDummyRobotInDB();
    const { getValueAgeMs } = FUNCTIONS_DICT;
    const ts = Date.now();
    const oneSecondInThePast = ts - 1000;
    const attributeValues = {
      attr1: { value: 0, ts: oneSecondInThePast },
    };
    // getValueAgeMs is now "specialized" for this robot
    const getValueAgeMsRobot = getValueAgeMs.injectContext({
      robotId,
      attributeValues,
      ts
    });
    // the result should be 1000 since we updated the attr1 "one second ago"
    assert.strictEqual(await getValueAgeMsRobot('attr1'), 1000);
  });

  it('evaluates getValueAgeMs() when the attribute is not present', async () => {
    const robotId = await createDummyRobotInDB();
    const { getValueAgeMs } = FUNCTIONS_DICT;
    const ts = Date.now();
    const attributeValues = {};
    // getValueAgeMs is now "specialized" for this robot
    const getValueAgeMsRobot = getValueAgeMs.injectContext({
      robotId,
      attributeValues,
      ts
    });
    assert.strictEqual(await getValueAgeMsRobot('attr1'), null);
  });

  it('evaluates getValueAgeMs() when the attribute has no timestamp', async () => {
    const robotId = await createDummyRobotInDB();
    const { getValueAgeMs } = FUNCTIONS_DICT;
    const ts = Date.now();
    const attributeValues = {
      attr1: { value: 100 },
    };
    // getValueAgeMs is now "specialized" for this robot
    const getValueAgeMsRobot = getValueAgeMs.injectContext({
      robotId,
      attributeValues,
      ts
    });
    assert.strictEqual(await getValueAgeMsRobot('attr1'), null);
  });

  ['visitedAreaSide', 'visitedAreaDiagonal'].forEach((fnName) => {
    // TODO(mike) re-enable tests with timeseries
    it.skip(`evaluates ${fnName}()`, async () => {
      const robotId = await createDummyRobotInDB();
      const f = FUNCTIONS_DICT[fnName];
      const dataProvider = new RobotDerivedAttributesDataProvider();
      await dataProvider.init({});
      const ts = Date.now(); // remember this timestamp as "now" to validate queries
      const clockMock = sinonSandbox.useFakeTimers(ts);
      const secs = 60;
      const fForRobot = f.injectContext({
        robotId,
        ts,
        dataProvider
      });
      await fForRobot(secs); // ignore the result: the mock does not compute anything
      // Since we use a mock for influx, and it does not have the ability to compute actual
      // query results (not as complex as this one at least) we will only assert that the
      // influxManager dispatches the query we expect to compute coordinates
      const expectedQuery = {
        selectFields: ['min(x) as minx', 'min(y) as miny', 'max(x) as maxx', 'max(y) as maxy'],
        measurement: 'robot_localization',
        whereFilters: { robotId },
        startTs: ts - secs * 1000,
        endTs: ts,
        groupByFields: ['frameId']
      };
      influxMock.assertQueryRawParams(expectedQuery);
      clockMock.restore();
    });
  });

  it('evaluates inRectangleArea()', async () => {
    const robotId = await createDummyRobotInDB();
    const attributeValues = {
      [VITAL_POSE]: {
        value: {
          x: 1,
          y: 2,
          theta: 3.14,
          frameId: 'm'
        }
      }
    };
    const { inRectangleArea } = FUNCTIONS_DICT;
    const inRectangleAreaFn = inRectangleArea.injectContext({
      robotId,
      attributeValues
    });
    // poses fully contained in the rectangle
    assert.isTrue(await inRectangleAreaFn(0, 1, 2, 3, 'm')); // fully contained
    assert.isTrue(await inRectangleAreaFn(2, 3, 0, 1, 'm')); // same, coordinates reversed (min/max)
    assert.isTrue(await inRectangleAreaFn(0, 1, 2, 3)); // frameId is optional
    assert.isFalse(await inRectangleAreaFn(0, 1, 2, 3, 'wrong_frame')); // the frame must match
    // pose in an edge of the rectangle
    assert.isTrue(await inRectangleAreaFn(0, 1, 1, 3, 'm'));
    assert.isTrue(await inRectangleAreaFn(1, 1, 2, 3, 'm'));
    assert.isTrue(await inRectangleAreaFn(0, 1, 2, 2, 'm'));
    assert.isTrue(await inRectangleAreaFn(0, 2, 2, 3, 'm'));
    // pose is in a corner of the rectangle
    assert.isTrue(await inRectangleAreaFn(1, 2, 2, 3, 'm'));
    assert.isTrue(await inRectangleAreaFn(1, 2, 2, 1, 'm'));
    assert.isTrue(await inRectangleAreaFn(1, 2, 0, 3, 'm'));
    assert.isTrue(await inRectangleAreaFn(1, 2, 0, 1, 'm'));
    // rectangles not containing the point
    assert.isFalse(await inRectangleAreaFn(0, 2.001, 100, 100, 'm'));
    assert.isFalse(await inRectangleAreaFn(0, -100, 100, 1.999, 'm'));
    assert.isFalse(await inRectangleAreaFn(-100, 0, 0.99, 100, 'm'));
    assert.isFalse(await inRectangleAreaFn(1.001, 0, 100, 100, 'm'));
  });

  it.skip('evaluates sustainedValue()', async () => {
    // TODO re-enable with timeseries
    const robotId = await createDummyRobotInDB();
    await attrDefsColl.insert({
      entityId: robotId,
      entityType: ID_TYPE_ROBOT,
      missionStatus: {
        label: 'missionStatus',
        timeline: {
          fieldType: 'string'
        }
      }
    });

    const ts = Date.now(); // remember this timestamp as "now" to validate queries
    const clockMock = sinonSandbox.useFakeTimers(ts);
    const pointTemplate = {
      measurement: influxMock.getRobotsMeasurementName(),
      tags: { robotId }
    };
    influxMock.writePoints([
      { ...pointTemplate, timestamp: tsToNs(ts - 1000), fields: { 'missionStatus.str': 'idle' } },
      { ...pointTemplate, timestamp: tsToNs(ts - 2000), fields: { 'missionStatus.str': 'idle' } },
      { ...pointTemplate, timestamp: tsToNs(ts - 3000), fields: { 'missionStatus.str': 'mission' } },
      { ...pointTemplate, timestamp: tsToNs(ts - 4000), fields: { 'missionStatus.str': 'idle' } },
      // the last element is outside the search window
      { ...pointTemplate, timestamp: tsToNs(ts - 5000), fields: { 'missionStatus.str': 'error' } }
    ]);

    const dataProvider = new RobotDerivedAttributesDataProvider();
    await dataProvider.init({});

    const { sustainedValue } = FUNCTIONS_DICT;
    const sustainedValueRobot = sustainedValue.injectContext({
      robotId,
      dataProvider,
      ts
    });
    // First query is over ~4 secs (4 rows). Result is not unique, so there is no sustainedValue()
    let secs = 4.9;
    let res = await sustainedValueRobot('missionStatus', secs);
    let expectedQuery = {
      selectFields: ['DISTINCT("missionStatus.str")'],
      measurement: 'robot_events',
      whereFilters: { robotId },
      startTs: ts - secs * 1000,
      endTs: ts,
      limit: 2
    };
    influxMock.assertQueryRawParams(expectedQuery);
    assert.deepEqual(res, null); // since the result is not unique, it returns null
    // Second query over only 2 rows. Latest rows have the same value so return is 'idle'
    secs = 2;
    res = await sustainedValueRobot('missionStatus', secs);
    expectedQuery = {
      selectFields: ['DISTINCT("missionStatus.str")'],
      measurement: 'robot_events',
      whereFilters: { robotId },
      startTs: ts - secs * 1000,
      endTs: ts,
      limit: 2
    };
    influxMock.assertQueryRawParams(expectedQuery);
    assert.deepEqual(res, 'idle'); // since the result is not unique, it returns null
    clockMock.restore();
  });

  AGGREGATIONS.forEach((agg) => {
    it.skip(`evaluates ${agg}Value()`, async () => {
      // TODO re-enable with timeseries
      const robotId = await createDummyRobotInDB();
      await attrDefsColl.insert({
        entityId: ID_INORBIT,
        entityType: ID_TYPE_SYSTEM_WIDE,
        cpuLoadPercentage: { unit: '%', label: 'CPU usage', precision: 1, timeline: {} },
      });

      const aggFunc = FUNCTIONS_DICT[`${agg}Value`];
      const ts = Date.now(); // remember this timestamp as "now" to validate queries
      const clockMock = sinonSandbox.useFakeTimers(ts);

      const pointTemplate = {
        measurement: influxMock.getRobotsMeasurementName(),
        tags: { robotId }
      };
      const results = { // min, max, mean for the values inserted below
        min: 0.1,
        max: 0.8,
        mean: 0.4
      };
      influxMock.writePoints([
        { ...pointTemplate, timestamp: tsToNs(ts - 1000), fields: { cpuLoadPercentage: 0.3 } },
        { ...pointTemplate, timestamp: tsToNs(ts - 2000), fields: { cpuLoadPercentage: 0.1 } },
        { ...pointTemplate, timestamp: tsToNs(ts - 3000), fields: { cpuLoadPercentage: 0.8 } },
        { ...pointTemplate, timestamp: tsToNs(ts - 4000), fields: { cpuLoadPercentage: 0.4 } },
        // the last element is outside the search window
        { ...pointTemplate, timestamp: tsToNs(ts - 5000), fields: { cpuLoadPercentage: 1.0 } }
      ]);

      const dataProvider = new RobotDerivedAttributesDataProvider();
      await dataProvider.init({});

      const secs = 4.9;
      const aggValueRobot = aggFunc.injectContext({
        robotId,
        dataProvider,
        ts
      });
      const res = await aggValueRobot('cpuLoadPercentage', secs);
      // anything. Since we use a mock for influx, and it does not have the ability to compute
      // actual query results (not as complex as this one at least) we will only assert that the
      // influxManager dispatches the query we expect to compute coordinates
      const expectedQuery = {
        selectFields: [`${agg}("cpuLoadPercentage")`],
        measurement: 'robot_events',
        whereFilters: { robotId },
        startTs: ts - secs * 1000,
        endTs: ts,
        limit: null
      };
      influxMock.assertQueryRawParams(expectedQuery);
      assert.equal(res, results[agg]);
      clockMock.restore();
    });
  });

  it('evaluates match()', async () => {
    const { match } = FUNCTIONS_DICT;
    const matchFn = match.injectContext({});
    // Simplest tests: match constant expressions (useless)
    assert.deepEqual(await matchFn('foo', 'foobar'), ['foo']);
    assert.deepEqual(await matchFn('foo$', 'foobar'), false);
    assert.deepEqual(await matchFn('^foo$', 'foobar'), false);
    assert.deepEqual(await matchFn('^foo', 'foobar'), ['foo']);
    assert.deepEqual(await matchFn('^bar$', 'foobar'), false);
    assert.deepEqual(await matchFn('bar$', 'foobar'), ['bar']);
    assert.deepEqual(await matchFn('f(o+)bar', 'foobar'), ['foobar', 'oo']);
    assert.deepEqual(
      await matchFn('([\\w]*), ([\\w]*)', 'Name: Smith, Will'),
      ['Smith, Will', 'Smith', 'Will']
    );
  });

  it('evaluates match() with non-constant arguments', async () => {
    // NOTE(herch) This test should test something like
    //   match("regexp", getValue("attr"))
    // but this is still not supported (it should be, but our poor interpretation of expr-eval
    // parsed expression only allows us to expect constants and variables as function arguments).
    const robotId = 'robot123';
    const robotsColl = await new MongoManager().getCollection(COLLECTIONS.ROBOTS);
    const doc = {
      _id: robotId,
      name: 'c3p0'
    };
    await robotsColl.insertOne(doc);
    const expr = new ParsedExpression({
      expressionStr: 'x = getValue("attr1"); match("mat(che)r.+", x)',
      functions: FUNCTIONS_DICT
    });
    await expr.evaluate({
      robotId,
      args: [],
      attributeValues: { attr1: { value: 'regexp matcher... rocks' } },
      functions: FUNCTIONS_DICT
    });
    assert.isTrue(expr.isSuccess());
    assert.deepEqual(expr.getResult(), ['matcher... rocks', 'che']);
  });

  it('returns false for match() with non-string arguments', async () => {
    const robotId = 'robot123';
    const robotsColl = await new MongoManager().getCollection(COLLECTIONS.ROBOTS);
    const doc = {
      _id: robotId,
      name: 'c3p0'
    };
    await robotsColl.insertOne(doc);
    const expr = new ParsedExpression({
      expressionStr: 'match("mat(che)r.+", 1)',
      functions: FUNCTIONS_DICT
    });
    await expr.evaluate({
      robotId,
      args: [],
      attributes: {},
      functions: FUNCTIONS_DICT
    });
    assert.isTrue(expr.isSuccess());
    assert.isFalse(expr.getResult());
  });

  it('Type-checks every built-in function', () => {
    // Shortcut to build an expression, evaluate it and assert it throws a specific error type
    const assertExprThrows = (expr, error) => {
      assert.throws(() => new ParsedExpression({
        expressionStr: expr, functions: FUNCTIONS_DICT
      }), error);
    };
    // getValue type checking
    assertExprThrows('getValue()', 'Function getValue expects 1 argument; received 0');
    assertExprThrows('getValue(1)', 'Argument #1 for function getValue must be a constant string');
    assertExprThrows('getValue("a","b")', 'Function getValue expects 1 argument; received 2');
    // visitedAreaSide type checking
    assertExprThrows('visitedAreaSide()', 'Function visitedAreaSide expects 1 argument; received 0');
    assertExprThrows('visitedAreaSide("")', 'Argument #1 for function visitedAreaSide must be a constant number');
    assertExprThrows('visitedAreaSide(1, 2)', 'Function visitedAreaSide expects 1 argument; received 2');
    // visitedAreaDiagonal type checking
    assertExprThrows('visitedAreaDiagonal()', 'Function visitedAreaDiagonal expects 1 argument; received 0');
    assertExprThrows('visitedAreaDiagonal("")', 'Argument #1 for function visitedAreaDiagonal must be a constant number');
    assertExprThrows('visitedAreaDiagonal(1, 2)', 'Function visitedAreaDiagonal expects 1 argument; received 2');
    // inRectangleArea type checking
    assertExprThrows('inRectangleArea()', 'Function inRectangleArea expects at least 4 arguments; received 0');
    assertExprThrows('inRectangleArea(1,2,3)', 'Function inRectangleArea expects at least 4 arguments; received 3');
    assertExprThrows('inRectangleArea(1,2,3,4,"frame",6)', 'Function inRectangleArea expects at most 5 arguments; received 6');
    assertExprThrows('inRectangleArea("a",2,3,4,"b")', 'Argument #1 for function inRectangleArea must be a constant number');
    assertExprThrows('inRectangleArea(1,2,3,4,5)', 'Argument #5 for function inRectangleArea must be a constant string');
    // minValue, maxValue, meanValue
    AGGREGATIONS.forEach((agg) => {
      const fnName = `${agg}Value`;
      assertExprThrows(`${fnName}()`, `Function ${fnName} expects 2 arguments; received 0`);
      assertExprThrows(`${fnName}(1)`, `Function ${fnName} expects 2 arguments; received 1`);
      assertExprThrows(`${fnName}(1, 2)`, `Argument #1 for function ${fnName} must be a constant string`);
      assertExprThrows(`${fnName}("a","b")`, `Argument #2 for function ${fnName} must be a constant number`);
    });
    // match type checking
    assertExprThrows('match()', 'Function match expects 2 arguments; received 0');
    assertExprThrows('match("re")', 'Function match expects 2 arguments; received 1');
    assertExprThrows('match(1, "foo")', 'Argument #1 for function match must be a constant string');
  });
});

describe('svc-derived-attributes ad-hoc expression evaluation', () => {
  let sinonSandbox;
  let mongoMgr;
  let attributeValuesColl;
  let attrManager;

  beforeEach(async () => {
    await mongoUnit.drop();
    sinonSandbox = sinon.createSandbox();
    mongoMgr = new MongoManager();
    attrManager = new AttributesManager();
    attributeValuesColl = mongoMgr.getCollection(COLLECTIONS.ATTRIBUTE_VALUES);
  });

  afterEach(() => {
    // We clean up the sinon sandbox
    sinonSandbox.restore();
  });

  it('evaluates constants and simple functions', async () => {
    const attributes = {
      battery: { value: 0.95 },
      status: { value: { level: 10, message: 'Ok', 'key with spaces': true } },
      arr: { value: [10, 20, 20] },
      nullValue: null
    };
    const tests = [
      ['1', 1],
      ['true', true],
      ['false', false],
      ['PI', 3.141592653589793],
      ['null', null],
      ['getValue("battery")', 0.95],
      ['getValue("xyz")', null],
      ['val = getValue("status"); val.level', 10],
      ['val = getValue("status"); get(val, "level")', 10],
      ['val = getValue("status"); get(val, "nothing")', null],
      ['val = getValue("status"); get(val, "nothing", "default")', 'default'],
      ['val = getValue("status"); get(val, "key with spaces")', true],
      ['get(2, 1)', null], // get() on no-objects returns the default value
      ['get(2, 1, 3)', 3], // get() on no-objects returns the default value
      ['arr = getValue("arr"); get(arr, 1)', 20],
      ['arr = getValue("arr"); get(arr, 100, -1)', -1],
      ['getValue("nullValue") == null', true],
    ];
    const errorTests = [
      ['a', 'undefined variable: a'],
    ];
    const robotId = await createDummyRobotInDB();
    const processor = new RobotDerivedAttributesProcessor({ robotId });
    for (const [expression, value] of tests) {
      // eslint-disable-next-line no-await-in-loop
      const result = await processor.evaluateAdHocSafeExpression({ expression, attributes });
      assert.equal(result.success, true);
      assert.equal(result.value, value);
    }
    for (const [expression, message] of errorTests) {
      // eslint-disable-next-line no-await-in-loop
      const result = await processor.evaluateAdHocSafeExpression({ expression, attributes });
      assert.equal(result.success, false);
      assert.equal(result.value, 'Error: ' + message);
      assert.equal(result.message, message);
    }
  });

  it('evaluates angularDistance()', async () => {
    const attributes = {
      heading: { value: 1 },
      object: { value: { angle: 2 } }
    };
    const tests = [
      ['angularDistance(1, 0)', -1],
      ['angularDistance(0, 1)', 1],
      ['angularDistance(6, 6.5)', 0.5],
      ['angularDistance(6.5, 6)', -0.5],
      ['angularDistance(6.5, 6 + 50*PI)', -0.5],
      ['angularDistance(6.5, 6 - 50*PI)', -0.5],
      ['angularDistance(0, PI)', Math.PI],
      ['angularDistance(0, -PI)', Math.PI],
      ['angularDistance(PI*10 + 1, 1)', 0],
      ['angularDistance(-11*PI, 0)', Math.PI],
      ['angularDistance(PI*10, PI*20 - 0.05)', -0.05],
      ['angularDistance(PI*10 - 0.05, PI*20)', 0.05],
      ['val = 2; angularDistance(val, 0)', -2],
      ['val = getValue("heading"); angularDistance(val, 0)', -1],
      ['val = getValue("object"); angle = get(val, "angle"); angularDistance(angle, 0)', -2],
    ];
    const robotId = await createDummyRobotInDB();
    const processor = new RobotDerivedAttributesProcessor({ robotId });
    for (const [expression, value] of tests) {
      // eslint-disable-next-line no-await-in-loop
      const result = await processor.evaluateAdHocSafeExpression({ expression, attributes });
      assert.equal(result.success, true);
      assert.isTrue(
        Math.abs(result.value - value) < 10e-06,
        `expected ${result.value} to be close to ${value}`
      );
    }
  });

  it('evaluates getValue()', async () => {
    // constants
    const sourceAttrId0 = 'sourceAttr0';
    const sourceAttrId1 = 'sourceAttr1';
    const robotId = await createDummyRobotInDB();
    // shared objects and managers
    const attrDefsColl = mongoMgr.getCollection(COLLECTIONS.ATTRIBUTE_DEFINITIONS);
    const processor = new RobotDerivedAttributesProcessor({ robotId });
    // create attributes configuration
    await attrDefsColl.insertOne({
      attributeId: sourceAttrId0,
      definition: {
        label: 'source attribute'
      },
    });
    await attrDefsColl.insertOne({
      attributeId: sourceAttrId1,
      definition: {
        label: 'source attribute'
      },
    });
    await attrDefsColl.insertOne({
      attributeId: sourceAttrId1,
      definition: {
        label: 'derived attribute'
      }
    });
    await attributeValuesColl.updateOne(
      { _id: robotId },
      { $set: {
        [sourceAttrId0]: { value: 10 },
        [sourceAttrId1]: { value: 8 }
      } },
      { upsert: true }
    );
    const result = await processor.evaluateAdHocSafeExpression({
      expression: `getValue("${sourceAttrId0}") * getValue("${sourceAttrId1}")`,
    });
    assert.equal(result.value, 80);
    assert.equal(result.success, true);
    assert.isUndefined(result.message);
  });

  it('evaluates getValue() with provided attribute values', async () => {
    // constants
    const attrId = 'newAttr';
    const robotId = await createDummyRobotInDB();
    // shared objects and managers
    const processor = new RobotDerivedAttributesProcessor({ robotId });
    const result = await processor.evaluateAdHocSafeExpression({
      expression: `getValue("${attrId}")`,
      attributes: {
        [attrId]: { value: 1234 }
      }
    });
    assert.equal(result.success, true);
    assert.equal(result.value, 1234);
    assert.isUndefined(result.message);
  });

  it.skip('evaluates isRobotInZone()', async () => {
    const robotsColl = mongoMgr.getCollection(COLLECTIONS.ROBOTS);
    const zonesColl = mongoMgr.getCollection(COLLECTIONS.TRAFFIC_ZONES);
    // create a robot in Moon location, and one somewhere else
    const robotId = await createDummyRobotInDB();
    const robotId2 = await createDummyRobotInDB();
    await robotsColl.updateOne({ _id: robotId }, { $set: { collections: ['moon'] } });
    await robotsColl.updateOne({ _id: robotId2 }, { $set: { collections: ['mars'] } });
    await zonesColl.insertOne({
      zoneId: 'vaporum',
      label: 'Mare Vaporum',
      properties: { robotIds: [robotId] }
    });
    await zonesColl.insertOne({
      zoneId: 'imbrium',
      label: 'Mare Imbrium',
      // no properties (no robots)
    });
    // isRobotInZone tests
    const processor = new RobotDerivedAttributesProcessor({ robotId });
    { // This robot is in zone 'vaporum' in its location, Moon
      const result = await processor.evaluateAdHocSafeExpression({
        expression: 'isRobotInZone("vaporum")'
      });
      assert.equal(result.success, true);
      assert.equal(result.value, true);
    }
    { // Same result expected if we pass the locationId to isRobotInZone
      const result = await processor.evaluateAdHocSafeExpression({
        expression: 'isRobotInZone("vaporum", "moon")'
      });
      assert.equal(result.success, true);
      assert.equal(result.value, true);
    }
    { // The result should be false if we use the zoneId from another location
      const result = await processor.evaluateAdHocSafeExpression({
        expression: 'isRobotInZone("vaporum", "mars")'
      });
      assert.equal(result.success, true);
      assert.equal(result.value, false);
    }
    { // The result should also be false if using another robot, not in this location
      const processor2 = new RobotDerivedAttributesProcessor({ robotId: robotId2 });
      const result = await processor2.evaluateAdHocSafeExpression({
        expression: 'isRobotInZone("vaporum")'
      });
      assert.equal(result.success, true);
      assert.equal(result.value, false);
    }
    // isZoneOccupied() tests
    { // vaporum zone is occupied
      const result = await processor.evaluateAdHocSafeExpression({
        expression: 'isZoneOccupied("vaporum")'
      });
      assert.equal(result.success, true);
      assert.equal(result.value, true);
    }
    { // the other zone is empty
      const result = await processor.evaluateAdHocSafeExpression({
        expression: 'isZoneOccupied("imbrium")'
      });
      assert.equal(result.success, true);
      assert.equal(result.value, false);
    }
    { // any other random zone (including one not defined) is not occupied
      const result = await processor.evaluateAdHocSafeExpression({
        expression: 'isZoneOccupied("doesnotexist")'
      });
      assert.equal(result.success, true);
      assert.equal(result.value, undefined);
    }
  });

  it('reports evaluation errors', async () => {
    // constants
    const robotId = await createDummyRobotInDB();
    // shared objects and managers
    const processor = new RobotDerivedAttributesProcessor({ robotId });
    const result = await processor.evaluateAdHocSafeExpression({
      // A malformed expression
      expression: 'getValue("',
    });
    assert.isUndefined(result.value);
    assert.equal(result.success, false);
    assert.isString(result.message);
  });
});

describe('svc-derived-attributes queries & methods calls measurement', () => {
  // We intialize the sinon sandbox
  let mongoMgr;
  let sinonSandbox;
  let attributeValuesColl;

  beforeEach(async () => {
    await mongoUnit.drop();
    // We spy on method 'getRobotAttributeValues' because
    // we want to know how many times this method is called
    // when processing attributes (processor.processUpdate())
    sinonSandbox = sinon.createSandbox();
    mongoMgr = new MongoManager();
    attributeValuesColl = mongoMgr.getCollection(COLLECTIONS.ATTRIBUTE_VALUES);
  });

  afterEach(() => {
    // We clean up the sinon sandbox
    sinonSandbox.restore();
  });

  it('getRobotAttributeValues method should called once when processing messages updates', async () => {
    // constants
    // NOTE (Elvio): we create 3 sources attr
    // to force the process update method later
    // to search for 2 attr values in the DB
    const sourceAttrId0 = 'sourceAttr0';
    const sourceAttrId1 = 'sourceAttr1';
    const sourceAttrId2 = 'sourceAttr2';
    const sourceAttrId3 = 'sourceAttr3';
    const derivedAttrId0 = 'derivedAttr0';
    const derivedAttrId1 = 'derivedAttr1';
    const robotId = await createDummyRobotInDB();
    // shared objects and managers
    const mongoMgr = new MongoManager();
    const attrDefsColl = mongoMgr.getCollection(COLLECTIONS.ATTRIBUTE_DEFINITIONS);
    const processor = new RobotDerivedAttributesProcessor({ robotId });
    // We create the spy object and we spy the getRobotAttributeValues method
    const spy = sinon.spy(processor._attributesManager, 'getRobotAttributeValues');
    // create attributes configuration
    await attrDefsColl.insertOne({
      attributeId: sourceAttrId0,
      definition: {
        label: 'source attribute'
      },
    });
    await attrDefsColl.insertOne({
      attributeId: sourceAttrId1,
      definition: {
        label: 'source attribute'
      },
    });
    await attrDefsColl.insertOne({
      attributeId: sourceAttrId2,
      definition: {
        label: 'source attribute'
      },
    });
    await attrDefsColl.insertOne({
      attributeId: sourceAttrId3,
      definition: {
        label: 'source attribute'
      },
    });
    await attrDefsColl.insertOne({
      attributeId: derivedAttrId0,
      definition: {
        label: 'source attribute'
      },
      mapping: {
        source: 'derived',
        transform: `getValue("${sourceAttrId0}") + getValue("${sourceAttrId1}")`
      }
    });
    await attrDefsColl.insertOne({
      attributeId: derivedAttrId1,
      definition: {
        label: 'source attribute'
      }, 
      mapping: {
        source: 'derived',
        transform: `getValue("${sourceAttrId2}") + getValue("${sourceAttrId3}")`
      }
    });
    // Simulate that 2 attributes (from different derived attr) already
    // have value in the DB to force the method processUpdate() to look for these values
    // and be sure that getAttributeValues is called once for both derived attributes
    await attributeValuesColl.updateOne(
      { _id: robotId },
      { $set: {
        [sourceAttrId0]: { value: 3 },
        [sourceAttrId2]: { value: 3 }
      } },
      { upsert: true }
    );
    const ts = Date.now();
    // From the service's message has 2 values to calculate both
    // derived attributes
    await processor.processUpdate({
      [sourceAttrId1]: { ts, value: { doubleValue: 8 } },
      [sourceAttrId3]: { ts, value: { doubleValue: 7 } }
    });
    const values = await attributeValuesColl.findOne({ _id: robotId });
    // The value gets updated to 11 -> 3 + 8
    assert.equal(values[derivedAttrId0].value, 11);
    // The value gets updated to 10 -> 3 + 7
    assert.equal(values[derivedAttrId1].value, 10);
    // Asserting the method getRobotAttributeValues was called only once
    // after processing 2 derived attributes
    assert.equal(spy.callCount, 1);
  });
});
