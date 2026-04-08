/**
 * Core functionality for svc-derived-attributes, implementing an object that receives updates
 * from a single robot, calculates and stores its derived attributes.
 *
 * It contains most of the service logic; other than the core helpers for the expressions language.
 */
import { isString } from 'lodash';
// ORO modules
import AttributesManager from '../../server/attributes';
import { fromVariant } from '../../lib/util';
import { ParsedExpression } from './expressions';
import { FUNCTIONS_DICT } from './functions';
import DerivedAttributesConfig from './derivedAttributesConfig';

// Creates an Expression object
const createExpression = (expressionStr, cache = null) => {
  return new ParsedExpression({ expressionStr, functions: FUNCTIONS_DICT, cache });
};

/**
 * Core helper for svc-derived-attributes. It represents a "worker" to receive attribute updates
 * from a single robot, calculate and store its derived attributes.
 *
 * It caches some values such as the robot attributes configuration.
 */
export default class RobotDerivedAttributesProcessor {
  /**
   * Initializes the processor
   * @param {string} robotId
   */
  constructor({ robotId, cache, throttledLogger }) {
    if (!robotId) {
      throw new Error('robotId is required');
    }
    this.robotId = robotId;
    this._attributesManager = new AttributesManager();
    this._derivedAttrsConfig = null // created on demand
    this._cache = cache;
    this._throttledLogger = throttledLogger;
  }

  /**
   * Process a message with attribute value updates. If any of those attributes should trigger
   * recalculation of a derived attribute, the attributes are calculated (via parsing and
   * evaluating their expressions) and stored.
   *
   * These come from the the AMQP queues so the values are in "variant" form (see `fromVariant`
   * comments below).
   *
   * @returns {object} Stats including processing time for each processed derived attribute
   */
  processUpdate = async (attributeValues) => {
    if (!this._derivedAttrsConfig) {
      const attrsConfig = await this._attributesManager.fetchAttributesConfig();
      this._derivedAttrsConfig = new DerivedAttributesConfig(attrsConfig, this._throttledLogger);
    }
    const robotConfig = this._derivedAttrsConfig
    // Filter attributes which may need to trigger an update to a derived attribute
    const toUpdate = new Set();
    // Filter attributes that are dependencies of a derived attribute
    const derAttrDependenciesIds = new Set();
    // Processing stats
    const stats = {};
    Object.keys(attributeValues).forEach((attributeId) => {
      robotConfig
        .getDependentDerivedAttributes(attributeId)
        .forEach((dependentAttr) => {
          // NOTE: this condition allows the service to
          // update derived attributes that are dependent on themselves
          // without falling in a infinite loop by re processing everytime the update
          if (attributeId != dependentAttr) {
            toUpdate.add(dependentAttr);
          }
          // Get all the attributes that are dependencies of that derived attr
          const { attributeIds: depAttributeIds } = robotConfig
            .getDerivedAttributeDependencies(dependentAttr);
          depAttributeIds.forEach(derAttrDependenciesIds.add, derAttrDependenciesIds);
        });
    });

    // Check if there are attribute values that are not within the incoming
    // attributes.
    const attributeIdsToFetch = [...derAttrDependenciesIds].filter(
      id => !(id in attributeValues)
    );

    // If there are attribute values missing, fetch them to complete the calculation.
    let fetchedAttributeValues = {};
    if (attributeIdsToFetch.length > 0) {
      fetchedAttributeValues = await this._attributesManager.getRobotAttributeValues(
        this.robotId, attributeIdsToFetch
      );
    }

    // Get each attribute mapped with the identifier of that attribute,
    // attributes contains an object with this shape { attributeId1: { value, ts }, ... }
    const mergedAttributeValues = {};
    derAttrDependenciesIds.forEach((id) => {
      if (attributeValues[id]) {
        mergedAttributeValues[id] = {
          value: fromVariant(attributeValues[id].value),
          ts: attributeValues[id].ts
        };
      } else {
        // The attribute comes from the feteched ones
        mergedAttributeValues[id] = fetchedAttributeValues[id];
      }
    });
    // Process each of the derived attributes that depends on any of the attributes that changed
    const updates = {};
    const ts = Date.now();
    let hasUpdates = false; // cheaper than any isEmpty function
    for (const derivedAttributeId of toUpdate.values()) {
      // eslint-disable-next-line no-await-in-loop
      const t0 = Date.now();
      // eslint-disable-next-line no-await-in-loop
      const { value, match } = await this.processDerivedAttribute({
        attributeId: derivedAttributeId,
        attributeValues: mergedAttributeValues,
        robotConfig
      });
      if (match) {
        hasUpdates = true;
        updates[derivedAttributeId] = { value, ts };
        // metricsProxy.record(measureMatched, 1);
      }
      const durationMs = Date.now() - t0;
      stats[derivedAttributeId] = { processingTimeMs: durationMs };
    }
    if (hasUpdates && !this.dryRun) {
      await this._attributesManager.saveAttributeValues({
        robotId: this.robotId, attributeValues: updates, ts
      });
    }
    return stats;
  };

