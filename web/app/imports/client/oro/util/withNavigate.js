/**
 * This HOC is implemented as a replacement of `withRouter` HOC (from react-routes v5) only
 * for backwards compatibility with class components that cannot use the new hooks
 * (useLocation, useNavigate, useParams).
 * It fetches the Router params from those hooks, and passes them to the wrapped components
 * in params { navigate, location, urlPathParams }
 *
 * Compatibility / migration notes:
 *  - `history` does not exist anymore in react-router v6, so a `navigate` function is used instead
 *  - `params` is so generic as a prop name that we are renaming it to `urlPathParams` (as often
 *    it ends up being used far from these hooks, where "params" may have any meaning).
 *
 * Please do NOT add new uses of this function. Write functional components and use only the hooks
 * you need from react-router
 */
import React from 'react';
import { useNavigate, useLocation, useParams } from 'react-router';
/**
 * @deprecated
 */
const legacyWithNavigate = ClassComponent => (props) => {
  const navigate = useNavigate();
  const location = useLocation();
  const urlPathParams = useParams();
  return (
    <ClassComponent
      {...props}
      navigate={navigate}
      location={location}
      urlPathParams={urlPathParams}
    />
  );
};

export {
  // eslint-disable-next-line import/prefer-default-export
  legacyWithNavigate
};
