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
 * Unit tests for ingest-side AttributeManager class.
 */
import assert from 'assert';
import * as sinon from 'sinon';
// ORO modules
import AttributesManager, { RobotVitalsConfig } from '../src/server/attributes';
import DerivedAttributesConfig from '../src/services/derivedAttributes/derivedAttributesConfig';
import * as fixtures from './testData/attributesTest.json';
import {
  SOURCES, AttributeValueParser, AttributeValueFormatter, UserInputAttributeValueParser
} from '../src/shared/attributes';
import { COLLECTIONS } from '../src/shared/constants';
import { map } from 'lodash';

/**
 * Tests that handleKeyValuePairs can properly handle a list of keys that may contain
 * the same key multiple times, multiple keys at once, etc.
 */
describe('AttributesManager: Test handleEvents', () => {
  let sandbox;
  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(async () => {
    sandbox.restore();
  });

  it('Test handling non-repeating keys', async () => {
    const mgr = new AttributesManager();

    // Mock AttributeManager.getRobotVitalsConfig so that it always returns an attribute
    // equal to the key provided
    sandbox.stub(mgr, 'getRobotVitalsConfig').callsFake(() => ({
      findAttributeIdMappedTo: (source, mappingObject) => mappingObject && mappingObject.key
    }));
    // Mock saveAttributeValues to capture how messages are getting processed
    // Save each batch of attributeValues in the array
    const receivedUpdates = [];
    sandbox.stub(mgr, 'saveAttributeValues').callsFake(({ attributeValues }) => {
      receivedUpdates.push(attributeValues);
    });
    // Get input from fixtures
    const { robotId, customDataInput1 } = fixtures;
    const { pairs, customField } = customDataInput1;
    // Process them
    await mgr.handleEvents({ robotId, customField }, pairs);
    // There should be a single update with two entries
    assert.equal(receivedUpdates.length, 1);
    assert.equal(Object.keys(receivedUpdates[0]).length, 2);
    // The first two keys should be on the first update
    const [{ key: k0, value: v0 }, { key: k1, value: v1 }] = pairs;
    assert.equal(receivedUpdates[0][k0].value, v0);
    assert.equal(receivedUpdates[0][k1].value, v1);
  });

  it('Test handling of repeating keys', async () => {
    const mgr = new AttributesManager();
    // Mock AttributeManager.getRobotVitalsConfig so that it always returns an attribute
    // equal to the key provided
    sandbox.stub(mgr, 'getRobotVitalsConfig').callsFake(() => ({
      findAttributeIdMappedTo: (source, mappingObject) => mappingObject && mappingObject.key
    }));
    // Mock saveAttributeValues to capture how messages are getting processed
    // Save each batch of attributeValues in the array
    const receivedUpdates = [];
    sandbox.stub(mgr, 'saveAttributeValues').callsFake(({ attributeValues }) => {
      receivedUpdates.push(attributeValues);
    });
    // Get input from fixtures
    const { robotId, customDataInput2 } = fixtures;
    const { pairs, customField } = customDataInput2;
    // Process them
    await mgr.handleEvents({ robotId, customField }, pairs);
    // There should be two updates, one with two messages and one with one
    assert.equal(receivedUpdates.length, 2);
    assert.equal(Object.keys(receivedUpdates[0]).length, 2);
    assert.equal(Object.keys(receivedUpdates[1]).length, 1);
    // The first two keys should be on the first update
    const [{ key: k0, value: v0 }, { key: k1, value: v1 }, { key: k2, value: v2 }] = pairs;
    assert.equal(receivedUpdates[0][k0].value, v0);
    assert.equal(receivedUpdates[0][k1].value, v1);
    // The last key should be on the last update
    assert.equal(receivedUpdates[1][k2].value, v2);
  });

  it('Stores ROS monitoring updates', async () => {
    const mgr = new AttributesManager();
    const ts = 123456;
    // Mock AttributeManager.getRobotVitalsConfig so that it finds the attribute from the
    // fixtures, not from the DB
    const { rosMonitoringMappingMock } = fixtures;
    const fakeConfig = {
      findAttributeIdMappedTo: (source, { type, key }) => (
        rosMonitoringMappingMock[type] && rosMonitoringMappingMock[type][key]
      )
    }
    sandbox.stub(mgr, 'getRobotVitalsConfig').callsFake(() => fakeConfig);
    // Stub saveAttributeValues, we only test as far as getting called to store someknown values
    sandbox.stub(mgr, 'saveAttributeValues');
    // Get input from fixtures
    const { robotId, rosMonitoringInput } = fixtures;
    // Process them
    await mgr.saveAttributesFromMappings({
      robotId,
      source: SOURCES.ROS_MONITOR.value,
      updates: rosMonitoringInput,
      ts
    });
    // There should be a single update with four entries (note that one of the monitoring
    // updates did not map to any attribute)
    sandbox.assert.calledOnce(mgr.saveAttributeValues);
    // Assert the values of the attribute updates are correct
    sandbox.assert.calledWith(mgr.saveAttributeValues, {
      attributeValues: {
        attrCameraRate: { value: 4.5 },
        attrDistro: { value: 'noetic' },
        attrPing: { value: 1.1 },
        attrScanRate: { value: 20 }
      },
      robotId,
      ts,
      config: fakeConfig
    });
  });
});

