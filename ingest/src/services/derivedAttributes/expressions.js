/* eslint-disable max-classes-per-file */
/**
 * Expressions library, implemented primarily for complex and derived attributes.
 *
 * It supports two types of expressions: the old, evil and unsafe expressions using JS's `eval()`,
 * and a new mechanism using expr-eval library.
 *
 * Both implementation have (still) pretty much the same functionality, which includes basic
 * math (unary, binary, ternary operators), injecting variables (`args`) and functions (such
 * as `hasTag`, injected from svc-derived-attributes)
 */
import { Parser } from 'expr-eval';
import { isObject, isString } from 'lodash';
import { FUNCTIONS_DICT } from './functions';

/**
 * Since expr-eval has no `null` value, yet some of our functions return `null` (and attribute
 * values can be null too), we extend the expression language injecting a "null" name in the
 * context, with value `null`.
 *
 * Note that creating the *constant* `null` in expr.Parser.consts does not work, as constants
 * are replaced by _numbers_ early on by the parser - so even defining `{ 'null': null }`
 * in the `consts` part of an expression, makes it evaluate to 0.
 *
 * We can add any constant we need here; although the right place for numeric constants would
 * be to extend the `consts` element of the parser. Add any other non-numeric constant here.
 * Make sure not to include "ts",or other names we do use as "context".
 */
const LANGUAGE_CONSTANTS = {
  null: null
};

/**
 * Base class for expressions: Currently only ParsedExpression is used for our expressions language.
 * Other subclasses may exist in the future (and did exist in the past!).
 * Subclasses need only to implement doEvaluate().
 */
class Expression {
  // Flag to signal if the result is valid. See isSuccess(), setIsSuccess()
  _success = undefined;

  // The result of evaluating the expression, after calling evaluate(). Only valid if isSuccess()
  _result = undefined;

  // An error message when the evaluation was not successful
  _message = undefined;

  // The original expression string -- whether its syntax was valid or not
  _expressionStr = undefined;

  // eslint-disable-next-line no-unused-vars
  constructor({ expressionStr, functions }) {
    if (!isString(expressionStr)) {
      throw new Error('expressionStr must be a string');
    }
    this._expressionStr = expressionStr;
  }

  /**
   *
   * @param {string} robotId The robot for which this expression is being evaluated. Note that
   *   all functions in `functions` are applied this argument, expecting to return a new function
   *   that operates on that robot
   * @param {object} args An array of positional arguments values
   * @param {object} attributeValues An object with attributes identified with the
   *   attributeId, like { [attributeId]: { value, ts }, [attributeId2]: { value, ts } ... }
   * @param {object} functions A map of available functions. Each has the type
   *   `robotId => args => result`; as robotId is applied once during the preparation of the
   *   context, and then the function can be evaluated multiple times with different arguments
   *   as appearing in the expression.
   * @param {number} ts (Optional) Is the "now" value for the evaluation of the expression.
   *
   * @returns Nothing. Its result is retrieved via getResult(), isSuccess() and getMessage()
   */
  // eslint-disable-next-line no-unused-vars
  evaluate = async ({
    robotId, args, attributeValues, functions, ts = Date.now(), variables = {}
  }) => {
    if (!robotId || !isString(robotId)) {
      throw new Error('robotId must be a string');
    }
    if (!Array.isArray(args)) {
      throw new Error('args must be an array');
    }
    if (!isObject(functions)) {
      throw new Error('functions must be an object');
    }
    if (!isObject(variables)) {
      throw new Error('variables must be an object');
    }
    this._robotId = robotId;
    // Build a "context" object to bind some names within the JS expression to evalate;
    // namely "args" and every inorbit-provided function (e.g. hasTag)
    const context = {
      args,
      attributeValues,
      robotId: this._robotId,
      // some of our functions are time-based; send a "now" value as part of the context
      // so they can all be based on the same exact timestamp
      ts,
      ...variables
    };
    return this.doEvaluate({ context, functions });
  };

  doEvaluate = async () => {
    throw new Error('Implemented by subclass');
  };

