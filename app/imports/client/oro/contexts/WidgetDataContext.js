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
 * Context to maintain widget information which may affect rendering; also allowing to share
 * data between the dashboard widget component and the toolbar component.
 *
 * For now, used only to set the widget title, which is rendered by dashboard generic components
 * (Section), while it can be modified by the widget components themselves (using setWidgetTitle
 * provided by the context hook useWidgetData).
 */
import React, { createContext, useContext, useCallback, useMemo, useReducer } from 'react';
import PropTypes from 'prop-types';

// React context. Note that it should not be exported; users should use
// WidgetDataProviedr and useWidgetData instead.
// It's only exported for old components (class-based)
const WidgetDataContext = createContext();
WidgetDataContext.displayName = 'widgetData';

// Dispatcher action constants (not exported)
const MSG_SET_WIDGET_TITLE = 'setTitle';

// Context reducer function
function widgetDataReducer(state, message) {
  const { action, callback } = message;
  switch (action) {
    // Update for a single robot localization data
    case MSG_SET_WIDGET_TITLE: {
      return { ...state, widgetTitle: callback(state) };
    }
    default:
      console.error('Unknown action sent to widgetDataReducer: ' + action);
      return state;
  }
}

// Context provider. Initialized with some properties from widget configuration (title for now)
function WidgetDataProvider({ title, ...props }) {
  const [state, dispatch] = useReducer(widgetDataReducer, {
    // data from the widget spec (config):
    spec: {
      title,
    },
    // other fields are the current context state (which can be changed via reducer functions)
    widgetTitle: title
  });
  const value = useMemo(() => [state, dispatch], [state]);
  return (
    // eslint-disable-next-line react/jsx-props-no-spreading
    <WidgetDataContext.Provider value={value} {...props} />
  );
}
WidgetDataProvider.propTypes = {
  title: PropTypes.string
};

// Hook to provide context data and setter functions
function useWidgetData() {
  const context = useContext(WidgetDataContext);
  if (context === undefined) {
    throw new Error('useWidgetData must be used within a WidgetDataProvider');
  }
  const [state, dispatch] = context;

  // Pre-bound convenience methods
  const setWidgetTitle = useCallback((callback) => {
    dispatch({
      action: MSG_SET_WIDGET_TITLE,
      callback
    });
  }, [dispatch]);

  return {
    ...state,
    setWidgetTitle,
  };
}

export {
  WidgetDataProvider,
  useWidgetData,
  // Context and message types are only exported for old, class-bsaed components. New
  // components should use useWidgetData (with its functions returned by that hook)
  WidgetDataContext
};