  /**
   * Processes the derived attribute <attributeId> and returns:
   * {
   *   match: Boolean,  // True if the value should be processed
   *   value: Any       // The resulting attribute value
   * }
   *
   * It uses the attribute mapping passed to get the derivation definition for this
   * attribute.
   * It can also use optional attributeValues received on the queue to get the source
   * attribute values.
   *
   * Mapping keys used:
   * {
   *   source: 'derived',
   *   language: 'safe' | 'unsafe',
   *   attributeIds: [],  // Ordered list of attributeId arguments
   *   transform: "args[0] + args[1]",  // String
   *   filter: "args[0] + args[1]"  // String
   * }
   *
   * This method does not retrieve any values from mongodb. If any attribute value is required as a
   * dependency of `attributeId`, it must be pre-fetched and received through `attributeValues`.
   *
   * @param {string} attributeId
   * @param {object} attributeValues A dictionary with the format:
   * { attrId1 : { value, ts }, attrId2 : { value, ts } ... } of any depedency attribute
   * that might be required to calculate the value of `attributeId`.
   * @param {object} robotConfig The robot derived attributes configuration
   *
   */
  async processDerivedAttribute({ attributeId, attributeValues, robotConfig }) {
    // metricsProxy.record(measureDerived, 1);
    // Fetch mapping definition which should have the detail
    const { transform, filter, language, attributeIds } = robotConfig.getExpressions(attributeId);
    // args (used on some legacy definitions) contains an array of attributes values
    // TODO(franguerini): Remove args and rewrite methods to use getValue() instead
    const args = Array.isArray(attributeIds)
      ? attributeIds.map(id => attributeValues[id] && attributeValues[id].value)
      : [];

    // Prepare and execute filter function
    // If the filter isn't included, then we automatically match
    if (filter && isString(filter)) {
      const { success, value, message } = await this.evaluateExpression({
        expression: filter,
        args,
        language,
        attributeValues
      });
      if (!success) { // if the filter could not be evaluated: update was processed (error value)
        return { match: true, value: `Filter error: ${message}` };
      } else if (!value) { // if filter evaluated to falsy value: update was processed (no match)
        return { match: false };
      } // else: filter succeeded, continue evaluating
    } // else: there is no filter, move on

    const { success, value, message: evalMsg } = await this.evaluateExpression({
      expression: transform,
      args,
      language,
      attributeValues
    });
    return {
      value: success ? value : `Expression error: ${evalMsg}`,
      match: true
    };
  }

  /**
   * Returns an object with { success, value, message } with a success flag if the expression
   * was evaluated correctly (correct syntax, no execution errors), and its value if it
   * was executed.
   * If it was not executed, a message may be added in the message field (this is a TODO)
   *
   * @param {object} attributeValues map attributes ids to values. It's used to lookup
   * attributes values during evaluation. If it's undefined, values for every attribute the
   * expression depends on will be fetched from the database.
   */
  evaluateExpression = async ({ args = [], expression, attributeValues = {} }) => {
    let expr;
    try {
      expr = createExpression(expression, this._cache);
    } catch (e) {
      // expression cannot be parsed (syntax error, typing error)
      return {
        success: false,
        message: e.message
      };
    }

    await expr.evaluate({
      robotId: this.robotId,
      args,
      attributeValues,
      functions: FUNCTIONS_DICT,
    });
    return {
      success: expr.isSuccess(),
      value: expr.getResult(),
      message: expr.getMessage()
    };
  }

  /**
   * Evaluates the provided expression.
   * Dependencies are fetched before evaluating the result.
   *
   * @param {string} expression The expression string
   * @param {object} attributeValues
   *   Optional, a dictionary from attribute id to a value (of any type).
   *   These will override any attribute value in the robot; they are used for testing without the
   *   need for waiting for the robot to publish data or forcing it to do it.
   * @returns {object} with { success, value, message }
   */
  evaluateAdHocSafeExpression = async ({ expression, attributes: fixedAttributeValues }) => {
    let expr;
    try {
      expr = createExpression(expression, this._cache);
    } catch (e) {
      // expression cannot be parsed (syntax error, typing error)
      return {
        success: false,
        message: e.message
      };
    }
    const attributeValues = await this._fetchDependenciesValues(expr);
    return this.evaluateExpression({
      expression,
      // combine robot's attribute values with values passed to test the expression
      attributeValues: { ...attributeValues, ...fixedAttributeValues }
    });
  }

  /**
   * Fetches all dependencies of an expression
   * Return an object with the following format:
   *  { attrId1: { value, ts }, attrId2: { value, ts }, ... }
   */
  async _fetchDependenciesValues(expr) {
    const { attributeIds: depAttributeIds } = expr.getDependencies();

    let fetchedAttributeValues = {};
    if (depAttributeIds.size > 0) {
      fetchedAttributeValues = await this._attributesManager.getRobotAttributeValues(
        this.robotId, [...depAttributeIds]
      );
    }
    return fetchedAttributeValues;
  }
}

export { createExpression };
