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
import { CssBaseline } from '@mui/material';
import { ThemeProvider, StyledEngineProvider } from '@mui/material/styles';
import { BrowserRouter } from 'react-router-dom';
// ORO modules
import theme from './Styles';
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

const App = () => (
  <ErrorBoundary>
    <BrowserRouter future={FUTURE_FLAG}>
      <AuthProvider>
        <AuthGuard>
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

const AppContainer = () => (
  <StyledEngineProvider injectFirst>
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      <App />
    </ThemeProvider>
  </StyledEngineProvider>
);

export default AppContainer;