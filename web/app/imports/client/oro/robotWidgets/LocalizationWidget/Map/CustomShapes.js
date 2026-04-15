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

export {
  avatarArrowPolygon,
  createAvatarArrowPolygon,
  createRotationIndicatorPolygons,
  createAvatarBorderRing,
  avatarBorderRing,
  createSquarePolygon,
  THREE_QUARTER_CIRCLE,
  CIRCLE_POLYGON_SIDES,
  ANGLE_INCREMENT
};