describe('AttributesManager: AttributeValueParser', () => {
  it('Parses various forms of numbers', async () => {
    const parser = new AttributeValueParser();
    assert.equal(parser('5'), 5);
    assert.equal(parser('-5'), -5);
    assert.equal(parser('0050'), 50);
    const parser2 = new AttributeValueParser({ unit: 'km' });
    assert.equal(parser2('5'), 5);
    assert.equal(parser2('0050'), 50);
    assert.equal(parser2('42km'), 42);
    assert.equal(parser2('-42km'), -42);
  });

  it('Does not scale percentages by default', async () => {
    // Note this test, even if trivial, asserts that percentages are no longer downscaled 100x by
    // default from their original value -- as it was until Nov'22
    const parser = new AttributeValueParser({ unit: '%' });
    assert.equal(parser('50'), 50); // originally, "50" would become 0.5
  });

  it('Scales values with units', async () => {
    // Note: scaling percentages by 0.01 is no longer a default since Nov'22 (see previous test)
    // so it needs to be explicit as with scaling with any other unit
    const parserPercent = new AttributeValueParser({ unit: '%', scale: 0.01 });
    assert.equal(parserPercent('50'), 0.50);
    const parserKm = new AttributeValueParser({ unit: 'km', scale: 1000 });
    assert.equal(parserKm('5km'), 5000);
  });

  it('Scale values if specified in attribute definition', async () => {
    const parser = new AttributeValueParser({ scale: 0.01 });
    assert.equal(parser('5'), 0.05);
  });

  it('Parses boolean values', async () => {
    assert.equal(new AttributeValueParser()('True'), true);
    assert.equal(new AttributeValueParser()('fAlsE'), false);
  });

  it('Leaves Strings unmodified', async () => {
    assert.deepStrictEqual(new AttributeValueParser()('hello'), 'hello');
    // quoted strings get their quotes removed
    assert.deepStrictEqual(new AttributeValueParser()('"hello"'), 'hello');
    assert.deepStrictEqual(new AttributeValueParser()('\'hello\''), 'hello');
    // spaces are removed too from quoted strings
    assert.deepStrictEqual(new AttributeValueParser()('     "hello"  \n  '), 'hello');
  });

  it('Parses JSON values if configured', async () => {
    const jsonStr = '{ "x": 1 }';
    assert.deepStrictEqual(new AttributeValueParser({ type: 'json' })(jsonStr), { x: 1 });
    assert.equal(new AttributeValueParser()(jsonStr), jsonStr); // not parsed; no 'type'
    assert.equal(new AttributeValueParser({ type: 'json' })('not json'), undefined); // not parsed
  });

  it('Parses YAML values if configured', async () => {
    const yamlStr = 'a:\n  b: 1';
    assert.deepStrictEqual(
      new AttributeValueParser({ type: 'yaml' })(yamlStr),
      { a: { b: 1 } }
    );
    assert.equal(new AttributeValueParser()(yamlStr), yamlStr); // not parsed, no 'type'
    // assert.equal(
    //   new AttributeValueParser({ type: 'yaml' })('not yaml'),
    //   undefined
    // ); // not parsed
  });
});

