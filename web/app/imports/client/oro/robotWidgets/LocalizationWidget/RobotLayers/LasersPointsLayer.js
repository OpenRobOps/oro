/**
 * Lasers Layer
 *
 * Displays the laser points for a given robot
 * Requires subscribing to the robot pose data.
 */
import React, { useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import VectorSource from 'ol/source/Vector';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import GeometryCollection from 'ol/geom/GeometryCollection';
import { Fill, Stroke, Circle, Style } from 'ol/style';
// Modules
import theme from '../../../../Styles';
import ReactVectorLayer from './ReactVectorLayer';
import { transformFeatures } from '../utils/geometry';

/**
  Decodes a structure like FloatingPointList (see protobuf message), which contains
  'runs' and 'values' fields (Inf and NaN values skipped) into a single float array
*/
function _decodeFixedPointsList(fpList) {
  const ret = [];
  // Go over the list of infinites (and deltas) and recreate the original numbers
  let valueIx = 0;
  for (let ix = 0; ix < fpList.runs.length; ix++) {
    let x = fpList.runs[ix];
    if (ix % 2 == 0) { // Even position; number of infinites to add
      while (x-- > 0) {
        ret.push(NaN);
      }
    } else {
      while (x-- > 0) { // Next x elements are non-infinite
        ret.push(fpList.values[valueIx++]);
      }
    }
  }
  if (valueIx != fpList.values.length) {
    throw new Error('Error decoding FP list; sum of even-position runs was not the same as the number of values');
  }
  return ret;
}

/**
 * Generates an array of points representing the laser points from the
 * laserconfig and laser ranges data.
 * The resulting points are centered with respect to the laser center, and require
 * a transformation
 * @param {*} laserConfig
 * @param {*} laserRanges
 */
function renderLaserPoints(laserConfig, laserRanges) {
  const ranges = _decodeFixedPointsList(laserRanges);

  // Translate from ranges to [x, y] points
  // These are in the reference frame of this laser
  const points = [];
  const angleIncrement = laserConfig.angle.incr || (laserConfig.angle.max - laserConfig.angle.min)
    / laserConfig.numRanges;
  const startAngle = angleIncrement > 0 ? laserConfig.angle.min : laserConfig.angle.max;
  let distance; let angle; let x; let
    y;
  for (let i = 0; i < ranges.length; i++) {
    distance = ranges[i];
    if (!Number.isNaN(distance) && distance != Infinity
      && distance <= laserConfig.range.max && distance > laserConfig.range.min) {
      angle = startAngle + angleIncrement * i;
      x = distance * Math.cos(angle);
      y = distance * Math.sin(angle);
      points.push([x, y]);
    }
  }

  return points;
}

/**
 * Creates an OpenLayers style based on the provided preferences
 */
function laserPointStyle(laserId = '0', laserPreferences = {}) {
  // Calculate the point color based on preferences or else default
  // color per laser Id
  let { pointsColor: color } = laserPreferences;
  if (!color) {
    switch (laserId) {
      case '0':
        color = theme.palette.laserPoints.primary;
        break;
      case '1':
        color = theme.palette.laserPoints.secondary;
        break;
      default:
        color = theme.palette.laserPoints.tertiary;
        break;
    }
  }

  const fill = new Fill({ color });
  const stroke = new Stroke({
    color,
    width: 1
  });
  return new Style({
    image: new Circle({
      fill,
      stroke,
      radius: 2
    }),
    fill,
    stroke
  });
}

/**
 * Creates the laser points features
 */
const createFeatures = ({ laserConfig = {}, laserRanges, laserId, laserPreferences }) => {
  const { transform = {} } = laserConfig;
  const laserPoints = renderLaserPoints(laserConfig, laserRanges);
  const feature = new Feature(new GeometryCollection(laserPoints.map(point => new Point(point))));
  feature.setStyle(laserPointStyle(laserId, laserPreferences));
  transformFeatures([feature], transform);
  return [feature];
};

/**
 * Displays a laser on a map
 */
const LaserPointsLayer = ({
  robotPose, laserConfig, laserId, laserRanges, dimmed, zIndex = 0, laserPreferences = {}
}) => {
  // Create the vector source only the first time, when we mount
  const vectorSource = useMemo(() => new VectorSource(), []);

  // Update the features on the source each time the robotPose or laser data changes
  useEffect(() => {
    const featureAtOrigin = createFeatures({ laserConfig, laserRanges, laserId, laserPreferences });
    const featuresAtMap = transformFeatures(featureAtOrigin, robotPose);

    // Update the features on the source in each render
    vectorSource.clear();
    vectorSource.addFeatures(featuresAtMap);
    return () => {
      vectorSource && vectorSource.clear();
    };
  }, [robotPose, laserConfig, laserRanges]);

  return (
    <ReactVectorLayer
      name="laserPoints"
      source={vectorSource}
      opacity={dimmed ? 0.3 : 1}
      zIndex={zIndex}
    />
  );
};

LaserPointsLayer.propTypes = {
  // Data Props
  robotPose: PropTypes.object, // {x,y,theta} of the robot
  laserConfig: PropTypes.object, // metadata such as laser transform, max/min angle, range, etc
  laserRanges: PropTypes.object, // actual laser values
  laserId: PropTypes.string,
  // Style props
  dimmed: PropTypes.bool,
  laserPreferences: PropTypes.object,
  zIndex: PropTypes.number
};

export default LaserPointsLayer;
export { createFeatures };
