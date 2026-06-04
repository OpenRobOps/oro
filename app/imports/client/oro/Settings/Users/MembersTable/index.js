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
 * MembersTable: section header + table of approved users.
 */
import React from 'react';
import PropTypes from 'prop-types';
import { Box, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import MemberRow from './MemberRow';

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
  table: {
    borderRadius: '12px',
    backgroundColor: theme.palette.background.userCardBg,
    border: `1px solid ${theme.palette.background.sidebarBorder}`,
    overflow: 'hidden',
  },
  tableHead: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr 1fr',
    padding: '14px 20px',
    borderBottom: `1px solid ${theme.palette.background.sidebarBorder}`,
  },
  headCell: {
    fontSize: '12px',
    fontWeight: 500,
    color: theme.palette.text.detailsLabel,
  },
  empty: {
    fontSize: '13px',
    color: theme.palette.text.muted,
  },
}));

const MembersTable = ({ users }) => {
  const { classes } = useStyles();
  return (
    <>
      <Typography className={classes.header}>
        Members ({users.length})
      </Typography>
      {users.length === 0 ? (
        <Typography className={classes.empty}>No members yet.</Typography>
      ) : (
        <Box className={classes.table}>
          <Box className={classes.tableHead}>
            <Typography className={classes.headCell}>User</Typography>
            <Typography className={classes.headCell}>Role</Typography>
            <Typography className={classes.headCell}>Joined</Typography>
          </Box>
          {users.map(u => <MemberRow key={u._id} user={u} />)}
        </Box>
      )}
    </>
  );
};

MembersTable.propTypes = {
  users: PropTypes.array.isRequired,
};

export default MembersTable;
