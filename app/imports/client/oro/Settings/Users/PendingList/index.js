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
 * PendingList: section header + cards for users awaiting approval.
 */
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { Box, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { usersSpanMultipleSources } from '../../../../../shared/users';
import PendingRow from './PendingRow';

const useStyles = makeStyles()(theme => ({
  header: {
    fontSize: '11px',
    fontWeight: 600,
    color: theme.palette.text.heading,
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    marginTop: '20px',
    marginBottom: '8px',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  empty: {
    fontSize: '13px',
    color: theme.palette.text.muted,
  },
}));

const PendingList = ({ users, onApproveUser, onRejectUser }) => {
  const { classes } = useStyles();
  const showSources = useMemo(() => usersSpanMultipleSources(users), [users]);
  return (
    <>
      <Typography className={classes.header}>
        Pending ({users.length})
      </Typography>
      {users.length === 0 ? (
        <Typography className={classes.empty}>No pending requests.</Typography>
      ) : (
        <Box className={classes.list}>
          {users.map(u => (
            <PendingRow
              key={u._id}
              user={u}
              sources={showSources ? u.sources : undefined}
              onApproveUser={onApproveUser}
              onRejectUser={onRejectUser}
            />
          ))}
        </Box>
      )}
    </>
  );
};

PendingList.propTypes = {
  users: PropTypes.array.isRequired,
  onApproveUser: PropTypes.func.isRequired,
  onRejectUser: PropTypes.func.isRequired,
};

export default PendingList;