  /**
   * Returns the dependencies of this expression: what elements should trigger its re-evaluation.
   *
   * @returns { attributeIds, time, tags } Where attributeIds and tags are Sets; and time is boolean
   *
   * NOTE(herchu) In the future, time could become an object with some value for how frequently
   * recomputation is needed.
   */
  getDependencies = () => {
    throw new Error('Implemented by subclass');
  };

  isSuccess = () => this._success;

  setIsSuccess = (success) => { this._success = success; };

  getResult = () => this._result;

  setResult = (result) => { this._result = result; };

  getMessage = () => this._message;

  setMessage = (message) => { this._message = message; };

  getExpressionStr = () => this._expressionStr;
}

/**
 * Eval-based implementation of expressions.
 * This is an old, evil and unsafe hack using JavaScript eval() under the hood, meaning arbitrary
 * code can be injected and evaluated. This should NOT be used anymore, prefer ParsedExpression
 * instead!
 *
 * This class is still available as we migrate to the other method, and for ourselves to implement
 * "advanced" expressions if a feature is not available in ParsedExpression (expr-eval library).
 *
 * NOTE: Evaluation of these expressions MUST NEVER be available via customer-facing configuration!
 */
class UnsafeEvalExpression extends Expression {
  doEvaluate = async ({ context, functions }) => {
    // NOTE NOTE NOTE NOTE NOTE NOTE NOTE NOTE NOTE NOTE NOTE NOTE NOTE
    // NOTE(adamantivm) This is insecure and error prone. It is ONLY AN EXPERIMENT
    // until we learn more about what kind of generalization or at least sanitization
    // we need to do on mapping.transform.
    // Executing random code like this is BAD BAD BAD. Do NOT copy @adamantivm

    // HACK(herchu): ALL our functions are async, since they will normally evaluate by
    // doing DB lookups or other queries. But we don't want to make expressions syntax dirty
    // with async or Promises: we want for example "hasTag('prod')" to simply work in an expression.
    // So we patch it by prefixing every use of the *known* function names with "await".
    // Note that there is a chance that syntax will be screwed with this dumb string replacement!
    // This horrible hack is allowed within the huge hack our eval()-based expression evaluator
    // already lives.
    let expression = this.getExpressionStr();
    Object.keys(functions).forEach((fnName) => {
      if (functions[fnName].canPrecomputeAsync()) {
        expression = expression.replace(new RegExp(fnName, 'g'), 'await ' + fnName);
      }
    });
    // Build a new context containint not only the values from `context` but also all
    // available functions, with robotId already applied
    const contextWithFunctions = { ...context };
    Object.entries(functions).forEach(([fnName, fn]) => {
      // each function is curried, returning a fn after receiving a robotId
      contextWithFunctions[fnName] = fn.injectContext(context);
    });
    try {
      const transformSource = `async ({ ${Object.keys(contextWithFunctions).join(', ')} }) \
        => ${expression}`;
      // eslint-disable-next-line no-eval
      const transformFunction = eval(transformSource);
      this.setResult(await transformFunction(contextWithFunctions));
      this.setIsSuccess(true);
    } catch (e) {
      this.setMessage(e.message);
      this.setResult(`Error: ${e.message}`);
      this.setIsSuccess(false);
    }
    // NOTE NOTE NOTE NOTE NOTE NOTE NOTE NOTE NOTE NOTE NOTE NOTE NOTE
  };

  /**
   * Returns the dependencies of this expression: what elements should trigger its re-evaluation.
   *
   * @returns { attributeIds, time, tags } Where attributeIds and tags are Sets; and time is boolean
   *
   * NOTE(herchu) In the future, time could become an object with some value for how frequently
   * recomputation is needed.
   */
  getDependencies = () => {
    const attributeIdsRegex = /getValue\(["'](?<dependencyId>[^"']+)["']\)/g;
    const attributeIds = new Set();
    for (const m of this.getExpressionStr().matchAll(attributeIdsRegex)) {
      const { dependencyId } = m.groups;
      attributeIds.add(dependencyId);
    }
    return { attributeIds };
  };
}

