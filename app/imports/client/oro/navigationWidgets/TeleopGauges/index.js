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
 * Teleop Gauge Component
 *
 * Container for the teleop gauges, managing state and data fetching
 * for speed and angular velocity display.
 */
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Meteor } from 'meteor/meteor';
import { useTracker } from 'meteor/react-meteor-data';
// ORO modules
import TeleopGaugesComponent from './TeleopGaugesComponent';
import { fetchRobotAttributeValues } from '../../../../lib/attributes';
import { VITAL_SPEED_LINEAR, VITAL_SPEED_ANGULAR } from '../../../../shared/attributes';

// Velocity limits and defaults
// TODO: Use the same source throughout the stack
const velLimitsDefaults = {
  linear: {
    min: 0.005,
    max: 0.5,
    default: 0.15
  },
  angular: {
    min: 0.00872665,
    max: 0.785398,
    default: 0.3925
  }
};

const TeleopGauges = (props) => {
  const {
    robotId,
    offline,
    maxLinearVel,
    linearGaugePrefs,
    speedLinearObj,
    maxAngularVel,
    angularGaugePrefs,
    speedAngularObj,
    isZeroData,
    disableControls
  } = props;

  const [networkStatus, setNetworkStatus] = useState();
  const [badNetwork, setBadNetwork] = useState(true);

  // networkState: 3 and 2 represent low and average latency
  // 1 and 0 represent high latency or offline
  if (badNetwork !== (offline || networkStatus < 2)) {
    setBadNetwork(!badNetwork);
  }

  const disableControlsProp = disableControls || badNetwork;

  const handleNetworkStatus = newNetworkStatus => setNetworkStatus(newNetworkStatus);

  return (
    <TeleopGaugesComponent
      robotId={robotId}
      isZeroData={isZeroData}
      offline={offline}
      disableControlsProp={disableControlsProp}
      handleNetworkStatus={handleNetworkStatus}
      networkStatus={networkStatus}
      maxLinearVel={maxLinearVel}
      linearGaugePrefs={linearGaugePrefs}
      speedLinearObj={speedLinearObj}
      maxAngularVel={maxAngularVel}
      angularGaugePrefs={angularGaugePrefs}
      speedAngularObj={speedAngularObj}
      {...props}
    />
  );
};

/**
 * Container: fetches speed attribute values and derives gauge configuration.
 */
const TeleopGaugesContainer = (ownProps) => {
  const { robotId, isZeroData } = ownProps;

  const trackerData = useTracker(() => {
    if (!robotId) return {};

    const attributes = [VITAL_SPEED_LINEAR, VITAL_SPEED_ANGULAR];
    const vitalsHandle = Meteor.subscribe('attributes.teleopGauges', { robotId, attributes });
    const isLoading = !vitalsHandle.ready();

    const vitals = fetchRobotAttributeValues({ robotId, attributes });
    const speedLinearObj = vitals[VITAL_SPEED_LINEAR] !== undefined
      ? vitals[VITAL_SPEED_LINEAR] : {};
    const speedAngularObj = vitals[VITAL_SPEED_ANGULAR] !== undefined
      ? vitals[VITAL_SPEED_ANGULAR] : {};

    const maxLinearVel = velLimitsDefaults.linear.max * 3;
    const maxAngularVel = velLimitsDefaults.angular.max * 3;

    const linearGaugePrefs = {
      minValue: 0,
      maxValue: maxLinearVel,
      unit: 'm /sec'
    };
    const angularGaugePrefs = {
      minValue: 0,
      maxValue: maxAngularVel,
      unit: 'radians /sec'
    };

    return {
      linearGaugePrefs,
      angularGaugePrefs,
      maxLinearVel,
      maxAngularVel,
      isLoading,
      speedLinearObj,
      speedAngularObj,
    };
  }, [robotId]);

  return <TeleopGauges {...ownProps} {...trackerData} />;
};

TeleopGauges.propTypes = {
  robotId: PropTypes.string,
  offline: PropTypes.bool,
  maxLinearVel: PropTypes.number,
  linearGaugePrefs: PropTypes.object,
  speedLinearObj: PropTypes.object,
  maxAngularVel: PropTypes.number,
  angularGaugePrefs: PropTypes.object,
  speedAngularObj: PropTypes.object,
  disableControls: PropTypes.bool,
  isZeroData: PropTypes.bool
};

export default TeleopGaugesContainer;
