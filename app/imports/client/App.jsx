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
 * This is the client-side entry point for the webapp.
 */
import React from 'react';
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
import { CssBaseline } from '@mui/material';
import { ThemeProvider, StyledEngineProvider } from '@mui/material/styles';
import { BrowserRouter } from 'react-router-dom';
// ORO modules
import { useOroTheme, setTheme, urlThemeOverride, AUTO_THEME } from './Styles';
import { Preferences } from '../lib/collections';
import Routes from './oro/Routes';
import AppHeader from './oro/AppHeader';
import ErrorBoundary from './oro/ErrorBoundary';
import { AuthProvider } from './oro/contexts/AuthContext';
import { AuthGuard } from './oro/Auth';

const appLayoutStyle = {
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  overflow: 'hidden',
};

const appContentStyle = {
  flex: 1,
  minHeight: 0,
  overflow: 'hidden',
};

const FUTURE_FLAG = {
  // These flags ensure future-compatibility and remove annoying console warnings
  v7_relativeSplatPath: true,
  v7_startTransition: true
};

/**
 * Applies the theme stored in the user's preferences once they are available.
 * The ?theme= URL override wins over the stored preference.
 */
const ThemePreference = () => {
  useTracker(() => {
    const userId = Meteor.userId();
    if (urlThemeOverride || !userId) {
      return;
    }
    const handle = Meteor.subscribe('userPreferences');
    if (!handle.ready()) {
      return;
    }
    const prefs = Preferences.findOne({ entityType: 'user', entityId: userId });
    setTheme(prefs?.ui?.theme || AUTO_THEME);
  });
  return null;
};

const App = () => (
  <ErrorBoundary>
    <BrowserRouter future={FUTURE_FLAG}>
      <AuthProvider>
        <AuthGuard>
          <ThemePreference />
          <div style={appLayoutStyle}>
            <AppHeader />
            <div style={appContentStyle}>
              <Routes />
            </div>
          </div>
        </AuthGuard>
      </AuthProvider>
    </BrowserRouter>
  </ErrorBoundary>
);

const AppContainer = () => {
  // Re-renders on setTheme(); MUI/emotion restyle everything live. Widgets
  // that paint imperatively (OpenLayers maps) pick the new colors up when
  // they remount, i.e. on the next route navigation.
  const theme = useOroTheme();
  return (
    <StyledEngineProvider injectFirst>
      <ThemeProvider theme={theme}>
        <CssBaseline enableColorScheme />
        <App />
      </ThemeProvider>
    </StyledEngineProvider>
  );
};

export default AppContainer;