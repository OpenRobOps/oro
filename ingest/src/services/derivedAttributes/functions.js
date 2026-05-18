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
 * Functions for our expressions language.
 *
 * Each function should be of the form `context => args => (result)`,
 * where `context` contains several values that some functions can use:
 *  - robotId
 *  - attributeKeyValues: attribute values already retrieved for this robot
 *  - ts: the "now" argument to fix all evaluation to an exact timestamp
 *
 * Note that all functions can have their own "caching" so that calling them with the same
 * arguments (or even with different arguments, but on the same context or robot) might return
 * the same results without re-evaluating the values from the DB (mongodb, timeseries, etc.).
 */
import { isNumber, isObject, isArray, isString, keyBy, isEmpty } from 'lodash';
// ORO modules
import { VITAL_POSE } from '../../shared/attributes';
import RobotDerivedAttributesDataProvider from './dataProvider';

const ONE_DAY_IN_SECONDS = 86400;

/**
 * get() is a function to get values from an object (or array): `get(obj, "a")` is the
 * equivalent in our language to a JS' `obj["a"]`.
 * While the expressions language also support doing `obj.a`, this function is more flexible
 * allowing:
 *  - arbitrary leys (with spaces, passing variables etc)
 *  - specifying a default value in the 3rd parameter
 *
 * If the key does not exist, or the value is not an object, it returns the given defaultValue,
 * or null.
 */
const fnGet = () => (value, key, defaultValue = null) => {
  if ((isObject(value) || isArray(value)) && key in value) {
    return value[key];
  } else {
    return defaultValue;
  }
};

/**
 * angularDistance() returns the distance between two angles (in radians).
 * The result represents the angle that should be added to the first angle to get the second one,
 * or how much a robot should turn to get to the second angle. Positive for clockwise turns,
 * and negative for counterclockwise turns, always returning the direction with the least
 * absolute value.
 *
 * Either of them can be negative or greater than 2*PI, but the result will always be in
 * range [-PI, PI].
 *
 * Note that if a user only cares about the absolute difference between the two angles ("is it
 * small?") then one should take the absolute value of the result.
 *
 * If one of the arguments is not a number, the result is null.
 */
const fnAngularDistance = () => (a, b) => {
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return null;
  }
  const PI2 = Math.PI * 2;
  // Focus on the diff; discard a
  let diff = b - a;
  // Normalize diff in [0, 2*PI). Note that negative module arithmetic in JS is tricky
  diff %= PI2;
  if (diff < 0) {
    diff = PI2 + diff;
  }
  // Now normalize in [-PI, PI], with the correct sign (direction)
  if (diff > Math.PI) {
    diff = -PI2 + diff;
  }
  return diff;
};

// Implementation for function `getValue` in derived attributes evaluation
// Returns the attribute value if it exists or a string error if it doesn't
const getValue = ({ attributeValues = {} }) => async (attributeId) => (
  attributeValues[attributeId] && ('value' in attributeValues[attributeId])
    ? attributeValues[attributeId].value : null
);

// Implementation for function `getValueAgeMs` in derived attributes evaluation
// Returns the time (in ms) since the attribute was updated for the last time
const getValueAgeMs = ({ attributeValues = {}, ts }) => async (attributeId) => (
  attributeValues[attributeId] && ('ts' in attributeValues[attributeId])
    ? ts - attributeValues[attributeId].ts : null
);

/**
 * withVisitedAreaBoundingBox is a higher level function to build functions that calculate results
 * using the bounding box of robot positions in the last N seconds.
 *
 * It is used to implement visitedAreaSide() and visitedAreaDiagonal()
 *
 * It operates on a "last N seconds" window. The "now" value is Date.now() by default,
 * unless a `ts` is specified.
 */
const withVisitedAreaBoundingBox = (resultFn) => ({
  robotId,
  ts,
  dataProvider = new RobotDerivedAttributesDataProvider()
}) => {
  if (!robotId) {
    throw new Error('visitedAreaSide requires a robotId');
  }
  return async (seconds) => {
    if (!isNumber(seconds) || seconds <= 0 || seconds > ONE_DAY_IN_SECONDS) {
      return undefined;
    }

    const nowTs = Date.now();
    const result = await dataProvider.getVisitedAreaBoundingBox({
      robotId,
      startTs: nowTs - seconds * 1000,
      endTs: nowTs
    });

    if (isEmpty(result)) {
      // If no data is found (or if the robot changed frameIds) then a bounding box does not exist.
      return undefined;
    }
    const { minX, minY, maxX, maxY } = result;
    return resultFn({ minX, minY, maxX, maxY, ts, seconds });
  };
};

