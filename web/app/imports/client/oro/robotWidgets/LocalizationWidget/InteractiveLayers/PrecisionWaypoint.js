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
 * Precision Waypoint (Stepwise navigation, precision teleop)
 *
 * Interactive layer that allows users to set a waypoint utilizing clicking
 * or teleop arrows.
 *
 * Subscribes to robot pose to continually update it's reference point
 *
 * TODO:
 * - Initial zoom when triggered
 * - Use proper icon that matches new design for the interaction control icon
 * - Style clean-up / proper styling
 */
import React, { useEffect, useContext, useMemo, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { makeStyles, withStyles } from 'tss-react/mui';
import VectorSource from 'ol/source/Vector';
import VectorLayer from 'ol/layer/Vector';
import Overlay from 'ol/Overlay';
import Feature from 'ol/Feature';
import Circle from 'ol/geom/Circle';
import LineString from 'ol/geom/LineString';
import { Stroke, Style } from 'ol/style';
import PointerInteraction from 'ol/interaction/Pointer';
import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableRow
} from '@mui/material';
// ORO modules
import theme from '../../../../Styles';
import { markerStyle, pathStyle } from '../Map/Styles';
import { getDistanceBetweenPoints, transformFeatures } from '../utils/geometry';
import { createFeature } from '../utils/utils';
import { waypointPolygon } from '../Map/CustomShapes';
import { createArrowFeature } from '../RobotLayers/RobotPoseLayer';
import { MapContext } from '../Map/Map';
import { useActiveInteraction } from '../../../contexts/ActiveInteractionContext';

// Constants that make this work
const FLIP_THRESHOLD_ANGLE = Math.PI / 4;
const FLIP_THRESHOLD_DISTANCE = 0.25;
const maxDistance = 2;

// Styles for the legend that shows current distance and angle
const useStyles = makeStyles()(theme => ({
  container: {
    position: 'absolute',
    backgroundColor: theme.palette.background.navMedium,
    color: theme.palette.text.contrastText,
    boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.5)',
    padding: '12px',
    borderRadius: '10px',
    border: 'none',
    // bottom and left make it so that the coordinate use on overlay.setPosition be
    // the point in the middle of the bottom edge of the legend
    bottom: '0px',
    left: '-60px',
    // Manually tuned width
    minWidth: '120px'
  }
}));

// Customized Material UI row component
const MyCell = withStyles(TableCell, {
  body: {
    color: 'inherit',
    padding: 0
  },
  root: {
    borderBottom: 'none'
  }
});

// Styles for the OpenLayer components

// Compass lines
const solidForwardLineStyle = pathStyle(theme.palette.teleop.completedPath, 3, false);
const dashedForwardLineStyle = pathStyle(theme.palette.teleop.completedPath, 2, true);
const solidBackwardsLineStyle = pathStyle(theme.palette.teleop.planedPath, 3, false);
const dashedBackwardsLineStyle = pathStyle(theme.palette.teleop.planedPath, 2, true);

/**
 * Function to create key features.
 * These will be cloned, translated and rotated with every render.
 */
const createFeatures = (frameRadius, posePreferences = {}) => {
  // Robot avatar, moves and rotates with user movement
  const avatarFeatures = [];
  // Waypoint marker, moves but doesn't rotate with user movement
  const waypointFeatures = [];
  // Circular control frame, doesn't move or rotate with user movement
  const frameFeatures = [];

  const { radius } = posePreferences;
  let feature = createArrowFeature({ color: theme.palette.teleop.waypointAvatar, radius });
  avatarFeatures.push(feature);

  feature = createFeature(waypointPolygon().clone(), 'waypointPolygon', 0);
  feature.setId('waypointFeature');
  feature.setStyle(markerStyle(theme.palette.teleop.completedPath, 'transparent', 1));
  waypointFeatures.push(feature);

  feature = new Feature(new Circle([0, 0], frameRadius));
  feature.setStyle(new Style({
    stroke: new Stroke({
      color: theme.palette.teleop.completedPath,
      width: 3
    })
  }));
  frameFeatures.push(feature);
  feature = new Feature(new Circle([0, 0], frameRadius + 0.03));
  feature.setStyle(new Style({
    stroke: new Stroke({
      color: theme.palette.teleopArrows.stepwise,
      width: 5
    })
  }));
  frameFeatures.push(feature);

  return { avatarFeatures, waypointFeatures, frameFeatures };
};

/**
 * returns { x, y } in map coordinates
 *
 * Distance and angle are in robot (initialPose) coordinates
 */
const coordsFromDistanceAngleAndInitialPose = (initialPose) => {
  const { x: x0, y: y0, theta } = initialPose;
  return (distance, angle) => ({
    x: distance * Math.cos(angle + theta) + x0,
    y: distance * Math.sin(angle + theta) + y0
  });
};

