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
 * Wrapper for DiagnosticsWidgetComponents that connects it with Meteor and MQTT data.
 */
import { Meteor } from 'meteor/meteor';
import { useTracker, withTracker } from 'meteor/react-meteor-data';
import { isNumber } from 'lodash';
// ORO modules
import DiagnosticsWidgetComponent from './DiagnosticsWidgetComponent';
import { useDirectClient } from '../../util/DirectClient';
import { RobotDiagnostics } from '../../../../lib/collections';
import { unzipKeyValueList } from '../../../../lib/util';

/**
 * Helper function to decode ROS Diagnostics data from DirectClient.
 * It must match the format parsed in ingest and stored into the DB.
 * 
 * @returns A single document with diagnostics status { _id: robotId, ts, statusList }
 */

const decodeFunc = (message, robotId) => {
  const status = { ts: message.ts, _id: robotId };
  const sensorEvents = [];
  message.fields.forEach((field) => {
    // TODO: agent version >= 1.19.0 will include a hasLevel flag
    // to indicate that level field is present on the message
    // (to avoid confusing default protobuf value with real 0 value).
    // Consider adding it to the checks here too once all agents report it.
    if (field && field.name && isNumber(field.level)) {
      const { name, level, msg, keyValues: keyValuesArray } = field;
      const event = { name, level, msg: msg !== undefined ? msg : '' };
      if (keyValuesArray && keyValuesArray.length > 0) {
        event.keyValues = unzipKeyValueList(keyValuesArray).elementValues;
      }
      sensorEvents.push(event);
    }
  });
  status.statusList = sensorEvents;
  return status;
};

/**
 * Hook to subscribe to ROS Diagnostics data from the database (for a single robot).
 * 
 * No side effects: It is usually used in combination with DirectClient, and with raising
 * Diagnostics agentlet runlevels.
 */
const useRobotDiagnostics = (robotId) => useTracker(() => {
  if (!robotId) {
    return { isLoading: false, data: [] };
  }
  const handle = Meteor.subscribe('diagnostics', { robotId });
  const diagnostics = RobotDiagnostics.findOne({ _id: robotId }) || {};
  return { isLoading: !handle.ready(), data: diagnostics };
}, [robotId]);

const Container = ({ robotId, nowTs, selectedRosDiagnosticsLevel, offline }) => {
  const { isLoading, data: dbData } = useRobotDiagnostics(robotId);

  const directData = useDirectClient({ 
    robotId,
    subtopic: 'ros/diagnostics2',
    typeString: 'RosDiagnosticsMessage',
    decodeFunc
  });

  return (
    <DiagnosticsWidgetComponent 
      isLoading={isLoading}
      // pass data from db or from direct client; giving priority to directClient (fresh)
      diagnostics={directData || dbData}
      // pass down props
      nowTs={nowTs}
      selectedRosDiagnosticsLevel={selectedRosDiagnosticsLevel}
      offline={offline}
    />
  )
}

// We are passing the same component as ZeroDataComponent
// because it knows how to handle its zero data state
export default Container;