/**
 * visiteadAreaSide returns the longest side length of the bounding box of robot poses over
 * the last N seconds.
 *
 * The design and detailed semantics of this function are described here:
 * https://docs.google.com/document/d/1ieJJfI6elHW5YbgF6OpSimY_NBGNrrDaScSg-Vi5-9I/edit#heading=h.57bkn7v5ezv3
 */
const visitedAreaSide = withVisitedAreaBoundingBox(({ minX, minY, maxX, maxY }) => {
  // if any of of arguments is not a number, then so is deltaX or deltaY
  const deltaX = maxX - minX;
  const deltaY = maxY - minY;
  return isNumber(deltaX) && isNumber(deltaY) ? Math.max(deltaX, deltaY) : undefined;
});

/**
 * visiteadAreaDiagonal returns the diagonal length of the bounding box of robot poses over
 * the last N seconds.
 *
 * The design and detailed semantics of this function are described here:
 * https://docs.google.com/document/d/1ieJJfI6elHW5YbgF6OpSimY_NBGNrrDaScSg-Vi5-9I/edit#heading=h.57bkn7v5ezv3
 */
const visitedAreaDiagonal = withVisitedAreaBoundingBox(({ minX, minY, maxX, maxY }) => {
  // if any of of arguments is not a number, then so is deltaX or deltaY
  const deltaX = maxX - minX;
  const deltaY = maxY - minY;
  return isNumber(deltaX) && isNumber(deltaY)
    ? Math.sqrt(deltaX * deltaX + deltaY * deltaY)
    : undefined;
});

/**
 * inRectangleArea determines if robot's current pose is within a rectangle defined by two
 * opposite corners (x0,y0)-(x1,y1). The frameId, if given (it is optional) must match the
 * current pose's frameId.
 *
 * As this function is based on the robot pose, it must add VITAL_POSE as dependency, which causes
 * it to be pre-fetched and provided through attributeKeyValues (so this function is not
 * really async, although the fetching of pose data is).
 */
const inRectangleArea = ({ robotId, attributeValues }) => {
  if (!robotId) {
    throw new Error('inRectangleArea requires a robotId');
  }
  return (x0, y0, x1, y1, frameId) => {
    const pose = attributeValues && attributeValues[VITAL_POSE]
      && attributeValues[VITAL_POSE].value;
    if (!pose) {
      return null;
    }
    const minX = Math.min(x0, x1);
    const maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1);
    const maxY = Math.max(y0, y1);
    // Test the current pose is in the rectangle defined by (x0,y0)-(x1,y1) and either the
    // frameId matches too (unless it is omitted)
    return (!frameId || frameId == pose.frameId)
      && minX <= pose.x && pose.x <= maxX && minY <= pose.y && pose.y <= maxY;
  };
};

/**
 * Helper function builder for isRobotInZone() and isZoneOccupied().
 * It follows the pattern for expression function builders, and it caches the robot information
 * (collections, location). It returns the list of robotIds in the given zone.
 */
const withRobotsInZoneHelper = (robotId) => {
  // This is a placeholder
  return null; 
};

/**
 * Returns the function to determine if the current robot is inside a zone:
 *    isRobotInZone(<zoneId>, [<locationId>])
 * The location argument is optional, and when omitted the zoneId refers to a zone in the current
 * robot's location.
 *
 * @returns {Boolean}
 */
const isRobotInZone = ({ robotId }) => {
  if (!robotId) {
    throw new Error('isRobotInZone requires a robotId');
  }
  const robotsInZoneHelper = withRobotsInZoneHelper(robotId);
  return async (zoneId, locationId) => {
    const robotIdsInZone = await robotsInZoneHelper(zoneId, locationId);
    return Array.isArray(robotIdsInZone) ? robotIdsInZone.includes(robotId) : false;
  };
};

/**
 * Returns the function to determine if a zone is currently occupied or contains any robots.
 *    isZoneOccupied(<zoneId>, [<locationId>])
 * The location argument is optional, and when omitted the zoneId refers to a zone in the current
 * robot's location.
 * It returns a boolean (occupied or not) if the zone exists; or undefined otherwise.
 *
 * @returns {Boolean}
 */
