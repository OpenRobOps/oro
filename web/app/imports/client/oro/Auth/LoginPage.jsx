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
    console.log("**********handleSendCode", email);
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

        {/* Passwordless email flow */}
        {step === 'email' ? (
          <>
            <TextField
              label="Email address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              disabled={loading}
              onKeyDown={(e) => e.key === 'Enter' && email && handleSendCode()}
            />
            <Button
              variant="contained"
              onClick={handleSendCode}
              disabled={loading || !email}
              fullWidth
              sx={{ textTransform: 'none' }}
            >
              {loading ? <CircularProgress size={20} /> : 'Send login code'}
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
            />
            <Button
              variant="contained"
              onClick={handleVerifyCode}
              disabled={loading || !code}
              fullWidth
              sx={{ textTransform: 'none' }}
            >
              {loading ? <CircularProgress size={20} /> : 'Verify code'}
            </Button>
            <Button
              variant="text"
              size="small"
              onClick={() => { setStep('email'); setCode(''); setError(null); }}
              sx={{ textTransform: 'none' }}
            >
              Use a different email
            </Button>
          </>
        )}

        <Divider sx={{ width: '100%', my: 1 }}>or</Divider>

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
