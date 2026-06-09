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
 * Miscellaneous functions to Meteor interactions.
 *
 * Note: Some utilities in this file are common and exist in public packages. If they appear here,
 * we decided not to add them from repositories to avoid importing more packages.
 * See comments on each function.
 */
import { useMemo, useReducer, useCallback } from 'react';
import { Meteor } from 'meteor/meteor';

/**
 * when an error ocurred on a meteor method call
 * and no custom error handler was provided
 * this is the one that will be used to handle it.
 */
const defaultMeteorErrorHandler = (error, meteorMethdoName, params) => {
  console.error('Error calling ' + meteorMethdoName, { error, params });
};

/**
 * Trigger a meteor promise call to obtain the company's Access Token for the event log.
 */
const getEventLogAccessToken = () => Meteor.callAsync('eventLog.getAccessToken', { data: {} });

/**
 * Hook to allow invoking a Meteor method and obtaining its response data or error object.
 * It allows an easy and almost logic-free way to call methods while storing the response, error
 * and a "loading..." state.
 *
 * Note that this functionality exists in various packages; although there is no standard and
 * it may be overkill to add a new package just for this method.
 * For example [meteor/react-meteor-data](https://packosphere.com/meteor/react-meteor-data).
 * This version is based on [react-meteor-hooks](https://github.com/andruschka/react-meteor-hooks)
 * from NPM.
 *
 * Usage:
 * ```
 * const { isLoading, data, error, call } = useMethod('module.doSomething');
 * ...
 * // In render code, use `data`, `error` and/or `isLoading`, for example:
 * { isLoading && <Loading /> }
 * { data && <ComponentElements {data} /> }
 * ...
 * // And in some event handler, for example onClick, trigger loading the data:
 *   onSomeEvent={call({ argument })}
 * ```
 * @param {*} methodName The Meteor method name
 * @param {Function} args.transform Optional, allows transforming any response obtained by the
 *   method before being returned by the hook in `{ data }`.
 * @returns {Object} An object with fields:
 *   - data The method response, when already loaded
 *   - error The error message or object, when there is an error invoking the method
 *   - call A function acting as an (async) method invocation. It passes its arguments to the
 *     Meteor method; and returns a Promise in case the caller wants to `await` for a result.
 *   - isLoading A boolean indicating the last `call()` has not yet completed
 */
const useMethod = (methodName, { transform } = {}) => {
  const [{ isLoading, error, data }, dispatch] = useReducer(
    (state, action) => {
      switch (action.type) {
        case 'loading':
          return { ...state, isLoading: true };
        case 'success':
          return {
            ...state,
            isLoading: false,
            error: null,
            data: action.payload,
          };
        case 'failure':
          return {
            ...state,
            isLoading: false,
            error: action.payload,
            data: null,
          };
        default:
          return state;
      }
    },
    {
      isLoading: false,
      data: null,
      error: null,
    }
  );

  const call = useCallback(async (...args) => {
    dispatch({ type: 'loading' });
    try {
      const result = await Meteor.callAsync(methodName, ...args);
      dispatch({
        type: 'success',
        payload: transform ? transform(result) : result,
      });
      return result;
    } catch (err) {
      dispatch({ type: 'failure', payload: err });
      throw err;
    }
  }, [methodName, transform]);

  return { isLoading, data, error, call };
};

export {
  useMethod
};