describe('AttributesManager: UserInputAttributeValueParser', () => {
  // This test exercises value parsing for numbes coming from user input. The
  // UserInputAttributeValueParser should work the same as AttributeValueParser (used by ingest)
  // except that it ignores scaling, and always applies the scale we expect for percengages
  // (they need to be in range [0..1])
  it('Parses user input without scaling', async () => {
    const parser = new UserInputAttributeValueParser();
    assert.equal(parser('5'), 5);
    assert.equal(parser('-5'), -5);
    assert.equal(parser('0050'), 50);
    const parser2 = new UserInputAttributeValueParser({ unit: 'km' });
    assert.equal(parser2('5'), 5);
    assert.equal(parser2('-42km'), -42);
    const parser3 = new UserInputAttributeValueParser({ unit: 'km', scale: 1000 });
    assert.equal(parser3('5'), 5);
    assert.equal(parser3('42km'), 42);
  });

  it('Parses user input for percentages', async () => {
    const parser1 = new UserInputAttributeValueParser({ unit: '%' });
    assert.equal(parser1('5%'), 0.05);
    assert.equal(parser1('99'), 0.99);
    const parser2 = new UserInputAttributeValueParser({ unit: '%', scale: 1234 });
    assert.equal(parser2('5%'), 0.05);
    assert.equal(parser2('99'), 0.99);
  });
});

describe('AttributesManager: AttributeValueFormatter', () => {
  it('Formats numbers', async () => {
    const fmt = new AttributeValueFormatter();
    assert.equal(fmt(0.001), '0.001');
    assert.equal(fmt(-5), '-5');
    assert.equal(fmt(50), '50');
  });

  it('Formats numbers with units', async () => {
    const fmtKm = new AttributeValueFormatter({ unit: 'km' });
    assert.equal(fmtKm(0), '0km');
    assert.equal(fmtKm(42), '42km');
    assert.equal(fmtKm(-42), '-42km');
  });

  it('Formats numbers with precision', async () => {
    const defaultFmt = new AttributeValueFormatter(); // default: 3 decimal digits
    assert.equal(defaultFmt(60000), '60,000');
    assert.equal(defaultFmt(0.6), '0.6');
    assert.equal(defaultFmt(0.06), '0.06');
    assert.equal(defaultFmt(0.006), '0.006');
    assert.equal(defaultFmt(0.0006), '0.001'); // not enough precision to represent it, rounded
    const preciseFmt = new AttributeValueFormatter({ precision: 5 });
    assert.equal(preciseFmt(0.6), '0.6');
    assert.equal(preciseFmt(0.06), '0.06');
    assert.equal(preciseFmt(0.006), '0.006');
    assert.equal(preciseFmt(0.0006), '0.0006');
    assert.equal(preciseFmt(0.00006), '0.00006');
    assert.equal(preciseFmt(0.000006), '0.00001');
  });

  it('Formats with scaling (and percentages)', async () => {
    const scaledFmt = new AttributeValueFormatter({ scale: 0.01 });
    assert.equal(scaledFmt(6), '6'); // scale is ignored, only used when parsing!
    // percentages are no longer scaled by default (Nov'22)
    const defaultPercentFmt = new AttributeValueFormatter({ unit: '%' });
    assert.equal(defaultPercentFmt(1), '100%');
    // formatting ignores the scale; it is about *stored* values (already scaled)
    const scaledPercentFmt = new AttributeValueFormatter({ unit: '%', scale: 1 });
    assert.equal(scaledPercentFmt(1), '100%');
  });

  it('Formats strings', async () => {
    const defaultFmt = new AttributeValueFormatter();
    assert.equal(defaultFmt('a string'), 'a string');
  });

  it('Formats json objects', async () => {
    const defaultFmt = new AttributeValueFormatter({ type: 'json' });
    assert.equal(defaultFmt('a string'), 'a string');
  });
});

