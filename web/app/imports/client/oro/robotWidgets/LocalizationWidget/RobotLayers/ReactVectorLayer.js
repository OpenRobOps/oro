/**
 * Vector layer Component
 *
 * Utilizes side Effects to attach a passed vector Source to the map object
 *
 * the map object is available through the context, as such it is not passed as a prop
 *
 * It will get mounted only when the map exists.
 *
 */
import { useContext, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
// Modules
import OLVectorLayer from 'ol/layer/Vector';
import { MapContext } from '../Map/Map';

const ReactVectorLayer = ({ source, style, zIndex = 0, projection, opacity = 1 }) => {
  const { map } = useContext(MapContext);
  const [myVectorLayer, setMyVectorLayer] = useState();

  // Add the layer when the map is created
  useEffect(() => {
    if (!map) return undefined;
    const vectorLayer = new OLVectorLayer({
      source,
      style,
      projection
    });
    map.addLayer(vectorLayer);
    setMyVectorLayer(vectorLayer);
    vectorLayer.setZIndex(zIndex);

    return () => {
      if (map) {
        map.removeLayer(vectorLayer);
      }
    };
  }, [source, map]);

  useEffect(() => {
    if (myVectorLayer) {
      myVectorLayer.setStyle(style);
    }
  }, [style, myVectorLayer]);

  useEffect(() => {
    if (myVectorLayer) {
      myVectorLayer.setOpacity(opacity);
    }
  }, [opacity, myVectorLayer]);

  useEffect(() => {
    if (myVectorLayer) {
      myVectorLayer.setZIndex(zIndex);
    }
  }, [zIndex, myVectorLayer]);

  return null;
};

ReactVectorLayer.propTypes = {
  source: PropTypes.object,
  style: PropTypes.func,
  zIndex: PropTypes.number,
  projection: PropTypes.object,
  opacity: PropTypes.number
};

export default ReactVectorLayer;
