/**
 * LoginPage — OAuth login screen.
 *
 * Renders a centered card with one button per configured OAuth provider.
 * To add a new provider: push an entry into OAUTH_PROVIDERS and install
 * the matching Meteor accounts-* package.
 */
import { Meteor } from 'meteor/meteor';
import React, { useState, useCallback } from 'react';
import {
  Box,
  Button,
  Paper,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import GitHubIcon from '@mui/icons-material/GitHub';

// ---- Extension point for OAuth providers ----
const OAUTH_PROVIDERS = [
  {
    id: 'google',
    label: 'Sign in with Google',
    icon: <GoogleIcon />,
    loginFn: (cb) =>
      Meteor.loginWithGoogle(
        { requestPermissions: ['email', 'profile'] },
        cb
      ),
  },
  {
    id: 'github',
    label: 'Sign in with GitHub',
    icon: <GitHubIcon />,
    loginFn: (cb) =>
      Meteor.loginWithGithub(
        { requestPermissions: ['user:email'] },
        cb
      ),
  },
];

const LoginPage = () => {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = useCallback((loginFn) => {
    setError(null);
    setLoading(true);
    loginFn((err) => {
      setLoading(false);
      if (err) {
        setError(err.reason || err.message || 'Login failed');
      }
    });
  }, []);

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
          maxWidth: 400,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
        }}
      >
        <Typography variant="h4" component="h1" gutterBottom>
          OpenRobOps
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Sign in to continue
        </Typography>

        {error && (
          <Alert severity="error" sx={{ width: '100%' }}>
            {error}
          </Alert>
        )}

        {OAUTH_PROVIDERS.map(({ id, label, icon, loginFn }) => (
          <Button
            key={id}
            variant="outlined"
            startIcon={loading ? <CircularProgress size={20} /> : icon}
            disabled={loading}
            onClick={() => handleLogin(loginFn)}
            fullWidth
            sx={{ textTransform: 'none' }}
          >
            {label}
          </Button>
        ))}
      </Paper>
    </Box>
  );
};

export default LoginPage;
