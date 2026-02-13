/**
 * Accounts hooks for OAuth user creation.
 *
 * Must be called at module level (not inside Meteor.startup) so the hook is
 * registered before any login attempt occurs.
 */
import { Accounts } from 'meteor/accounts-base';

/**
 * Extract a normalized { name, email } from the OAuth service data that
 * Meteor attaches to the user document during login.
 */
const normalizeOAuthProfile = (options, user) => {
  console.log('normalizeOAuthProfile', options, user);
  if (user.services?.google) {
    const g = user.services.google;
    return {
      name: g.name || `${g.given_name || ''} ${g.family_name || ''}`.trim() || g.email,
      email: g.email,
    };
  }
  if (user.services?.github) {
    const gh = user.services.github;
    return {
      name: gh.username || options.profile?.name || gh.email || 'GitHub User',
      email: gh.email || null,
    };
  }
  // Fallback for any future provider
  return {
    name: options.profile?.name || 'Unknown',
    email: options.profile?.email || null,
  };
};

const registerAccountsHooks = () => {
  Accounts.onCreateUser((options, user) => {
    console.log("Accounts.onCreateUser", options, user);
    const { name, email } = normalizeOAuthProfile(options, user);
    user.profile = { name, email };
    // New users start with no roles — an admin must approve them
    user.userRoles = [];
    return user;
  });
};

export { registerAccountsHooks };
