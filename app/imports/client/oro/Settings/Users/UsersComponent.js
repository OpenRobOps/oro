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
 * UsersComponent: page-level layout for the Users settings section. Renders
 * the page title + subtitle and delegates the pending and members lists to
 * their own components.
 */
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { Box, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { usersSpanMultipleSources } from '../../../../shared/users';
import PendingList from './PendingList';
import UsersTable from './UsersTable';
import AdminEmailsWarning from './AdminEmailsWarning';

const useStyles = makeStyles()(theme => ({
  title: {
    fontSize: '20px',
    fontWeight: 600,
    color: theme.palette.text.heading,
    marginBottom: '4px',
  },
  subtitle: {
    fontSize: '13px',
    color: theme.palette.text.subheading,
    marginBottom: '20px',
    paddingBottom: '16px',
    borderBottom: `1px solid ${theme.palette.background.borderLight}`,
  },
  loading: {
    fontSize: '13px',
    color: theme.palette.text.muted,
  },
}));

const UsersComponent = ({
  isLoading, pendingUsers, approvedUsers, unregisteredAdminEmails, currentUserId,
  onApproveUser, onRejectUser, onChangeRole, onDeleteUser,
}) => {
  const { classes } = useStyles();
  // Decide whether to show per-user source labels once, across the whole screen
  // (pending + approved), so both lists show them under the same condition.
  const showSources = useMemo(
    () => usersSpanMultipleSources([...pendingUsers, ...approvedUsers]),
    [pendingUsers, approvedUsers],
  );
  return (
    <Box>
      <Typography className={classes.title}>Users</Typography>
      <Typography className={classes.subtitle}>
        Review and approve pending registrations.
      </Typography>
      {isLoading && <Typography className={classes.loading}>Loading users…</Typography>}
      {!isLoading && (
        <>
          <PendingList
            users={pendingUsers}
            showSources={showSources}
            onApproveUser={onApproveUser}
            onRejectUser={onRejectUser}
          />
          <AdminEmailsWarning emails={unregisteredAdminEmails} />
          <UsersTable
            users={approvedUsers}
            showSources={showSources}
            currentUserId={currentUserId}
            onChangeRole={onChangeRole}
            onDeleteUser={onDeleteUser}
          />
        </>
      )}
    </Box>
  );
};

UsersComponent.propTypes = {
  isLoading: PropTypes.bool,
  pendingUsers: PropTypes.array.isRequired,
  approvedUsers: PropTypes.array.isRequired,
  unregisteredAdminEmails: PropTypes.arrayOf(PropTypes.string),
  currentUserId: PropTypes.string,
  onApproveUser: PropTypes.func.isRequired,
  onRejectUser: PropTypes.func.isRequired,
  onChangeRole: PropTypes.func.isRequired,
  onDeleteUser: PropTypes.func.isRequired,
};

export default UsersComponent;
