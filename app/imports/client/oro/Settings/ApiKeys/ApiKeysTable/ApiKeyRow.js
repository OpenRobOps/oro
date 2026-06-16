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
 * ApiKeyRow: single row in the API keys table — name, expiration, last used,
 * and a Revoke action. The secret is never present on the key object.
 */
import React, { useCallback } from 'react';
import PropTypes from 'prop-types';
import { Box, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import { formatDate, formatLastSeen } from '../../../../../lib/util';
import SecondaryButton from '../../../util/SecondaryButton';

const useStyles = makeStyles()(theme => ({
  row: {
    display: 'grid',
    // Fixed last column (matching the table header) so the action cell reserves
    // the same width on every row, keeping all columns aligned.
    gridTemplateColumns: '2fr 1fr 1fr 96px',
    padding: '14px 20px',
    alignItems: 'center',
    '&:not(:last-of-type)': {
      borderBottom: `1px solid ${theme.palette.background.sidebarBorder}`,
    },
  },
  name: {
    fontSize: '14px',
    fontWeight: 500,
    color: theme.palette.text.detailsValue,
  },
  value: {
    fontSize: '14px',
    fontWeight: 500,
    lineHeight: '20px',
    color: theme.palette.text.detailsValue,
  },
  muted: {
    fontSize: '14px',
    lineHeight: '20px',
    color: theme.palette.text.muted,
  },
  expiredBadge: {
    marginLeft: '6px',
    fontSize: '11px',
    fontWeight: 500,
    color: theme.palette.text.pendingDot,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
}));

const ApiKeyRow = ({ apiKey, onDeleteKey }) => {
  const { classes } = useStyles();
  const handleDelete = useCallback(
    () => onDeleteKey(apiKey.id, apiKey.name),
    [onDeleteKey, apiKey.id, apiKey.name],
  );
  const expired = Boolean(apiKey.expirationTs && apiKey.expirationTs < Date.now());
  return (
    <Box className={classes.row}>
      <Typography className={classes.name}>{apiKey.name}</Typography>
      <Typography className={expired ? classes.muted : classes.value}>
        {apiKey.expirationTs ? formatDate(apiKey.expirationTs) : 'Never'}
        {expired && <span className={classes.expiredBadge}>Expired</span>}
      </Typography>
      <Typography className={apiKey.lastUsedTs ? classes.value : classes.muted}>
        {apiKey.lastUsedTs ? formatLastSeen(apiKey.lastUsedTs) : 'Never used'}
      </Typography>
      <Box className={classes.actions}>
        <SecondaryButton onClick={handleDelete}>Revoke</SecondaryButton>
      </Box>
    </Box>
  );
};

ApiKeyRow.propTypes = {
  apiKey: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    expirationTs: PropTypes.number,
    lastUsedTs: PropTypes.number,
  }).isRequired,
  onDeleteKey: PropTypes.func.isRequired,
};

export default ApiKeyRow;
