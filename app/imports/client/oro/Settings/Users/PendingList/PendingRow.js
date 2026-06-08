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
 * PendingRow: card for a single pending user: identity on the left, a details
 * box (role select / request date / status pill) in the middle, and the
 * Reject / Approve actions on the right.
 */
import React, { useCallback, useState } from 'react';
import PropTypes from 'prop-types';
import { Box, MenuItem, Select, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { ALL_ROLE_DOCS, ROLE_VIEWER } from '../../../../../shared/roles';
import { formatDate } from '../../../../../lib/util';
import PrimaryButton from '../../../util/PrimaryButton';
import SecondaryButton from '../../../util/SecondaryButton';
import UserComponent from '../UserComponent';

const useStyles = makeStyles()(theme => ({
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
}));

const DetailsCell = ({ label, children }) => {
  const { classes } = useStyles();
  return (
    <Box className={classes.detailsCell}>
      <Typography className={classes.detailsLabel}>{label}</Typography>
      {children}
    </Box>
  );
};

DetailsCell.propTypes = {
  label: PropTypes.string.isRequired,
  children: PropTypes.node,
};

const PendingRow = ({ user, onApproveUser, onRejectUser }) => {
  const { classes } = useStyles();
  const [roleId, setRoleId] = useState(ROLE_VIEWER);
  const handleRoleChange = useCallback(event => setRoleId(event.target.value), []);
  const handleApprove = useCallback(
    () => onApproveUser(user._id, roleId),
    [onApproveUser, user._id, roleId],
  );
  const handleReject = useCallback(() => onRejectUser(user._id), [onRejectUser, user._id]);
  return (
    <Box className={classes.card}>
      <UserComponent user={user} size={48} bordered />
      <Box className={classes.detailsBox}>
        <DetailsCell label="Role">
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
          <Box className={classes.pendingPill}>
            <span className={classes.pendingDot} />
            <Typography className={classes.pendingLabel}>Pending</Typography>
          </Box>
        </DetailsCell>
      </Box>
      <Box className={classes.actions}>
        <SecondaryButton onClick={handleReject}>Reject</SecondaryButton>
        <PrimaryButton onClick={handleApprove}>Approve</PrimaryButton>
      </Box>
    </Box>
  );
};

PendingRow.propTypes = {
  user: PropTypes.object.isRequired,
  onApproveUser: PropTypes.func.isRequired,
  onRejectUser: PropTypes.func.isRequired,
};

export default PendingRow;
