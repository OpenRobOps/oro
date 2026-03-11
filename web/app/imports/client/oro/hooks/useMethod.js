/**
 * Generic hook for calling a Meteor method asynchronously.
 *
 * @param {string} methodName - The Meteor method name to call.
 * @returns {{ execute: Function, loading: boolean, error: Error|null }}
 *
 * @example
 * const { execute, loading, error } = useMethod('myMethod');
 * const result = await execute({ arg1: 'value' });
 */

import { useCallback, useState } from 'react';
import { Meteor } from 'meteor/meteor';

const useMethod = (methodName) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = useCallback(async (args) => {
    setLoading(true);
    setError(null);
    try {
      return await Meteor.callAsync(methodName, args);
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [methodName]);

  return { execute, loading, error };
};

export default useMethod;