describe('DerivedAttributesConfig', () => {
  it('Computes dependencies for getValue', async () => {
    const attrsConfig = {
      derived0: {
        mapping: {
          source: 'derived',
          transform: 'getValue("attr0")'
        }
      }
    };
    const config = new DerivedAttributesConfig(attrsConfig);
    const deps = config.getDerivedAttributeDependencies('derived0');
    assert.deepStrictEqual(deps.attributeIds, new Set(['attr0']));
    assert.equal(deps.time || false, false);
    assert.equal(deps.tags, undefined);
  });

  ['visitedAreaSide', 'visitedAreaDiagonal'].forEach((fnName) => {
    it(`Computes dependencies for ${fnName}`, async () => {
      const attrsConfig = {
        derived0: {
          mapping: {
            source: 'derived',
            transform: `${fnName}(10)`
          }
        }
      };
      const config = new DerivedAttributesConfig(attrsConfig);
      const deps = config.getDerivedAttributeDependencies('derived0');
      assert.deepStrictEqual(deps.attributeIds, new Set(['cpuLoadPercentage']));
      assert.equal(deps.time, true);
      assert.equal(deps.tags, undefined);
    });
  });

  ['minValue', 'maxValue', 'meanValue'].forEach((agg) => {
    it('Computes dependencies for ' + agg, async () => {
      const attrsConfig = {
        derived0: {
          mapping: {
            source: 'derived',
            transform: `${agg}("attr0", 10)`
          }
        }
      };
      const config = new DerivedAttributesConfig(attrsConfig);
      const deps = config.getDerivedAttributeDependencies('derived0');
      assert.deepStrictEqual(deps.attributeIds, new Set([
        'attr0',
        // HACK(herchu) Remove when hack is _getDerivedAttributeDependencies is undone
        'cpuLoadPercentage'
      ]));
      assert.equal(deps.time, true);
      assert.equal(deps.tags, undefined);
    });
  });

  it('Compute dependent derived attributes', async () => {
    const attrsConfig = {
      attr1: { 
        definition: { label: 'attr1' },
        mapping: { key: 'example', source: 'key-value' },
      },
      attr2: {
        definition: { label: 'attr2' },
        mapping: { key: 'example', source: 'key-value' },
      },
      attr3: {
        definition: { label: 'attr3' },
        mapping: { key: 'example', source: 'key-value' },
      },
      derived1: {
        definition: { label: 'derived1' },
        mapping: {
          source: 'derived',
          attributeIds: ['attr1', 'attr2'],
          transform: 'args[0] + args[1]'
        },
      },
      derived2: {
        definition: { label: 'derived2' },
        mapping: {
          source: 'derived',
          attributeIds: ['attr1', 'derived1'],
          transform: 'args[0] + args[1]'
        }
      },
    };
    const config = new DerivedAttributesConfig(attrsConfig);
    assert.deepStrictEqual(config.getDependentDerivedAttributes('attr1'), new Set(['derived1', 'derived2']));
    assert.deepStrictEqual(config.getDependentDerivedAttributes('attr2'), new Set(['derived1']));
    assert.deepStrictEqual(config.getDependentDerivedAttributes('attr3'), new Set());
    assert.deepStrictEqual(config.getDependentDerivedAttributes('derived1'), new Set(['derived2']));
    assert.deepStrictEqual(config.getDependentDerivedAttributes('derived2'), new Set());
  });

  it('Compute derived attributes dependencies from an expression', async () => {
    const attrsConfig = {
      attr1: { 
        definition: { label: 'attr1' },
        mapping: { key: 'example', source: 'key-value' },
      },
      attr2: {
        definition: { label: 'attr2' },
        mapping: { key: 'example', source: 'key-value' },
      },
      attr3: {
        definition: { label: 'attr3' },
        mapping: { key: 'example', source: 'key-value' },
      },
      derived1: {
        definition: { label: 'derived1' },
        mapping: {
          source: 'derived',
          // NOTE: visitedAreaSide will add 'pose' as dependency
          transform: 'getValue("attr1") + getValue("attr2") + visitedAreaSide(100)'
        },
      },
      derived2: {
        definition: { label: 'derived2' },
        mapping: {
          source: 'derived',
          filter: 'getValue("attr3") > 0',
          // NOTE: meanValue/maxValue/minValue add add 'time' dependency, and hasTag adds 'foo' tag
          transform: 'getValue("der1") + meanValue(\'der2\', 1) + maxValue("der3", 1) + minValue("der4", 3)'
        }
      },
    };
    const config = new DerivedAttributesConfig(attrsConfig);
    assert.deepStrictEqual(
      config.getDerivedAttributeDependencies('derived1'),
      {
        attributeIds: new Set(['attr1', 'attr2', 'cpuLoadPercentage']),
        time: true
      }
    );
    assert.deepStrictEqual(
      config.getDerivedAttributeDependencies('derived2'),
      {
        attributeIds: new Set([
          'der1', 'der2', 'der3', 'der4', 'attr3',
          // HACK(herchu) Remove when hack is _getDerivedAttributeDependencies is undone
          'cpuLoadPercentage'
        ]),
        time: true
      }
    );
  });
});

/**
 * Tests for ROS Diagnostics key-value mapping. Diagnostics values are matched to
 * attributes by their source node name (namespace) plus key, so two nodes exposing
 * the same key resolve to different attributes.
 */
