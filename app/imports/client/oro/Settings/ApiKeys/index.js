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
 * ApiKeys container: lists the current user's own API keys and wires the
 * create/revoke Meteor methods. Personal-access-token model — every user
 * manages only their own keys.
 */
import React, { useCallback, useState } from 'react';
import { useMethod } from '../../util/meteorUtils';
import useConfirmationSnackbar, { SnackbarVariants } from '../../util/useConfirmationSnackbar';
import useApiKeys from './hooks/useApiKeys';
import ApiKeysComponent from './ApiKeysComponent';
import CreateApiKeyDialog from './CreateApiKeyDialog';

const ApiKeys = () => {
  const { isLoading, data: apiKeys, refetch } = useApiKeys();
  const { call: createApiKey, isLoading: isCreating } = useMethod('apiKeys.create');
  const { call: deleteApiKey } = useMethod('apiKeys.delete');
  const { openDialog, ConfirmationDialog } = useConfirmationSnackbar();
  const [createOpen, setCreateOpen] = useState(false);

  // Relays creation to the method and refreshes the list. Returns the one-time
  // payload (incl. the plaintext key) so the dialog can reveal it; errors
  // propagate to the dialog, which shows them inline.
  const handleCreate = useCallback(async (name, expirationDays) => {
    const result = await createApiKey({ name, expirationDays });
    refetch();
    return result;
  }, [createApiKey, refetch]);

  const handleDeleteKey = useCallback((id, name) => {
    openDialog(
      {
        message: `Revoke "${name}"? Any integration using this key will immediately stop working. This cannot be undone.`,
        variant: SnackbarVariants.WARNING,
        actionMessage: 'Revoke',
      },
      async (confirmed) => {
        if (!confirmed) {
          return;
        }
        try {
          await deleteApiKey(id);
          refetch();
        } catch (err) {
          openDialog({
            message: `Could not revoke API key: ${err?.reason || err?.message || err}`,
            variant: SnackbarVariants.ERROR,
          });
        }
      },
    );
  }, [deleteApiKey, refetch, openDialog]);

  return (
    <>
      <ApiKeysComponent
        isLoading={isLoading}
        apiKeys={apiKeys}
        onOpenCreate={() => setCreateOpen(true)}
        onDeleteKey={handleDeleteKey}
      />
      <CreateApiKeyDialog
        open={createOpen}
        isCreating={isCreating}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
      />
      {ConfirmationDialog}
    </>
  );
};

export default ApiKeys;
