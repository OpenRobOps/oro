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
 * UserRow: single grid row in the approved users table.
 *
 * Every user's role can be changed inline via a Select, except the current
 * user's own row (which is rendered read-only to avoid self-lockout). Changing
 * the selection replaces the user's roles with the single chosen role.
 */
import React, { useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { Box, MenuItem, Select, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { ALL_ROLE_DOCS } from '../../../../../shared/roles';
import { formatDate, formatLastSeen } from '../../../../../lib/util';
import SecondaryButton from '../../../util/SecondaryButton';
import UserComponent from '../UserComponent';

const useStyles = makeStyles()(theme => ({
  row: {
    display: 'grid',
    // Fixed last column (matching the table header) so the action cell reserves
    // the same width on every row — including the current user's row, which has
    // no Delete button — keeping all columns aligned.
    gridTemplateColumns: '2fr 1fr 1fr 1fr 96px',
    padding: '14px 20px',
    alignItems: 'center',
    '&:not(:last-of-type)': {
      borderBottom: `1px solid ${theme.palette.background.sidebarBorder}`,
    },
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  roles: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
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
  roleSelect: {
    // Shrink to the role label's width (it's a grid item, which would otherwise
    // stretch to fill the column and push the dropdown arrow to the far right).
    width: 'fit-content',
    justifySelf: 'start',
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
  date: {
    fontSize: '14px',
    fontWeight: 500,
    lineHeight: '20px',
    color: theme.palette.text.detailsValue,
  },
}));

const getRoleLabel = (roleId) => {
  const roleDoc = ALL_ROLE_DOCS.find(r => r._id === roleId);
  return roleDoc ? roleDoc.label : roleId;
};

const UserRow = ({
  user, sources, isCurrentUser, onChangeRole, onDeleteUser,
}) => {
  const { classes } = useStyles();
  const displayName = user.profile?.name || user.profile?.email || 'this user';
  const handleDelete = useCallback(
    () => onDeleteUser(user._id, displayName),
    [onDeleteUser, user._id, displayName],
  );
  // Display every assigned role; the system supports multiple roles per user.
  const roles = useMemo(
    () => (user.userRoles ?? []).map(roleId => ({ id: roleId, label: getRoleLabel(roleId) })),
    [user.userRoles]
  );
  // The Select edits a single role. Pick the user's highest-ranked role as its
  // value (ALL_ROLE_DOCS is ordered most-privileged first).
  const primaryRole = useMemo(
    () => ALL_ROLE_DOCS.find(r => user.userRoles?.includes(r._id))?._id ?? '',
    [user.userRoles]
  );
  const handleRoleChange = useCallback(
    event => onChangeRole(user._id, event.target.value),
    [onChangeRole, user._id],
  );
  return (
    <Box className={classes.row}>
      <UserComponent user={user} size={32} sources={sources} />
      {isCurrentUser ? (
        <Box className={classes.roles}>
          {roles.map(role => (
            <span key={role.id} className={classes.rolePill}>{role.label}</span>
          ))}
        </Box>
      ) : (
        <Select
          size="small"
          value={primaryRole}
          onChange={handleRoleChange}
          variant="outlined"
          className={classes.roleSelect}
        >
          {ALL_ROLE_DOCS.map(r => (
            <MenuItem key={r._id} value={r._id}>{r.label}</MenuItem>
          ))}
        </Select>
      )}
      <Typography className={classes.date}>
        {formatDate(user.createdAt)}
      </Typography>
      <Typography className={classes.date}>
        {formatLastSeen(user.lastSeenTs)}
      </Typography>
      <Box className={classes.actions}>
        {/* No delete action on your own row, to avoid self-lockout. */}
        {!isCurrentUser && (
          <SecondaryButton onClick={handleDelete}>Delete</SecondaryButton>
        )}
      </Box>
    </Box>
  );
};

UserRow.propTypes = {
  user: PropTypes.object.isRequired,
  sources: PropTypes.arrayOf(PropTypes.string),
  isCurrentUser: PropTypes.bool,
  onChangeRole: PropTypes.func.isRequired,
  onDeleteUser: PropTypes.func.isRequired,
};

export default UserRow;
