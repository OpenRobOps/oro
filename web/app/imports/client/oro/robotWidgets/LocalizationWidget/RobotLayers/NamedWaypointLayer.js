/**
 * This component is used to display named waypoint.
 * Waypoints WITH theta use a circle-with-arrow marker (waypointThetaPolygon) rotated to face theta.
 * Waypoints WITHOUT theta (intermediate nodes) use the simple circle marker.
 * Selected / editing states use AnchoredOverlayLayer + WaypointLabel (coordinates, edit field).
 */
import React, {
  useMemo, useEffect, useContext, useState
} from 'react';
import PropTypes from 'prop-types';
import { Vector as VectorLayer } from 'ol/layer.js';
import VectorSource from 'ol/source/Vector.js';
import Point from 'ol/geom/Point';
import { Fill, Style, Text } from 'ol/style';
import { useTheme } from '@mui/material/styles';
// Modules
import { createFeature } from '../utils/utils';
import { MapContext, FEATURE_PROPERTY_ANNOTATION_UNIQUE_ID } from '../Map/Map';
import { makeWaypointCircleStyles } from '../Map/waypointMarkerCircleStyles';
import { waypointThetaPolygon } from '../Map/CustomShapes';
import { markerStyle } from '../Map/Styles';
import AnchoredOverlayLayer from '../Map/AnchoredOverlay';
import WaypointLabel from './WaypointLabel';

const WAYPOINT_PIN_SCALE = 1.5;
const WAYPOINT_PIN_HOVER_SCALE = 2;

// Colors for the three mission states
const GREY_COLOR = 'rgba(130, 130, 130, 0.6)';
const GREEN_COLOR = 'rgba(46, 125, 50, 0.9)';

