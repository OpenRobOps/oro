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
  const { map } = useContext(MapContext);

  useEffect(() => {
    if (!map) return undefined;
    if (!url) return undefined;

    const { height, width } = mapMetadata;
    const imageExtent = [0, 0, width, height];
    const imageProjection = new Projection({
      code: 'image-map',
      units: 'pixels',
      extent: imageExtent,
    });

    const mapProjection = map.getView().getProjection();

    // Handle coordinate transformations for all possible map formats
    registerMapImageTransforms(mapProjection, imageProjection, mapMetadata);

    const imageLayer = new OLImageLayer({
      source: new Static({
        url,
        projection: imageProjection,
        imageExtent,
        imageSmoothing: true,
      }),
      style,
    });

    map.addLayer(imageLayer);
    imageLayer.setZIndex(zIndex);

    // Extend the map object with autoFit method to fit the image
    try {
      const extent = calculateMapExtent(mapMetadata);
      map.autoFit = () => map.getView().fit(extent);
    } catch (error) {
      console.error('Failed to calculate map extent:', error);
    }

    if (autoFit) {
      map.autoFit();
    }

    return () => {
      if (map) {
        map.autoFit = null;
        map.removeLayer(imageLayer);
      }
    };
  }, [map, url, mapMetadata]);

  return null;
};

MapImageLayer.propTypes = {
  url: PropTypes.string,
  mapMetadata: PropTypes.shape({
    height: PropTypes.number.isRequired,
    width: PropTypes.number.isRequired,
    resolution: PropTypes.number.isRequired,
    x: PropTypes.number.isRequired,
    y: PropTypes.number.isRequired,
    formatVersion: PropTypes.number,
  }).isRequired,
  style: PropTypes.func,
  zIndex: PropTypes.number,
  autoFit: PropTypes.bool,
};

export default MapImageLayer;