/**
 * Returns angle and distance with respect to the robot
 * given a x1, y1 in map coordinates,
 * and direction (forward = 1 or backwards = -1)
 */
const angleDistanceFromCoordsDirectionAndInitialPose = (initialPose) => {
  const { x: x0, y: y0, theta } = initialPose;
  return (x1, y1, direction) => {
    const x = x1 - x0;
    const y = y1 - y0;
    let distance = Math.sqrt((x ** 2) + (y ** 2));
    let angle = Math.atan2(y, x) - theta;
    if (direction < 0) {
      distance *= -1;
      angle += Math.PI;
    }
    while (angle > Math.PI) {
      angle -= 2 * Math.PI;
    }
    return ({ distance, angle });
  };
};

/**
 * distance and angle with respect to the robot's initialPose
 */
const renderControl = ({ source, overlay, allFeatures, initialPose }) => {
  // Pose where the robot currently is, before executing any precision teleop action
  const { x: x0, y: y0, theta } = initialPose;

  // Bind translation function for this value of the initial pose
  const coordsFromDistanceAngle = coordsFromDistanceAngleAndInitialPose(initialPose);

  // The frame doesn't change unless the initialPose changes, so we can transform it
  // only once and then re-use it with every mouse movement below
  const { frameFeatures } = allFeatures;
  const renderedFrameFeatures = transformFeatures(
    frameFeatures.map(f => f.clone()),
    { x: x0, y: y0 }
  );

  return (angle, distance) => {
    const { avatarFeatures, waypointFeatures } = allFeatures;
    // Current robot avatar position in map coordinates
    const { x: x1, y: y1 } = coordsFromDistanceAngle(distance, angle);
    // Point at both ends of the circle frame
    const { x: x2, y: y2 } = coordsFromDistanceAngle(maxDistance, angle);
    const { x: x3, y: y3 } = coordsFromDistanceAngle(-maxDistance, angle);

    // Re-render
    source.clear();

    // Bounding circle
    source.addFeatures(renderedFrameFeatures);

    // Robot avatar, move and translate to new position
    source.addFeatures(transformFeatures(
      avatarFeatures.map(f => f.clone()),
      { x: x1, y: y1, theta: angle + theta }
    ));

    // Waypoint, move but don't rotate, it's always standing upwards
    source.addFeatures(transformFeatures(
      waypointFeatures.map(f => f.clone()),
      { x: x1, y: y1 }
    ));

    // Label overlay, position one meter above the waypoint marker
    overlay.setPosition([x1, y1 + 1]);

    // Solid line between center and robot
    let feature = new Feature(new LineString([[x0, y0], [x1, y1]]));
    feature.setStyle(distance > 0 ? solidForwardLineStyle : solidBackwardsLineStyle);
    source.addFeature(feature);

    // Dashed line until forward end of circle
    let startPoint = distance > 0 ? [x1, y1] : [x0, y0];
    feature = new Feature(new LineString([startPoint, [x2, y2]]));
    feature.setStyle(dashedForwardLineStyle);
    source.addFeature(feature);

    // Dashed line until backwards end of circle
    startPoint = distance > 0 ? [x0, y0] : [x1, y1];
    feature = new Feature(new LineString([startPoint, [x3, y3]]));
    feature.setStyle(dashedBackwardsLineStyle);
    source.addFeature(feature);
  };
};

