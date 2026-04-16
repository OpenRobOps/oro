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
 * Costmap layer Component
 * Allows displaying the costmap grid image for the selected robot.
 * It will get mounted only when the map exists.
 * Also it will render the costmap based on the costmap metadata.
 */
import { useContext, useEffect } from 'react';
import PropTypes from 'prop-types';
import ImageLayer from 'ol/layer/Image';
import Static from 'ol/source/ImageStatic';
import Projection from 'ol/proj/Projection';
import { addCoordinateTransforms } from 'ol/proj';

// Modules
import { MapContext } from '../Map/Map';
import { rotatePoint2D } from '../utils/geometry';

/**
 * Component that shows the robot costmap.
 *
 * It will side effect the map to add an image layer with the costmap png image encoded in base64
 *
 * costmapMetadata : metadata received from the costmap (x,y, resolution etc)
 * zIndex: costmap z axis (by default it is 0)
 *
 * @param {*} { costmapMetadata, zIndex = 0 }
 * @return {*}
 */
const CostmapLayer = ({ costmapMetadata, zIndex = 0 }) => {
  const { height, width, theta, resolution, x, y, data } = costmapMetadata;
  const { map } = useContext(MapContext);

  useEffect(() => {
    if (!map) return undefined;

    const costmapExtent = [0, -1 * height, width, 0];
    const costmapProjection = new Projection({
      code: 'costmap-layer',
      units: 'pixels',
      extent: costmapExtent,
    });

    addCoordinateTransforms(
      map.getView().getProjection(),
      costmapProjection,
      ([mX, mY]) => rotatePoint2D([(mX - x) / resolution, -(mY - y) / resolution], theta),
      // NOTE: The following transform, from image to map, seems not used anywhere.
      // Kept here for completeness.
      ([iX, iY]) => rotatePoint2D([iX * resolution + x, -(iY * resolution + y)], -theta)
    );

    const imageLayer = new ImageLayer({
      source: new Static({
        imageLoadFunction: (image) => {
          image.getImage().src = `data:image/png;base64,${data}`;
        },
        projection: costmapProjection,
        imageExtent: costmapExtent,
        interpolate: true,
      }),
    });

    map.addLayer(imageLayer);
    imageLayer.setZIndex(zIndex);

    return () => {
      if (map) {
        map.removeLayer(imageLayer);
      }
    };
  }, [map, data]);

  return null;
};

CostmapLayer.propTypes = {
  // Map metadata props
  costmapMetadata: PropTypes.object, // metadata received from the map (x,y, resolution etc)
  zIndex: PropTypes.number, // zIndex: map z axis (by default it is 0)
};

export default CostmapLayer;
