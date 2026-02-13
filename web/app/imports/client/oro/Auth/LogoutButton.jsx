/**
 * LogoutButton — small icon button for use in headers / toolbars.
 */
import React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from '../contexts/AuthContext';

const LogoutButton = () => {
  const { logout } = useAuth();

  return (
    <Tooltip title="Sign out">
      <IconButton onClick={logout} color="inherit" aria-label="Sign out">
        <LogoutIcon />
      </IconButton>
    </Tooltip>
  );
};

export default LogoutButton;
