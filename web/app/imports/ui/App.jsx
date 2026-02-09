/**
 * This is the client-side entry point for the webapp.
 */
import { Meteor } from 'meteor/meteor';
import React from 'react';
import { CssBaseline } from '@mui/material';
import { ThemeProvider, StyledEngineProvider } from '@mui/material/styles';
import { useTracker } from 'meteor/react-meteor-data';
import PropTypes from 'prop-types';
// ORO modules
import theme from './Styles';
// import Routes from '../imports/client/oro/RoutesDashboards';

const App = () => {
  const userId = Meteor.userId;

  // NOTE(adamantivm) Only the output of the users handle is returned outside of this tracker
  // so we only care if the users subscription is not ready yet.
  const { userLoading, userDoc } = useTracker(() => {
    const usersHandle = Meteor.subscribe('user.details');
    const userLoading = !usersHandle.ready();
    const userDoc = userId
      ? Meteor.users.findOne({ _id: userId }) || { _id: userId }
      : null;
    return { userLoading, userDoc };
  }, [userId]);

  return (
    <div>
      <h1>Hello {!userDoc ? "anonymous" : userDoc.profile?.name}</h1>
    </div>
  );
}

const AppContainer = () => (
  <StyledEngineProvider injectFirst>
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      <App />
    </ThemeProvider>
  </StyledEngineProvider>
);

export default AppContainer;