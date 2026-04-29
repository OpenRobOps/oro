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
 * Context for handling a shared state as a "current UI interaction", which is active until
 * executed or cancelled. This "active interaction" may have its own metadata, also stored
 * as part of the context value. It allows decoupling the various components that need
 * to know the active operation and interact with it, as well as providing higher level
 * wrappers for working with this state.
 *
 * This context is implemented initially for the Navigation Detail active operation (waypoint
 * navigation OR relocalize OR open teleop OR ...), but its implementation is generic and can
 * be used for any similar UI interaction with state.
 *
 * Usage Overview
 *
 * In the closest common ancestor of all components using interactions, instantiate the Provider:
 * ```
 * <ActiveInteractionProvider>
 *    ... Your components ...
 * </ActiveInteractionProvider>
 * ```
 *
 * Then, register a callback for each interaction that you want to have executed. This can be done
 * inside another component, or by defining an executor component for this specific purpose.
 * The callback should be defined like so:
 *
 * ```
 * const { setInteractionCallback, clearIntaractionCallback } = useActiveInteraction();
 *
 * useEffect(() => {
 *   setInteractionCallback('navigation', (data) => { doNavigationStuff() });
 *   return () => clearInteractionCallback('navigation);
 * }, []);
 * ```
 *
 * Then individual components can access the context and change it like this:
 * ```
 * const { dispatch, activeInteraction, data } = useActiveInteraction();
 * * Determine current interaction
 * const isNavigationActive = activeInteraction == 'navigation';
 * * Change current interaction:
 * onClick={() => {
 *   dispatch(setActiveInteractionMessage('navigation'))
 * }}>
 * * In some button that confirms the interaction, execute it:
 * onClick={
 *   () => dispatch(executeInteractionMessage())
 * }>
 * ````
 *
 * Refer to documentation of each exported function for usage, and the design document:
 *
 * Design: https://docs.google.com/document/d/1oz40z21zH7nr8GQSOaOePt4edPtO_ZAJvLXp_hpi-eQ/edit#heading=h.984lpysnbv8j
 */
import React, { createContext, useContext, useCallback, useMemo, useReducer } from 'react';
import { isFunction } from 'lodash';

// Message fields for dispatch()
const MSG_SET_DATA_FIELD = 'setData';
const MSG_SET_INTERACTION_FIELD = 'setInteraction';
const MSG_EXECUTE_INTERACTION_FIELD = 'executeInteraction';

// React context to keep a current interaction. Note that it is NOT exported:
// the wrapper ActiveInteractionProvider is used instead.
const ActiveInteractionContext = createContext();

/**
 * Message builder to change the active interaction
 */
const setActiveInteractionMessage = (interaction, data = null) => ({
  [MSG_SET_INTERACTION_FIELD]: interaction,
  [MSG_SET_DATA_FIELD]: data
});

/**
 * Message builder to change the state (data) of current interaction
 */
const setInteractionDataMessage = data => ({
  [MSG_SET_DATA_FIELD]: data
});

/**
 * Message builder to execute an interaction (by default, the current active interaction)
 */
const executeInteractionMessage = (interaction = null, data = null) => ({
  [MSG_EXECUTE_INTERACTION_FIELD]: interaction,
  [MSG_SET_DATA_FIELD]: data
});

/**
 * This reducer is the internal mutator function for the context state (see
 * ActiveInteractionProvider below). It receives 'messages' to alter the context state, which
 * should always be created with the `*Message` functions exported in this module.
 *
 * It follows the useReducer React hook pattern, so its args are:
 *
 * @param state is the current context value
 * @param action is an arbitrary object that represents how to mutate the state. This should NOT
 *    be constructed by the user; instead, the *Message functions take care of creating legal
 *    values.
 */
function activeInteractionReducer(state, action) {
  const { _interactionCallbacks, data, activeInteraction } = state;
  if (MSG_SET_INTERACTION_FIELD in action) {
    // Message to change current active interaction
    const {
      [MSG_SET_INTERACTION_FIELD]: nextInteractionParam,
      [MSG_SET_DATA_FIELD]: nextData, // this field is optional (null by default)
    } = action;
    let nextInteraction;
    if (isFunction(nextInteractionParam)) {
      // same as React's useState, allow passing a function as next data;
      nextInteraction = nextInteractionParam(activeInteraction);
    } else {
      nextInteraction = nextInteractionParam;
    }
    if (nextInteraction && !(nextInteraction in state._interactionCallbacks)) {
      throw new Error(`Unhandled activeInteraction type: ${nextInteraction} (available: ${Object.keys(state._interactionCallbacks)})`);
    }
    return { ...state, data: nextData || null, activeInteraction: nextInteraction };
  } else if (MSG_EXECUTE_INTERACTION_FIELD in action) {
    // Message to execute the current interaction (or, immediately execute a different action)
    const {
      [MSG_EXECUTE_INTERACTION_FIELD]: executeInteraction,
      // this data field is optional; if null or omitted then data in state is used
      [MSG_SET_DATA_FIELD]: moreData
    } = action;
    const interaction = executeInteraction || activeInteraction;

    if (!(interaction in _interactionCallbacks)) {
      throw new Error('ActiveInteractionContext: Bad interactionCallback value passed to executeInteraction: ' + interaction);
    }
    // Invoke the interaction callback. If it returns true ("handled"), then reset active
    // interaction. Otherwise keep current state
    if (_interactionCallbacks[interaction](data, moreData)) {
      return { ...state, data: null, activeInteraction: null };
    } else {
      return state;
    }
  } else if (MSG_SET_DATA_FIELD in action) {
    // Message to change data (state) of the current interaction
    const { [MSG_SET_DATA_FIELD]: nextData } = action;
    if (isFunction(nextData)) {
      // same as React's useState, allow passing a function as next data; which applies to the
      // current state (making it easier to implement state data modifiers without depending
      // on current context data)
      return { ...state, data: nextData(state.data) };
    } else {
      return { ...state, data: nextData };
    }
  } else {
    console.error('Invalid argument at activeInteractionReducer:', action);
    return state;
  }
}

/**
 * Provider for ActiveInteractionContext. It is initialized with a set of
 * callbacks: a dictionary mapping from interaction type (string) to a callback function.
 * This Provider is used only once to provide the Context to all children, then they
 * will refer to useActiveInteraction() hook to get the state (context value) and modify it.
 */
function ActiveInteractionProvider({ ...props }) {
  const [state, dispatch] = useReducer(activeInteractionReducer, {
    _interactionCallbacks: {},
    activeInteraction: null,
    data: null
  });
  const value = useMemo(() => [state, dispatch], [state]);
  return (
    <ActiveInteractionContext.Provider value={value} {...props} />
  );
}

/**
 * Main entry point for using ActiveInteractionContext: This hook provides users with three values:
 *   - activeInteraction: The 'key' of the current interaction, a user-defined value (or null if
 *     none is active).
 *   - data: User-defined metadata associated to the current interaction. For example, the
 *     coordinates of a selected target pose.
 *   - dispatch(): A function to mutate the context. The allowed arguments for this function are
 *     constructed by setActiveInteractionMessage, setInteractionDataMessage and
 *     executeInteractionMessage.
 */
function useActiveInteraction() {
  const context = useContext(ActiveInteractionContext);
  if (context === undefined) {
    throw new Error('useActiveInteraction must be used within a ActiveInteractionProvider');
  }
  const [_rawState, dispatch] = context;

  // Destructure some fields for callers' convenience
  const { activeInteraction, data, _interactionCallbacks } = (_rawState || {});

  // Mechanism to allow (re-)setting a callback to be executed for a given active interaction
  // NOTE(adamantivm) We purposely change the _interactionCallbacks object directly, to avoid
  // a re-render, since this method may be called repeatedly with updated callbacks that are bound
  // to changing parameter values.
  const setInteractionCallback = useCallback((interaction, callback, force = false) => {
    if (!force && interaction in _interactionCallbacks) {
      throw new Error(`Callback already registered for interaction ${interaction}.`
        + 'If this expected the force = true param.');
    }
    _interactionCallbacks[interaction] = callback;
  }, [_interactionCallbacks]);
  const clearInteractionCallback = useCallback((interaction, force = false) => {
    if (!force && !(interaction in _interactionCallbacks)) {
      throw new Error(`No callback registered for interaction ${interaction}.`
        + 'If this expected the force = true param.');
    }
    delete _interactionCallbacks[interaction];
  }, [_interactionCallbacks]);

  // Pre-bound convenience methods
  const setActiveInteraction = useCallback((interaction, data0) => {
    dispatch(setActiveInteractionMessage(interaction, data0));
  }, [dispatch]);
  const executeInteraction = useCallback((interaction, data0) => {
    dispatch(executeInteractionMessage(interaction, data0));
  }, [dispatch]);
  const setInteractionData = useCallback((data0) => {
    dispatch(setInteractionDataMessage(data0));
  }, [dispatch]);

  return {
    // activeInteraction is a string identifying the 'type' of interaction in progress.
    // It depends on how the Provider was initialized
    activeInteraction,
    // data field contains any metadata considered state or arguments for the current interaction,
    // for example the pose to be sent to a Waypoint Nav / Relocalize
    data,
    // Allows a caller to register a different interaction callback
    setInteractionCallback,
    // Remove an interaction callback
    clearInteractionCallback,
    // Set a new interaction to be the active one
    setActiveInteraction,
    // Executes an active interaction (by default, the currently active one)
    executeInteraction,
    // Updates the data for the currently active interaction
    setInteractionData
  };
}

export {
  ActiveInteractionProvider,
  useActiveInteraction
};
