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