/**
 * Concrete class for implementing Expressions, based on expr-eval library.
 */
class ParsedExpression extends Expression {
  // The parsed expression from expr-eval library
  _expression = undefined;

  _cache = undefined;

  constructor({ expressionStr, functions, cache }) {
    super({ expressionStr, functions });
    this._cache = cache;
    if (!isObject(functions)) {
      // Require `functions` to be passed. If there are no functions, force to pass an empty
      // object {} -- so that we ensure we know about type checking (first implementation did
      // not have this argument)
      throw new Error('functions must be an object');
    }
    const expr = Parser.parse(expressionStr);
    // Simplify the expression: If there are some constants (e.g. "24 * 60") these still represent
    // a constant, so they are valid as arguments for our own functions (that only accept constants)
    this._expression = expr.simplify({});
    // Do some type checking: make sure all inorbit function calls have appropriate arity and only
    // constants passed as arguments (see precomputeFunctionCalls)
    if (functions) {
      // collectFunctionCalls can throw exceptions for non-constant arguments; do not catch here
      const calls = this.collectFunctionCalls(functions);
      calls.forEach(({ fn, args }) => {
        if (fn) {
          fn.typeCheck(args);
        }
      });
    }
  }

  doEvaluate = async ({ context, functions }) => {
    if (!this._expression) {
      // expression failed to parse. Do nothing
      this.setIsSuccess(false);
      return;
    }
    // Note that expr-eval library does not support async functions. The only async functions
    // we used are our own, all in `functions`. Since the arguments are constants and known
    // (it is a limitation we impose on the expressions) we can pre-calculate all functions'
    // results (using await) and then provide simpler functions to the evaluator that will simply
    // look up for the calculated values.
    // For this, first collect all function calls and their arguments
    const functionCalls = this.collectFunctionCalls(functions);
    // Then turn all `functions` into a new set newFunctions which only return the known,
    // precomputed results
    let newFunctions;
    try {
      newFunctions = await this.precomputeFunctionCalls({ functions, context, functionCalls });
    } catch (e) {
      this.setMessage(e.message);
      this.setIsSuccess(false);
      return;
    }
    // Now inject these new functions in the parser
    this.injectFunctionsIntoParser(newFunctions, context);
    // Add to the context (robotId, etc.) other constants from our own language.
    // Ssee comment in LANGUAGE_CONSTANTS declaration)
    const contextWithConstants = {
      ...context,
      ...LANGUAGE_CONSTANTS
    };
    try {
      const result = this._expression.evaluate(contextWithConstants);
      this.setResult(result);
      this.setIsSuccess(true);
    } catch (e) {
      this.setMessage(e.message);
      this.setResult(`Error: ${e.message}`);
      this.setIsSuccess(false);
    }
  };

