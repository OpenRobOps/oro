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
 * useApiKeys: fetch the current user's own API keys (sanitized metadata) via
 * the `apiKeys.list` method. The list changes only on explicit create/revoke
 * actions, so a simple fetch + refetch is preferred over a reactive
 * subscription. Returns { isLoading, data, accessDenied, refetch }.
 */
import { useState, useEffect, useCallback } from 'react';
import { Meteor } from 'meteor/meteor';

const useApiKeys = () => {
  const [state, setState] = useState({ isLoading: true, data: [], accessDenied: false });

  const refetch = useCallback(async () => {
    setState(s => ({ ...s, isLoading: true }));
    try {
      const data = await Meteor.callAsync('apiKeys.list');
      setState({ isLoading: false, data: data || [], accessDenied: false });
    } catch (err) {
      setState({ isLoading: false, data: [], accessDenied: err?.error === 'not-authorized' });
    }
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  return { ...state, refetch };
};

export default useApiKeys;
