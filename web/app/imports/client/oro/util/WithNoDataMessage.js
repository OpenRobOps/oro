/**
 * withNoDataMessage HOC.
 * Displays the right content according to these props:
 *    - isZeroData: if true shows the zero data design
 *    - isLoading: if true it shows the loading design
 *    - robotId || selectedRobotId (Localization widget case):
 *      if falsy it shows a 'no robot selected' design
 * Note that the content should be passed as a prop
 * otherwise, it will show a default widget with a big msg
 * The options object receives customized content,
 * intended to display them according to the different no data scenarios
 * - ZeroDataComponent: should be displayed during zero data state
 * - IsLoadingComponent: should be displayed while the app is loading
 * - NoSelectionComponent: should be displayed if there is any robot selected
 * - NoDataComponent: should be displayed if there is a selected robot
 *   but the widget has no data to show
 * Reference here: https://docs.google.com/document/d/1zqhLcUS4mgtpJ8ZH5y31LPdh2CkIGKdpzQ-0S1GsOGs/edit
 */
import React from 'react';
import PropTypes from 'prop-types';
import { isEmpty } from 'lodash';
import { Grid, Typography } from '@mui/material';
import NoRobotSelectedIcon from '../graphics/op/NoRobotSelectedIcon';

// Component that creates a default no data widget
const DefaultNoDataMessage = ({ message, dataTest = 'default-no-data-message' }) => (
  <Grid container justifyContent="center" alignItems="center" style={{ height: '100%' }} data-test={dataTest}>
    <Typography variant="h5">
      {message}
    </Typography>
  </Grid>
);

DefaultNoDataMessage.propTypes = {
  message: PropTypes.string,
  dataTest: PropTypes.string
};

const WithNoDataMessage = (Component, options = {}) => (props) => {
  const { isLoading = false, isZeroData, robotId, selectedRobotId, robotIds, robots } = props;
  // TODO (bmartin): no data state may vary depending on the widget,
  //                     design and define how we can handle this state
  const { ZeroDataComponent, IsLoadingComponent, NoSelectionComponent, NoDataComponent } = options;
  const hasNoRobotSelected = !robotId && !selectedRobotId && isEmpty(robotIds) && isEmpty(robots);

  if (isZeroData) {
    return ZeroDataComponent ? <ZeroDataComponent {...props} /> : <DefaultNoDataMessage message="No robot installed yet" />;
  }

  if (isLoading) {
    return IsLoadingComponent ? <IsLoadingComponent {...props} /> : <DefaultNoDataMessage message="Loading..." />;
  }

  if (hasNoRobotSelected) {
    return NoSelectionComponent ? <NoSelectionComponent {...props} /> : <NoRobotSelectedIcon />;
  }

  // if it does not match any of the conditions described above
  // then show the component as it is
  return <Component {...props} />;
};

WithNoDataMessage.propTypes = {
  Component: PropTypes.object,
  options: PropTypes.object,
  isZeroData: PropTypes.bool,
  isLoading: PropTypes.bool,
  robotId: PropTypes.string,
  selectedRobotId: PropTypes.string,
  robotIds: PropTypes.array,
  robots: PropTypes.array
};

export default WithNoDataMessage;