  /**
  * Find all function calls to our own functions in a list of tokens
  *
  * It returns an array of { fn, name, args } objects with the names of all functions called and
  * their arguments list. There can be repeated elements in this list. Each element of `args`
  * is an object { constant, type, value }: A boolean indicating if the argument is a constant,
  * its type (if known), and its value (if known).
  *
  * If any function call (to one of our `functions`) contains other than constant arguments,
  * it throws an exception.
  *
  * TODO(herchu) Parsing of the (implicit) syntax tree built by expr-val is very lame in this
  * implementation. It prevents us from using actual subexpressions as arguments to our functions.
  * We should improve this so when an argument is declared as TYPE_ANY, it can *really* be any
  * value, not just constants or variables (which are both atomic tokens, easier to parse here).
  */
  _collectFunctionCallsFromTokens = (tokens, functions) => {
    if (!tokens) { // expression not parsed? added this guard just in case
      return [];
    }
    let functionCalls = [];
    for (let i = 0; i < tokens.length; i++) {
      // Each function call with constant arguments has this form: (note: "INUMBER" is for all
      // constants, not just numbers)
      //   Instruction { type: 'IVAR', value: 'getValue' },
      //   Instruction { type: 'INUMBER', value: 'attr0123' },
      //   Instruction { type: 'IFUNCALL', value: 1 }, -> the number is the arguments' count
      if (tokens[i].type == 'IVAR' && tokens[i].value in functions) {
        const name = tokens[i].value;
        // If the function is one we define, we need to assert all its arguments are constants or
        // variables (not complex sub-expressions)
        let j;
        // console.log("token function call at",i, tokens[i])
        for (j = i + 1; j < tokens.length && ['INUMBER', 'IVAR'].includes(tokens[j].type); j++) {
          // traverse the tokens after IVAR skipping tokens of type INUMBER (constants)
          // and other IVAR (variables) until we find the first token that isn't an INUMBER or IVAL
          // (we look for IFUNCALL)
        }
        if (j < tokens.length && tokens[j].type == 'IFUNCALL' && tokens[j].value == j - i - 1) {
          // If all tokens from the IVAR up to IFUNCALL were INUMBER, this is a call to a function
          // with only constant arguments. Collect it.
          // (Note: If tokens[j].value != j-i-1, then this function call is part of a subexpression,
          // not the function call corresponding to the IVAR in tokens[i])
          const args = tokens.slice(i + 1, j).map((token) => ({
            constant: token.type == 'INUMBER',
            value: token.type == 'INUMBER' ? token.value : undefined,
            type: token.type == 'INUMBER' ? typeof token.value : undefined
          }));
          const fn = functions[name];
          functionCalls.push({
            fn,
            name,
            args
          });
        } else {
          // Otherwise there are (complex) expressions among the function call arguments: fail
          // TODO(herchu) in order to allow for non-constant arguments, parse back the expression
          // creating a list of arguments { value: (NONE), type: (EXPRESSION), constant: false }
          throw new Error(`Function ${name} can only receive constant arguments`);
        }
      }
      if (tokens[i].type == 'IEXPR') {
        // handle sub-expressions. The `value` in a IEXPR is a list of tokens; recursion is
        // necessary
        const subExprCalls = this._collectFunctionCallsFromTokens(tokens[i].value, functions);
        functionCalls = functionCalls.concat(subExprCalls);
      }
    }
    return functionCalls;
  };

  /**
  * Find all function calls to our own functions (ie. any function whose name is one of the
  * keys in `functions` argument object.
  *
  * It returns an array of { name, args } objects with the names of all functions called and
  * their arguments list. There can be repeated elements in this list.
  *
  * If any function call (to one of our `functions`) contains other than constant arguments,
  * it throws an exception.
  */
  collectFunctionCalls = (functions) => {
    const { tokens } = this._expression;
    return this._collectFunctionCallsFromTokens(tokens, functions);
  };

