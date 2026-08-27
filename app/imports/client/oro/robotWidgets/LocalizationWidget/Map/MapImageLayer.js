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
 * Map Image layer Component
 * Allows displaying a background image for the map structure.
 * It will get mounted only when the map exists.
 */
import PropTypes from 'prop-types';
import { useContext, useEffect } from 'react';
import OLImageLayer from 'ol/layer/Image';
import Static from 'ol/source/ImageStatic';
import Projection from 'ol/proj/Projection';
import { MapContext } from './Map';
import {
  registerMapImageTransforms,
  calculateMapExtent,
} from '../utils/utils';

/**
 * Component to interact with the Map.
 *
 * It will side effect the map to add an image layer with its features
 *
 * @param autoFit   If set to true, when loaded it will fit and center the map view to the
 *                  provided map metadata
 */
const MapImageLayer = ({ url, mapMetadata, style, zIndex = 0, autoFit = false }) => {
  const { map, autoFitRef } = useContext(MapContext);

  useEffect(() => {
    if (!map) return undefined;
    if (!url) return undefined;

    const { height, width } = mapMetadata;
    const imageExtent = [0, 0, width, height];
    const imageProjection = new Projection({
      code: `image-map-${mapMetadata._id || 'default'}`,
      units: 'pixels',
      extent: imageExtent,
    });

    const mapProjection = map.getView().getProjection();

    // Handle coordinate transformations for all possible map formats
    registerMapImageTransforms(mapProjection, imageProjection, mapMetadata);

    const imageLayer = new OLImageLayer({
      className: 'ol-map-image-layer',
      source: new Static({
        url,
        projection: imageProjection,
        imageExtent,
        interpolate: true,
      }),
      style,
    });

    map.addLayer(imageLayer);
    imageLayer.setZIndex(zIndex);

    // Register autoFit via context ref so Map.js can call it without OL map mutation
    try {
      const extent = calculateMapExtent(mapMetadata);
      if (autoFitRef) autoFitRef.current = () => map.getView().fit(extent);
      if (autoFit) map.getView().fit(extent);
    } catch (error) {
      console.error('Failed to calculate map extent:', error);
    }

    return () => {
      if (autoFitRef) autoFitRef.current = null;
      if (map) map.removeLayer(imageLayer);
    };
  }, [map, url, mapMetadata]);

  return null;
};

MapImageLayer.propTypes = {
  url: PropTypes.string,
  mapMetadata: PropTypes.shape({
    _id: PropTypes.string,
    height: PropTypes.number,
    width: PropTypes.number,
    resolution: PropTypes.number,
    x: PropTypes.number,
    y: PropTypes.number,
    formatVersion: PropTypes.number,
  }),
  style: PropTypes.func,
  zIndex: PropTypes.number,
  autoFit: PropTypes.bool,
};

export default MapImageLayer;
