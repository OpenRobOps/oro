/**
 * MissionRouteLayer — renders a single continuous corridor + center line
 * for the entire mission route.  Individual edge corridors are stitched
 * into one seamless polygon so there are no visible cuts at waypoints.
 *
 * Two visual states:
 *   - Completed portion → green corridor + solid center line
 *   - Pending portion   → blue corridor + dashed center line
 */
import React, { useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import VectorSource from 'ol/source/Vector';
import OlPolygon from 'ol/geom/Polygon';
import LineString from 'ol/geom/LineString';
import Feature from 'ol/Feature';
import { Fill, Stroke, Style } from 'ol/style';
import ReactVectorLayer from '../../RobotLayers/ReactVectorLayer';

// ── Pending (active mission, not yet traversed) ─────────────────────────────
const PENDING_CORRIDOR_STYLE = new Style({
  fill: new Fill({ color: 'rgba(200, 220, 245, 0.85)' }),
});
const PENDING_CENTER_STYLE = new Style({
  stroke: new Stroke({ color: 'rgba(25, 118, 210, 0.95)', width: 3, lineCap: 'round', lineJoin: 'round' }),
});
const PENDING_CENTER_DASHED_STYLE = new Style({
  stroke: new Stroke({ color: 'rgba(25, 118, 210, 0.95)', width: 3, lineCap: 'round', lineJoin: 'round', lineDash: [10, 8] }),
});

// ── Completed (robot already passed) ────────────────────────────────────────
const COMPLETED_CORRIDOR_STYLE = new Style({
  fill: new Fill({ color: 'rgba(200, 240, 200, 0.85)' }),
});
const COMPLETED_CENTER_STYLE = new Style({
  stroke: new Stroke({ color: 'rgba(46, 125, 50, 0.95)', width: 3, lineCap: 'round', lineJoin: 'round' }),
});
const COMPLETED_CENTER_DASHED_STYLE = new Style({
  stroke: new Stroke({ color: 'rgba(46, 125, 50, 0.95)', width: 3, lineCap: 'round', lineJoin: 'round', lineDash: [10, 8] }),
});

// ── Geometry helpers ────────────────────────────────────────────────────────

/** Perpendicular unit normal for a single segment from pts[i] to pts[i+1]. */
const segNormal = (pts, i) => {
  const dx = pts[i + 1][0] - pts[i][0];
  const dy = pts[i + 1][1] - pts[i][1];
  const len = Math.hypot(dx, dy) || 1;
  return [-dy / len, dx / len];
};

/** Extract the half-width for a single edge annotation. Returns 0 for edges without corridor. */
const edgeHalfWidth = (edgeAnn) => {
  if (!edgeAnn?.corridor) return 0;
  const c = edgeAnn.corridor;
  if (c.width != null) return c.width / 2;
  return ((c.leftWidth || 0) + (c.rightWidth || 0)) / 2;
};

/**
 * Build a corridor polygon with bevel joins at sharp corners.
 * `widthPairs` is a per-point array of {in, out} half-widths.
 * At junction points, `in` = incoming edge width, `out` = outgoing edge width,
 * so each edge maintains its own corridor width cleanly (no triangles).
 */
const buildCorridorFromPolyline = (pts, widthPairs) => {
  if (!pts || pts.length < 2) return null;

  const leftSide = [];
  const rightSide = [];

  for (let i = 0; i < pts.length; i++) {
    const px = pts[i][0];
    const py = pts[i][1];
    const wp = widthPairs[i];

    if (i === 0) {
      const [nx, ny] = segNormal(pts, 0);
      leftSide.push([px + nx * wp.out, py + ny * wp.out]);
      rightSide.push([px - nx * wp.out, py - ny * wp.out]);
    } else if (i === pts.length - 1) {
      const [nx, ny] = segNormal(pts, i - 1);
      leftSide.push([px + nx * wp.in, py + ny * wp.in]);
      rightSide.push([px - nx * wp.in, py - ny * wp.in]);
    } else {
      // Interior point: bevel with incoming/outgoing widths
      const [n1x, n1y] = segNormal(pts, i - 1);
      const [n2x, n2y] = segNormal(pts, i);
      leftSide.push([px + n1x * wp.in, py + n1y * wp.in]);
      leftSide.push([px + n2x * wp.out, py + n2y * wp.out]);
      rightSide.push([px - n1x * wp.in, py - n1y * wp.in]);
      rightSide.push([px - n2x * wp.out, py - n2y * wp.out]);
    }
  }

  const ring = [...leftSide, ...rightSide.reverse(), leftSide[0]];
  return new OlPolygon([ring]);
};

// Minimum corridor half-width for edges without corridor — keeps the polygon
// connected without visible width, avoids bowtie pinch artifacts.
const MIN_CORRIDOR_HW = 0.04;

/**
 * Stitch per-edge polylines into coords + per-point width pairs {in, out}.
 * At junction points between edges, `in` = previous edge's width,
 * `out` = next edge's width, so each edge keeps its own corridor width.
 */
function stitchPolylinesWithWidths(polylines, edgeAnnotations) {
  if (!polylines || polylines.length === 0) return { coords: null, widths: null };
  const coords = [];
  const widths = [];
  // Pre-compute per-edge half-widths
  const edgeHws = polylines.map((pl, i) => {
    const hw = (edgeAnnotations && edgeAnnotations[i])
      ? edgeHalfWidth(edgeAnnotations[i])
      : 0;
    return hw > 0 ? hw : MIN_CORRIDOR_HW;
  });
  polylines.forEach((pl, i) => {
    const hw = edgeHws[i];
    const isJunction = i > 0 && coords.length > 0;
    const start = isJunction ? 1 : 0;
    // At a junction, the first coord was already emitted by the previous edge.
    // Update its `out` width to this edge's width.
    if (isJunction && widths.length > 0) {
      widths[widths.length - 1].out = hw;
    }
    for (let j = start; j < pl.length; j++) {
      coords.push([pl[j].x, pl[j].y]);
      widths.push({ in: hw, out: hw });
    }
  });
  return coords.length >= 2 ? { coords, widths } : { coords: null, widths: null };
}

// ── Component ───────────────────────────────────────────────────────────────

const MissionRouteLayer = ({
  edgePolylines,
  edgeAnnotations,
  completedEdgeIds,
  missionEdgeIds,
  zIndex = 9,
}) => {
  const vectorSource = useMemo(() => new VectorSource(), []);

  useEffect(() => {
    vectorSource.clear();
    if (!edgePolylines || edgePolylines.length === 0 || !missionEdgeIds) return;

    // Count completed edges (in order from the start)
    let completedCount = 0;
    if (completedEdgeIds) {
      for (let i = 0; i < missionEdgeIds.length; i++) {
        if (completedEdgeIds.has(missionEdgeIds[i])) {
          completedCount = i + 1;
        } else {
          break;
        }
      }
    }

    // Pending (blue) corridor — seamless polygon with per-edge widths
    const { coords: allCoords, widths: allWidths } = stitchPolylinesWithWidths(
      edgePolylines, edgeAnnotations
    );
    if (allCoords) {
      const fullCorridorGeom = buildCorridorFromPolyline(allCoords, allWidths);
      if (fullCorridorGeom) {
        const f = new Feature(fullCorridorGeom);
        f.setStyle(PENDING_CORRIDOR_STYLE);
        vectorSource.addFeature(f);
      }
    }

    // Per-edge center lines — dashed for free-planning edges (no trajectory)
    edgePolylines.forEach((pl, i) => {
      if (!pl || pl.length < 2) return;
      const edgeCoords = pl.map((p) => [p.x, p.y]);
      // Prepend the last point of the previous edge so lines connect at junctions
      if (i > 0) {
        const prev = edgePolylines[i - 1];
        const lastPt = prev[prev.length - 1];
        edgeCoords.unshift([lastPt.x, lastPt.y]);
      }
      const isCompleted = i < completedCount;
      const isFreeplan = edgeAnnotations && edgeAnnotations[i]
        && !edgeAnnotations[i].trajectory;
      let style;
      if (isCompleted) {
        style = isFreeplan ? COMPLETED_CENTER_DASHED_STYLE : COMPLETED_CENTER_STYLE;
      } else {
        style = isFreeplan ? PENDING_CENTER_DASHED_STYLE : PENDING_CENTER_STYLE;
      }
      const f = new Feature(new LineString(edgeCoords));
      f.setStyle(style);
      vectorSource.addFeature(f);
    });

    // Overlay the completed (green) corridor on top
    if (completedCount > 0) {
      const { coords, widths } = stitchPolylinesWithWidths(
        edgePolylines.slice(0, completedCount),
        edgeAnnotations ? edgeAnnotations.slice(0, completedCount) : null,
      );
      if (coords) {
        const corridorGeom = buildCorridorFromPolyline(coords, widths);
        if (corridorGeom) {
          const f = new Feature(corridorGeom);
          f.setStyle(COMPLETED_CORRIDOR_STYLE);
          vectorSource.addFeature(f);
        }
      }
    }
  }, [edgePolylines, edgeAnnotations, completedEdgeIds, missionEdgeIds, vectorSource]);

  return <ReactVectorLayer source={vectorSource} zIndex={zIndex} />;
};

MissionRouteLayer.propTypes = {
  /** Per-edge polylines [{x,y}, …] in mission order */
  edgePolylines: PropTypes.array,
  /** Edge annotation objects (to derive corridor widths) */
  edgeAnnotations: PropTypes.array,
  /** Set of completed edge IDs */
  completedEdgeIds: PropTypes.object,
  /** Ordered array of mission edge IDs */
  missionEdgeIds: PropTypes.array,
  zIndex: PropTypes.number,
};

export default MissionRouteLayer;