const isZoneOccupied = ({ robotId }) => {
  if (!robotId) {
    throw new Error('isZoneOccupied required a robotId');
  }
  const robotsInZoneHelper = withRobotsInZoneHelper(robotId);
  return async (zoneId, locationId) => {
    const robotIdsInZone = await robotsInZoneHelper(zoneId, locationId);
    return robotIdsInZone ? robotIdsInZone.length > 0 : undefined;
  };
};

/**
 * Returns a function that aggregates the values of an attribute on a "last seconds" window.
 *
 * @param {string} aggFuncName an aggregation function e.g. min, max, mean, etc.
 * @param {function} resultFunc a function to process the results as returned from the
 *  RobotDerivedAttributesDataProvider.aggregateAttribute function, and turns them into the result
 *  of this InOrbit function. If not given, it is assumed that the query returns only one point
 *  with one column, which becomes the result.
 * @param {number} limit The limit for points in the result. If not provided, the limit is imposed
 *  by the RobotDerivedAttributesDataProvider class.
 * @return a function that returns another function that does the query to DB through the data
 *  provider class and returns the value. The function signature is:
 * ({ robotId, dataProvider }) => (attributeId, seconds) => { ... }
 */
const aggregateTimeseriesAttribute = ({ aggFuncName, resultFunc = null, limit = null }) => ({
  robotId, dataProvider = new RobotDerivedAttributesDataProvider()
}) => {
  if (!robotId) {
    throw new Error('robotId is required');
  }
  return async (attributeId, seconds) => {
    if (!isNumber(seconds) || seconds <= 0 || seconds > ONE_DAY_IN_SECONDS) {
      throw new Error('seconds must be a positive number within the last 24 hours');
    }
    if (!isString(attributeId)) {
      throw new Error('attributeId must be a string');
    }

    const nowTs = Date.now();
    const result = await dataProvider.aggregateAttribute({
      robotId,
      attributeId,
      aggFuncName,
      resultFunc,
      limit,
      startTs: nowTs - seconds * 1000,
      endTs: nowTs
    });
    return result;
  };
};

/**
 * Implementation for match() function.
 * As this function does not need any context, there is no need to do currying on its arguments,
 * and we can always reuse the same function object (in the implementation regexpMatch below).
 *
 * @returns {bool|Array} false when there is no match or a list of matches
 */
const regexpMatchImpl = (reStr, value) => {
  let re;
  try {
    re = new RegExp(reStr);
  } catch (e) {
    // Ignore, there is no error reporting. Just return no value (must be a falsy value)
    return false;
  }
  if (!isString(value)) {
    // Cannot evaluate either; no match
    return false;
  }
  return value.match(re) || false;
};
const regexpMatch = () => regexpMatchImpl;

// Argument types for functions
const TYPE_STRING = 'string';
const TYPE_NUMBER = 'number';
const TYPE_CONSTANT = 'constant'; // any constant value
const TYPE_ANY = 'any';

/**
 * Function is a function of our expressions language (not a plain JavaScript function!).
 * These functions allow computation in two stages: In one stage the "context" is provided, and then
 * the actual user arguments are sent. They also allow checking for consistency of arguments
 * (arguments count and types).
 *
 * **Async**:
 * Our expressions engine is based on expr-eval library, not supporting async functions. We still
 * support async functions via a HACK in ParsedExpression which precalculates all function calls
 * results, memoize them, and replace the function during expression valuation by a simple memo
 * table lookup. This approach works ONLY if we are sure all its argumetns are constants. For this
 * reason, only declare Functions with an async `fn` if its type (given by `args`) can
 * ensure constant arguments when doing static typing. There is no way to check this via code
 * since functions are indistinguishable (an async function is just a function returning a Promise,
 * after code has been transpiled).
 *
 * **Types**:
 * Functions can perform type checking on arguments. For this, the `args` value must be an object
 * of the form `{ min, max, types }` where `min, max` are the minimum and maximum number of
 * arguments to receive, and an optional `types` array contain their types. These types can each
 * be:
 *   - A type name: 'string', 'number'
 *   - A constraing that only constants can exist in the expression: 'constant'
 *   - A wildcard: 'any'
 *   - An object: Assumed to be a fastest-validator validator expression (TODO)
 *
 * As a shortcut, if `arity` is passed instead of `args`, then `min = max = arity`, expecting
 * exactly `arity` constant arguments.
 *
 * @param name A string with the function name (used for debugging and error messages)
 * @param args An object with { min, max, types}, see type checking note above.
 * @param arity Shortcut to only define the number of arguments, when args is not used - see above
 * @param dependenciesFn A function that will collect dependencies (which attributes, tags, etc.)
 *   of this Function given its user-provided arguments.
 */
