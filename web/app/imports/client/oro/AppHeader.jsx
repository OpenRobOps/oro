/**
 * Global app header with branding and user avatar menu.
 */
import React, { useState } from 'react';
import {
  AppBar,
  Avatar,
  Box,
  Divider,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from './contexts/AuthContext';

/** Return up to two initials from a full name. */
const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const AppHeader = () => {
  const { user, logout } = useAuth();
  const [anchorEl, setAnchorEl] = useState(null);
  const menuOpen = Boolean(anchorEl);

  const profile = user?.profile || {};
  const { name, email, avatar } = profile;

  const handleOpen = (e) => setAnchorEl(e.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const handleLogout = () => {
    handleClose();
    logout();
  };

  return (
    <AppBar position="static" sx={{ bgcolor: '#170E28' }}>
      <Toolbar sx={{ justifyContent: 'space-between' }}>
        <img src="/images/oro-logo.svg" alt="ORO" height="22" />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Divider
            orientation="vertical"
            flexItem
            sx={{ borderColor: '#3E3155', my: '12px', height: '22px' }}
          />
          <Box
            onClick={handleOpen}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              py: '5px',
              borderRadius: '4px',
            }}
          >
          <Avatar
            src={avatar || undefined}
            sx={{
              width: 22,
              height: 22,
              bgcolor: '#3A285A',
              fontSize: '11px',
              fontWeight: 700,
              color: '#D0D0D0',
              fontFamily: 'Inter, Helvetica, Arial, sans-serif',
            }}
          >
            {!avatar && getInitials(name)}
          </Avatar>
          <Box sx={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
            <Typography sx={{ fontSize: '10px', color: '#FFFFFF', lineHeight: 'normal' }}>
              {name?.split(' ')[0] || 'User'}
            </Typography>
            <Typography sx={{ fontSize: '10px', color: '#AAAAAA', lineHeight: 'normal' }}>
              Admin
            </Typography>
          </Box>
          <KeyboardArrowDownIcon sx={{ color: '#AAAAAA', fontSize: '18px' }} />
          </Box>
        </Box>
        <Menu
          anchorEl={anchorEl}
          open={menuOpen}
          onClose={handleClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          <Box sx={{ px: 2, py: 1 }}>
            <Typography variant="subtitle2">{name}</Typography>
            {email && (
              <Typography variant="body2" color="text.secondary">
                {email}
              </Typography>
            )}
          </Box>
          <Divider />
          <MenuItem onClick={handleLogout}>
            <LogoutIcon fontSize="small" sx={{ mr: 1 }} />
            Logout
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
};

export default AppHeader;
