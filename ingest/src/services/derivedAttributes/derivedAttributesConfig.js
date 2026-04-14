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

import { createExpression } from './processor';
import { SOURCES } from '../../shared/attributes';

/**
 * Derived attributes configuration for a given robot.
 *
 * NOTE: consider moving this to a separate module.

 */
class DerivedAttributesConfig {
    constructor(attrsConfig, throttledLogger) {
      this._attrsConfig = attrsConfig;
      // See RobotVitalsConfig.getDependentDerivedAttributes
      this._memoDependentAttributes = {};
      // See RobotVitalsConfig.getDerivedAttributeDependencies
      this._memoDerivedAttrDeps = {};
      this._throttledLogger = throttledLogger;
    }
  
    /**
     * Returns a set with the ids of derived attributes that depend on the attribute with id
     * attributeId.
     * Note that results are memoized for efficiency.
     *
     * @param {string} attributeId
     */
    getDependentDerivedAttributes(attributeId) {
      // Memoize results to avoid computing the same dependencies many times
      if (!this._memoDependentAttributes[attributeId]) {
        this._memoDependentAttributes[attributeId] = this._getDependentDerivedAttributes(attributeId);
      }
      return this._memoDependentAttributes[attributeId];
    }
  
    /**
     * Returns a list with the ids of all the derived attributes defined for this robot
     * @returns {array}
     */
    _getDerivedAttributesIds = () => (
      Object.keys(this._attrsConfig).filter(
        attributeId => this._attrsConfig[attributeId]?.mapping?.source == SOURCES.DERIVED.value
      )
    )
  
    /**
     * Returns a set with the ids of derived attributes that depend on the attribute with id
     * attributeId.
     *
     * @param {string} attributeId
     */
    _getDependentDerivedAttributes = (attributeId) => {
      const dependents = new Set();
      for (const derivedId of this._getDerivedAttributesIds()) {
        // Find derived attributes that depend on attributeId
        const { attributeIds } = this.getDerivedAttributeDependencies(derivedId);
        if (attributeIds.has(attributeId)) {
          dependents.add(derivedId);
        }
      }
      return dependents;
    };
  
    /**
     * Returns a list of attribute ids that a derived attribute depends on.
     * Note that results are memoized for efficiency.
     *
     * @param {string} attributeId The derived attribute id
     * @returns {array} List of ids of attributes that derived attribute expressions (transform or
     * filter reference). 
     */
    getDerivedAttributeDependencies(attributeId) {
      if (!this._memoDerivedAttrDeps[attributeId]) {
        this._memoDerivedAttrDeps[attributeId] = this._getDerivedAttributeDependencies(attributeId);
      }
      return this._memoDerivedAttrDeps[attributeId];
    }
  
    /**
     * Returns a list of attribute ids that a derived attribute depends on.
     *
     * @param {string} attributeId The derived attribute id
     * @returns {array} List of ids of attributes that derived attribute expressions (transform or
     * filter reference). 
     */
    _getDerivedAttributeDependencies = (attributeId) => {
        const { mapping } = this._attrsConfig[attributeId] || {};
      if (mapping?.source != SOURCES.DERIVED.value) {
        // Not a derived attribute
        return {};
      }
      const { attributeIds: explicitAttributeIds = [], filter, transform } = mapping;
      const attributeIds = new Set();
      if (Array.isArray(explicitAttributeIds)) {
        explicitAttributeIds.forEach(attributeIds.add, attributeIds);
      }
      let time;
      for (const exprStr of [transform, filter]) {
        if (exprStr) {
          // Get attribute dependencies. To do this, the expression must be well formed.
          try {
            const expr = createExpression(exprStr, mapping);
            const {
              attributeIds: depAttributeIds,
              time: depTime,
            } = expr.getDependencies();
            if (depAttributeIds) {
              depAttributeIds.forEach(attributeIds.add, attributeIds);
            }
            if (depTime) {
              // NOTE: if time elements are objects, we should do a merge. If they are timestamps,
              // e.g. one says "every 10s" and the other one "every 30s", a clever merge is needed
              time = time || depTime;
            }
          } catch (e) {
            // Throttle error to avoid spamming logs with bad configs
            this._throttledLogger && this._throttledLogger.error(
                'derivedExpressionError:' + attributeId,
                `getDerivedAttributeDependencies expression error for attribute ${attributeId}: ${e}`
            );
          }
        }
      }
      const ret = { attributeIds };
      if (time) {
        ret.time = time;
      }
      // HACK(herchu) If the expression depends on time, add an artificial dependency on CPU usage,
      // which we know it gets refreshed often (as long as the agent is online), rarely suppressed.
      // Keep this hack isolated here to avoid hacking the dependencies inference (which depends
      // on functions and will be spread in many points).
      // TODO(herchu) Remove this hack when we implement proper time-based processing in
      // svc-derived-attributes; find discussion in IO-6318.
      if (ret.time) {
        ret.attributeIds.add('cpuLoadPercentage'); // Not importing the constant, less lines to un-do
      }
      return ret;
    };
  
    /**
     * Returns the expressions used by a derived attribute
     * @param {string} attributeId
     * @returns {object}
     */
    getExpressions = (attributeId) => {
      const { mapping } = this._attrsConfig[attributeId] || {};
      if (mapping?.source != SOURCES.DERIVED.value) {
        // Not a derived attribute
        return {};
      }
      // include filter, expression and attributeIds; all necessary to know how this
      // attribute will be evaluated
      // NOTE: attributeIds (list of dependencies) is deprecated but still in use, so it is returned
      const { filter, transform, attributeIds } = mapping;
      return { filter, transform, attributeIds };
    };
  }
  
  export default DerivedAttributesConfig;