class Function {
  constructor({ name, fn, args, arity, dependenciesFn, cacheable }) {
    if (!fn) {
      throw new Error('fn is required');
    }
    if (isNumber(arity) && args) {
      throw new Error('Only one of args and arity can be given');
    }
    if (isNumber(arity)) {
      // 'arity' is a shortcut for "exactly N *constant* arguments", simpler way to express
      // { min: N, max: N, types: [constant, constant, ...] }
      this._args = {
        min: arity,
        max: arity,
        types: Array(arity).fill(TYPE_CONSTANT)
      };
    } else {
      this._args = args;
    }
    this._name = name;
    this._fn = fn;
    this._dependenciesFn = dependenciesFn;
    this._calculateCanPrecomputeAsync();
    this._cacheable = cacheable;
  }

  getName = () => this._name;

  /**
   * Receives the context in which this function is going to be executed (the robotId, attribute
   * values, etc.), and returns a JavaScript function ready to be evaluated once its actual
   * arguments are provided.
   */
  injectContext = (...context) => this._fn(...context);

  /**
   * Helper function to serialize function objects with their name
   */
  toString = () => `Function(${this._name})`;

  /**
   * Collects the dependencies for this function, given its actual arguments. For example,
   * "getValue('attr1')" only dependency is attribute "attr1".
   *
   * The dependencies are collected in place into the object `deps`, which contains
   * { attributes, tags, time } where attributes and tags are Sets, and time is a boolean.
   *
   * TODO(herchu) turns 'deps' into a proper class of our own, that allows adding arguments and
   * tags; and setting the `time` flag.
   */
  collectDependencies = (args, deps) => this._dependenciesFn && this._dependenciesFn(args, deps);

  /**
   * Performs a type checking by validating that the provided arguments match
   * the arguments number and types expected by the function.
   *
   * It throws an Error if the arguments number of types do not match this function declaration.
   *
   * TODO(herchu) Switch to a custom, more representative exception class.
   */
  typeCheck = (args) => {
    if (!this._args) {
      return;
    }
    const name = this._name;
    const { min, max, types } = this._args;
    if (isNumber(min) && args.length < min) {
      throw new Error(`Function ${name} expects ${
        min == max ? '' : 'at least '
      }${min} argument${min == 1 ? '' : 's'}; received ${args.length}`);
    }
    if (isNumber(max) && args.length > max) {
      throw new Error(`Function ${name} expects ${
        min == max ? '' : 'at most '
      }${max} argument${min == 1 ? '' : 's'}; received ${args.length}`);
    }
    // At this point, number of arguments matches allowed values. Now check their types
    // (if there was any type constraint)
    args.forEach((arg, ix) => {
      const argType = types && types[ix];
      // Check this argument type
      if (argType == TYPE_CONSTANT) {
        // Any constant value
        if (!arg.constant) {
          throw new Error(`Argument #${ix + 1} for function ${name} must be constant`);
        }
      } else if (argType == TYPE_STRING || argType == TYPE_NUMBER) {
        // Typed constants: string or number
        if (!arg.constant || argType != arg.type) {
          throw new Error(`Argument #${ix + 1} for function ${name} must be a constant ${argType}`);
        }
      } else if (argType == TYPE_ANY) {
        // This is a wildcard; always accept it.
      } else if (!isString(argType) && isObject(argType)) {
        // This is a fastest-validator type object
        // TODO(herchu) implement this validation
      } else {
        throw new Error('Bad language initialization: Cannot validate arguments type: ' + argType);
      }
    });
  };

