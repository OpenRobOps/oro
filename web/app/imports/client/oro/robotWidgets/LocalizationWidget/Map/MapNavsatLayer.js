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
  const { map } = useContext(MapContext);

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

    // TODO: Extract the creation of this autoFit method so that it can be re-created
    // in case that 'bounds' changes - without re-creating the entire worldLayer when only the
    // bounds have changed
    if (bounds && bounds.length > 3) {
      if (bounds[2] - bounds[0] != 0 || bounds[3] - bounds[1] != 0) {
        map.autoFit = () => map.getView().fit(bounds);
      } else {
        map.autoFit = () => {
          map.getView().setCenter([bounds[0], bounds[1]]);
          map.getView().setZoom(19);
        };
      }
    }

    return () => {
      if (map) {
        map.autoFit = null;
        map.removeLayer(worldLayer);
      }
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
