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
 * UserModerationComponent: Display the pending and approved users.
 */
import React, { useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import { Box, MenuItem, Select, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { ALL_ROLE_DOCS, ROLE_VIEWER } from '../../../../shared/roles';
import AvatarInitials from '../../util/AvatarInitials';
import PrimaryButton from '../../util/PrimaryButton';
import SecondaryButton from '../../util/SecondaryButton';
import { formatDate } from '../../../../lib/util';

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
  sectionHeader: {
    fontSize: '11px',
    fontWeight: 600,
    color: theme.palette.text.heading,
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    marginTop: '20px',
    marginBottom: '8px',
  },
  emptyText: {
    fontSize: '13px',
    color: theme.palette.text.muted,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  card: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '17px',
    gap: '16px',
    borderRadius: '12px',
    backgroundColor: theme.palette.background.userCardBg,
    border: `1px solid ${theme.palette.background.sidebarBorder}`,
  },
  identityWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    minWidth: 0,
  },
  avatar: {
    border: `1px solid ${theme.palette.background.sidebarBorder}`,
  },
  identity: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  identityName: {
    fontSize: '16px',
    fontWeight: 600,
    lineHeight: '24px',
    color: theme.palette.text.detailsValue,
  },
  identityEmail: {
    fontSize: '14px',
    lineHeight: '20px',
    color: theme.palette.text.detailsLabel,
  },
  detailsBox: {
    display: 'flex',
    alignItems: 'center',
    padding: '9px',
    borderRadius: '8px',
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.background.sidebarBorder}`,
  },
  detailsCell: {
    display: 'flex',
    flexDirection: 'column',
    padding: '0 8px',
  },
  detailsLabel: {
    fontSize: '11px',
    fontWeight: 500,
    lineHeight: '14px',
    letterSpacing: '0.55px',
    textTransform: 'uppercase',
    color: theme.palette.text.detailsLabel,
    marginBottom: '4px',
  },
  detailsValue: {
    fontSize: '14px',
    fontWeight: 500,
    lineHeight: '20px',
    color: theme.palette.text.detailsValue,
  },
  detailsDivider: {
    width: '1px',
    height: '32px',
    backgroundColor: theme.palette.background.detailsBorder,
    margin: '0 8px',
  },
  inlineRoleSelect: {
    fontSize: '14px',
    fontWeight: 500,
    lineHeight: '20px',
    color: theme.palette.text.detailsValue,
    '& .MuiSelect-select': {
      padding: '0 24px 0 0',
      minHeight: '20px',
    },
    '& .MuiOutlinedInput-notchedOutline': { border: 0 },
    '& .MuiSvgIcon-root': { color: theme.palette.text.detailsLabel },
  },
  pendingPill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '2px 8px',
    borderRadius: '9999px',
    backgroundColor: theme.palette.background.pendingBg,
  },
  pendingDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    backgroundColor: theme.palette.text.pendingDot,
    display: 'inline-block',
  },
  pendingLabel: {
    fontSize: '11px',
    fontWeight: 500,
    lineHeight: '14px',
    color: theme.palette.text.pendingDot,
  },
  actions: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  table: {
    borderRadius: '12px',
    backgroundColor: theme.palette.background.userCardBg,
    border: `1px solid ${theme.palette.background.sidebarBorder}`,
    overflow: 'hidden',
  },
  tableHead: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr 1fr 1fr',
    padding: '14px 20px',
    borderBottom: `1px solid ${theme.palette.background.sidebarBorder}`,
  },
  tableHeadCell: {
    fontSize: '12px',
    fontWeight: 500,
    color: theme.palette.text.detailsLabel,
  },
  tableRow: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr 1fr 1fr',
    padding: '14px 20px',
    alignItems: 'center',
    '&:not(:last-of-type)': {
      borderBottom: `1px solid ${theme.palette.background.sidebarBorder}`,
    },
  },
  memberIdentityWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    minWidth: 0,
  },
  rolePill: {
    display: 'inline-block',
    fontSize: '12px',
    fontWeight: 500,
    textTransform: 'capitalize',
    color: theme.palette.text.detailsValue,
    border: `1px solid ${theme.palette.background.sidebarBorder}`,
    borderRadius: '6px',
    padding: '4px 10px',
  },
  activeChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '12px',
    color: theme.palette.background.mintAccent,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    backgroundColor: theme.palette.background.mintAccent,
    display: 'inline-block',
  },
}));

const roleLabel = (roleId) => {
  const doc = ALL_ROLE_DOCS.find(r => r._id === roleId);
  return doc ? doc.label : roleId;
};

const UserIdentity = ({ user }) => {
  const { classes } = useStyles();
  const name = user.profile?.name || 'User';
  const email = user.profile?.email || user.emails?.[0]?.address || '';
  return (
    <Box className={classes.identityWrap}>
      <AvatarInitials
        name={name}
        src={user.profile?.avatar}
        size={48}
        className={classes.avatar}
      />
      <Box className={classes.identity}>
        <Typography className={classes.identityName}>{name}</Typography>
        <Typography className={classes.identityEmail}>{email}</Typography>
      </Box>
    </Box>
  );
};

const DetailsCell = ({ label, children }) => {
  const { classes } = useStyles();
  return (
    <Box className={classes.detailsCell}>
      <Typography className={classes.detailsLabel}>{label}</Typography>
      {children}
    </Box>
  );
};

const PendingPill = () => {
  const { classes } = useStyles();
  return (
    <Box className={classes.pendingPill}>
      <span className={classes.pendingDot} />
      <Typography className={classes.pendingLabel}>Pending</Typography>
    </Box>
  );
};

const PendingRow = ({ user, onApproveUser, onRejectUser }) => {
  const { classes } = useStyles();
  const [roleId, setRoleId] = useState(ROLE_VIEWER);
  const handleRoleChange = useCallback((event) => setRoleId(event.target.value), []);
  const handleApprove = useCallback(
    () => onApproveUser(user._id, roleId),
    [onApproveUser, user._id, roleId],
  );
  const handleReject = useCallback(() => onRejectUser(user._id), [onRejectUser, user._id]);

  return (
    <Box className={classes.card}>
      <UserIdentity user={user} />
      <Box className={classes.detailsBox}>
        <DetailsCell label="Requested Role">
          <Select
            size="small"
            value={roleId}
            onChange={handleRoleChange}
            variant="outlined"
            className={classes.inlineRoleSelect}
          >
            {ALL_ROLE_DOCS.map(r => (
              <MenuItem key={r._id} value={r._id}>{r.label}</MenuItem>
            ))}
          </Select>
        </DetailsCell>
        <Box className={classes.detailsDivider} />
        <DetailsCell label="Request Date">
          <Typography className={classes.detailsValue}>
            {formatDate(user.createdAt)}
          </Typography>
        </DetailsCell>
        <Box className={classes.detailsDivider} />
        <DetailsCell label="Status">
          <PendingPill />
        </DetailsCell>
      </Box>
      <Box className={classes.actions}>
        <SecondaryButton onClick={handleReject}>Reject</SecondaryButton>
        <PrimaryButton onClick={handleApprove}>Approve</PrimaryButton>
      </Box>
    </Box>
  );
};

const ActiveChip = () => {
  const { classes } = useStyles();
  return (
    <Box className={classes.activeChip}>
      <span className={classes.activeDot} />
      Active
    </Box>
  );
};

const MemberRow = ({ user }) => {
  const { classes } = useStyles();
  const name = user.profile?.name || 'User';
  const email = user.profile?.email || user.emails?.[0]?.address || '';
  return (
    <Box className={classes.tableRow}>
      <Box className={classes.memberIdentityWrap}>
        <AvatarInitials name={name} src={user.profile?.avatar} size={32} />
        <Box className={classes.identity}>
          <Typography className={classes.identityName}>{name}</Typography>
          <Typography className={classes.identityEmail}>{email}</Typography>
        </Box>
      </Box>
      <Box>
        {user.userRoles?.[0] && (
          <span className={classes.rolePill}>{roleLabel(user.userRoles[0])}</span>
        )}
      </Box>
      <ActiveChip />
      <Typography className={classes.detailsValue}>
        {formatDate(user.createdAt)}
      </Typography>
    </Box>
  );
};

const UserModerationComponent = ({
  isLoading, pendingUsers, approvedUsers, onApproveUser, onRejectUser,
}) => {
  const { classes } = useStyles();

  return (
    <Box>
      <Typography className={classes.title}>User Moderation</Typography>
      <Typography className={classes.subtitle}>
        Review and approve pending registrations.
      </Typography>
      {isLoading && <Typography className={classes.loading}>Loading users…</Typography>}
      {!isLoading && (
        <>
          {pendingUsers.length === 0 ? (
            <Typography className={classes.emptyText}>No pending users.</Typography>
          ) : (
            <Box className={classes.list}>
              {pendingUsers.map(u => (
                <PendingRow
                  key={u._id}
                  user={u}
                  onApproveUser={onApproveUser}
                  onRejectUser={onRejectUser}
                />
              ))}
            </Box>
          )}
          <Typography className={classes.sectionHeader}>
            Members ({approvedUsers.length})
          </Typography>
          {approvedUsers.length === 0 ? (
            <Typography className={classes.emptyText}>No members yet.</Typography>
          ) : (
            <Box className={classes.table}>
              <Box className={classes.tableHead}>
                <Typography className={classes.tableHeadCell}>User</Typography>
                <Typography className={classes.tableHeadCell}>Role</Typography>
                <Typography className={classes.tableHeadCell}>Status</Typography>
                <Typography className={classes.tableHeadCell}>Joined</Typography>
              </Box>
              {approvedUsers.map(u => <MemberRow key={u._id} user={u} />)}
            </Box>
          )}
        </>
      )}
    </Box>
  );
};

UserModerationComponent.propTypes = {
  isLoading: PropTypes.bool,
  pendingUsers: PropTypes.array.isRequired,
  approvedUsers: PropTypes.array.isRequired,
  onApproveUser: PropTypes.func.isRequired,
  onRejectUser: PropTypes.func.isRequired,
};

export default UserModerationComponent;
