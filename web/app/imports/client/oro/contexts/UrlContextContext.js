/**
 * Context used to sync the Url context so that every place where the url
 * context is needed has the same (context, setContext) read and write functions
 *
 * use the hook useUrlContext to access the url context
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { getUrlParams, toUrlParamString } from '../../../lib/urlParser';
import { serializeCtx, deserializeCtx } from '../../../lib/context';

const UrlContextContext = React.createContext({});
UrlContextContext.displayName = 'urlContextContext';

/**
 * Update the current url to reflect the current context.
 *
 * @param {string} location react-route location object
 * @param {string} navigate react-route navigate function
 * @param {object} context selected context
 */
const updateUrl = ({ location, navigate, context }) => {
  const pathname = location.pathname || '';
  const search = context ? toUrlParamString({ ctx: serializeCtx(context) }) : location.search;
  if (search != location.search) {
    navigate(`${pathname}${search}`);
  }
};

/**
 * Deserialize context from the given location's query params.
 *
 * @param {object} location react-route location object
 */
const readContext = (location) => {
  if (!location) {
    return {};
  }
  const { ctx } = getUrlParams(location.search);
  return deserializeCtx(ctx);
};

function UrlContextProvider(props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [context, setContext] = useState(readContext(location));

  /**
   * Context update effect:
   * Whenever context changes and it's not empty (that is, if it was initialized),
   * update URL query params with its serialization.
   *
   * @depends context - updated context
   */
  useEffect(() => {
    if (context) {
      updateUrl({ location, navigate, context });
    }
  }, [context]);

  return (
    <UrlContextContext.Provider value={[context, setContext]} {...props} />
  );
}

// Hook that returns the context and setContext function of the url context
function useUrlContext() {
  const context = React.useContext(UrlContextContext);
  if (context === undefined) {
    console.error('useUrlContext called outside of a UrlContextContext');
    // If a component attempts using the context with no provider, return null to them
    return null;
  }
  // Context is an array containing [context, setContext]
  return context;
}

export {
  UrlContextContext,
  UrlContextProvider,
  useUrlContext
};
