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
 * Unit tests for DeltaInt encoding/decoding functions.
 *
 * This is our JS implementation for the same encoding implemented in Python (agent code:
 * array_util.py).
 */
import assert from 'assert';

import {
  deltaIntEncode, deltaIntDecode, deltaIntEncodePoints, deltaIntDecodePoints
} from '../src/shared/arrayUtil';

describe('DeltaInt encoding functions', () => {
  it('encodes and decodes with moderate error', () => {
    const bits = 10;
    const values = [1.23, 1.111, 1.245, 1.24500005, 2];
    const encoded = deltaIntEncode(values, bits);
    assert.strictEqual(values.length, encoded.deltas.length);
    assert.strictEqual(encoded.exponent > 0, true);
    const decodedValues = deltaIntDecode(encoded);
    assert.strictEqual(values.length, decodedValues.length);
    for (let i = 0; i<values.length; i++) {
      const diff = Math.abs(values[i] - decodedValues[i]);
      assert.strictEqual(diff < 0.001, true);
    }
  });

  it('encodes big numbers with few bits and small relative errors', () => {
    const bits = 6;
    const values = [9000000, 9001000, 8999000, 9001005, 9001020, 9000888];
    const encoded = deltaIntEncode(values, bits);
    assert.strictEqual(values.length, encoded.deltas.length);
    assert.strictEqual(encoded.exponent < 0, true);
    const decodedValues = deltaIntDecode(encoded);
    assert.strictEqual(values.length, decodedValues.length);
    for (let i = 0; i<values.length; i++) {
      const diff = Math.abs(values[i] - decodedValues[i]);
      assert.strictEqual(diff < 15, true);
    }
  });

  it('encodes and decodes using many bits for small absolute error', () => {
    const bits = 25;
    const values = [1.23, 1.111, 1.245, 1.24500005, 2];
    const encoded = deltaIntEncode(values, bits);
    assert.strictEqual(values.length, encoded.deltas.length);
    assert.strictEqual(encoded.exponent > 0, true);
    const decodedValues = deltaIntDecode(encoded);
    assert.strictEqual(values.length, decodedValues.length);
    for (let i = 0; i < values.length; i++) {
      const diff = Math.abs(values[i] - decodedValues[i]);
      assert.strictEqual(diff < 0.00000001, true);
    }
  });

  it('handles edge cases', () => {
    // encode and decode an empty list
    const encoded1 = deltaIntEncode([], 5);
    const decoded1 = deltaIntDecode(encoded1);
    assert.strictEqual(decoded1.length, 0);
    // encode and decode 1-element list
    const encoded2 = deltaIntEncode([128], 5);
    const decoded2 = deltaIntDecode(encoded2);
    assert.strictEqual(decoded2.length, 1);
    assert.strictEqual(decoded2[0], 128);
    // encode and decode several identical numbers
    const encoded3 = deltaIntEncode([4, 4, 4, 4, 4], 5);
    const decoded3 = deltaIntDecode(encoded3);
    assert.strictEqual(decoded3.length, 5);
    decoded3.every(x => x == 4);
  });

  it('encodes lists of points', () => {
    const values = [{ x: 7, y: 1238 }, { x: 7.5, y: 1236 }, { x: 7.4, y: 1245 }];
    // encode and decode an empty list
    const encoded = deltaIntEncodePoints(values);
    const decoded = deltaIntDecodePoints(encoded.xs, encoded.ys);
    for (let i = 0; i < values.length; i++) {
      const dx = Math.abs(values[i].x - decoded[i].x);
      assert.strictEqual(dx < 0.0001, true);
      const dy = Math.abs(values[i].y - decoded[i].y);
      assert.strictEqual(dy < 0.1, true);
    }
  });
});
