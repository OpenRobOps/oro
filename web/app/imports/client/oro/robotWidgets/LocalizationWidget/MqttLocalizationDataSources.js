/*
 * Data sources to retrieve Localization data through MQTT (DirectClient).
 * These interact with the RobotsDataContext to inject retrieved data into the context.
 *
 * Implementation of DataSources is done in two parts:
 * - First a hook ("use*") which retrieves and returns new data on updates. All these
 *   hooks MUST use a single argument specifying the data to retrieve, and an optional
 *   callback argument (used to dispatch that data to a context).
 * - Secondly, a "*DataSource" function that uses the hook ignoring the return value, and
 *   passing a dispatch action function instead to send the data to the context.
 *
 * Design: https://docs.google.com/document/d/1oz40z21zH7nr8GQSOaOePt4edPtO_ZAJvLXp_hpi-eQ/edit#heading=h.fhzgh3sqlqxp
 *
 * NOTE:
 * - This hook cannot be used outside of RobotsDataContext. Most importantly, it doesn't return any
 *   data itself, it only provides received data through the provided RobotDataContext callback
 * - Even if it is subscribed to data from multiple robots, it relays one message from one robot at
 *   the time and relies completely on the RobotsDataContext to merge information from multiple
 *   robots and multiple messages of different types per robot.
 */
import { useEffect } from 'react';
import { useDirectClientMulti } from '../../util/DirectClient';
import {
  singleRobotLocalizationData
} from './LocalizationDataTypes';
import { wrapHookAsDataSource } from '../../contexts/RobotsDataContext/RobotsDataContext';
import { useSpatialTransformations,
  useLocalizationDataToSublocationTransformation,
  usePathsToSublocationTransformation } from './SpatialTransformations';
import { deltaIntDecodePoints } from '../../../../shared/arrayUtil';

// eslint-disable-next-line no-unused-vars
const PATH_ENCODING_NONE = 0; // Unused in this file; used as default
const PATH_ENCODING_DELTA_INT = 1;

/**
 * Decoding function for localization data received through mqtt. It transforms the data
 * to the same format we are storing in mongodb and receiving through useTracker()s.
 */
function decodeLaserAndPose(msg) {
  const laserRanges = {};
  msg.lasers.forEach((a) => {
    laserRanges[a.name] = {
      runs: a.ranges.runs,
      values: a.ranges.values,
      ts: msg.ts
    };
  });
  return {
    robotPose: {
      frameId: msg.frameId,
      x: msg.posX + msg.offsetX,
      y: msg.posY + msg.offsetY,
      theta: msg.yaw,
      ts: msg.ts
    },
    laserRanges,
    src: 'mqtt'
  };
}

/**
 * Decoding function for paths data received through mqtt. It transforms the data
 * to the same format we are storing in mongodb and receiving through useTracker()s.
 */
function decodePaths(msg) {
  const paths = {};
  if (!msg.paths) {
    return null;
  }

  // Obtain each of the path points to pass as state. Note that different agents use different
  // protobuf message versions
  msg.paths.forEach((path) => {
    let points;
    if (path.encodingVersion == PATH_ENCODING_DELTA_INT) {
      // Paths use IntDelta encoding (see arrayUtil.js). Decode them into { x, y } points
      // and discard the encoded version.
      points = deltaIntDecodePoints(path.encodedPoints.xs, path.encodedPoints.ys);
    } else {
      // default path encoding is the explicit list of points
      ({ points } = path);
    }
    paths[path.pathId] = { points, ts: path.ts, frameId: path.frameId };
  });

  return {
    paths,
    src: 'mqtt'
  };
}

/**
 * Hook to use localization data from DirectClient. It adds a decoding function, and
 * (as with other data source hooks) it also optionally invokes a callback on data
 * changes.
 *
 * NOTE:
 * - Each callback call will contain the information of a single received MQTT
 *   message. The receiver RobotsDataContext is responsible for merging the data
 */
function useDirectClientLocalizationData({ robotIds }, cb = null) {
  // NOTE: These hooks always returns the latest message received from
  // one of the provided robots, in the format { [robotId]: localizationData }
  const directLocalizationData = useDirectClientMulti({
    robotIds,
    subtopic: 'ros/loc/data2',
    typeString: 'LocationAndPoseMessage',
    decodeFunc: decodeLaserAndPose
  });

  const directPathsData = useDirectClientMulti({
    robotIds,
    subtopic: 'ros/loc/path',
    typeString: 'PathDataMessage',
    decodeFunc: decodePaths
  });

  const spatialTransformations = useSpatialTransformations(robotIds);

  const localizationDataRobotTSublocation = useLocalizationDataToSublocationTransformation(
    spatialTransformations
  );

  const pathsRobotTSublocation = usePathsToSublocationTransformation(
    spatialTransformations
  );

  // Important NOTE: DO NOT invoke cb(directLocalizationData) here, as this
  // code runs during a render: Instead, do it only when directLocalizationData or
  // directPathsData change, wrapping the callback call in a useEffect().
  // The reason is that if during render() we invoke this callback
  // (which in our framework hides some setState) this generates
  // an infinite loop of setState+render.

  // This effect gets executed for every localization update
  useEffect(() => {
    cb && cb(localizationDataRobotTSublocation(directLocalizationData));
  }, [directLocalizationData]);

  // This effect gets executed for every path update
  useEffect(() => {
    cb && cb(pathsRobotTSublocation(directPathsData));
  }, [directPathsData]);
}

/**
 * Action builder for robot localization data coming from DirectClient: It simply
 * uses robotLocalizationData (from the Context library), but it needs to append
 * the robotId to it.
 */
function robotLocalizationDataWithRobotId(data) {
  // 'data' will always be in the form { [robotId]: localizationData }
  // Since we have a single update per robot at a time, we can safely always pick
  // the robotId as the first key from the object, and the localizationData as
  // the property associated with this key.
  const robotIds = Object.keys(data);
  if (!robotIds.length == 1) {
    console.warn('Unexpected data received in MqttLocalizationDataSources action builder. '
      + `keys = ${robotIds.join(',')}`);
  }
  const robotId = Object.keys(data)[0];
  const localizationData = data[robotId];
  return singleRobotLocalizationData({ robotId, localizationData });
}

/**
 * Data Source function to use DirectClient localization data in the RobotsDataContext.
 */
const directClientLocalizationDataSource = wrapHookAsDataSource(
  useDirectClientLocalizationData, robotLocalizationDataWithRobotId
);

export {
  useDirectClientLocalizationData,
  directClientLocalizationDataSource
};
