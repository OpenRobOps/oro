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
 * Shared user helpers — the auth "source(s)" (identity providers) a user can
 * sign in with. A user may have more than one (e.g. linked GitHub + Google, or
 * an OAuth provider plus passwordless email).
 *
 * The server derives these from `user.services` (which is never published to
 * clients, as it holds tokens/secrets) and publishes only the derived list;
 * the client maps each value to a display label.
 */

const USER_SOURCES = {
  GITHUB: 'github',
  GOOGLE: 'google',
  EMAIL: 'email',
};

// Human-readable labels for each source, keyed by the source value.
const USER_SOURCE_LABELS = {
  [USER_SOURCES.GITHUB]: 'GitHub',
  [USER_SOURCES.GOOGLE]: 'Google',
  [USER_SOURCES.EMAIL]: 'Email',
};

/**
 * Derives all auth sources of a user from its `services` document.
 *
 * SERVER-ONLY in practice: clients never receive `user.services`.
 *
 * @param {object} user A user document (or any object with a `services` field)
 * @returns {string[]} The sources the user can sign in with (a subset of
 *   USER_SOURCES values), in a stable order. May be empty.
 */
const getUserSources = (user) => {
  const services = user?.services || {};
  const sources = [];
  if (services.google) {
    sources.push(USER_SOURCES.GOOGLE);
  }
  if (services.github) {
    sources.push(USER_SOURCES.GITHUB);
  }
  // accounts-passwordless stores its state under services.password.
  if (services.password) {
    sources.push(USER_SOURCES.EMAIL);
  }
  // Fallback: a user with an email but no recognized service is treated as an
  // email-source user (covers passwordless variants that store nothing else).
  if (!sources.length && user?.emails?.length) {
    sources.push(USER_SOURCES.EMAIL);
  }
  return sources;
};

/**
 * Whether a set of users spans more than one distinct auth source. Lists use
 * this to decide whether per-user source labels are worth showing (a single
 * shared source is just noise).
 *
 * @param {object[]} users Users carrying a `sources` array (as published)
 * @returns {boolean}
 */
const usersSpanMultipleSources = (users) => {
  const seen = new Set();
  for (const user of users || []) {
    for (const source of user?.sources || []) {
      seen.add(source);
      if (seen.size > 1) {
        return true;
      }
    }
  }
  return false;
};

/**
 * Extracts a user's primary email address, lowercased for case-insensitive
 * comparison. Falls back from `profile.email` to the first `emails[]` entry.
 *
 * @param {object} user A user document
 * @returns {string} The lowercased email, or '' when none is resolvable
 */
const getUserEmail = user => String(
  user?.profile?.email || user?.emails?.[0]?.address || ''
).toLowerCase();

/**
 * Given the full user list and the configured `adminEmails`, returns the admin
 * emails that are NOT yet registered as users (case-insensitive match against
 * each user's primary email).
 *
 * These are emails that will be granted the admin role automatically on their
 * owner's first login (see `initialRolesForUser` in accountsHooks). Returned in
 * their original (configured) casing, de-duplicated; blank entries are ignored.
 *
 * @param {object[]} users User documents (as published to the client)
 * @param {string[]} adminEmails The configured `Meteor.settings.adminEmails`
 * @returns {string[]} The configured admin emails missing from the user list
 */
const missingAdminEmails = (users, adminEmails) => {
  const registered = new Set((users || []).map(getUserEmail).filter(Boolean));
  const seen = new Set();
  const missing = [];
  for (const raw of adminEmails || []) {
    const normalized = String(raw || '').toLowerCase();
    if (!normalized || registered.has(normalized) || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    missing.push(raw);
  }
  return missing;
};

export {
  USER_SOURCES,
  USER_SOURCE_LABELS,
  getUserSources,
  usersSpanMultipleSources,
  getUserEmail,
  missingAdminEmails,
};