const NamedWaypointLayer = ({
  annotation, isSelected, isGhost, isEditing, indexList,
  activeWaypointIds, completedWaypointIds
}) => {
  const { map } = useContext(MapContext);
  const theme = useTheme();
  const [isHovered, setIsHovered] = useState(false);
  const { annotation: namedWaypoint = {}, entity } = annotation || {};
  const { x, y, theta, annotationId, label } = namedWaypoint;
  const hasTheta = theta != null && Number.isFinite(theta);
  const uniqueId = { ...entity, annotationId };

  const missionIndexes = Array.isArray(indexList)
    ? indexList
    : (indexList != null && indexList !== false ? [indexList] : []);
  const hasMissionIndex = missionIndexes.length > 0;
  const isActive = isSelected || isEditing || hasMissionIndex;
  const badgeText = hasMissionIndex ? missionIndexes.join(', ') : '';

  // Three-state: dimmed (grey), completed (green), active (blue/default)
  const isCompleted = completedWaypointIds && completedWaypointIds.has(annotationId);
  const isDimmed = activeWaypointIds && !activeWaypointIds.has(annotationId);

  const vectorSource = useMemo(() => new VectorSource(), []);
  const waypointLayer = useMemo(
    () => new VectorLayer({ source: vectorSource }),
    [vectorSource],
  );

  const olLabel = (isSelected || isEditing) ? '' : (label || '');

  // Circle styles for intermediate nodes (no theta)
  const circleStyles = useMemo(
    () => makeWaypointCircleStyles({
      theme,
      label: olLabel,
      isHovered,
      isActive: isActive && !isDimmed,
      isRoute: hasMissionIndex && !isDimmed,
      badgeText: isDimmed ? '' : badgeText,
      alwaysShowLabel: false,
      // Pass override color for dimmed/completed states
      ...(isDimmed ? { overrideColor: GREY_COLOR } : {}),
      ...(isCompleted && !isDimmed ? { overrideColor: GREEN_COLOR } : {}),
    }),
    [theme, olLabel, isHovered, isActive, hasMissionIndex, badgeText, isDimmed, isCompleted],
  );

  // Fill / stroke for theta waypoints — mirrors the circle marker colour logic
  const isRoute = hasMissionIndex && !isDimmed;
  const accentColor = isRoute ? '#1565c0' : theme.selectedAnnotationBackground;

  const pinFillColor = useMemo(() => {
    if (!hasTheta) return null;
    if (isDimmed) return GREY_COLOR;
    if (isCompleted) return GREEN_COLOR;
    return (isActive || isHovered) ? accentColor : theme.unselectedAnnotationBackground;
  }, [hasTheta, isActive, isHovered, isDimmed, isCompleted, accentColor, theme]);

  const pinStrokeColor = useMemo(() => {
    if (!hasTheta) return null;
    if (isDimmed) return GREY_COLOR;
    if (isCompleted) return GREEN_COLOR;
    return accentColor;
  }, [hasTheta, isDimmed, isCompleted, accentColor]);

  // Label style for theta waypoints — shown on hover
  const thetaLabelStyle = useMemo(() => {
    if (!hasTheta || (!isHovered && !isActive) || !olLabel) return null;
    return new Style({
      geometry: new Point([x, y]),
      text: new Text({
        text: olLabel,
        font: 'bold 10px "Inter", sans-serif',
        fill: new Fill({ color: '#fff' }),
        backgroundFill: new Fill({ color: theme.unselectedAnnotationBackground }),
        padding: [2, 6, 2, 6],
        offsetY: -20,
      }),
    });
  }, [hasTheta, isHovered, isActive, olLabel, x, y, theme]);

  const entityKey = useMemo(() => JSON.stringify(entity || {}), [entity]);

  useEffect(() => {
    vectorSource.clear();
    if (x == null || y == null) return;

    if (hasTheta && pinFillColor) {
      // Waypoint with theta: circle-with-arrow rotated to face theta direction
      const scale = isHovered ? WAYPOINT_PIN_HOVER_SCALE : WAYPOINT_PIN_SCALE;
      const geom = waypointThetaPolygon();
      geom.rotate(theta, [0, 0]);
      geom.translate(x, y);
      geom.scale(scale);

      const pinFeature = createFeature(geom, `wptPin-${annotationId}-${entityKey}`, 0);
      pinFeature.set(FEATURE_PROPERTY_ANNOTATION_UNIQUE_ID, uniqueId);
      const styles = [markerStyle(pinFillColor, pinStrokeColor, 2)];
      if (thetaLabelStyle) styles.push(thetaLabelStyle);
      pinFeature.setStyle(styles);
      vectorSource.addFeature(pinFeature);
    } else {
      // Intermediate node: simple circle
      const iconFeature = createFeature(
        new Point([x, y]),
        `wptPoint-${annotationId}-${entityKey}`,
        0,
      );
      iconFeature.set(FEATURE_PROPERTY_ANNOTATION_UNIQUE_ID, uniqueId);
      iconFeature.setStyle(circleStyles);
      vectorSource.addFeature(iconFeature);
    }
  }, [x, y, theta, annotationId, entityKey, circleStyles, pinFillColor, pinStrokeColor, hasTheta, isHovered, isDimmed, isCompleted, vectorSource, thetaLabelStyle]);

  useEffect(() => {
    if (!map || !waypointLayer) return undefined;
    map.addLayer(waypointLayer);
    waypointLayer.setZIndex(10);
    waypointLayer.setOpacity(isGhost ? 0.4 : 1);
    return () => {
      map.removeLayer(waypointLayer);
    };
  }, [map, waypointLayer, isGhost]);

  useEffect(() => {
    if (!map || !waypointLayer || isGhost) return undefined;
    const pointerMoveFn = (evt) => {
      const hit = map.hasFeatureAtPixel(evt.pixel, {
        layerFilter: (l) => l === waypointLayer,
      });
      setIsHovered(Boolean(hit));
    };
    const viewport = map.getViewport();
    const pointerLeaveFn = () => setIsHovered(false);
    map.on('pointermove', pointerMoveFn);
    viewport.addEventListener('pointerleave', pointerLeaveFn);
    return () => {
      map.un('pointermove', pointerMoveFn);
      viewport.removeEventListener('pointerleave', pointerLeaveFn);
    };
  }, [map, waypointLayer, isGhost]);

  return (
    <>
      {(isSelected || isEditing) && (
        <AnchoredOverlayLayer x={x} y={y} z={10} sizeY={1}>
          <WaypointLabel
            waypoint={namedWaypoint}
            isSelected={isSelected}
            isGhost={isGhost}
            isEditing={isEditing}
            isMissionStep={hasMissionIndex}
          />
        </AnchoredOverlayLayer>
      )}
    </>
  );
};

NamedWaypointLayer.propTypes = {
  annotation: PropTypes.object,
  isSelected: PropTypes.bool,
  isGhost: PropTypes.bool,
  isEditing: PropTypes.bool,
  indexList: PropTypes.oneOfType([PropTypes.array, PropTypes.number]),
  activeWaypointIds: PropTypes.object, // Set of waypoint IDs in the active mission
  completedWaypointIds: PropTypes.object, // Set of waypoint IDs the robot has passed
};

export default NamedWaypointLayer;
export {
  FEATURE_PROPERTY_ANNOTATION_UNIQUE_ID
};
