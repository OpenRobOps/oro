/**
 * User-related publications.
 *
 * Publishes the current user's profile and roles to the client.
 * Explicitly excludes services.* (OAuth tokens/secrets).
 */
import { Meteor } from 'meteor/meteor';

Meteor.publish('user.details', function () {
  if (!this.userId) {
    return this.ready();
  }
  return Meteor.users.find(
    { _id: this.userId },
    {
      fields: {
        'profile.name': 1,
        'profile.email': 1,
        'profile.avatar': 1,
        userRoles: 1,
      },
    }
  );
});
