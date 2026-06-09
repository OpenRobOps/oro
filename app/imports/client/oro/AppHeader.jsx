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
 * Global app header with branding and user avatar menu.
 */
import React, { useState } from 'react';
import {
  AppBar,
  Box,
  Divider,
  Menu,
  MenuItem,
  Toolbar,
  Typography,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import LogoutIcon from '@mui/icons-material/Logout';
import SettingsIcon from '@mui/icons-material/Settings';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import AvatarInitials from './util/AvatarInitials';

const AppHeader = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
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

  const handleSettings = () => {
    handleClose();
    navigate('/configuration');
  };

  const handleLogoClick = () => navigate('/dashboards');

  return (
    <AppBar
      position="static"
      elevation={0}
      color="transparent"
      sx={{ bgcolor: 'background.paper' }}
    >
      <Toolbar sx={{ justifyContent: 'space-between' }}>
        <img
          src="/images/oro-logo.svg"
          alt="ORO:go to dashboards"
          height="22"
          onClick={handleLogoClick}
          style={{ cursor: 'pointer' }}
        />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Divider
            orientation="vertical"
            flexItem
            sx={{ borderColor: 'background.borderLight', my: '12px', height: '22px' }}
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
          <AvatarInitials name={name} src={avatar} size={22} />
          <Box sx={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
            <Typography sx={{ fontSize: '10px', color: 'common.white', lineHeight: 'normal', textTransform: 'capitalize' }}>
              {name?.split(' ')[0] || 'User'}
            </Typography>
            <Typography sx={{ fontSize: '10px', color: 'text.muted', lineHeight: 'normal' }}>
              Admin
            </Typography>
          </Box>
          <KeyboardArrowDownIcon sx={{ color: 'text.muted', fontSize: '18px' }} />
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
          <MenuItem onClick={handleSettings}>
            <SettingsIcon fontSize="small" sx={{ mr: 1 }} />
            Settings
          </MenuItem>
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
