/**
 * OpenLayers Style[] for circle waypoint markers.
 * Shared by Localization named waypoints and the Edges editor (WaypointMarkerLayer).
 */
import { Fill, Stroke, Style, Circle as CircleStyle, Text } from 'ol/style';

/**
 * @param {object} opts
 * @param {object} opts.theme MUI theme (semantic annotation colors on root)
 * @param {string} [opts.label]
 * @param {boolean} [opts.isHovered]
 * @param {boolean} [opts.isActive] selected, editing, or explicit endpoint/route state
 * @param {boolean} [opts.isRoute] use route / mission accent (blue)
 * @param {string} [opts.badgeText] optional text inside the circle (e.g. "1", "2", step index)
 * @param {boolean} [opts.alwaysShowLabel] if true, show map label whenever `label` is set
 *   (localization map); else hover/active only (edges editor)
 */
export function makeWaypointCircleStyles({
  theme,
  label = '',
  isHovered = false,
  isActive = false,
  isRoute = false,
  badgeText = '',
  alwaysShowLabel = false,
  overrideColor = null,
}) {
  const showHoverEffect = isHovered && !isActive;
  /* eslint-disable no-nested-ternary */
  const radius = isActive ? 11 : (showHoverEffect ? 10 : 8);
  const fontSize = isActive ? 11 : (showHoverEffect ? 10 : 9);
  const strokeWidth = isActive ? 3 : (showHoverEffect ? 2.5 : 2);
  /* eslint-enable no-nested-ternary */

  const fillColor = overrideColor || (isActive || showHoverEffect
    ? (isRoute ? '#1565c0' : theme.selectedAnnotationBackground)
    : theme.unselectedAnnotationBackground);
  const borderColor = overrideColor || (isRoute ? '#1565c0' : theme.selectedAnnotationBackground);

  return [
    new Style({
      image: new CircleStyle({
        radius,
        fill: new Fill({ color: fillColor }),
        stroke: new Stroke({ color: borderColor, width: strokeWidth }),
      }),
      text: badgeText
        ? new Text({
          text: badgeText,
          font: `bold ${fontSize}px "Inter", sans-serif`,
          fill: new Fill({ color: '#fff' }),
          offsetX: 0,
          offsetY: 0,
        })
        : undefined,
    }),
    new Style({
      text: new Text({
        text: (alwaysShowLabel || isActive || isHovered) ? (label || '') : '',
        font: `bold ${fontSize}px "Inter", sans-serif`,
        fill: new Fill({ color: theme.selectedAnnotationLabel }),
        backgroundFill: new Fill({
          color: theme.unselectedAnnotationBackground,
        }),
        padding: [2, 6, 2, 6],
        offsetY: isActive ? -22 : (showHoverEffect ? -20 : -18),
      }),
    }),
  ];
}
