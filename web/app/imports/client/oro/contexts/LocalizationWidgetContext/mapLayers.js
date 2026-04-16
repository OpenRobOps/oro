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
 * Layer constants
 * for more information check design doc:
 * https://docs.google.com/document/d/1l1LRlNc4M-QS6n66O3Crdga9wZychVFve2LdI41EUHk/edit#heading=h.y21jxakbjmvv)
 */
const NAVIGATION_MAP_LAYER_COSTMAP = 'costmap';
const NAVIGATION_MAP_LAYER_POSE_OUTLINE = 'poseOutline';
const NAVIGATION_MAP_LAYER_LIDARS = 'lidars';
const NAVIGATION_MAP_LAYER_PATHS = 'paths';

/**
 * List with all the necessary information to display the layers on the map
 *  - id: The id that identifies the layer
 *  - label: The name of the layer that's going to be displayed in the selector
 *           in Navigation Control Bar
 *  - defaultState: <optional> the default state of the layer
 */
const MAP_LAYERS = [
  {
    id: NAVIGATION_MAP_LAYER_COSTMAP,
    label: 'Costmap',
    defaultState: {
      isVisible: true
    }
  },
  {
    id: NAVIGATION_MAP_LAYER_LIDARS,
    label: 'Lidar',
    defaultState: {
      isVisible: true
    }
  },
  {
    id: NAVIGATION_MAP_LAYER_POSE_OUTLINE,
    label: 'Outline',
    defaultState: {
      isVisible: true
    }
  },
  {
    id: NAVIGATION_MAP_LAYER_PATHS,
    label: 'Path',
    defaultState: {
      isVisible: true
    }
  },
];

export {
  MAP_LAYERS,
  NAVIGATION_MAP_LAYER_COSTMAP,
  NAVIGATION_MAP_LAYER_LIDARS,
  NAVIGATION_MAP_LAYER_POSE_OUTLINE,
  NAVIGATION_MAP_LAYER_PATHS,
};
