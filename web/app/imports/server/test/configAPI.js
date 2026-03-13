/**
 * Utility functions and constants used in ConfigAPItests.
 */
import { Accounts } from 'meteor/accounts-base';
// ORO modules
import { Robots } from '../../lib/collections';
import { ROLE_VIEWER } from '../roles';

const BOB_USER = 'b0b';
// Creates a robot 
export const createRobot = async (robotName = 'r2d2') => (
  Robots.insertAsync({
    name: robotName,
    version: '0.1',
    status: { agentOnline: true },
    updateStamp: Date.now(),
  })
);
// Helper function to create a test user
export const createUser = async ({
  id = BOB_USER, 
  name = 'User', 
  role = ROLE_VIEWER
} = {}) => {
  await Accounts.users.insertAsync({
    _id: id,
    profile: {
      name
    },
    userRoles: role ? [role] : []
  });
  return Accounts.users.findOneAsync({ _id: id });
};
