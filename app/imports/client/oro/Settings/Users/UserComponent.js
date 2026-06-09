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
 * UserComponent: avatar + name + email block shared by the pending and members
 * rows of the Users settings page. `size` controls the avatar diameter;
 * `bordered` draws a 1px outline around it (used by the larger card variant).
 */
import React from 'react';
import PropTypes from 'prop-types';
import { Box, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import AvatarInitials from '../../util/AvatarInitials';

const useStyles = makeStyles()(theme => ({
  wrap: {
    display: 'flex',
    alignItems: 'center',
    minWidth: 0,
    gap: '12px',
  },
  avatarBorder: {
    border: `1px solid ${theme.palette.background.sidebarBorder}`,
  },
  identity: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
  },
  name: {
    fontSize: '16px',
    fontWeight: 600,
    lineHeight: '24px',
    color: theme.palette.text.detailsValue,
  },
  email: {
    fontSize: '14px',
    lineHeight: '20px',
    color: theme.palette.text.detailsLabel,
  },
}));

const UserComponent = ({ user, size = 48, bordered = false }) => {
  const { classes } = useStyles();
  const name = user.profile?.name || 'User';
  const email = user.profile?.email || user.emails?.[0]?.address || '';
  return (
    <Box className={classes.wrap}>
      <AvatarInitials
        name={name}
        src={user.profile?.avatar}
        size={size}
        className={bordered ? classes.avatarBorder : undefined}
      />
      <Box className={classes.identity}>
        <Typography className={classes.name}>{name}</Typography>
        <Typography className={classes.email}>{email}</Typography>
      </Box>
    </Box>
  );
};

UserComponent.propTypes = {
  user: PropTypes.object.isRequired,
  size: PropTypes.number,
  bordered: PropTypes.bool,
};

export default UserComponent;