describe('RobotVitalsConfig: ROS Diagnostics namespace mapping', () => {
  const ROS_DIAG = SOURCES.ROS_DIAGNOSTICS.value;

  // Two nodes ('nodeA', 'nodeB') both expose key 'rate'; a third attribute maps
  // 'rate' with no namespace at all (legacy-style mapping).
  const buildConfig = () => new RobotVitalsConfig('robot-1', {
    attrRateA: { definition: {}, mapping: { source: ROS_DIAG, namespace: 'nodeA', key: 'rate' } },
    attrRateB: { definition: {}, mapping: { source: ROS_DIAG, namespace: 'nodeB', key: 'rate' } },
    attrOtherSource: { definition: {}, mapping: { source: SOURCES.KEY_VALUE.value, key: 'rate' } }
  });

  it('resolves the same key under different namespaces to different attributes', () => {
    const config = buildConfig();
    assert.equal(config.findAttributeIdMappedTo(ROS_DIAG, { namespace: 'nodeA', key: 'rate' }), 'attrRateA');
    assert.equal(config.findAttributeIdMappedTo(ROS_DIAG, { namespace: 'nodeB', key: 'rate' }), 'attrRateB');
  });

  it('does not match a namespace that has no mapping', () => {
    const config = buildConfig();
    assert.equal(config.findAttributeIdMappedTo(ROS_DIAG, { namespace: 'nodeC', key: 'rate' }), undefined);
  });

  it('does not cross source types', () => {
    const config = buildConfig();
    // 'rate' exists under KEY_VALUE too, but a ROS_DIAGNOSTICS lookup must not return it.
    assert.equal(config.findAttributeIdMappedTo(SOURCES.KEY_VALUE.value, { key: 'rate' }), 'attrOtherSource');
    assert.equal(config.findAttributeIdMappedTo(ROS_DIAG, { namespace: 'nodeA', key: 'wrong' }), undefined);
  });

  it('matches a namespace-less mapping against any node (escape-hatch behavior)', () => {
    // A mapping without a namespace matches the key from any node. This is the
    // documented fallback; namespace disambiguation only applies when the mapping
    // itself defines a namespace.
    const config = new RobotVitalsConfig('robot-1', {
      attrLegacy: { definition: {}, mapping: { source: ROS_DIAG, key: 'rate' } }
    });
    assert.equal(config.findAttributeIdMappedTo(ROS_DIAG, { namespace: 'anyNode', key: 'rate' }), 'attrLegacy');
  });
});

/**
 * Tests that saveAttributesFromMappings resolves ROS Diagnostics key-values
 * (flattened as { value, namespace, key }) end-to-end against a real config.
 */
describe('AttributesManager: saveAttributesFromMappings for ROS Diagnostics', () => {
  let sandbox;
  beforeEach(() => { sandbox = sinon.createSandbox(); });
  afterEach(() => { sandbox.restore(); });

  it('maps namespaced diagnostics updates to the right attributes', async () => {
    const ROS_DIAG = SOURCES.ROS_DIAGNOSTICS.value;
    const mgr = new AttributesManager();
    const ts = 987654;
    // Real RobotVitalsConfig so findAttributeIdMappedTo runs for real.
    const config = new RobotVitalsConfig('robot-1', {
      attrBatteryPct: { definition: {}, mapping: { source: ROS_DIAG, namespace: 'battery', key: 'battery_percentage' } },
      attrScanRate: { definition: {}, mapping: { source: ROS_DIAG, namespace: 'scan_freshness', key: 'scan_rate_hz' } }
    });
    sandbox.stub(mgr, 'getRobotVitalsConfig').callsFake(() => config);
    sandbox.stub(mgr, 'saveAttributeValues');

    await mgr.saveAttributesFromMappings({
      robotId: 'robot-1',
      source: ROS_DIAG,
      updates: [
        { value: '80.9', namespace: 'battery', key: 'battery_percentage' },
        { value: '11', namespace: 'scan_freshness', key: 'scan_rate_hz' },
        // Unmapped namespace+key pair: should be ignored, not throw.
        { value: 'x', namespace: 'nav2_lifecycle', key: 'map_server' }
      ],
      ts
    });

    sandbox.assert.calledOnce(mgr.saveAttributeValues);
    sandbox.assert.calledWith(mgr.saveAttributeValues, sinon.match({
      attributeValues: {
        attrBatteryPct: { value: '80.9' },
        attrScanRate: { value: '11' }
      },
      ts
    }));
  });
});

