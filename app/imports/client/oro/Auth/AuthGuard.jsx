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
 * AuthGuard — gates the app behind authentication + role checks.
 *
 * Three states:
 *   1. Logging in          → spinner
 *   2. Not authenticated   → LoginPage
 *   3. No roles assigned   → "Pending Approval" screen
 *   4. Authenticated+roles → render children
 */
import React from 'react';
import { Box, CircularProgress, Typography, Button, Paper } from '@mui/material';
import LoginPage from './LoginPage';
import { useAuth } from '../contexts/AuthContext';

const AuthGuard = ({ children }) => {
  const { isLoggingIn, isAuthenticated, hasRoles, user, logout } = useAuth();

  // 1. Loading / logging-in
  if (isLoggingIn) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // 2. Not authenticated
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // 3. Authenticated but no roles — pending approval
  if (!hasRoles) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          bgcolor: 'background.default',
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: 4,
            maxWidth: 440,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
          }}
        >
          <Typography variant="h5" component="h1">
            Pending Approval
          </Typography>
          <Typography variant="body1" color="text.secondary" align="center">
            Your account{user?.profile?.name ? ` (${user.profile.name})` : ''} has been created
            but an administrator has not yet assigned you a role. Please contact your team admin.
          </Typography>
          <Button variant="outlined" onClick={logout} sx={{ mt: 1 }}>
            Sign out
          </Button>
        </Paper>
      </Box>
    );
  }

  // 4. All good
  return children;
};

export default AuthGuard;
