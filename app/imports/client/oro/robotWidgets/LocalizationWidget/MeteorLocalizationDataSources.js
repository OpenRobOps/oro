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
import { Robots, RobotLocalization, SpatialAnnotations } from '../../../../lib/collections';
import { fetchRobotAttributeValues } from '../../../../lib/attributes';
import { VITAL_PING_RTT_AVG } from '../../../../shared/attributes';
import { normalizeMapAnnotation } from '../../../../shared/maps';
import { keyBy } from 'lodash';
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
function useMeteorLocalizationData({ robotIds, lowBandwidth, selectedRobotId }, cb = null) {
  const key = (robotIds || []).join(',');
  return useTracker(() => {
    if (!Array.isArray(robotIds) || robotIds.length == 0) return null;
    // Only the selected robot needs lasers and paths; everyone else is drawn from pose alone.
    const others = robotIds.filter((id) => id !== selectedRobotId);
    const subs = [];
    if (others.length) subs.push(Meteor.subscribe('localization', { robotIds: others, lowBandwidth: true }));
    if (robotIds.includes(selectedRobotId)) subs.push(Meteor.subscribe('localization', { robotIds: [selectedRobotId], lowBandwidth }));
    const p = RobotLocalization.find({ _id: { $in: robotIds } }).fetch().map((l) => { l.src = 'meteor'; return l; });
    const data = { isLoading: subs.some((s) => !s.ready()), localizationData: keyBy(p, '_id') };
    cb && cb(data);
    return data;
  }, [key, lowBandwidth, selectedRobotId]);
}

/**
 * Hook that returns a fully-resolved map given a robotId and an optional map label.
 * Reads from the spatial_annotations collection which stores map metadata and image data.
 * Uses objectUrl when available; falls back to a data URL built from the base64 `data` field.
 */
const useMeteorMapData = (
  { robotId, entityId, entityType = 'robot', label = 'map' },
  cb = null,
) => useTracker(() => {
  const accessRobotId = robotId || entityId;
  if (!accessRobotId || !label) {
    cb && cb({ isLoading: false });
    return { isLoading: false };
  }
  const query = entityType === 'system'
    ? { entityType: 'system', entityId: '0', label }
    : { entityType: 'robot', entityId: entityId || accessRobotId, label };

  const sub = Meteor.subscribe('spatial_annotations.map', { robotId: accessRobotId, ...query });
  const isLoading = !sub.ready();
  const normalized = normalizeMapAnnotation(SpatialAnnotations.findOne(query));
  const a = normalized?.annotation;

  let mapUrl = null;
  if (a?.objectUrl?.startsWith('http')) {
    mapUrl = a.objectUrl;
  } else if (a?.data) {
    mapUrl = `data:image/png;base64,${a.data}`;
  }

  const result = {
    isLoading,
    mapUrl,
    ...(a ? {
      entityType: normalized.entity.entityType,
      entityId: normalized.entity.entityId,
      label,
      frameId: normalized.entity.frameId,
      // OL projection code must be unique per image (MapImageLayer); `_id` feeds createImagePixelProjection
      _id: `${normalized.entity.entityType}-${normalized.entity.entityId}-${label}`,
      width: a.width,
      height: a.height,
      x: a.x,
      y: a.y,
      resolution: a.resolution,
      formatVersion: a.formatVersion,
      dataHash: a.dataHash,
    } : {}),
  };

  cb && cb(result);
  return result;
}, [robotId, entityId, entityType, label]);

/**
 * Hook to return RTT data for a single robot. Subscribing to robot.connectionQuality starts
 * the server-side ping loop and publishes the pingAvg attribute value, which we read through
 * the standard attribute-values pipeline. `rtt` is the raw attribute object — `{ value, ts }`
 * — so consumers should read `rtt.value` and `rtt.ts`.
 */
const useMeteorRttData = ({ robotId }, cb = null) => useTracker(() => {
  const rttHandle = Meteor.subscribe('robot.connectionQuality', { robotId });
  const isLoading = !rttHandle.ready();
  const values = fetchRobotAttributeValues({ robotId, attributes: [VITAL_PING_RTT_AVG] });
  const rtt = values?.[VITAL_PING_RTT_AVG];
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
