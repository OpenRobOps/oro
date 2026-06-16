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
 * AdminEmailsWarning: banner shown above the users table when one or more
 * configured `adminEmails` are not registered as users yet. Each such email
 * will be granted the admin role automatically on its owner's first login, so
 * we surface it in case the configuration is a mistake.
 */
import React from 'react';
import PropTypes from 'prop-types';
import { Box, Typography } from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import { makeStyles } from 'tss-react/mui';

const useStyles = makeStyles()(theme => ({
  banner: {
    display: 'flex',
    gap: '10px',
    alignItems: 'flex-start',
    padding: '12px 16px',
    marginTop: '20px',
    borderRadius: '12px',
    backgroundColor: theme.palette.background.pendingBg,
    border: `1px solid ${theme.palette.incidents.warning}`,
  },
  icon: {
    fontSize: 18,
    color: theme.palette.incidents.warning,
    flexShrink: 0,
    marginTop: '1px',
  },
  messages: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  message: {
    fontSize: '13px',
    color: theme.palette.text.heading,
  },
}));

// Exact warning copy for a single unregistered admin email.
const warningFor = email => `User ${email} is not registered but will become `
  + 'Administrator on first login. If this is not correct, remove "adminEmails" '
  + 'property from configuration.';

const AdminEmailsWarning = ({ emails }) => {
  const { classes } = useStyles();
  if (!emails || emails.length === 0) {
    return null;
  }
  return (
    <Box className={classes.banner} data-test="admin-emails-warning">
      <WarningIcon className={classes.icon} />
      <Box className={classes.messages}>
        {emails.map(email => (
          <Typography key={email} className={classes.message}>
            {warningFor(email)}
          </Typography>
        ))}
      </Box>
    </Box>
  );
};

AdminEmailsWarning.propTypes = {
  emails: PropTypes.arrayOf(PropTypes.string),
};

export default AdminEmailsWarning;