  /**
   * Calculates and sets the _canPrecomputeAsync flag, which determines if every function call
   * to this function can (and should) be precalculated before expression evaluation.
   * This means that arguments are known before evaluation time.
   * We do this for async functions to workaround the limitation in expr-eval of not being
   * able to evaluate with awaits.
   *
   * Note: We should also tell if this._fn is actually an async function, and fail if
   * the function is not typed in a way that can be precalculated. However, there is no way
   * to actually determine that safely, since once functions are transpiled (in built code) all
   * functions are indistinguishable. See ideas here https://stackoverflow.com/a/38510353/4810295.
   * We could catch problems in DEV environemnts, but for now we do not even know if we are
   * running in dev env, using babel as runtime or regular node with transpiled code.
   */
  _calculateCanPrecomputeAsync = () => {
    this._canPrecomputeAsync = this._args.types && this._args.types.every(
      (t) => [TYPE_CONSTANT, TYPE_STRING, TYPE_NUMBER].includes(t)
    );
  };

  /**
   * Tells if this function's calls can (and should) be precalcualted before the actual expression
   * evaluation. We do this for all async functions since expr-eval does not support evaluating
   * async function calls. For this reason, we only accept CONSTANT argument values to async
   * functions, and enforce this in our "typing" of expressions.
   * See ParsedExpression.precomputeFunctionCalls()
   */
  canPrecomputeAsync = () => this._canPrecomputeAsync;

  /**
   * Tells if a function's results can be cached. This is used to save performance on some functions
   * based on querying external services/DBs.
   * This is based on the `cacheable` field passed in constructor, and used mostly for timeseries-
   * based services.
   *
   * NOTEs:
   *  - Cache settings in the service apply equally to all functions. In the future we might
   *    want to enable different cache ages for them.
   *  - Do not enable caching for functions that change all the time -- e.g. getValue() to get
   *    an attribute's value. Use it only for expensive functions that (should) only change a little
   *    during time, e.g. visitedAreaDiagonal() or inRectangleArea() to avoid hitting timeseries db.
   */
  isCacheable = () => this._cacheable;
}

