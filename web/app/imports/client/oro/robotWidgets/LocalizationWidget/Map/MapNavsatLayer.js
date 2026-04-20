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
 * Map Navsat layer Component
 *
 * Takes care of displaying a grid of the earth surface, so that we can display robots over it.
 */
import { useContext, useEffect } from 'react';
import PropTypes from 'prop-types';
import TileLayer from 'ol/layer/Tile.js';
import TileJSON from 'ol/source/TileJSON.js';
import OSM from 'ol/source/OSM.js';
import { MapContext } from './Map';

const LOCALIZATION_TILESETS = {
  OSM_STREET: 'osm-street',
  SATELLITE: 'satellite'
};

/**
 * Component that displays an outdoor map with the correct initially specified location
 */
const MapNavsatLayer = ({
  zIndex = 0,
  uiPreferences = {},
  tilesetKey: key,
  bounds
}) => {
  const { map, autoFitRef } = useContext(MapContext);

  const tileset = uiPreferences?.map?.tileset || LOCALIZATION_TILESETS.OSM_STREET;

  useEffect(() => {
    if (!map) return undefined;

    const worldLayer = new TileLayer();
    map.addLayer(worldLayer);
    worldLayer.setZIndex(zIndex);

    switch (tileset) {
      case LOCALIZATION_TILESETS.OSM_STREET:
        worldLayer.setSource(new OSM());
        break;
      case LOCALIZATION_TILESETS.SATELLITE:
        if (!key) {
          throw new Error('Key for map tileset service missing in props');
        }
        worldLayer.setSource(new TileJSON({
          url: `https://api.maptiler.com/tiles/satellite-v2/tiles.json?key=${key}`,
          tileSize: 512,
          crossOrigin: 'anonymous'
        }));
        break;
      default:
        console.warn(`Unknown tileset found in UI preferences: ${tileset}`);
    }

    // Register autoFit via context ref so Map.js can call it without OL map mutation
    if (autoFitRef && bounds && bounds.length > 3) {
      if (bounds[2] - bounds[0] != 0 || bounds[3] - bounds[1] != 0) {
        autoFitRef.current = () => map.getView().fit(bounds);
      } else {
        autoFitRef.current = () => {
          map.getView().setCenter([bounds[0], bounds[1]]);
          map.getView().setZoom(19);
        };
      }
    }

    return () => {
      if (autoFitRef) autoFitRef.current = null;
      if (map) map.removeLayer(worldLayer);
    };
  }, [map, tileset]);

  return null;
};

MapNavsatLayer.propTypes = {
  zIndex: PropTypes.number,
  uiPreferences: PropTypes.object,
  tilesetKey: PropTypes.string,
  bounds: PropTypes.array // OpenLayers extent in the form [left, top, right, bottom]
};

export default MapNavsatLayer;
