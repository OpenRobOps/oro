/**
 * Contains the custom OpenLayers shapes used in the map
 */
import Polygon from 'ol/geom/Polygon';
import Circle from 'ol/geom/Circle';
import MultiLineString from 'ol/geom/MultiLineString';

/**
 * Precision on which the "circles" are going be to drawn,
 * Since the OpenLayers library does not provide a way to draw circle sections or arches.
 * The code needs to do it manually by drawing a Polygon of CIRCLE_POLYGON_SIDES edges
 * to simulate a circle
 */
const CIRCLE_POLYGON_SIDES = 128;

/**
 * A full circle in radians
 */
const FULL_CIRCLE = 2 * Math.PI;

/**
 * Represents three quarter parts of a circumference
 */
const THREE_QUARTER_CIRCLE = (CIRCLE_POLYGON_SIDES * 3) / 4;

/**
 * Angle increment expressed in radians
 */
const ANGLE_INCREMENT = FULL_CIRCLE / CIRCLE_POLYGON_SIDES;

// Baseline for the avatar size using the radius
const AVATAR_BORDER_RADIUS = 0.45;

// Height of the waypoint indicator
const WAYPOINT_HEIGHT = 0.5;

// Radius of the waypoint cone
const WAYPOINT_RADIUS = 0.2;

// Radius of the inner circle of the waypoint cone marker
const WAYPOINT_INNER_RADIUS = 0.1;

// Radius of the theta-aware waypoint marker circle
const THETA_MARKER_RADIUS = 0.15;

// How far the arrow tip extends beyond the circle edge
const THETA_ARROW_LENGTH = 0.12;

// Half of the angular gap on the circle where the arrow emerges (radians)
const THETA_ARROW_HALF_GAP = Math.PI / 6;

/**
 * Creates a circle used to decorate the border ring of the robot pose avatar
 */
const createAvatarBorderRing = (radius = AVATAR_BORDER_RADIUS) => (
  new Circle([0, 0], radius)
);

/**
 * Pre-created border ring
 */
const avatarBorderRing = createAvatarBorderRing();

/**
 * Creates a polygon with the shape of an arrow aiming to the right of the screen
 */
const createAvatarArrowPolygon = (radius = AVATAR_BORDER_RADIUS) => (
  new Polygon([
    [
      [radius, 0],
      [-radius / 2, -radius * 0.866],
      [-radius * 0.01, 0],
      [-radius / 2, radius * 0.866]
    ]
  ])
);

/**
 * Helper function for createRotationIndicatorPolygon.
 * Creates a polygon imitating an arc in a circle with `radius`, drawn between angles
 * `angleFrom` and `angleTo`.
 * Note that Openlayers does not implement arcs, so this is imitated using chords with small
 * angle increments.
 *
 * @return an array of points (each a 2-element array)
 */
const calculateArcPoints = (angleFrom, angleTo, radius) => {
  const angleIncrement = Math.PI / 64;
  const points = [];
  let angle;
  for (angle = angleFrom; angle < angleTo; angle += angleIncrement) {
    points.push([radius * Math.cos(angle), radius * Math.sin(angle)]);
  }
  // last point needs to end exactly at `angleTo`
  points.push([radius * Math.cos(angleTo), radius * Math.sin(angleTo)]);
  return points;
};

/**
 * Helper function for createRotationIndicatorPolygon. It calculates the coordinates of a polyline
 * for the head of an arrow, drawn over an arc of a circle with `radius` and ending at `angle`
 *
 * @return an array of points (each a 2-element array)
 */
const calculateArcArrowHeadPoints = (angle, radius) => {
  // Opening of the arrow head lines (any constant around PI/4 "looks like" an arrow)
  const arrowHeadAngle = Math.PI / 3;
  // Size of the arrow head - proportional to the circle radius
  const arrowSize = radius / 4;
  // Calculate point of the arc where the arrow would end (the arc is drawn elsewhere)
  const x = radius * Math.cos(angle);
  const y = radius * Math.sin(angle);
  // Calculate the angle of the tangent to the circle in that given point
  // Note that while mathematically correct, drawing the arrow head pointing to the tangent looks
  // a bit odd (the arc almost touches the inner arrow line) so we add a small offset to
  // point it outwards
  const tangent = -Math.PI / 2 + angle - 0.1;
  // the two angles of arrow head lines, to the left and right of the tangent
  const a0 = tangent - arrowHeadAngle / 2;
  const a1 = tangent + arrowHeadAngle / 2;
  // Coordinates for the two points to connect with (x, y)
  const p1 = [x + Math.cos(a0) * arrowSize, y + Math.sin(a0) * arrowSize];
  const p2 = [x + Math.cos(a1) * arrowSize, y + Math.sin(a1) * arrowSize];
  // Finally connect the three points
  return [p1, [x, y], p2];
};

