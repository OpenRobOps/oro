/**
 * Navigation Control Bar Component
 *
 * Navigation widget can be used in a dashboard as a control widget or
 * can be added to a fullscreen navigation
 */
import React from 'react';
import PropTypes from 'prop-types';
import { Meteor } from 'meteor/meteor';
import { withTracker } from 'meteor/react-meteor-data';
// InOrbit modules
import Lock from '../../robotWidgets/Lock';
import RobotSearch from '../../util/RobotSearch';
import NavigationControlBarComponent from './NavigationControlBarComponent';
import { Robots } from '../../../../lib/collections';

const NavigationControlBar = ({ robot, ...props }) => {
  return (
    <NavigationControlBarComponent
      Lock={Lock}
      RobotSearch={RobotSearch}
      robot={robot}
      {...props}
    />
  );
};

NavigationControlBar.propTypes = {
  robot: PropTypes.object
};

/**
 * Get module configuration for customizations
 */
const NavigationControlBarContainer = withTracker(({ robotId }) => {
  if (robotId) {
    const subHandles = [];

    subHandles.push(Meteor.subscribe('preferences', { keys: ['lock'] }));
    if (robotId) {
      subHandles.push(robotId && Meteor.subscribe('robot.details', { robotId }));
    }

    const isLoading = subHandles.some(s => !s.ready());

    if (isLoading) {
      return {
        isLoading
      };
    }

    const robot = robotId && Robots.findOne({ _id: robotId });
    return {
      robotId,
      robot,
    };
  }
  return {};
})(NavigationControlBar);

export default NavigationControlBarContainer;
