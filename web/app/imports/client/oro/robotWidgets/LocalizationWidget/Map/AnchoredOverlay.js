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
 * Implements an overlay element to be added in an Openlayers map, above an element.
 * For example, to render robot or waypoint names.
 *
 * It is meant to render a box for a box located in { x, y }, with an approximate height
 * sizeY (in map coordinates). The overlay will position a few pixels over that coordinate, and
 * adjusts according to the current map zoom (resolution).
 *
 * The caller must pass the actual contents of the box, as children or this component.
 *
 * NOTE: For now it only supports "top" anchor, ie. the box always appear above the element.
 */
import React, { useMemo, useEffect, useContext } from 'react';
import Overlay from 'ol/Overlay';
import PropTypes from 'prop-types';
import { MapContext } from './Map';

// Styles for the name and properties legend
const anchoredStyle = {
  // anchor bottom/centered to the coordinate calculated over the waypoint icons
  position: 'absolute',
  transform: 'translateX(-50%)',
  bottom: 0
};

const AnchoredOverlayLayer = ({ x, y, sizeY = 1, children }) => {
  // Get a reference to the OpenLayers map
  const { map } = useContext(MapContext);
  const resolution = map && map.getView().getResolution();
  // Create feature only the first time, when we mount
  const overlay = useMemo(() => (
    new Overlay({ opacity: 0.8 })
  ), []);
  // Update the features on the source each time the robotPose or map zooming change
  useEffect(() => {
    overlay.setPosition([x, y]);
    // Calculation below is an approximation: (-1 / resolution) is about the height
    // of the marker, Then the legends anchor and center to that point using absolute
    // positioning.
    overlay.setOffset([0, -sizeY / (resolution || 0.1)]);
  }, [x, y, resolution]);
  useEffect(() => {
    // Position overlay above and to the left of the named waypoint
    // icon, to align it to the center of the icon
    if (!map || !overlay) return undefined;
    map.addOverlay(overlay);
    return () => {
      map.removeOverlay(overlay);
    };
  }, [map, overlay]);

  return (
    <div>
      <div
        ref={div => overlay.setElement(div)}
        style={anchoredStyle}
      >
        {children}
      </div>
    </div>
  );
};
AnchoredOverlayLayer.propTypes = {
  x: PropTypes.number,
  y: PropTypes.number,
  sizeY: PropTypes.number,
  children: PropTypes.object
};

export default AnchoredOverlayLayer;
