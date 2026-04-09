/**
 * Component used to display an edge between waypoints. The edge can have a trajectory that is
 * specified as a [NURBS](https://en.wikipedia.org/wiki/Non-uniform_rational_B-spline).
 */
import React, { useMemo, useEffect } from 'react';
import PropTypes from 'prop-types';
import VectorSource from 'ol/source/Vector';
import LineString from 'ol/geom/LineString';
import Polygon from 'ol/geom/Polygon';
import { Fill, Stroke, Style } from 'ol/style';
import nurbs from 'nurbs';
import { last } from 'lodash';
// ORO Modules
import rootTheme from '../../../../../Styles'; // NOTE: Should not import theme directly
import AnchoredOverlayLayer from '../../Map/AnchoredOverlay';
import { pathStyle } from '../../Map/Styles';
import ReactVectorLayer from '../../RobotLayers/ReactVectorLayer';
import { createFeature } from '../../utils/utils';
import { FEATURE_PROPERTY_ANNOTATION_UNIQUE_ID } from '../../Map/Map';
import Label from '../Label';

// Types of trajectories that can be used in edges
const TRAJECTORY_TYPE_LINE = 'line';
const TRAJECTORY_TYPE_NURBS = 'nurbs';

/**
 * Compute the points of the edge between two waypoints for a trajectory defined using NURBS.
 * The returned list of points can be used to build a sequence of lines that approximates the curve.
 *
 * @param {object} startWaypointCoord
 * @param {object} endWaypointCoord
 * @param {object} trajectory
 */
const computeNurbsPoints = (
  startWaypointCoord,
  endWaypointCoord,
  trajectory = { parameters: {} }
) => {
  const { parameters } = trajectory;
  const controlPoints = Array.isArray(parameters.controlPoints)
    ? [...parameters.controlPoints]
    : [];
  // The first control point is the start waypoint and the last control point is the end
  // waypoint
  const firstControlPoint = controlPoints[0];
  if (firstControlPoint
    && firstControlPoint?.x === undefined
    && firstControlPoint?.y === undefined) {
    // If the first control point is defined, but x and y are not defined, we use the start
    // waypoint for the coordinate, but keep any other field, like the weight for example.
    firstControlPoint.x = startWaypointCoord.x;
    firstControlPoint.y = startWaypointCoord.y;
  } else {
    // If the first control point is defined, we prepend the start waypoint
    controlPoints.unshift(startWaypointCoord);
  }
  const lastControlPoint = last(controlPoints);
  if (lastControlPoint
    && lastControlPoint?.x === undefined
    && lastControlPoint?.y === undefined) {
    // If the last control point is defined, but x and y are not defined, we use the start
    // waypoint for the coordinate, but keep any other field, like the weight for example.
    lastControlPoint.x = startWaypointCoord.x;
    lastControlPoint.y = startWaypointCoord.y;
  } else {
    // If the last control point is defined, we append the end waypoint
    controlPoints.push(endWaypointCoord);
  }
  const points = [];
  try {
    const n = nurbs({
      points: controlPoints.map(p => [p.x, p.y]),
      knots: Array.isArray(parameters.knotVector) ? [parameters.knotVector] : [],
      weights: controlPoints.map(p => (Number.isFinite(p?.weight) ? p.weight : 1)),
      degree: trajectory.degree
    });
    const domain = n.domain[0];

    const step = 0.05 * (domain[1] - domain[0]);
    for (let t = domain[0]; t <= domain[1]; t += step) {
      const p = n.evaluate([], t);
      points.push(p);
    }
    // We need to add the last point because of accumulated floating point errors the loop may not
    // reach the end point
    const p = n.evaluate([], domain[1]);
    points.push(p);
  } catch (e) {
    console.error('Error computing NURBS points', e);
  }
  return points;
};

/**
 * Computes the points of the edge between two waypoints based on the trajectory.
 *
 * @see [Spatial Annotations design document](https://docs.google.com/document/d/1uqw8i68mKQTY0Dc2ZAxhOgkTsVJdJBvGIdAKtCGD6Kc/edit?tab=t.0)
 */
const computePoints = (startWaypointCoord, endWaypointCoord, trajectory) => {
  if (!startWaypointCoord || !endWaypointCoord) {
    return [];
  }

  const trajectoryType = trajectory?.type || TRAJECTORY_TYPE_LINE;

  switch (trajectoryType) {
    case TRAJECTORY_TYPE_LINE:
      return [
        [startWaypointCoord.x, startWaypointCoord.y],
        [endWaypointCoord.x, endWaypointCoord.y]
      ];
    case TRAJECTORY_TYPE_NURBS:
      return computeNurbsPoints(startWaypointCoord, endWaypointCoord, trajectory);
    default:
      console.error('Unsupported trajectory type', trajectory);
      return [];
  }
};

