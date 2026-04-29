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