/**
 * Creates polygons to draw the indicator for an object that can be rotated.
 *
 * It draws two arc-shaped arrows over a circle slightly larger than`radius`.
 *
 * The first polygon are the two arcs (a multiline), and the second element are the arrow heads.
 * They are returned separately so they can be styled differently (e.g. dotted line for the arc,
 * and continuous line for the arrow head)
 *
 * @returns An array with two element: The arcs first, then the arrow heads.
 */
const createRotationIndicatorPolygons = (radius = AVATAR_BORDER_RADIUS) => {
  radius *= 1.3;
  const angleFrom = 0.30 * Math.PI;
  const angleTo = 0.70 * Math.PI;
  // Create two arcs (we could create more two; this design just looks good)
  const arc1 = calculateArcPoints(angleFrom, angleTo, radius);
  const arc2 = calculateArcPoints(angleFrom + Math.PI, angleTo + Math.PI, radius);
  // Create the arrow heads for each arc
  const arrow1 = calculateArcArrowHeadPoints(angleTo, radius);
  const arrow2 = calculateArcArrowHeadPoints(angleTo + Math.PI, radius);
  // Return these lines combined as MultiLineStrings, two different objects to get different styles
  return [
    new MultiLineString([arc1, arc2]),
    new MultiLineString([arrow1, arrow2])
  ];
};

/**
 * Pre-created arrow polygon with default size
 */
const avatarArrowPolygon = createAvatarArrowPolygon();

/**
 * Creates square polygons based on the size passed as a parameter
 */
const createSquarePolygon = halfSize => new Polygon([[
  [-halfSize, halfSize],
  [halfSize, halfSize],
  [halfSize, -halfSize],
  [-halfSize, -halfSize]]
]);

/**
 * Creates the waypoint indicator cone as a Polygon with a circle in the middle
 */
const waypointPolygon = () => {
  // Draws the first line from the origin (0,0) to the the top left beginning of the cone
  const points = [[0, 0], [-WAYPOINT_RADIUS, WAYPOINT_HEIGHT]];

  // Draws the cone arc as a half a circle
  for (let i = 1; i <= CIRCLE_POLYGON_SIDES / 2; i++) {
    points.push([
      Math.cos(ANGLE_INCREMENT * i) * -WAYPOINT_RADIUS,
      WAYPOINT_HEIGHT + (Math.sin(ANGLE_INCREMENT * i) * WAYPOINT_RADIUS)
    ]);
  }

  // Draws the inner circle of the waypoint marker
  let i = 0;
  for (; i <= CIRCLE_POLYGON_SIDES; i++) {
    points.push([
      Math.cos(ANGLE_INCREMENT * i) * WAYPOINT_INNER_RADIUS,
      WAYPOINT_HEIGHT + (Math.sin(ANGLE_INCREMENT * i) * WAYPOINT_INNER_RADIUS)
    ]);
  }
  i--;
  points.push([
    Math.cos(ANGLE_INCREMENT * i) * WAYPOINT_RADIUS,
    WAYPOINT_HEIGHT + (Math.sin(ANGLE_INCREMENT * i) * WAYPOINT_RADIUS)
  ]);

  return new Polygon([points]);
};

/**
 * Creates a circle-with-arrow marker for waypoints that have theta.
 * The arrow points along the positive X axis (theta = 0); callers rotate by theta.
 * Shape: a filled circle with a triangular pointer emerging from the right side.
 */
const waypointThetaPolygon = () => {
  const r = THETA_MARKER_RADIUS;
  const innerR = r * 0.5;
  const tipX = r + THETA_ARROW_LENGTH;
  const gap = THETA_ARROW_HALF_GAP;
  const points = [];

  // Trace the outer circle from the top edge of the arrow gap, counter-clockwise
  // all the way around to the bottom edge of the gap (≈300° of arc)
  const startAngle = gap;
  const endAngle = FULL_CIRCLE - gap;
  for (let a = startAngle; a <= endAngle; a += ANGLE_INCREMENT) {
    points.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  // Ensure we land exactly at the bottom edge of the gap
  points.push([r * Math.cos(endAngle), r * Math.sin(endAngle)]);

  // Arrow tip extending to the right
  points.push([tipX, 0]);

  // Close back to start of outer circle
  points.push([r * Math.cos(startAngle), r * Math.sin(startAngle)]);

  // Inner circle as a separate ring — wound clockwise to create a transparent hole
  const innerRing = [];
  for (let a = CIRCLE_POLYGON_SIDES; a >= 0; a--) {
    innerRing.push([
      Math.cos(ANGLE_INCREMENT * a) * innerR,
      Math.sin(ANGLE_INCREMENT * a) * innerR
    ]);
  }

  return new Polygon([points, innerRing]);
};

export {
  avatarArrowPolygon,
  createAvatarArrowPolygon,
  createRotationIndicatorPolygons,
  waypointPolygon,
  waypointThetaPolygon,
  createAvatarBorderRing,
  avatarBorderRing,
  createSquarePolygon,
  THREE_QUARTER_CIRCLE,
  CIRCLE_POLYGON_SIDES,
  ANGLE_INCREMENT
};
