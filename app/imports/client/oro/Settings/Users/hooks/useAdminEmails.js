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
 * useAdminEmails: fetches the configured `adminEmails` (from server settings)
 * once on mount via the `users.adminEmails` method. Emails listed there are
 * granted the admin role automatically on first login; the User Moderation page
 * uses this to warn about admin emails that are not registered yet.
 *
 * The list is static server configuration, so a single fetch is enough — there
 * is nothing to keep reactive.
 *
 * @returns {string[]} The configured admin emails (empty until loaded / on error)
 */
import { useEffect, useState } from 'react';
import { Meteor } from 'meteor/meteor';

const useAdminEmails = () => {
  const [adminEmails, setAdminEmails] = useState([]);

  useEffect(() => {
    let cancelled = false;
    Meteor.callAsync('users.adminEmails')
      .then((emails) => {
        if (!cancelled) {
          setAdminEmails(Array.isArray(emails) ? emails : []);
        }
      })
      .catch(() => {
        // Non-fatal: without the list we simply show no warning. Access errors
        // are expected for non-admins (who never reach this page anyway).
        if (!cancelled) {
          setAdminEmails([]);
        }
      });
    return () => { cancelled = true; };
  }, []);

  return adminEmails;
};

export default useAdminEmails;
