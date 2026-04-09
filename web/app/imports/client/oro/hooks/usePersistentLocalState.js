/**
 * usePersistentLocalState is a hook that behaves exactly as React's useState, but also persisting
 * the state to local storage: https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage
 *
 * @param {Object} initialState the initial value for the state (useState argument)
 * @param {String} storageKey A unique key within localStorage (should not be repeated with other
 *   keys for values stored across the app)
 * @param {Array} persistentKeysList (optional) If only a few keys of the state require being
 *   persisted, specify them in this array of strings. Otherwise, the entire state object is
 *   persisted. NOTE: When passing this argument, always make sure to pass a *constant* value!
 *   (not an array literal that will be a different object every time).
 */
import { useEffect, useState } from 'react';
import { pick } from 'lodash';

const usePersistentLocalState = (initialState, storageKey, persistentKeysList = null) => {
  const [state, setState] = useState(initialState);

  useEffect(() => {
    // Every time the state changes (someone called setState) persist it.
    if (state == initialState) {
      // Ignore just the initial value: otherwise, it always get persisted (before we load an
      // initial value from storage)
      return;
    }
    if (state) {
      const stateToPersist = persistentKeysList ? pick(state, persistentKeysList) : state;
      localStorage.setItem(storageKey, JSON.stringify(stateToPersist));
    } else {
      localStorage.removeItem(storageKey);
    }
  }, [state]);

  useEffect(() => {
    // Executed only once. Attempt to load a value from persistent storage, and use it as state
    const item = localStorage.getItem(storageKey);
    if (item) {
      try {
        const value = JSON.parse(item);
        if (value) {
          setState(persistentKeysList ? { ...initialState, ...value } : value);
        }
      } catch (e) {
        // If the value cannot be parsed, ignore it -- and remove it from local storage
        console.error('usePersistentState: Bad value stored in key', storageKey);
        localStorage.removeItem(storageKey);
      }
    }
  }, []);
  return [state, setState];
};

export default usePersistentLocalState;
