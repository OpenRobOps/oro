/**
 * Auth context
 *
 * Provides authentication state and helpers to the component tree.
 * Follows the same pattern as DarkModeContext.
 */
import { Meteor } from 'meteor/meteor';
import React, { useMemo, useCallback } from 'react';
import { useTracker } from 'meteor/react-meteor-data';

const AuthContext = React.createContext(undefined);
AuthContext.displayName = 'authContext';

function AuthProvider(props) {
  const { userId, user, isLoggingIn } = useTracker(() => {
    const uid = Meteor.userId();
    const usersHandle = Meteor.subscribe('user.details');
    const isLoggingIn = Meteor.loggingIn();
    const user =
      uid && usersHandle.ready()
        ? Meteor.users.findOne({ _id: uid })
        : null;
    return { userId: uid, user, isLoggingIn };
  }, []);

  const isAuthenticated = Boolean(userId);
  const hasRoles = Boolean(
    user?.userRoles && user.userRoles.length > 0
  );

  const logout = useCallback(() => {
    Meteor.logout();
  }, []);

  const value = useMemo(
    () => ({
      userId,
      user,
      isLoggingIn,
      isAuthenticated,
      hasRoles,
      logout,
    }),
    [userId, user, isLoggingIn, isAuthenticated, hasRoles, logout]
  );

  return <AuthContext.Provider value={value} {...props} />;
}

function useAuth() {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export { AuthContext, AuthProvider, useAuth };
