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
 * Hooks for the maps a robot can display and the frame transforms that place it on them.
 *
 * A map selection travels through dashboard context as a string ("map ref"):
 *   - `system:<mapId>` — a shared map
 *   - `robot:<mapId>`  — one of the robot's own maps
 *   - `<mapId>`        — legacy: the robot's own map with that label
 */
import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { useTracker } from 'meteor/react-meteor-data';
import { RobotLocalization, SpatialTransformations } from '../../../lib/collections';
import { findFrameTransform, ROBOT_MAPS_COLLECTION } from '../../../shared/maps';

/**
 * Client-only mirror of the `spatial_annotations.maps` publication (map summaries).
 * Cached on globalThis: a Meteor collection name can only be claimed once per page, and the dev
 * server's hot module replacement re-evaluates this module, which would otherwise throw
 * "There is already a collection named" and break every consumer.
 */
const clientCollections = (globalThis.__oroClientCollections ||= {});
const RobotMaps = (clientCollections[ROBOT_MAPS_COLLECTION]
  ||= new Mongo.Collection(ROBOT_MAPS_COLLECTION));

const SYSTEM = { entityType: 'system', entityId: '0' };

/** Parses a map ref into the annotation's entity + label. */
export function parseMapRef(mapRef, robotId) {
  if (!mapRef) return null;
  const [prefix, ...rest] = String(mapRef).split(':');
  const label = rest.join(':');
  if (prefix === 'system' && label) return { ...SYSTEM, label };
  if (prefix === 'robot' && label) return { entityType: 'robot', entityId: robotId, label };
  return { entityType: 'robot', entityId: robotId, label: mapRef };
}

export const mapRefFor = ({ entityType, mapId }) => `${entityType}:${mapId}`;

/** The entry in `maps` that `mapRef` points to, or null if it matches none (e.g. stale after
 * switching to a robot that doesn't have that map). */
export function findMapRef(maps, mapRef, robotId) {
  const q = parseMapRef(mapRef, robotId);
  return (q && maps.find((m) => m.entityType === q.entityType && m.mapId === q.label)) || null;
}

/** Every map the robot can display, plus which one to show by default. */
export function useRobotMapsList(robotId) {
  return useTracker(() => {
    if (!robotId) return { isLoading: false, maps: [], defaultMap: null };
    const subs = [
      Meteor.subscribe('spatial_annotations.maps', { robotId }),
      Meteor.subscribe('localization', { robotIds: [robotId], lowBandwidth: true }),
    ];
    // Summaries for other robots may be present when several widgets show different robots.
    const maps = RobotMaps.find({
      $or: [{ entityType: 'system' }, { entityType: 'robot', entityId: robotId }],
    }).fetch().map(({ _id, ...summary }) => summary);
    const robotDefault = RobotLocalization.findOne({ _id: robotId })?.defaultMap;
    const own = maps.find((m) => m.entityType === 'robot' && m.mapId === robotDefault);
    const firstSystem = maps.find((m) => m.entityType === 'system');
    const def = own || firstSystem || null;
    return {
      isLoading: subs.some((s) => !s.ready()),
      maps,
      defaultMap: def && { mapId: def.mapId, entityType: def.entityType, entityId: def.entityId },
    };
  }, [robotId]);
}

/** Transform from frame `from` to frame `to` for a robot: robot override → system → identity → null. */
export function useFrameTransform({ robotId, from, to }) {
  return useTracker(() => {
    if (!robotId || !from || !to) return { isLoading: false, transform: null };
    const sub = Meteor.subscribe('spatial_transformations', { robotId });
    const robotDoc = SpatialTransformations.findOne({ entityType: 'robot', entityId: robotId });
    const systemDoc = SpatialTransformations.findOne(SYSTEM);
    return { isLoading: !sub.ready(), transform: findFrameTransform({ robotDoc, systemDoc, from, to }) };
  }, [robotId, from, to]);
}
