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

const App = () => (
  <ErrorBoundary>
    <BrowserRouter>
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