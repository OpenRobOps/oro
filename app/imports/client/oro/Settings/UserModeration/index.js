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
 * User Moderation container: Splits users into pending (empty userRoles) and
 * members.
 */
import React, { useCallback, useMemo } from 'react';
import { isEmpty } from 'lodash';
import { useMethod } from '../../util/meteorUtils';
import useConfirmationSnackbar, { SnackbarVariants } from '../../util/useConfirmationSnackbar';
import useAllUsers from './hooks/useAllUsers';
import UserModerationComponent from './UserModerationComponent';

const UserModeration = () => {
  const { isLoading, data: users } = useAllUsers();
  const { call: setUserRole } = useMethod('users.setUserRole');
  const { call: rejectUser } = useMethod('users.reject');
  const { openDialog, ConfirmationDialog } = useConfirmationSnackbar();

  const { pendingUsers, approvedUsers } = useMemo(() => ({
    pendingUsers: users.filter(u => isEmpty(u.userRoles)),
    approvedUsers: users.filter(u => !isEmpty(u.userRoles)),
  }), [users]);

 // TODO: Add missing methods for rejectUser and approveUser.
  const handleApproveUser = useCallback(async (userId, roleId) => {
    try {
      await setUserRole(userId, roleId);
    } catch (err) {
      openDialog({
        message: `Could not approve user: ${err?.reason || err?.message || err}`,
        variant: SnackbarVariants.ERROR,
      });
    }
  }, [setUserRole, openDialog]);

  const handleRejectUser = useCallback(async (userId) => {
    try {
      await rejectUser(userId);
    } catch (err) {
      openDialog({
        message: `Could not reject user: ${err?.reason || err?.message || err}`,
        variant: SnackbarVariants.ERROR,
      });
    }
  }, [rejectUser, openDialog]);

  return (
    <>
      <UserModerationComponent
        isLoading={isLoading}
        pendingUsers={pendingUsers}
        approvedUsers={approvedUsers}
        onApproveUser={handleApproveUser}
        onRejectUser={handleRejectUser}
      />
      {ConfirmationDialog}
    </>
  );
};

export default UserModeration;
