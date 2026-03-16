/**
 * The delta_int_* functions below implement our "DeltaInt" encoding:
 * Used to encode arrays of floating point numbers which are relatively close to each other
 * in a more integer-friendly form, with minimal precision loss.
 *
 * This encoding allows serializing values in protobuf in a much more compact precision
 * than floats, as small integers (protobuf: signed ints, `sint32`) use fewer bits
 * (proportional to log2(x)), while floats always use 32 bits (or 64 for double precision).
 *
 * See more details in agent code: array_util.py
 */
/* eslint-disable no-bitwise */
import { zipWith, maxBy, mean } from 'lodash';

/**
 * Encode a list of floating point values in DeltaInt form (see this file's header).
 *
 * The return value is a 3-element tuple:
 *  - A float `anchor`
 *  - A list of integer `deltas` (as a difference from `anchor`), scaled up or down by a given
 *    power of 2: 2^p
 *  - An exponent `p` which determines how to scale `deltas` back.
 *    This exponent is set to be 0. The return value 0 is reserved to represent an empty
 *    input array (since protobuf cannot represent None or null values)
 *
 * Argument max_bits controls how many significant bits are kept to represent each
 * output integer (the deltas). The higher maxBits value, the more precision is obtained
 * when decoding values. But also, the deltas will be larger numbers, meaning their
 * protobuf encoding will occupy more bits (roughly: maxBits).
 */
const deltaIntEncode = (values, maxBits = 15) => {
  // When the input is an empty array, skip all the math below
  if (!values.length) {
    return { anchor: 0, deltas: [], exponent: 0 };
  }
  // The anchor is chosen to generate small distances to all other values
  const anchor = mean(values); // JS numbers are "Number", no need to cast to float
  // Estimate the maximum magnitude to represent, as the difference between
  // the minimum and maximum deltas.
  const magnitude = Math.abs(maxBy(values, v => Math.abs(v - anchor)) - anchor);
  // Find the exponent that brings values closest to 2^max_bits
  const power = 1 << maxBits;
  let exponent;
  let scale;
  if (magnitude <= 0) {
    scale = 0;
    exponent = 0;
  } else if (power > magnitude) {
    // Max value is less than 2^max_bits, so we will scale up numbers before casting to int
    exponent = 1;
    while (power > magnitude * (1 << exponent)) {
      exponent += 1;
    }
    scale = 1 << exponent;
  } else {
    // Max value is greater than 2^max_bits, so we will scale down numbers before casting to int
    exponent = -1;
    while (power < magnitude / (1 << -exponent)) {
      exponent -= 1;
    }
    scale = 1 / (1 << -exponent);
  }
  // Finally scale up (or down) all deltas with multiplying or dividing by 2^abs(exponent)
  return { anchor, deltas: values.map(x => Math.round((x - anchor) * scale)), exponent };
};

/**
 * Decodes a DeltaInt encoding (see above) given as a tuple back into an float array.
 */
const deltaIntDecode = ({ anchor, deltas, exponent }) => {
  // Determine scaling used and re-build deltas with scaling and adding back
  // the anchor value to become points.
  // This up- or down-scales values depending if exponent is greater or less than 0
  // eslint-disable-next-line no-bitwise
  const scale = exponent > 0 ? (1 << exponent) : 1 / (1 << -exponent);
  return deltas.map(d => d / scale + anchor);
};

/**
 * Encodes a list of points with .x, .y (they may be ROS Pose objects) using DeltaInt
*/
const deltaIntEncodePoints = (points, max_bits = 10) => {
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  return { xs: deltaIntEncode(xs, max_bits), ys: deltaIntEncode(ys, max_bits) };
};

/**
 * Decodes two DeltaInt encodings (see above) of the same length into a list of pairs (x, y).
 */
const deltaIntDecodePoints = (encodedXs, encodedYs) => {
  const xs = deltaIntDecode(encodedXs);
  const ys = deltaIntDecode(encodedYs);
  return zipWith(xs, ys, (x, y) => ({ x, y }));
};

export {
  deltaIntDecode,
  deltaIntEncode,
  deltaIntEncodePoints,
  deltaIntDecodePoints
};
