/*
 * Data sources to retrieve Localization data from Meteor.
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
 */
import { useTracker } from 'meteor/react-meteor-data';
import { Meteor } from 'meteor/meteor';
// ORO Modules
import { Robots, RobotLocalization, RobotVitals, SpatialAnnotations } from '../../../../lib/collections';
import { arrayToMapById } from '../../../../lib/util';
import {
  multipleRobotsLocalizationData, mapData, rttData, robotDetailsData
} from './LocalizationDataTypes';
import {
  wrapHookAsDataSource
} from '../../contexts/RobotsDataContext/RobotsDataContext';

/**
 * Hook that retrieves localization data from meteor, and dispatches it
 * to the RobotsDataContext.
 *
 * This function can be used as a 'conventional' hook that returns data, or with a callback
 * which gets called on every data change -- the later is used to dispatch information
 * to a context (see meteorLocalizationDataSource).
 */
function useMeteorLocalizationData({ robotIds, lowBandwidth }, cb = null) {
  return useTracker(() => {
    if (!Array.isArray(robotIds) || robotIds.length == 0) {
      return null;
    }
    // Subscribe to all robots' localization data
    const sub = Meteor.subscribe('localization', { robotIds, lowBandwidth });
    const p = RobotLocalization.find({ _id: { $in: robotIds } }).fetch()
      .map((l) => { l.src = 'meteor'; return l; });
    // Convert from array to object indexed by robotId
    const localizationData = arrayToMapById(p);
    const data = {
      isLoading: !sub.ready(),
      localizationData
    };
    cb && cb(data); // The callback is used for Contexts
    return data; // Data is returned anyway, to use as a regular hook
  }, [robotIds]);
}

/**
 * Hook that returns a fully-resolved map given a robotId and an optional map label.
 * Reads from the spatial_annotations collection which stores map metadata and image data.
 * Uses objectUrl when available; falls back to a data URL built from the base64 `data` field.
 */
const useMeteorMapData = (
  { robotId, entityId, label = 'map' },
  cb = null,
) => useTracker(() => {
  const id = robotId || entityId;
  if (!id) {
    cb && cb({ isLoading: false });
    return { isLoading: false };
  }

  const sub = Meteor.subscribe('spatial_annotations.map', { robotId: id, label });
  const isLoading = !sub.ready();
  const doc = SpatialAnnotations.findOne({ entityType: 'robot', entityId: id, label });
  const map = doc?.map;

  let mapUrl = null;
  if (map?.objectUrl?.startsWith('http')) {
    mapUrl = map.objectUrl;
  } else if (map?.data) {
    mapUrl = `data:image/png;base64,${map.data}`;
  }

  const result = {
    isLoading,
    mapUrl,
    ...(map ? {
      width: map.width,
      height: map.height,
      x: map.x,
      y: map.y,
      resolution: map.resolution,
      formatVersion: map.formatVersion,
      dataHash: map.dataHash,
    } : {}),
  };

  cb && cb(result);
  return result;
}, [robotId, entityId, label]);

/**
 * Hook to return RTT data for a single robot from Meteor, obtained from
 * RobotVitals by subscribing to robot.connectionQuality.
 * TODO: 'robot.connectionQuality' publication is not yet implemented in oro server.
 */
const useMeteorRttData = ({ robotId }, cb = null) => useTracker(() => {
  const rttHandle = Meteor.subscribe('robot.connectionQuality', { robotId });
  const isLoading = !rttHandle.ready();
  const vitals = RobotVitals.findOne({ _id: robotId });
  const rtt = (vitals && vitals.sysNetRtt);
  const data = { isLoading, rtt };
  cb && cb(data);
  return data;
}, [robotId]);

/**
 * Hook to return robot details for a given robotIds array
 */
const useMeteorRobotDetails = ({ robotIds }, cb = null) => useTracker(() => {
  const robotDetails = Meteor.subscribe('robot.details', { robotIds });
  const isLoading = !robotDetails.ready();
  const robots = Robots.find({ _id: { $in: robotIds } }).fetch();
  const data = { isLoading, robots };
  cb && cb(data);
  return data;
}, [robotIds]);

// -----------------------------------------------------------------------------
// Data sources follow: They simply wrap the hook into a function that knows how
// to 'dispatch' the data to the RobotsDataContext
// -----------------------------------------------------------------------------

/**
 * Data source implementation for Localization (pose + ...) data
 */
const meteorLocalizationDataSource = wrapHookAsDataSource(
  useMeteorLocalizationData, multipleRobotsLocalizationData
);

/**
 * Data source implementation for Map data
 */
const meteorMapDataSource = wrapHookAsDataSource(useMeteorMapData, mapData);

/**
 * Data source implementation for RTT (ping) data
 */
const meteorRttDataSource = wrapHookAsDataSource(useMeteorRttData, rttData);

/**
 * Data source implementation for Robot Details
 */
const meteorRobotDetailsSource = wrapHookAsDataSource(useMeteorRobotDetails, robotDetailsData);

export {
  // Hooks
  useMeteorLocalizationData,
  useMeteorMapData,
  useMeteorRttData,
  useMeteorRobotDetails,
  // Data sources
  meteorLocalizationDataSource,
  meteorMapDataSource,
  meteorRttDataSource,
  meteorRobotDetailsSource
};