  /**
   * Given the list of `functionCalls` (see `collectFunctionCalls`), the `context` for the
   * expression evaluation and the actual dictionary of `functions`, it computes the result of
   * each function call.
   * Those functions could be async (and will be, in most cases, involving DB lookups) and the
   * purpose of this function is to isolate the async evaluation here.
   * It returns a new dictionary with the same keys as `functions`, with functions that behave
   * exactly the same, just that they will work only on the known arguments from `functionCalls`,
   * and they are not async (since they have been evaluated already).
   */
  precomputeFunctionCalls = async ({ functions, context, functionCalls }) => {
    const results = {};
    // The lookupFn is like a "compiled" version of functions, that simply looks up their evaluation
    // results in the `results` object. The closure is bound to this context so it will have
    // access to `results`.
    const lookupFn = (name) => () => (...args) => {
      if (!(name in results)) {
        // it should never happen
        throw new Error(`function ${name} was no pre-calculated`);
      }
      const fnResults = results[name];
      const argsKey = JSON.stringify(args);
      return argsKey in fnResults ? fnResults[argsKey] : undefined;
    };
    const newFunctions = {};
    for (const { name, args } of functionCalls) {
      const fun = functions[name];
      if (!fun.canPrecomputeAsync()) {
        // If the function cannot be precomputed because there is no guarantee that its
        // arguments are always constants, then we do not replace it by a memoized version.
        // Note that this will FAIL if the function is async, since expr-eval will only see
        // a Promise as function evaluation result. It's up to us to build our functions language
        // properly; see class declaration in InOrbitFunction
        newFunctions[name] = fun.injectContext;
        // eslint-disable-next-line no-continue
        continue;
      }
      const argValues = args.map((arg) => arg.value);
      const argsKey = JSON.stringify(argValues);
      // If this function (with same arguments) was evaluated, there is no need to recompute
      if (results[name] && argsKey in results[name]) {
        // eslint-disable-next-line no-continue
        continue;
      }
      const cacheKey = { // key to be used in caching code below
        // type: any constant to avoid name clash with other services
        type: 'expression-function',
        name,
        robotId: context.robotId,
        argsKey
        // note: missing ts on purpose: since ts changes even by a few ms from expression to
        // next expression. So make sure caching is enabled ONLY for live services! Evaluating
        // an expression "in the past" would have unexpected results wrt. caching
      };
      // If caching is enabled, see if this function (for same context, same arguments) was
      // already evaluated and stored in cache.
      // eslint-disable-next-line no-await-in-loop
      const cachedValue = await this.readFromCache(fun, cacheKey);
      let res;
      if (cachedValue && 'value' in cachedValue) {
        // Just use cached value
        res = cachedValue.value;
      } else {
        // pre-evaluate this function call
        const f = fun.injectContext(context);
        try {
          // eslint-disable-next-line no-await-in-loop
          res = await f(...argValues);
          // eslint-disable-next-line no-await-in-loop
          await this.writeToCache(fun, cacheKey, res);
        } catch (e) {
          console.warn(`error evaluating function ${name}`, e.message);
          // Let the handler catch the error and return the appropriate response
          throw e;
        }
      }
      if (!(name in results)) {
        results[name] = {};
        newFunctions[name] = lookupFn(name);
      }
      results[name][argsKey] = res;
    }
    return newFunctions;
  };

  /**
   * Attempts to read a cached function evalution. If the cache is disabled, the functions should
   * not be cacheable, or the value is not in cache
   * The cacheKey argument is built from several fields (including function name and arguments)
   * to guarantee uniqueness, and it must mach the one passed to readFromCache.
   */
  readFromCache = async (func, cacheKey) => {
    if (func.isCacheable() && this._cache) {
      return this._cache.get(cacheKey);
    } else {
      return null;
    }
  };

  /**
   * Caches a function evaluation result.
   * The cacheKey argument is built from several fields (including function name and arguments)
   * to guarantee uniqueness, and it must mach the one passed to readFromCache.
   */
  writeToCache = async (func, cacheKey, result) => {
    if (func.isCacheable() && this._cache) {
      // If we just calculated the function, and it is cacheable, then remember the result
      // eslint-disable-next-line no-await-in-loop
      await this._cache.set(cacheKey, { value: result });
    }
  };

  /**
   * Injects a set of functions contained in a dictionary keyed by function name into the
   * parser used in this expression (the parser is also the evaluator in expr-eval).
   */
  injectFunctionsIntoParser = (functions, context) => {
    const { parser } = this._expression;
    Object.entries(functions).forEach(([name, fn]) => { parser.functions[name] = fn(context); });
  };

  /**
   * Returns the dependencies of this expression: what elements should trigger its re-evaluation.
   *
   * @returns { attributeIds, time, tags } Where attributeIds and tags are Sets; and time is boolean
   *
   * NOTE(herchu) In the future, time could become an object with some value for how frequently
   * recomputation is needed.
   */
  getDependencies = () => {
    // NOTE(herchu) Assuming all expressions are based on the set of functions here. We might
    // use different function dictionaries in the future, depepending where this expression
    // is being used
    const functions = FUNCTIONS_DICT;
    const deps = { attributeIds: new Set() };
    this.collectFunctionCalls(functions).forEach(({ name, args }) => {
      if (name in FUNCTIONS_DICT) {
        FUNCTIONS_DICT[name].collectDependencies(args, deps);
      }
    });
    return deps;
  };
}

export {
  Expression,
  UnsafeEvalExpression,
  ParsedExpression
};
