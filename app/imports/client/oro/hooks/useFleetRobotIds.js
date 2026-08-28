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

/** Ids of every robot the user can see (the `robots` publication), stable across renders. */
import { useRef } from 'react';
import useRobots from './useRobots';

export function useFleetRobotIds() {
  const { robotsById } = useRobots();
  const ids = Object.keys(robotsById).sort();
  const ref = useRef(ids);
  if (ref.current.length !== ids.length || ref.current.some((id, i) => id !== ids[i])) ref.current = ids;
  return ref.current;
}
