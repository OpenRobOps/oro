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
 * Left side of the Settings page: user identity card + section navigation.
 */
import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import { Box, Chip, Typography } from '@mui/material';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import VpnKeyOutlinedIcon from '@mui/icons-material/VpnKeyOutlined';
import { makeStyles } from 'tss-react/mui';
import AvatarInitials from '../util/AvatarInitials';

export const SECTIONS = [
  { id: 'users', label: 'Users', Icon: GroupOutlinedIcon },
  { id: 'apiKeys', label: 'API keys', Icon: VpnKeyOutlinedIcon },
];

const useStyles = makeStyles()(theme => ({
  sidebar: {
    width: 260,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    borderRadius: '8px',
    backgroundColor: theme.palette.background.sidebar,
    border: `1px solid ${theme.palette.background.sidebarBorder}`,
    overflow: 'hidden',
  },
  userCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    borderBottom: `1px solid ${theme.palette.background.sidebarBorder}`,
  },
  userInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  userName: {
    fontSize: '14px',
    fontWeight: 600,
    color: theme.palette.text.detailsValue,
    textTransform: 'capitalize',
  },
  roleChip: {
    fontSize: '10px',
    fontWeight: 400,
    color: theme.palette.text.darkBlue,
    backgroundColor: theme.palette.background.selectedNav,
    textTransform: 'capitalize',
    alignSelf: 'flex-start',
    height: 'auto',
    '& .MuiChip-label': {
      padding: '4px 8px',
      textTransform: 'capitalize',
      fontFamily: 'Inter',
      fontWeight: 500,
      color: theme.palette.text.darkBlue,
    },
    borderRadius: '4px',
  },
  settingsSidebarList: {
    display: 'flex',
    flexDirection: 'column',
    padding: '8px',
  },
  settingsSidebarItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
    color: theme.palette.text.heading,
    backgroundColor: 'transparent',
    fontSize: '14px',
    fontWeight: 500,
    '&:hover': {
      backgroundColor: theme.palette.background.hover,
    },
  },
  settingsSidebarItemActive: {
    color: theme.palette.text.darkBlue,
    backgroundColor: theme.palette.background.selectedNav,
    '&:hover': {
      backgroundColor: theme.palette.background.selectedNav,
    },
  },
  settingsSidebarIcon: {
    fontSize: 18,
  },
}));

const SettingsSidebarItem = ({ id, label, Icon, isActive, onSelect }) => {
  const { classes, cx } = useStyles();
  const handleClick = useCallback(() => onSelect(id), [onSelect, id]);
  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Enter' || event.key === ' ') onSelect(id);
  }, [onSelect, id, handleClick]);

  return (
    <Box
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cx(classes.settingsSidebarItem, isActive && classes.settingsSidebarItemActive)}
    >
      <Icon className={classes.settingsSidebarIcon} />
      {label}
    </Box>
  );
};

const SettingsSidebar = ({ user, active, onSelect }) => {
  const { classes } = useStyles();
  const { name, role, avatar } = user || {};
  return (
    <Box className={classes.sidebar}>
      <Box className={classes.userCard}>
        <AvatarInitials name={name} src={avatar} size={36} />
        <Box className={classes.userInfo}>
          <Typography className={classes.userName}>
            {name || 'User'}
          </Typography>
          {role && <Chip label={role} size="small" className={classes.roleChip} />}
        </Box>
      </Box>
      <Box className={classes.settingsSidebarList}>
        {SECTIONS.map(({ id, label, Icon }) => (
          <SettingsSidebarItem
            key={id}
            id={id}
            label={label}
            Icon={Icon}
            isActive={active === id}
            onSelect={onSelect}
          />
        ))}
      </Box>
    </Box>
  );
};

SettingsSidebar.propTypes = {
  user: PropTypes.shape({
    name: PropTypes.string,
    role: PropTypes.string,
    avatar: PropTypes.string,
  }),
  active: PropTypes.string,
  onSelect: PropTypes.func.isRequired,
};

export default SettingsSidebar;
