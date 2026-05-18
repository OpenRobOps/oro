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
 * Builders for OpenLayers styles used in the map.
 */
import { Fill, Stroke, Circle, Style } from 'ol/style';

/**
 * Style used for user control markers.
 * It should have a higher zIndex than other elements being drawn in the map.
 */
export function markerStyle(primaryColor, strokeColor, strokeWidth = 3) {
  return new Style({
    fill: new Fill({ color: primaryColor }),
    stroke: new Stroke({
      color: strokeColor,
      width: strokeWidth
    }),
    zIndex: 50
  });
}

export function noStyle() {
  return new Style({ fill: new Fill({ color: 'transparent' }) });
}

export function pointStyle(color, radius) {
  const fill = new Fill({ color });
  const stroke = new Stroke({
    color,
    width: 1
  });
  return new Style({
    image: new Circle({
      fill,
      stroke,
      radius
    }),
    fill,
    stroke
  });
}

export function pathStyle(color, strokeWidth, isDashed = false) {
  const stroke = new Stroke({
    color,
    width: strokeWidth
  });

  if (isDashed) {
    stroke.setLineDash([4, 6]);
    stroke.setLineDashOffset(6);
  }

  return new Style({
    stroke
  });
}