const PrecisionWaypoint = ({ robotLocalizationData = {}, uiPreferences = {} }) => {
  const { classes } = useStyles();
  const { robotPose: initialPose = {} } = robotLocalizationData;
  const { map } = useContext(MapContext);
  const { data, setInteractionData } = useActiveInteraction();

  const posePreferences = uiPreferences.map && uiPreferences.map.pose;

  // Keep track of when the user is in the middle of a drag operation to avoid
  // re-renders in the middle of a drag.
  // When cursorDelta is undefined, there is no drag operation going on.
  const cursorDelta = useRef();

  // Sync with angle and distance from app-wide active interaction context
  const { angle: contextAngle = 0, distance: contextDistance = 0 } = data || {};

  // -------------------------------------------------
  // Persistent things that almost never change
  // -------------------------------------------------

  // Create features to be used for rendering
  const allFeatures = useMemo(() => createFeatures(maxDistance, posePreferences), []);

  // Source and interaction objects
  const { source, precisionInteraction, overlay } = useMemo(() => ({
    source: new VectorSource(),
    precisionInteraction: new PointerInteraction(),
    overlay: new Overlay({})
  }), []);

  // Hooking of source, interaction and layer with OL map
  useEffect(() => {
    if (!map) return undefined;

    const layer = new VectorLayer({
      name: 'interactionLayer',
      source,
    });

    // Add layer and interactions to the map
    map.addLayer(layer);
    map.addOverlay(overlay);
    layer.setZIndex(1000);
    // The order of the interactions is important: the last one will be triggered first
    map.getInteractions().extend([precisionInteraction]);

    // clean up the component once unmounted
    return () => {
      if (map) {
        map.removeInteraction(precisionInteraction);
        map.removeOverlay(overlay);
        map.removeLayer(layer);
      }
    };
  }, [map, source, precisionInteraction]);

  // -------------------------------------------------
  // Things that depend on the initial pose and some of the elements above that change less often
  // -------------------------------------------------
  const coordsFromDistanceAngle = useCallback(
    coordsFromDistanceAngleAndInitialPose(initialPose),
    [initialPose]
  );
  const angleDistanceFromCoordsDirection = useCallback(
    angleDistanceFromCoordsDirectionAndInitialPose(initialPose),
    [initialPose]
  );
  const render = useCallback(
    renderControl({ source, overlay, allFeatures, initialPose }),
    [source, initialPose]
  );

  // Main function body. Will refresh each time the robot pose changes or if the angle and distance
  // is updated by an external component
  useEffect(() => {
    // If cursorDelta has some value, we're in the middle of a drag operation, avoid
    // changing anything until the user releases the mouse.
    if (cursorDelta.current !== undefined) {
      return;
    }

    let distance = contextDistance;
    let angle = contextAngle;

    // HACK: This logic enforces the maxDistance limit in case another object changes it beyond
    // the limit
    if (Math.abs(distance) > maxDistance) {
      distance = Math.sign(distance) * Math.min(Math.abs(distance), maxDistance);
      setInteractionData({ distance, angle });
    }

    // Render at the initial position, and updated positions when initialPose or
    // context distance or angle change
    render(angle, distance);

    precisionInteraction.handleDownEvent = (evt) => {
      // Accept interaction start when the cursor is 0.5 from the current avatar location.
      const [x, y] = evt.coordinate;
      const { x: curX, y: curY } = coordsFromDistanceAngle(distance, angle);
      if (getDistanceBetweenPoints([x, y], [curX, curY]) > 0.5) {
        return false;
      }

      // Keep track and use the offset of the event point vs. where the current
      // interaction is
      cursorDelta.current = { x: x - curX, y: y - curY };

      return true;
    };

    precisionInteraction.handleDragEvent = (evt) => {
      const [evtX, evtY] = evt.coordinate;

      // Correct location where the avatar is being moved
      const x = evtX - cursorDelta.current.x;
      const y = evtY - cursorDelta.current.y;

      const {
        distance: newDistance,
        angle: newAngle
      } = angleDistanceFromCoordsDirection(x, y, Math.sign(distance));

      // If the recent drag resulted in a sudden change of angle, most likely we just
      // went through the center, especially if the value of distance is low, so perform
      // a change in direction
      if (Math.abs(angle - newAngle) > FLIP_THRESHOLD_ANGLE
        && Math.abs(distance) < FLIP_THRESHOLD_DISTANCE) {
        ({ distance, angle } = angleDistanceFromCoordsDirection(x, y, -1 * Math.sign(distance)));
      } else {
        distance = newDistance;
        angle = newAngle;
      }

      // Cap maximum distance
      distance = Math.sign(distance) * Math.min(Math.abs(distance), maxDistance);

      render(angle, distance);
    };

    precisionInteraction.handleUpEvent = () => {
      setInteractionData({ distance, angle });
      cursorDelta.current = undefined;
      return true;
    };
  }, [contextAngle, contextDistance, initialPose]);

  // Use React and MaterialUI to render the current value legend.
  // This is grabbed and used by the Overlay to place in the proper location within the map.
  // NOTE: We must wrap the element used by the Overlay in an outer DOM element,
  // otherwise React will crash during unmount.
  return (
    <div key="stepwiseLabel" style={{ display: 'none' }}>
      <Paper
        ref={div => overlay.setElement(div)}
        className={classes.container}
      >
        <Table>
          <TableBody>
            <TableRow>
              <MyCell>Distance</MyCell>
              <MyCell align="right">
                {contextDistance.toFixed(2)}
              </MyCell>
              <MyCell>m</MyCell>
            </TableRow>
            <TableRow>
              <MyCell>Angle</MyCell>
              <MyCell align="right">
                {Math.round(contextAngle / Math.PI * 180)}
              </MyCell>
              <MyCell>°</MyCell>
            </TableRow>
          </TableBody>
        </Table>
      </Paper>
    </div>
  );
};

PrecisionWaypoint.propTypes = {
  robotLocalizationData: PropTypes.object,
  uiPreferences: PropTypes.object
};

export default PrecisionWaypoint;
