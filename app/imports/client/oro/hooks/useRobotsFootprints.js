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

/** Resolved footprint (`map.pose` shape) per robot, from the `robot_footprints` publication. */
import { useMemo } from 'react';
import { Meteor } from 'meteor/meteor';
import { Mongo } from 'meteor/mongo';
import { useTracker } from 'meteor/react-meteor-data';
import { ROBOT_FOOTPRINTS_COLLECTION } from '../../../shared/footprint';

const clientCollections = (globalThis.__oroClientCollections ||= {});
const RobotFootprints = (clientCollections[ROBOT_FOOTPRINTS_COLLECTION]
  ||= new Mongo.Collection(ROBOT_FOOTPRINTS_COLLECTION));

const EMPTY = {};

export function useRobotsFootprints(robotIds) {
  const key = (robotIds || []).join(',');
  const docs = useTracker(() => {
    if (!robotIds || robotIds.length === 0) return [];
    Meteor.subscribe('robot_footprints', { robotIds });
    return RobotFootprints.find({ _id: { $in: robotIds } }).fetch();
  }, [key]);
  return useMemo(() => (docs.length === 0 ? EMPTY
    : Object.fromEntries(docs.map((d) => [d._id, { map: { pose: d.pose } }]))), [docs]);
}
