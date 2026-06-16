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
 * CreateApiKeyDialog: two-phase dialog.
 *  - "form": name + expiration, then Create.
 *  - "revealed": shows the new key EXACTLY ONCE with copy / download and a
 *    prominent irreversible warning. Backdrop/escape are disabled here so the
 *    key is not lost by accident; the user must click "Done", which clears the
 *    in-memory key.
 */
import React, { useState, useCallback, useEffect } from 'react';
import PropTypes from 'prop-types';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, Select, MenuItem, FormControl, InputLabel, Alert, Box, Typography,
} from '@mui/material';
import { makeStyles } from 'tss-react/mui';
import PrimaryButton from '../../util/PrimaryButton';
import SecondaryButton from '../../util/SecondaryButton';
import { copyToClipboard, downloadJson } from '../../util/clipboardAndDownload';

// `value` is days; 0 means "no expiration" (sent to the server as null).
const EXPIRATION_OPTIONS = [
  { label: '30 days', value: 30 },
  { label: '60 days', value: 60 },
  { label: '90 days', value: 90 },
  { label: 'No expiration', value: 0 },
];
const DEFAULT_EXPIRATION = 90;

const useStyles = makeStyles()(theme => ({
  field: {
    marginTop: '12px',
  },
  keyBlock: {
    marginTop: '16px',
    fontFamily: 'monospace',
    fontSize: '13px',
    wordBreak: 'break-all',
    userSelect: 'all',
    backgroundColor: theme.palette.background.userCardBg,
    border: `1px solid ${theme.palette.background.sidebarBorder}`,
    borderRadius: '8px',
    padding: '12px',
    maxHeight: '120px',
    overflow: 'auto',
  },
  revealActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '12px',
  },
  copied: {
    fontSize: '12px',
    color: theme.palette.text.muted,
  },
}));

const CreateApiKeyDialog = ({
  open, isCreating, onClose, onCreate,
}) => {
  const { classes } = useStyles();
  const [phase, setPhase] = useState('form');
  const [name, setName] = useState('');
  const [expirationValue, setExpirationValue] = useState(DEFAULT_EXPIRATION);
  const [plaintextKey, setPlaintextKey] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  // Reset all state whenever the dialog (re)opens.
  useEffect(() => {
    if (open) {
      setPhase('form');
      setName('');
      setExpirationValue(DEFAULT_EXPIRATION);
      setPlaintextKey(null);
      setError(null);
      setCopied(false);
    }
  }, [open]);

  const handleCreate = useCallback(async () => {
    setError(null);
    try {
      // 0 ("No expiration") is sent as null.
      const result = await onCreate(name.trim(), expirationValue || null);
      setPlaintextKey(result.key);
      setPhase('revealed');
    } catch (err) {
      setError(err?.reason || err?.message || String(err));
    }
  }, [onCreate, name, expirationValue]);

  const handleCopy = useCallback(async () => {
    try {
      await copyToClipboard(plaintextKey);
      setCopied(true);
    } catch {
      setError('Could not copy automatically — select the key above and copy it manually.');
    }
  }, [plaintextKey]);

  const handleDownload = useCallback(() => {
    downloadJson(`oro-api-key-${name.trim() || 'key'}.json`, { name: name.trim(), key: plaintextKey });
  }, [name, plaintextKey]);

  // Clear the in-memory secret, then close.
  const handleDone = useCallback(() => {
    setPlaintextKey(null);
    onClose();
  }, [onClose]);

  // In the reveal phase, ignore backdrop clicks so the key is not lost; the
  // user must explicitly click "Done".
  const handleDialogClose = useCallback(() => {
    if (phase !== 'revealed') {
      onClose();
    }
  }, [phase, onClose]);

  return (
    <Dialog
      open={open}
      onClose={handleDialogClose}
      disableEscapeKeyDown={phase === 'revealed'}
      fullWidth
      maxWidth="sm"
    >
      {phase === 'form' ? (
        <>
          <DialogTitle>Create API key</DialogTitle>
          <DialogContent>
            {error && <Alert severity="error">{error}</Alert>}
            <TextField
              className={classes.field}
              label="Name"
              fullWidth
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={isCreating}
            />
            <FormControl fullWidth className={classes.field}>
              <InputLabel id="api-key-expiration-label">Expiration</InputLabel>
              <Select
                labelId="api-key-expiration-label"
                label="Expiration"
                value={expirationValue}
                onChange={e => setExpirationValue(e.target.value)}
                disabled={isCreating}
              >
                {EXPIRATION_OPTIONS.map(o => (
                  <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </DialogContent>
          <DialogActions>
            <SecondaryButton onClick={onClose} disabled={isCreating}>Cancel</SecondaryButton>
            <PrimaryButton onClick={handleCreate} disabled={isCreating || !name.trim()}>
              {isCreating ? 'Creating…' : 'Create'}
            </PrimaryButton>
          </DialogActions>
        </>
      ) : (
        <>
          <DialogTitle>Copy your API key</DialogTitle>
          <DialogContent>
            <Alert severity="warning">
              Copy this key now and store it securely. For security reasons it will&nbsp;
              <strong>never be shown again</strong> — once you close this dialog you cannot
              retrieve it.
            </Alert>
            <Box className={classes.keyBlock} tabIndex={0} aria-label="Generated API key">
              {plaintextKey}
            </Box>
            {error && <Alert severity="error" className={classes.field}>{error}</Alert>}
            <Box className={classes.revealActions}>
              <SecondaryButton onClick={handleCopy}>Copy</SecondaryButton>
              <SecondaryButton onClick={handleDownload}>Download JSON</SecondaryButton>
              {copied && (
                <Typography className={classes.copied} aria-live="polite">Copied</Typography>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <PrimaryButton onClick={handleDone}>Done</PrimaryButton>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
};

CreateApiKeyDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  isCreating: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  onCreate: PropTypes.func.isRequired,
};

export default CreateApiKeyDialog;
