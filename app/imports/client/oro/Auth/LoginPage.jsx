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
 * LoginPage — Passwordless email + OAuth login screen.
 *
 * Two-step email flow (enter email → enter code) with OAuth buttons below.
 */
import { Meteor } from 'meteor/meteor';
import { Accounts } from 'meteor/accounts-base';
import React, { useState, useCallback } from 'react';
import {
  Box,
  Button,
  Divider,
  Paper,
  TextField,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import GoogleIcon from '@mui/icons-material/Google';
import GitHubIcon from '@mui/icons-material/GitHub';
import { isArray } from 'lodash';

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

const ENABLED_OAUTH_PROVIDERS = isArray(Meteor.settings.public.oauthProviders) 
  ? Meteor.settings.public.oauthProviders 
  : [];

const LoginPage = () => {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [step, setStep] = useState('email'); // 'email' | 'code'
  const [code, setCode] = useState('');

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

  const handleSendCode = useCallback(() => {
    setError(null);
    setLoading(true);
    Accounts.requestLoginTokenForUser(
      {
        selector: email,
        userData: {
          name: email.split('@')[0],
          email: email,
          avatar: null,
        }
      },
      (err) => {
        setLoading(false);
        if (err) {
          setError(err.reason || err.message || 'Could not send code');
        } else {
          setStep('code');
        }
      }
    );
  }, [email]);

  const handleVerifyCode = useCallback(() => {
    setError(null);
    setLoading(true);
    Meteor.passwordlessLoginWithToken(
      email,
      code,
      (err) => {
        setLoading(false);
        if (err) {
          setError(err.reason || err.message || 'Invalid code');
        }
      }
    );
  }, [email, code]);

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
          border: (theme) => `1px solid ${theme.palette.background.borderLight}`,
          bgcolor: 'background.paper',
          color: 'text.primary',
        }}
      >
        <Box
          component="h1"
          sx={{
            m: 0,
            display: 'flex',
            justifyContent: 'center',
            width: '100%',
            lineHeight: 0,
          }}
        >
          <Box
            component="img"
            src="/images/oro-logo.svg"
            alt="ORO"
            sx={{
              height: 44,
              width: 'auto',
              display: 'block',
              maxWidth: '100%',
            }}
          />
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Sign in to continue
        </Typography>

        {error && (
          <Alert severity="error" sx={{ width: '100%' }}>
            {error}
          </Alert>
        )}

        {/* Passwordless email flow */}
        { ENABLED_OAUTH_PROVIDERS?.includes("email") && (
          (step === 'email') ? (
            <>
              <TextField
                label="Email address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                fullWidth
                disabled={loading}
                onKeyDown={(e) => e.key === 'Enter' && email && handleSendCode()}
                slotProps={{
                  inputLabel: { sx: { color: 'text.secondary', '&.Mui-focused': { color: 'secondary.main' } } },
                  htmlInput: { sx: { color: 'text.primary' } },
                }}
                sx={{
                  '& .MuiInput-underline:before': { borderColor: (theme) => alpha(theme.palette.text.secondary, 0.4) },
                  '& .MuiInput-underline:hover:not(.Mui-disabled):before': { borderColor: 'text.secondary' },
                  '& .MuiInput-underline:after': { borderColor: 'secondary.main' },
                }}
              />
              <Button
                variant="contained"
                color="secondary"
                onClick={handleSendCode}
                disabled={loading || !email}
                fullWidth
                sx={{ textTransform: 'none', color: 'common.white' }}
              >
                {loading ? <CircularProgress size={20} color="inherit" /> : 'Send login code'}
              </Button>
            </>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary">
                Enter the 6-digit code sent to <strong>{email}</strong>
              </Typography>
              <TextField
                label="Login code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                fullWidth
                disabled={loading}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && code && handleVerifyCode()}
                slotProps={{
                  inputLabel: { sx: { color: 'text.secondary', '&.Mui-focused': { color: 'secondary.main' } } },
                  htmlInput: { sx: { color: 'text.primary' } },
                }}
                sx={{
                  '& .MuiInput-underline:before': { borderColor: (theme) => alpha(theme.palette.text.secondary, 0.4) },
                  '& .MuiInput-underline:hover:not(.Mui-disabled):before': { borderColor: 'text.secondary' },
                  '& .MuiInput-underline:after': { borderColor: 'secondary.main' },
                }}
              />
              <Button
                variant="contained"
                color="secondary"
                onClick={handleVerifyCode}
                disabled={loading || !code}
                fullWidth
                sx={{ textTransform: 'none', color: 'common.white' }}
              >
                {loading ? <CircularProgress size={20} color="inherit" /> : 'Verify code'}
              </Button>
              <Button
                variant="text"
                size="small"
                color="secondary"
                onClick={() => { setStep('email'); setCode(''); setError(null); }}
                sx={{ textTransform: 'none' }}
              >
                Use a different email
              </Button>
            </>
          )
        )}

        {ENABLED_OAUTH_PROVIDERS?.some(provider => provider != "email") &&
         ENABLED_OAUTH_PROVIDERS?.includes("email") && (
          <Divider
            sx={{
              width: '100%',
              my: 1,
              color: 'text.secondary',
              '&::before, &::after': { borderColor: 'background.borderLight' },
            }}
          >
            or
          </Divider>
        )}

        {OAUTH_PROVIDERS.map(({ id, label, icon, loginFn }) => (
          ENABLED_OAUTH_PROVIDERS.includes(id) && (
            <Button
              key={id}
              variant="outlined"
              color="secondary"
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : icon}
              disabled={loading}
              onClick={() => handleLogin(loginFn)}
              fullWidth
              sx={{ textTransform: 'none', borderColor: 'secondary.main', color: 'text.primary' }}
            >
              {label}
            </Button>
          )
        ))}
      </Paper>
    </Box>
  );
};

export default LoginPage;