// Dictionary of supported functions in our expressions language.
// TODO(herchu) move this to its own file, or a configuration file. This is "the set of functions
// for robot expressions", while we may have other sets.
const FUNCTIONS_LIST = [
  new Function({
    name: 'get',
    fn: fnGet,
    args: { min: 2, max: 3, types: [TYPE_ANY, TYPE_ANY, TYPE_ANY] },
    // args: { min: 2, max: 3 },
  }),
  new Function({
    name: 'angularDistance',
    fn: fnAngularDistance,
    args: { min: 2, max: 2, types: [TYPE_ANY, TYPE_ANY] }, // numbers, but not necessarily constants
  }),
  new Function({
    name: 'getValue',
    fn: getValue,
    args: {
      min: 1,
      max: 1,
      types: [TYPE_STRING]
    },
    dependenciesFn: (args, { attributeIds }) => {
      args.length && args[0].type == TYPE_STRING && attributeIds.add(args[0].value);
    }
  }),
  new Function({
    name: 'getValueAgeMs',
    fn: getValueAgeMs,
    args: {
      min: 1,
      max: 1,
      types: [TYPE_STRING]
    },
    dependenciesFn: (args, deps) => {
      const { attributeIds } = deps;
      args.length && args[0].type == TYPE_STRING && attributeIds.add(args[0].value);
      deps.time = true;
    }
  }),
  new Function({
    name: 'visitedAreaSide',
    fn: visitedAreaSide,
    args: {
      min: 1,
      max: 1,
      types: [TYPE_NUMBER]
    },
    cacheable: true,
    dependenciesFn: (args, deps) => {
      // NOTE(mike) This function also depends on VITAL_POSE, but we omit it for efficiency
      deps.time = true;
    }
  }),
  new Function({
    name: 'visitedAreaDiagonal',
    fn: visitedAreaDiagonal,
    args: {
      min: 1,
      max: 1,
      types: [TYPE_NUMBER]
    },
    cacheable: true,
    dependenciesFn: (args, deps) => {
      // NOTE(mike) This function also depends on VITAL_POSE, but we omit it for efficiency
      deps.time = true;
    }
  }),
  new Function({
    name: 'match',
    fn: regexpMatch,
    args: {
      min: 2,
      max: 2,
      // Note that match(<regexp>, <anything>) is still limited in the second argument as
      // we don't allow complex sub-expressions as parameters to our functions, so this
      // TYPE_ANY represents for now a _variable_. The match() usage would be like:
      //   x = getValue("attr1"); match("someregexp", x)
      // Leaving TYPE_ANY as it represents the right thing: _anything_, and expressions will be
      // more flexible later when our parser and type checker is improved.
      types: [TYPE_STRING, TYPE_ANY]
    }
    // dependenciesFn: No dependencies added by this function
  }),
  new Function({
    name: 'inRectangleArea',
    fn: inRectangleArea,
    args: {
      min: 4, // all coordinates are required
      max: 5, // the frameId is optional
      types: [TYPE_NUMBER, TYPE_NUMBER, TYPE_NUMBER, TYPE_NUMBER, TYPE_STRING]
    },
    cacheable: true,
    dependenciesFn: (args, { attributeIds }) => {
      attributeIds.add(VITAL_POSE);
    }
  }),
  new Function({
    name: 'distinctValues',
    fn: aggregateTimeseriesAttribute({
      aggFuncName: 'DISTINCT',
      limit: 10, // hardcoded limit for efficiency
      resultFunc: (results) => {
        if (!results || !results.length) {
          return null;
        } else {
          return results.map((p) => p.value); // discard the dummy timestamp, return only values
        }
      }
    }),
    args: {
      min: 2,
      max: 2,
      types: [TYPE_STRING, TYPE_NUMBER] // We can consider adding the third argument 'limit' later
    },
    cacheable: true,
    dependenciesFn: (args, deps) => {
      const { attributeIds } = deps;
      args.length && args[0].type == TYPE_STRING && attributeIds.add(args[0].value);
      deps.time = true;
    }
  }),
  // sustainedValue is a shortcut for "exactly 1 distinct values" and could use distinctValues(),
  // something like:
  //    sustainedValue(attr, t) ::=
  //         x = distinctValues(attr, t); x[0] if x and len(x)==1 else null
  // but we have no way to express one function in terms of another one so it is mostly a copy
  new Function({
    name: 'sustainedValue',
    fn: aggregateTimeseriesAttribute({
      aggFuncName: 'DISTINCT',
      limit: 2, // no need to fetch more than 2 points
      resultFunc: (results) => {
        if (!results || results.length != 1) {
          return null;
        } else {
          return results[0].value; // first and unique row; column.value skipping the dummy time
        }
      }
    }),
    args: {
      min: 2,
      max: 2,
      types: [TYPE_STRING, TYPE_NUMBER]
    },
    cacheable: true,
    dependenciesFn: (args, deps) => {
      const { attributeIds } = deps;
      args.length && args[0].type == TYPE_STRING && attributeIds.add(args[0].value);
      deps.time = true;
    }
  }),
  // isRobotInZone(zoneId, [locationId]) tells if the current robot is inside the zone identified
  // by zoneId. The locationId is optional: When omitted, it refers to the robot's location
  new Function({
    name: 'isRobotInZone',
    fn: isRobotInZone,
    args: {
      min: 1,
      max: 2,
      types: [TYPE_STRING, TYPE_STRING]
    },
    cacheable: true,
    dependenciesFn: (args, { attributeIds }) => {
      attributeIds.add(VITAL_POSE);
    }
  }),
  // isZoneOccupied(zoneId, [locationId]) tells if a zone zoneId is currently occupied by at least
  // one robot. The locationId is optional: When omitted, it refers to the robot's location
  new Function({
    name: 'isZoneOccupied',
    fn: isZoneOccupied,
    args: {
      min: 1,
      max: 2,
      types: [TYPE_STRING, TYPE_STRING]
    },
    cacheable: true,
    dependenciesFn: (args, deps) => {
      deps.time = true;
    }
  }),
];
// add minValue, maxValue, meanValue with an iteration (using their generic function generator)
['min', 'max', 'mean'].forEach((op) => {
  const name = `${op}Value`;
  FUNCTIONS_LIST.push(new Function({
    name,
    fn: aggregateTimeseriesAttribute({ aggFuncName: op }),
    args: {
      min: 2,
      max: 2,
      types: [TYPE_STRING, TYPE_NUMBER] // the attributeId and interval duration (seconds)
    },
    cacheable: true,
    dependenciesFn: (args, deps) => {
      const { attributeIds } = deps;
      args.length && args[0].type == TYPE_STRING && attributeIds.add(args[0].value);
      deps.time = true;
    }
  }));
});

// Turn the list constructed above into a dictionary keyed by function name for faster access;
// that is the object that gets exported
const FUNCTIONS_DICT = keyBy(FUNCTIONS_LIST, (f) => f.getName());

export {
  Function,
  FUNCTIONS_DICT,
  TYPE_ANY,
  TYPE_CONSTANT,
  TYPE_STRING,
  TYPE_NUMBER
};
