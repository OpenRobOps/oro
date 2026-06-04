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
 * MemberRow: single grid row in the approved members table.
 */
import React, { useMemo } from 'react';
import PropTypes from 'prop-types';
import { Box, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { ALL_ROLE_DOCS } from '../../../../../shared/roles';
import { formatDate } from '../../../../../lib/util';
import UserComponent from '../UserComponent';

const useStyles = makeStyles()(theme => ({
  row: {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr 1fr',
    padding: '14px 20px',
    alignItems: 'center',
    '&:not(:last-of-type)': {
      borderBottom: `1px solid ${theme.palette.background.sidebarBorder}`,
    },
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

const MemberRow = ({ user }) => {
  const { classes } = useStyles();
  const firstRole = user.userRoles?.[0];
  const roleLabel = useMemo(() => getRoleLabel(firstRole), [firstRole]);
  return (
    <Box className={classes.row}>
      <UserComponent user={user} size={32} />
      <Box>
        {firstRole && (
          <span className={classes.rolePill}>{roleLabel}</span>
        )}
      </Box>
      <Typography className={classes.date}>
        {formatDate(user.createdAt)}
      </Typography>
    </Box>
  );
};

MemberRow.propTypes = {
  user: PropTypes.object.isRequired,
};

export default MemberRow;
