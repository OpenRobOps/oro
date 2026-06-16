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
 * Settings page — sidebar on the left, scrollable section list on the right.
 * Clicking a sidebar entry scrolls
 * the matching section into view.
 */
import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { useAuth } from '../contexts/AuthContext';
import { ALL_ROLE_DOCS } from '../../../shared/roles';
import SettingsSidebar, { SECTIONS } from './SettingsSidebar';
import Users from './Users';
import ApiKeys from './ApiKeys';

const roleLabel = (roleId) => {
  const doc = ALL_ROLE_DOCS.find(r => r._id === roleId);
  return doc ? doc.label : roleId;
};

const SECTION_COMPONENTS = {
  users: Users,
  apiKeys: ApiKeys,
};

const useStyles = makeStyles()(theme => ({
  page: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: theme.palette.background.default,
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 24px',
    backgroundColor: theme.palette.background.navDark
  },
  topBarTitle: {
    fontSize: '20px',
    fontWeight: 600,
    color: theme.palette.text.buttonText,
  },
  body: {
    flex: 1,
    display: 'flex',
    gap: '32px',
    padding: '24px 32px',
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    minWidth: 0,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '40px',
    paddingBottom: '24px',
  }
}));

const Settings = () => {
  const { classes } = useStyles();
  const { section: routeSection } = useParams();
  const { user } = useAuth();

  const initialSection = SECTIONS.find(s => s.id === routeSection)?.id || SECTIONS[0].id;
  const [activeSection, setActiveSection] = useState(initialSection);

  const profile = user?.profile || {};
  const firstRoleId = user?.userRoles?.[0];
  const sidebarUser = useMemo(() => ({
    name: profile.name || 'User',
    role: firstRoleId ? roleLabel(firstRoleId) : 'Member',
    avatar: profile.avatar,
  }), [profile.name, profile.avatar, firstRoleId]);

  const handleSelect = useCallback((id) => {
    setActiveSection(id);
  }, []);

  useEffect(() => {
    if (routeSection && SECTIONS.some(s => s.id === routeSection)) {
      setActiveSection(routeSection);
    }
  }, [routeSection]);

  // Render only the section selected in the sidebar (one at a time).
  const ActiveSection = SECTION_COMPONENTS[activeSection];

  return (
    <Box className={classes.page}>
      <Box className={classes.topBar}>
        <Typography className={classes.topBarTitle}>Settings</Typography>
      </Box>
      <Box className={classes.body}>
        <SettingsSidebar
          user={sidebarUser}
          active={activeSection}
          onSelect={handleSelect}
        />
        <Box className={classes.content}>
          {ActiveSection && <ActiveSection user={user} />}
        </Box>
      </Box>
    </Box>
  );
};

export default Settings;
