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
      {/* Dashboard are accessible under /dashboards/... route.
          Note that without a companyId, this will fail to match and use the RedirectWithParams
          at the end (so the primary companyId of the user is added to the URL */}
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
