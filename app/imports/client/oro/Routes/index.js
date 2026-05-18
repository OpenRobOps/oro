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
 * Top level app component that decides which page to show based on the URL. It also handle
 * some redirects e.g. if user is not logged in, not part of a company, or if some URL parts are
 * missing.
 *
 * About auth flow, see design:
 * https://docs.google.com/document/d/12H9U1idCCt9awG_-wrx1I6slS2oU8U4YzeYtuBzOB8Y/edit#heading=h.26nq18pv637l
 */
import React from 'react';
import {
  Routes,
  Route,
  Navigate,
  useLocation
} from 'react-router-dom';
import PropTypes from 'prop-types';
// ORO modules
import DashboardSelector from './screens/DashboardSelector';

// Settings Screen component
const SettingsScreen = () => {
  return (
    "Settings Screen placeholder"
  )
};

// eslint-disable-next-line react/prop-types
const RedirectWithParams = ({ url, ignoreHash }) => {
  // NOTE(herchu) This does not support (yet) "merging" any query params given
  // in `url` with those from the original url we are redirecting from.
  const location = useLocation();
  const search = location.search || '';
  const hash = ignoreHash || !location.hash ? '' : location.hash;
  return (
    <Navigate to={url + search + hash} replace />
  );
};

const OroRoutes = () => {
  return (
    <Routes>
      {/* ---------------------------------------------- */}
      {/* Paths only available to fully registered users */}
      {/* ---------------------------------------------- */}

      <Route path="/configuration/:section?" Component={SettingsScreen} />
      {/* Dashboard are accessible under /dashboards/... route */}
      <Route path="/dashboards/:dashboardId?" Component={DashboardSelector} />

      {/* If the user reached a path that does not match any of the above, redirect them to
          Dashboards page */}
      <Route path="*" element={<RedirectWithParams url={'/dashboards'} ignoreHash />} />
    </Routes>
  );
};

OroRoutes.propTypes = {
  user: PropTypes.object,
};

export default OroRoutes;
