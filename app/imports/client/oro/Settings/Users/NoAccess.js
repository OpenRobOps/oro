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
 * NoAccess: legend shown in place of the Users section when the current user
 * lacks access to view users (the `users.all` publication rejected the
 * subscription).
 */
import React from 'react';
import { Box, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';

const useStyles = makeStyles()(theme => ({
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '48px 20px',
    gap: '8px',
  },
  title: {
    fontSize: '16px',
    fontWeight: 600,
    color: theme.palette.text.heading,
  },
  message: {
    fontSize: '13px',
    color: theme.palette.text.muted,
    maxWidth: '420px',
  },
}));

const NoAccess = () => {
  const { classes } = useStyles();
  return (
    <Box className={classes.wrap}>
      <Typography className={classes.title}>Access restricted</Typography>
      <Typography className={classes.message}>
        You don&apos;t have access to this feature. Contact an administrator if
        you believe you should be able to view or manage users.
      </Typography>
    </Box>
  );
};

export default NoAccess;
