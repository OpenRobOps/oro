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
 * VitalsWidget
 *
 * This component displays some of the robot information inside Ground Control. It is a container
 * for VitalsTextEntry and VitalsGaugeEntry components.
 */
import React from 'react';
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
// ORO modules
import VitalsWidgetComponent from './VitalsWidgetComponent';
import { Robots } from '../../../../lib/collections';
import { fetchRobotAttributeValues } from '../../../../lib/attributes';
import WithNoDataMessage from '../../util/WithNoDataMessage';

/**
 * Get values from server
 */
const VitalsWidgetContainer = (props) => {
  const { robotId, config } = props;
  const attributes = (config && config.elementList) || [];
  const attributesKey = attributes.join(',');
  const trackerData = useTracker(() => {
    if (robotId) {
      // Query only the attributes we are displaying, based on the configuration
      const vitalsHandle = Meteor.subscribe('attributes.values', { robotId, attributes });
      const robotHandle = Meteor.subscribe('robot.details', { robotId });
      const isLoading = !vitalsHandle.ready() || !robotHandle.ready();
      if (isLoading) {
        return { isLoading };
      }
      const attributeValues = fetchRobotAttributeValues({ robotId, attributes }) || {};
      const robot = Robots.findOne({ _id: robotId });
      return {
        isLoading,
        attributeValues,
        robot
      };
    }
    return {};
  }, [robotId, attributesKey]);
  return <VitalsWidgetComponent {...props} {...trackerData} />;
};

// We are passing the same component as ZeroDataComponent
// because it knows how to handle its zero data state
export default WithNoDataMessage(VitalsWidgetContainer, {
  ZeroDataComponent: VitalsWidgetContainer
});
