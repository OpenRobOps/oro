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
 * ApiKeysComponent: presentational layout for the API keys settings section —
 * title + subtitle + "Create API key" action and the table of existing keys.
 */
import React from 'react';
import PropTypes from 'prop-types';
import { Box, Typography } from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import PrimaryButton from '../../util/PrimaryButton';
import ApiKeysTable from './ApiKeysTable';

const useStyles = makeStyles()(theme => ({
  headerRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '16px',
  },
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
}));

const ApiKeysComponent = ({
  isLoading, apiKeys, onOpenCreate, onDeleteKey,
}) => {
  const { classes } = useStyles();
  return (
    <Box>
      <Box className={classes.headerRow}>
        <Typography className={classes.title}>API keys</Typography>
        <PrimaryButton onClick={onOpenCreate}>Create API key</PrimaryButton>
      </Box>
      <Typography className={classes.subtitle}>
        Personal access tokens for the OpenRobOps REST API. Send one in the&nbsp;
        <code>x-auth-api-key</code> request header.
      </Typography>
      {isLoading && <Typography className={classes.loading}>Loading API keys…</Typography>}
      {!isLoading && <ApiKeysTable keys={apiKeys} onDeleteKey={onDeleteKey} />}
    </Box>
  );
};

ApiKeysComponent.propTypes = {
  isLoading: PropTypes.bool,
  apiKeys: PropTypes.array.isRequired,
  onOpenCreate: PropTypes.func.isRequired,
  onDeleteKey: PropTypes.func.isRequired,
};

export default ApiKeysComponent;
