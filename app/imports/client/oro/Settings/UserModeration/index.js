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
import useAllUsers from './hooks/useAllUsers';
import UserModerationComponent from './UserModerationComponent';

const UserModeration = () => {
  const { isLoading, data: users } = useAllUsers();
  const setUserRole = useMethod('users.setUserRole');
  const rejectUser = useMethod('users.reject');

  const { pendingUsers, approvedUsers } = useMemo(() => ({
    pendingUsers: users.filter(u => isEmpty(u.userRoles)),
    approvedUsers: users.filter(u => !isEmpty(u.userRoles)),
  }), [users]);

  const handleApproveUser = useCallback((userId, roleId) => (
    setUserRole.call(userId, roleId)
  ), [setUserRole]);

  const handleRejectUser = useCallback(userId => rejectUser.call(userId), [rejectUser]);

  return (
    <UserModerationComponent
      isLoading={isLoading}
      pendingUsers={pendingUsers}
      approvedUsers={approvedUsers}
      onApproveUser={handleApproveUser}
      onRejectUser={handleRejectUser}
    />
  );
};

export default UserModeration;