/**
 * Renders the edge between two waypoints. If the edge has a trajectory, it will render a curve
 * using a sequence of lines that approximate the trajectory.
 */
const EdgeLayer = ({ edge, zIndex = 0, isSelected }) => {
  const { annotation = {}, entity } = edge || {};
  const { startWaypointCoord, endWaypointCoord, trajectory, annotationId, label } = annotation;
  const uniqueId = { ...entity, annotationId };

  // Compute the points of the curve based on the trajectory
  const curvePoints = useMemo(() => {
    if (!startWaypointCoord || !endWaypointCoord) {
      return [];
    }
    return computePoints(startWaypointCoord, endWaypointCoord, trajectory);
  }, [startWaypointCoord, endWaypointCoord, trajectory]);

  // Compute the center of the curve. This is used to show the label of the edge in the middle of
  // the curve.
  const centerAnchor = useMemo(() => {
    if (curvePoints.length < 2) {
      return [];
    }
    if (curvePoints.length % 2 === 1) {
      return curvePoints[(curvePoints.length - 1) / 2];
    }
    const a = curvePoints[curvePoints.length / 2 - 1];
    const b = curvePoints[curvePoints.length / 2];
    return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  }, [curvePoints]);

  // Create the OpenLayers feature for the curve
  const curveFeature = useMemo(() => {
    const geom = new LineString(curvePoints);
    const f = createFeature(geom, 'edge' + JSON.stringify(uniqueId), 0);
    f.set(FEATURE_PROPERTY_ANNOTATION_UNIQUE_ID, uniqueId);
    return f;
  }, [curvePoints, isSelected]);

  // Create the OpenLayers feature for the arrow head that indicates the direction of the edge
  const arrowHeadFeature = useMemo(() => {
    if (curvePoints.length < 2) {
      return null;
    }
    // This math may look complex but it's just to compute the direction of arrow head
    const a = curvePoints[curvePoints.length - 2];
    const b = curvePoints[curvePoints.length - 1];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const norm = Math.sqrt(dx * dx + dy * dy);
    const ndx = dx / norm;
    const ndy = dy / norm;
    const z = [b[0] - 0.33 * ndx, b[1] - 0.33 * ndy];
    const geom = new Polygon([
      [
        [z[0] - 0.2 * ndy, z[1] + 0.2 * ndx],
        [z[0] + 0.2 * ndy, z[1] - 0.2 * ndx],
        [b[0], b[1]],
      ]
    ]);
    const f = createFeature(geom, 'edgeArrow' + JSON.stringify(uniqueId), 0);
    f.set(FEATURE_PROPERTY_ANNOTATION_UNIQUE_ID, uniqueId);
    return f;
  }, [curvePoints]);

  useEffect(() => {
    const color = isSelected
      ? rootTheme.palette.primary.main
      : rootTheme.palette.background.navLight;
    curveFeature?.setStyle(pathStyle(color, 3, false));
    arrowHeadFeature?.setStyle(new Style({
      fill: new Fill({ color }),
      stroke: new Stroke({
        color,
        width: 3
      }),
      zIndex: zIndex + 1
    }));
  }, [isSelected, curveFeature, arrowHeadFeature]);

  // Create the OpenLayers source for the curve and arrow head
  const vectorSourceCurve = useMemo(() => {
    const source = new VectorSource();
    source.addFeature(curveFeature);
    if (arrowHeadFeature) {
      source.addFeature(arrowHeadFeature);
    }
    return source;
  }, [curveFeature, arrowHeadFeature]);

  return (
    <>
      <ReactVectorLayer
        name="edgeCurve"
        source={vectorSourceCurve}
        zIndex={zIndex}
      />
      {isSelected && (
        <AnchoredOverlayLayer x={centerAnchor[0]} y={centerAnchor[1]} sizeY={0.1}>
          <Label label={label} />
        </AnchoredOverlayLayer>
      )}
    </>
  );
};

EdgeLayer.propTypes = {
  edge: PropTypes.shape({
    annotation: PropTypes.shape({
      startWaypointCoord: PropTypes.shape({
        x: PropTypes.number,
        y: PropTypes.number
      }).isRequired,
      endWaypointCoord: PropTypes.shape({
        x: PropTypes.number,
        y: PropTypes.number
      }).isRequired,
      trajectory: PropTypes.shape({
        controlPoints: PropTypes.array,
        knotVector: PropTypes.array,
        degree: PropTypes.number
      }),
      annotationId: PropTypes.string.isRequired
    }),
    entity: PropTypes.object.isRequired
  }),
  zIndex: PropTypes.number,
  isSelected: PropTypes.bool,
};

export default EdgeLayer;
